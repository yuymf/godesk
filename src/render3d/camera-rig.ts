/**
 * G3D-JUDGE-PIECES · camera auto-framing, turn modes, zoom / orbit clamps.
 *
 * Pure helpers (unit-tested) + `CameraDirector`, the imperative glue that
 * drives the PerspectiveCamera / OrbitControls through MotionController so
 * every automatic move is a logged 600 ms "camera" tween (reduced motion → 0).
 *
 * Modes (settlecoast-like table feel, own implementation):
 * - "play": tilted 3/4 view while the local player acts
 * - "overview": near top-down while AI / opponents act
 */
import { MOUSE, TOUCH, type PerspectiveCamera } from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { MotionController } from "./motion";
import { TILE_RADIUS } from "./tokens";

export type V3 = readonly [number, number, number];
export type CameraMode = "play" | "overview";

export const CAMERA_MODE_POLAR_DEG: Readonly<Record<CameraMode, number>> = { play: 50, overview: 9 };
/** Zoom is relative to the fitted distance: 1 = whole island (+ tray) in view. */
export const ZOOM_LIMITS = { min: 0.7, max: 3.2 } as const;
export const ZOOM_STEP = 1.25;
export const ROTATE_STEP_DEG = 45;
export const POLAR_LIMITS_DEG = { min: 0, max: 64 } as const;
/** Viewport fraction (NDC) the framed points may occupy. */
export const FRAME_MARGIN = 0.93;
const DEG = Math.PI / 180;
/**
 * Half extent of the square tide-water plane (`water/mesh.ts` WATER_HALF_EXTENT,
 * unit-tested to stay in sync; not imported so the water chunk stays lazy).
 * Beyond it the beige sky dome shows, so automatic framing keeps every frustum
 * corner on the sea, `SEA_EDGE_PAD` inside the edge.
 */
export const SEA_HALF_EXTENT = 9;
export const SEA_EDGE_PAD = 0.3;
/** Play mode may flatten toward top-down to keep the sky out, but not below this. */
export const PLAY_MIN_POLAR_DEG = 18;

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(Math.max(zoom, ZOOM_LIMITS.min), ZOOM_LIMITS.max);
}

export function zoomPercent(zoom: number): number {
  return Math.round(zoom * 100);
}

/** Camera offset from the orbit target (y-up, azimuth 0 looks from +Z). */
export function orbitOffset(distance: number, polar: number, azimuth: number): V3 {
  const s = Math.sin(polar);
  return [distance * s * Math.sin(azimuth), distance * Math.cos(polar), distance * s * Math.cos(azimuth)];
}

/**
 * Smallest camera distance (target-relative orbit) at which every point lies
 * inside `margin` of the viewport. Closed form per point:
 *   D ≥ q·d + max(|q·r| / (m·tanH), |q·u| / (m·tanV))
 * where d = view direction (target → camera), r = right, u = up.
 */
export function fitDistance(
  points: readonly V3[],
  target: V3,
  polar: number,
  azimuth: number,
  fovDeg: number,
  aspect: number,
  margin = FRAME_MARGIN,
): number {
  const tanV = Math.tan((fovDeg * DEG) / 2) * margin;
  const tanH = tanV * Math.max(aspect, 1e-3);
  const sp = Math.sin(polar);
  const cp = Math.cos(polar);
  const d: V3 = [sp * Math.sin(azimuth), cp, sp * Math.cos(azimuth)];
  const r: V3 = [Math.cos(azimuth), 0, -Math.sin(azimuth)];
  // u = r × (−d)  (camera up, orthogonal to r and d)
  const f: V3 = [-d[0], -d[1], -d[2]];
  const u: V3 = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  let best = 0.5;
  for (const p of points) {
    const q: V3 = [p[0] - target[0], p[1] - target[1], p[2] - target[2]];
    const qd = q[0] * d[0] + q[1] * d[1] + q[2] * d[2];
    const qr = q[0] * r[0] + q[1] * r[1] + q[2] * r[2];
    const qu = q[0] * u[0] + q[1] * u[1] + q[2] * u[2];
    best = Math.max(best, qd + Math.max(Math.abs(qr) / tanH, Math.abs(qu) / tanV));
  }
  return best;
}

