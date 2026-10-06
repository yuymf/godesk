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
import type { PerspectiveCamera } from "three";
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
export const POLAR_LIMITS_DEG = { min: 0, max: 68 } as const;
/** Viewport fraction (NDC) the framed points may occupy. */
export const FRAME_MARGIN = 0.93;
const DEG = Math.PI / 180;

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

type FramingNode = {
  kind: string;
  position: readonly [number, number, number];
  rotationY?: number;
};

/** Tray half-extents used for framing (matches dice.ts TRAY with a small pad). */
const TRAY_HALF: readonly [number, number] = [0.86, 0.56];

/**
 * Points that must stay in frame: every tile's hex corners at tile-top height,
 * harbour markers and the dice tray corners. Ships may bleed past the edge.
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
    } else if (node.kind === "dice-tray") {
      const yaw = node.rotationY ?? 0;
      const c = Math.cos(yaw);
      const s = Math.sin(yaw);
      for (const [lx, lz] of [
        [TRAY_HALF[0], TRAY_HALF[1]],
        [-TRAY_HALF[0], TRAY_HALF[1]],
        [TRAY_HALF[0], -TRAY_HALF[1]],
        [-TRAY_HALF[0], -TRAY_HALF[1]],
      ] as const) {
        out.push([x + lx * c + lz * s, y + 0.18, z - lx * s + lz * c]);
      }
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
};

/** Small API for the on-canvas toolbar (and Track B's HUD, if it wants its own controls). */
export type CameraRigApi = {
  zoomIn(): void;
  zoomOut(): void;
  setZoom(zoom: number): void;
  rotate(direction: 1 | -1): void;
  reset(): void;
  getState(): CameraRigState;
  subscribe(listener: (state: CameraRigState) => void): () => void;
};

type Pose = { target: V3; distance: number; polar: number; azimuth: number };

export class CameraDirector implements CameraRigApi {
  mode: CameraMode = "play";
  private zoom = 1;
  private azimuth = 0;
  private points: V3[] = [];
  private center: V3 = [0, 0, 0];
  private radius = 4;
  private fit = 12;
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
    this.controls.removeEventListener("start", this.onStart);
    this.controls.removeEventListener("end", this.onEnd);
    this.listeners.clear();
  }

  private readonly onStart = () => {
    // The user grabbed the camera: drop any automatic move where it is.
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

  /** Update what must stay in frame. `snap` jumps there immediately (first layout / resize). */
  setFraming(points: V3[], center: V3, radius: number, snap: boolean): void {
    this.points = points;
    this.center = center;
    this.radius = radius;
    this.refit();
    if (snap && !this.pinned && !this.tweening) this.apply(this.goal(), true);
  }

  /** Aspect changed: refit and keep the current zoom / azimuth. */
  onResize(): void {
    this.refit();
    if (!this.pinned && !this.tweening && !this.dragging) this.apply(this.goal(), true);
  }

  /** Turn-driven mode change; skipped while pinned (judge) or while the user is dragging. */
  setMode(mode: CameraMode, id: string, instant = false): void {
    if (this.pinned || this.dragging) {
      this.mode = mode;
      this.notify();
      return;
    }
    this.mode = mode;
    this.refit();
    this.transition(this.goal(), id, instant);
  }

  /** Judge: snap to a mode with default zoom / azimuth and pin. */
  pinToMode(mode: CameraMode): void {
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
    this.syncFromCamera();
    this.zoom = clampZoom(zoom);
    this.pinned = false;
    const pose = { ...this.current(), distance: this.fit / this.zoom };
    if (animate) this.transition(pose, "zoom", false);
    else this.apply(pose, true);
  }

  rotate(direction: 1 | -1): void {
    this.syncFromCamera();
    this.pinned = false;
    this.azimuth += direction * ROTATE_STEP_DEG * DEG;
    this.refit();
    this.transition({ ...this.current(), azimuth: this.azimuth, distance: this.fit / this.zoom }, `rotate:${direction}`, false);
  }

  reset(): void {
    this.pinned = false;
    this.zoom = 1;
    this.azimuth = 0;
    this.refit();
    this.transition(this.goal(), "reset", false);
  }

  getState(): CameraRigState {
    return {
      mode: this.mode,
      zoom: this.zoom,
      zoomPercent: zoomPercent(this.zoom),
      minZoom: ZOOM_LIMITS.min,
      maxZoom: ZOOM_LIMITS.max,
      azimuthDeg: Math.round((this.azimuth / DEG) * 10) / 10,
    };
  }

  subscribe(listener: (state: CameraRigState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  /** Per frame, after controls.update(): pan clamp + zoom readout from wheel / pinch. */
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
    if (this.dragging) this.syncFromCamera();
    else {
      const distance = this.camera.position.distanceTo(this.controls.target);
      const zoom = clampZoom(this.fit / Math.max(distance, 1e-3));
      if (Math.abs(zoom - this.zoom) > 0.004) {
        this.zoom = zoom;
        this.notify();
      }
    }
  }

  private syncFromCamera(): void {
    if (this.tweening) return;
    const pose = this.current();
    this.azimuth = pose.azimuth;
    this.zoom = clampZoom(this.fit / Math.max(pose.distance, 1e-3));
    this.notify();
  }

  private refit(): void {
    const polar = CAMERA_MODE_POLAR_DEG[this.mode] * DEG;
    const points = this.points.length > 0 ? this.points : [[4, 0, 4], [-4, 0, -4]] as V3[];
    this.fit = fitDistance(points, this.center, polar, this.azimuth, this.camera.fov, this.camera.aspect);
    if (!this.pinned) {
      this.controls.minDistance = this.fit / ZOOM_LIMITS.max;
      this.controls.maxDistance = this.fit / ZOOM_LIMITS.min;
      this.controls.minPolarAngle = POLAR_LIMITS_DEG.min * DEG;
      this.controls.maxPolarAngle = POLAR_LIMITS_DEG.max * DEG;
    }
  }

  private goal(): Pose {
    return {
      target: this.center,
      distance: this.fit / this.zoom,
      polar: CAMERA_MODE_POLAR_DEG[this.mode] * DEG,
      azimuth: this.azimuth,
    };
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

  private transition(to: Pose, id: string, instant: boolean): void {
    if (instant) {
      this.apply(to, true);
      return;
    }
    const from = this.current();
    const dAz = angleDelta(from.azimuth, to.azimuth);
    // Let OrbitControls pass through both ends while tweening.
    this.controls.minDistance = Math.min(this.controls.minDistance, from.distance, to.distance);
    this.controls.maxDistance = Math.max(this.controls.maxDistance, from.distance, to.distance);
    const ms = this.motion.camera(`camera:${id}`, (p) => {
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
    });
    // A previous camera tween is `end()`ed inside motion.camera (its p = 1 clears the flag first).
    this.tweening = ms > 0;
  }

  private notify(): void {
    if (this.listeners.size === 0) return;
    const state = this.getState();
    const key = `${state.mode}|${state.zoomPercent}|${state.azimuthDeg}`;
    if (key === this.lastNotified) return;
    this.lastNotified = key;
    for (const listener of this.listeners) listener(state);
  }
}