/** Camera basis for an orbit pose: d = target → camera, r = right, u = up. */
function orbitBasis(polar: number, azimuth: number): { d: V3; r: V3; u: V3 } {
  const sp = Math.sin(polar);
  const cp = Math.cos(polar);
  const d: V3 = [sp * Math.sin(azimuth), cp, sp * Math.cos(azimuth)];
  const r: V3 = [Math.cos(azimuth), 0, -Math.sin(azimuth)];
  const u: V3 = [
    r[1] * -d[2] - r[2] * -d[1],
    r[2] * -d[0] - r[0] * -d[2],
    r[0] * -d[1] - r[1] * -d[0],
  ];
  return { d, r, u };
}

/**
 * Largest orbit distance at which all four frustum corners still land on the
 * sea square (|x|, |z| ≤ half). The target sits on the sea plane, so the
 * footprint scales linearly with distance: closed form per corner and axis.
 * 0 when a corner ray never reaches the sea (horizon in view).
 */
export function maxSeaDistance(
  target: V3,
  polar: number,
  azimuth: number,
  fovDeg: number,
  aspect: number,
  half = SEA_HALF_EXTENT - SEA_EDGE_PAD,
): number {
  const { d, r, u } = orbitBasis(polar, azimuth);
  const tanV = Math.tan((fovDeg * DEG) / 2);
  const tanH = tanV * Math.max(aspect, 1e-3);
  if (Math.abs(target[0]) >= half || Math.abs(target[2]) >= half) return 0;
  let best = Number.POSITIVE_INFINITY;
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const ray: V3 = [
        -d[0] + sx * tanH * r[0] + sy * tanV * u[0],
        -d[1] + sx * tanH * r[1] + sy * tanV * u[1],
        -d[2] + sx * tanH * r[2] + sy * tanV * u[2],
      ];
      if (ray[1] >= -1e-6) return 0;
      // Unit distance: camera at d, hit = d + t·ray with d.y + t·ray.y = 0.
      const t = d[1] / -ray[1];
      const hx = d[0] + t * ray[0];
      const hz = d[2] + t * ray[2];
      for (const [h, c] of [[hx, target[0]], [hz, target[2]]] as const) {
        if (Math.abs(h) < 1e-9) continue;
        best = Math.min(best, (half - Math.sign(h) * c) / Math.abs(h));
      }
    }
  }
  return best;
}

/** Steepest polar (≤ `from`) at which `distance` keeps the frame on the sea; `floor` if none. */
export function maxSeaPolar(
  target: V3,
  distance: number,
  azimuth: number,
  fovDeg: number,
  aspect: number,
  from: number,
  floor = 0,
  half = SEA_HALF_EXTENT - SEA_EDGE_PAD,
): number {
  const max = (polar: number) => maxSeaDistance(target, polar, azimuth, fovDeg, aspect, half);
  if (max(from) >= distance) return from;
  let lo = floor;
  let hi = from;
  if (max(lo) < distance) return floor;
  for (let i = 0; i < 18; i += 1) {
    const mid = (lo + hi) / 2;
    if (max(mid) >= distance) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Keep-in-frame margin for the must-see points (tiles) when the sea forces a crop. */
export const KEEP_MARGIN = 1;

/**
 * Zoom-1 pose that frames `points` (island + harbours) for a preferred polar
 * while keeping the sky out: first flatten the tilt (down to `minPolar`), then
 * move in, cropping the outer ring (harbours) but never `keepPoints` (tiles).
 * If even that cannot hide the sea edge: `hard` (AI / top-down framing) stays
 * sky-free and crops the island edge; otherwise (own turn) the whole island
 * stays in frame and `safe` is false (very wide canvases until the sea grows).
 */
export function seaSafeFraming(
  points: readonly V3[],
  keepPoints: readonly V3[],
  target: V3,
  preferredPolar: number,
  minPolar: number,
  azimuth: number,
  fovDeg: number,
  aspect: number,
  half = SEA_HALF_EXTENT - SEA_EDGE_PAD,
  hard = false,
): { polar: number; distance: number; fit: number; safe: boolean } {
  let polar = preferredPolar;
  for (;;) {
    const fit = fitDistance(points, target, polar, azimuth, fovDeg, aspect);
    const max = maxSeaDistance(target, polar, azimuth, fovDeg, aspect, half);
    if (fit <= max) return { polar, distance: fit, fit, safe: true };
    if (polar <= minPolar + 1e-6) {
      const keep = keepPoints.length > 0 ? fitDistance(keepPoints, target, polar, azimuth, fovDeg, aspect, KEEP_MARGIN) : fit;
      if (keep <= max) return { polar, distance: max, fit, safe: true };
      if (hard && max > 0.5) return { polar, distance: max, fit, safe: true };
      return { polar, distance: Math.min(fit, keep), fit, safe: false };
    }
    polar = Math.max(minPolar, polar - 2 * DEG);
  }
}

/**
 * Own-turn framing: keep the 3/4 tilt (≥ 18°) when the sea covers the frame; on canvases too wide
 * for the sea at that tilt, flatten further (down to top-down) rather than show the sky dome, as
 * long as every tile still fits. Only when even that fails is the ≥ 18° (sky-at-corners) pose used.
 */
export function playFraming(
  points: readonly V3[],
  keepPoints: readonly V3[],
  target: V3,
  preferredPolar: number,
  azimuth: number,
  fovDeg: number,
  aspect: number,
  half = SEA_HALF_EXTENT - SEA_EDGE_PAD,
): { polar: number; distance: number; fit: number; safe: boolean } {
  const tilted = seaSafeFraming(points, keepPoints, target, preferredPolar, PLAY_MIN_POLAR_DEG * DEG, azimuth, fovDeg, aspect, half);
  if (tilted.safe) return tilted;
  const flat = seaSafeFraming(points, keepPoints, target, tilted.polar, 0, azimuth, fovDeg, aspect, half);
  return flat.safe ? flat : tilted;
}

type FramingNode = {
  kind: string;
  position: readonly [number, number, number];
  rotationY?: number;
};

/**
 * Points that must stay in frame: every tile's hex corners at tile-top height
 * and the harbour markers. Ships may bleed past the edge; the dice tray is a
 * screen-corner overlay (dice-overlay.ts), not part of the world framing.
 */
export function framingPoints(nodes: readonly FramingNode[]): V3[] {
  const out: V3[] = [];
  for (const node of nodes) {
    const [x, y, z] = node.position;
    if (node.kind === "tile") {
      for (let i = 0; i < 6; i += 1) {
        const a = (Math.PI / 3) * i;
        out.push([x + Math.cos(a) * TILE_RADIUS, y + 0.28, z + Math.sin(a) * TILE_RADIUS]);
      }
    } else if (node.kind === "port") {
      out.push([x + 0.25, y + 0.1, z + 0.25], [x - 0.25, y + 0.1, z - 0.25]);
    }
  }
  return out;
}

/** Island centre (tile centroid, y = 0) and radius for pan clamping. */
export function islandCenter(nodes: readonly FramingNode[]): { center: V3; radius: number } {
  const tiles = nodes.filter((node) => node.kind === "tile");
  if (tiles.length === 0) return { center: [0, 0, 0], radius: 4 };
  let cx = 0;
  let cz = 0;
  for (const tile of tiles) {
    cx += tile.position[0];
    cz += tile.position[2];
  }
  cx /= tiles.length;
  cz /= tiles.length;
  let radius = 0;
  for (const tile of tiles) radius = Math.max(radius, Math.hypot(tile.position[0] - cx, tile.position[2] - cz));
  return { center: [cx, 0, cz], radius: radius + TILE_RADIUS };
}

/** Keep the orbit target within `maxOffset` of the island centre (xz), on the table plane. */
export function clampTarget(target: V3, center: V3, maxOffset: number): V3 {
  const dx = target[0] - center[0];
  const dz = target[2] - center[2];
  const len = Math.hypot(dx, dz);
  if (len <= maxOffset) return [target[0], center[1], target[2]];
  const k = maxOffset / len;
  return [center[0] + dx * k, center[1], center[2] + dz * k];
}

/** Local player acting → tilted "play"; anyone else (AI / opponent) → top-down "overview". */
export function cameraModeFor(localSeat: number | null | undefined, activeSeat: number | null | undefined): CameraMode {
  if (localSeat === null || localSeat === undefined) return "play";
  if (activeSeat === null || activeSeat === undefined) return "play";
  return localSeat === activeSeat ? "play" : "overview";
}

/** Shortest signed angle from a to b. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export type CameraRigState = {
  mode: CameraMode;
  zoom: number;
  zoomPercent: number;
  minZoom: number;
  maxZoom: number;
  azimuthDeg: number;
  /** Left-drag / one-finger drag pans instead of orbiting. */
  panMode: boolean;
  /** An island tour is playing. */
  touring: boolean;
};

/** Small API for the on-canvas toolbar (and Track B's HUD, if it wants its own controls). */
export type CameraRigApi = {
  zoomIn(): void;
  zoomOut(): void;
  setZoom(zoom: number): void;
  rotate(direction: 1 | -1): void;
  reset(): void;
  /** Toggle drag-to-pan (mouse left button / one finger). */
  setPanMode(on: boolean): void;
  /** Near top-down framing of the whole coastline with every harbour. */
  showHarbors(): void;
  /** Slow orbit around the island; any user input or API call stops it. */
  tour(): void;
  getState(): CameraRigState;
  subscribe(listener: (state: CameraRigState) => void): () => void;
};

type Pose = { target: V3; distance: number; polar: number; azimuth: number };

/** Island tour: azimuth steps (deg), leg duration, tilt and zoom. */
export const TOUR = { stepsDeg: [60, 120, 180, 240, 300, 360], legMs: 1100, polarDeg: 40, zoom: 1.3 } as const;

export class CameraDirector implements CameraRigApi {
  mode: CameraMode = "play";
  private zoom = 1;
  private azimuth = 0;
  private points: V3[] = [];
  /** Tile corners: never cropped by the sea clamp on the player's own turn. */
  private keepPoints: V3[] = [];
  private center: V3 = [0, 0, 0];
  private radius = 4;
  /** Fitted distance for the current mode polar (zoom-relative readout). */
  private fit = 12;
  /** Zoom-1 distance after the sea clamp (≤ fit when the outer ring is cropped). */
  private base = 12;
  /** Polar for the current mode after the sea clamp. */
  private polar = CAMERA_MODE_POLAR_DEG.play * DEG;
  private seaHalf = SEA_HALF_EXTENT - SEA_EDGE_PAD;
  private clampKey = "";
  private panMode = false;
  private tourToken = 0;
  private touring = false;
  /** Judge presets pin the camera: no auto transitions, no clamps. */
  private pinned = false;
  private dragging = false;
  private tweening = false;
  private readonly listeners = new Set<(state: CameraRigState) => void>();
  private lastNotified = "";

  constructor(
    private readonly camera: PerspectiveCamera,
    private readonly controls: OrbitControls,
    private readonly motion: MotionController,
  ) {
    controls.minPolarAngle = POLAR_LIMITS_DEG.min * DEG;
    controls.maxPolarAngle = POLAR_LIMITS_DEG.max * DEG;
    // Pan slides across the table plane (target stays on y = 0).
    controls.screenSpacePanning = false;
    controls.addEventListener("start", this.onStart);
    controls.addEventListener("end", this.onEnd);
  }

  dispose(): void {
    this.stopTour();
    this.controls.removeEventListener("start", this.onStart);
    this.controls.removeEventListener("end", this.onEnd);
    this.listeners.clear();
  }

  private readonly onStart = () => {
    // The user grabbed the camera: drop any automatic move where it is.
    this.stopTour();
    this.motion.stopCamera();
    this.tweening = false;
    this.dragging = true;
    this.pinned = false;
  };

  private readonly onEnd = () => {
    this.dragging = false;
    this.syncFromCamera();
  };

  get isPinned(): boolean {
    return this.pinned;
  }

  /** Sea square half extent (the water controller may extend it with a far-sea ring). */
  setSeaExtent(half: number): void {
    const next = Math.max(1, half - SEA_EDGE_PAD);
    if (Math.abs(next - this.seaHalf) < 1e-6) return;
    this.seaHalf = next;
    this.refit();
    if (!this.pinned && !this.tweening && !this.dragging && !this.touring) this.apply(this.goal(), true);
  }

  /** Update what must stay in frame. `snap` jumps there immediately (first layout / resize). */
  setFraming(points: V3[], center: V3, radius: number, snap: boolean, keepPoints: V3[] = points): void {
    this.points = points;
    this.keepPoints = keepPoints;
    this.center = center;
    this.radius = radius;
    this.refit();
    if (snap && !this.pinned && !this.tweening && !this.touring) this.apply(this.goal(), true);
  }

  /** Aspect changed: refit and keep the current zoom / azimuth. */
  onResize(): void {
    this.refit();
    if (!this.pinned && !this.tweening && !this.dragging && !this.touring) this.apply(this.goal(), true);
  }

  /** Turn-driven mode change; skipped while pinned (judge) or while the user is dragging. */
  setMode(mode: CameraMode, id: string, instant = false): void {
    if (this.pinned || this.dragging) {
      this.mode = mode;
      this.notify();
      return;
    }
    this.stopTour();
    this.mode = mode;
    this.refit();
    this.transition(this.goal(), id, instant);
  }

  /** Judge: snap to a mode with default zoom / azimuth and pin. */
  pinToMode(mode: CameraMode): void {
    this.stopTour();
    this.mode = mode;
    this.zoom = 1;
    this.azimuth = 0;
    this.pinned = false;
    this.refit();
    this.apply(this.goal(), true);
    this.pinned = true;
  }

  /** Judge: an explicit pose; clamps are lifted until the user touches the camera. */
  pinFree(): void {
    this.stopTour();
    this.pinned = true;
    this.controls.minDistance = 0.1;
    this.controls.maxDistance = 200;
    this.controls.minPolarAngle = 0;
    this.controls.maxPolarAngle = Math.PI * 0.48;
  }

  zoomIn(): void {
    this.setZoom(this.zoom * ZOOM_STEP, true);
  }

  zoomOut(): void {
    this.setZoom(this.zoom / ZOOM_STEP, true);
  }

  setZoom(zoom: number, animate = false): void {
    this.stopTour();
    this.syncFromCamera();
    this.zoom = clampZoom(zoom);
    this.pinned = false;
    const current = this.current();
    const pose = { ...current, distance: this.seaCappedDistance(this.base / this.zoom, current) };
    if (animate) this.transition(pose, "zoom", false);
    else this.apply(pose, true);
  }

  rotate(direction: 1 | -1): void {
    this.stopTour();
    this.syncFromCamera();
    this.pinned = false;
    this.azimuth += direction * ROTATE_STEP_DEG * DEG;
    this.refit();
    const current = this.current();
    const turned = { ...current, azimuth: this.azimuth };
    this.transition({ ...turned, distance: this.seaCappedDistance(this.base / this.zoom, turned) }, `rotate:${direction}`, false);
  }

  reset(): void {
    this.stopTour();
    this.pinned = false;
    this.zoom = 1;
    this.azimuth = 0;
    this.refit();
    this.transition(this.goal(), "reset", false);
  }

  setPanMode(on: boolean): void {
    this.panMode = on;
    this.controls.mouseButtons.LEFT = on ? MOUSE.PAN : MOUSE.ROTATE;
    this.controls.mouseButtons.RIGHT = on ? MOUSE.ROTATE : MOUSE.PAN;
    this.controls.touches.ONE = on ? TOUCH.PAN : TOUCH.ROTATE;
    this.notify();
  }

  showHarbors(): void {
    this.stopTour();
    this.pinned = false;
    this.zoom = 1;
    const framing = this.framingFor("overview");
    this.transition({ target: this.center, distance: framing.distance, polar: framing.polar, azimuth: this.azimuth }, "harbors", false);
  }

  tour(): void {
    if (this.touring) {
      this.stopTour();
      this.reset();
      return;
    }
    this.pinned = false;
    this.syncFromCamera();
    const token = ++this.tourToken;
    this.touring = true;
    this.notify();
    const start = this.azimuth;
    const polar = Math.min(TOUR.polarDeg * DEG, this.polar + 10 * DEG);
    const leg = (index: number) => {
      if (token !== this.tourToken) return;
      if (index >= TOUR.stepsDeg.length) {
        this.touring = false;
        this.zoom = 1;
        this.azimuth = start;
        this.refit();
        this.transition(this.goal(), "tour:end", false);
        return;
      }
      const azimuth = start + TOUR.stepsDeg[index]! * DEG;
      const at = { target: this.center, polar, azimuth, distance: this.base / TOUR.zoom };
      const pose = { ...at, distance: this.seaCappedDistance(at.distance, at) };
      const ms = this.transition(pose, `tour:${index}`, false, TOUR.legMs, () => leg(index + 1));
      // Reduced motion: no tour, just end where we started.
      if (ms === 0) {
        this.tourToken += 1;
        this.touring = false;
        this.notify();
      }
    };
    leg(0);
  }

  private stopTour(): void {
    if (!this.touring) return;
    this.tourToken += 1;
    this.touring = false;
    this.notify();
  }

  getState(): CameraRigState {
    return {
      mode: this.mode,
      zoom: this.zoom,
      zoomPercent: zoomPercent(this.zoom),
      minZoom: ZOOM_LIMITS.min,
      maxZoom: ZOOM_LIMITS.max,
      azimuthDeg: Math.round((this.azimuth / DEG) * 10) / 10,
      panMode: this.panMode,
      touring: this.touring,
    };
  }

  subscribe(listener: (state: CameraRigState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  /** Per frame, after controls.update(): pan clamp, sea clamp and zoom readout from wheel / pinch. */
  update(): void {
    if (this.pinned || this.tweening) return;
    const t = this.controls.target;
    const clamped = clampTarget([t.x, t.y, t.z], this.center, this.radius * 0.6);
    if (clamped[0] !== t.x || clamped[1] !== t.y || clamped[2] !== t.z) {
      const dx = clamped[0] - t.x;
      const dy = clamped[1] - t.y;
      const dz = clamped[2] - t.z;
      t.set(clamped[0], clamped[1], clamped[2]);
      this.camera.position.set(this.camera.position.x + dx, this.camera.position.y + dy, this.camera.position.z + dz);
    }
    this.updateSeaClamp();
    if (this.dragging) this.syncFromCamera();
    else {
      const distance = this.camera.position.distanceTo(this.controls.target);
      const zoom = clampZoom(this.base / Math.max(distance, 1e-3));
      if (Math.abs(zoom - this.zoom) > 0.004) {
        this.zoom = zoom;
        this.notify();
      }
    }
  }

  /**
   * User orbit / zoom / pan: cap distance and tilt so the frame stays on the
   * sea. Never forces the camera tighter than the automatic framing itself.
   */
  private updateSeaClamp(): void {
    const pose = this.current();
    const key = `${pose.target.map((v) => v.toFixed(2)).join()}|${pose.distance.toFixed(2)}|${pose.polar.toFixed(3)}|${pose.azimuth.toFixed(3)}|${this.camera.aspect.toFixed(3)}`;
    if (key === this.clampKey) return;
    this.clampKey = key;
    const { fov, aspect } = this.camera;
    const seaMax = maxSeaDistance(pose.target, pose.polar, pose.azimuth, fov, aspect, this.seaHalf);
    this.controls.minDistance = this.base / ZOOM_LIMITS.max;
    this.controls.maxDistance = Math.max(this.base, Math.min(this.base / ZOOM_LIMITS.min, seaMax));
    const safePolar = maxSeaPolar(pose.target, pose.distance, pose.azimuth, fov, aspect, POLAR_LIMITS_DEG.max * DEG, 0, this.seaHalf);
    this.controls.maxPolarAngle = Math.max(safePolar, this.polar);
  }

  /** Clamp a zoomed distance to the sea (never tighter than the zoom-1 framing). */
  private seaCappedDistance(distance: number, pose: Pick<Pose, "target" | "polar" | "azimuth">): number {
    const seaMax = maxSeaDistance(pose.target, pose.polar, pose.azimuth, this.camera.fov, this.camera.aspect, this.seaHalf);
    return Math.min(distance, Math.max(this.base, seaMax));
  }

  private syncFromCamera(): void {
    if (this.tweening) return;
    const pose = this.current();
    this.azimuth = pose.azimuth;
    this.zoom = clampZoom(this.base / Math.max(pose.distance, 1e-3));
    this.notify();
  }

  private framingFor(mode: CameraMode): { polar: number; distance: number; fit: number; safe: boolean } {
    const points = this.points.length > 0 ? this.points : ([[4, 0, 4], [-4, 0, -4]] as V3[]);
    if (mode === "play") {
      return playFraming(points, this.keepPoints, this.center, CAMERA_MODE_POLAR_DEG[mode] * DEG, this.azimuth, this.camera.fov, this.camera.aspect, this.seaHalf);
    }
    const minPolar = 0;
    return seaSafeFraming(
      points,
      this.keepPoints,
      this.center,
      CAMERA_MODE_POLAR_DEG[mode] * DEG,
      minPolar,
      this.azimuth,
      this.camera.fov,
      this.camera.aspect,
      this.seaHalf,
      mode === "overview",
    );
  }

  private refit(): void {
    const framing = this.framingFor(this.mode);
    this.fit = framing.fit;
    this.base = framing.distance;
    this.polar = framing.polar;
    this.clampKey = "";
    if (!this.pinned) {
      this.controls.minDistance = this.base / ZOOM_LIMITS.max;
      this.controls.maxDistance = this.base / ZOOM_LIMITS.min;
      this.controls.minPolarAngle = POLAR_LIMITS_DEG.min * DEG;
      this.controls.maxPolarAngle = POLAR_LIMITS_DEG.max * DEG;
    }
  }

  /** Readout for e2e / judge: framed polar (deg), zoom-1 distance, fitted distance. */
  get framing(): { polarDeg: number; base: number; fit: number } {
    return { polarDeg: this.polar / DEG, base: this.base, fit: this.fit };
  }

  private goal(): Pose {
    const at = { target: this.center, polar: this.polar, azimuth: this.azimuth };
    return { ...at, distance: this.seaCappedDistance(this.base / this.zoom, at) };
  }

  private current(): Pose {
    const t = this.controls.target;
    const dx = this.camera.position.x - t.x;
    const dy = this.camera.position.y - t.y;
    const dz = this.camera.position.z - t.z;
    const distance = Math.hypot(dx, dy, dz) || 1;
    const polar = Math.acos(Math.min(Math.max(dy / distance, -1), 1));
    const azimuth = Math.hypot(dx, dz) < 1e-6 ? this.azimuth : Math.atan2(dx, dz);
    return { target: [t.x, t.y, t.z], distance, polar, azimuth };
  }

  private apply(pose: Pose, final: boolean): void {
    const [ox, oy, oz] = orbitOffset(pose.distance, pose.polar, pose.azimuth);
    this.controls.target.set(pose.target[0], pose.target[1], pose.target[2]);
    this.camera.position.set(pose.target[0] + ox, pose.target[1] + oy, pose.target[2] + oz);
    this.camera.lookAt(pose.target[0], pose.target[1], pose.target[2]);
    if (final) {
      this.azimuth = pose.azimuth;
      this.notify();
    }
  }

  private transition(to: Pose, id: string, instant: boolean, ms?: number, done?: () => void): number {
    if (instant) {
      this.apply(to, true);
      done?.();
      return 0;
    }
    const from = this.current();
    const dAz = angleDelta(from.azimuth, to.azimuth);
    // Let OrbitControls pass through both ends while tweening.
    this.controls.minDistance = Math.min(this.controls.minDistance, from.distance, to.distance);
    this.controls.maxDistance = Math.max(this.controls.maxDistance, from.distance, to.distance);
    this.controls.maxPolarAngle = Math.max(this.controls.maxPolarAngle, from.polar, to.polar);
    const duration = this.motion.camera(
      `camera:${id}`,
      (p) => {
        const lerp = (a: number, b: number) => a + (b - a) * p;
        this.apply(
          {
            target: [lerp(from.target[0], to.target[0]), lerp(from.target[1], to.target[1]), lerp(from.target[2], to.target[2])],
            distance: lerp(from.distance, to.distance),
            polar: lerp(from.polar, to.polar),
            azimuth: from.azimuth + dAz * p,
          },
          p >= 1,
        );
        if (p >= 1) {
          this.tweening = false;
          this.azimuth = to.azimuth;
          this.refit();
        }
      },
      { ms, done },
    );
    // A previous camera tween is `end()`ed inside motion.camera (its p = 1 clears the flag first).
    this.tweening = duration > 0;
    return duration;
  }

  private notify(): void {
    if (this.listeners.size === 0) return;
    const state = this.getState();
    const key = `${state.mode}|${state.zoomPercent}|${state.azimuthDeg}|${state.panMode}|${state.touring}`;
    if (key === this.lastNotified) return;
    this.lastNotified = key;
    for (const listener of this.listeners) listener(state);
  }
}
