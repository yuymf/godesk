/**
 * G3D-09 motion layer (SPEC §3 动效映射 + §4.5): every tween runs on one
 * `@tweenjs/tween.js` Group ticked from SceneHost's render loop.
 *
 * - node added → drop-in, `placeMs` 280, out-back
 * - node removed (settlement → city) → scale fade-out 160 ms
 * - robber position change → arc `moveMs` 420
 * - lastDice change → precomputed tumble `diceMs` 900 (no physics engine)
 * - turn → camera mode transition `cameraMs` 600, in-out-sine (camera-rig.ts CameraDirector:
 *   own turn tilted 3/4, AI / opponent turns near top-down); skipped while the user drags
 * - robber position change → hop-walk along a bowed arc (`hop`), facing travel
 * - `prefers-reduced-motion: reduce` → every duration is 0 (camera snaps)
 *
 * Tweens never gate input: picks hit the hit-overlay layer, which is rebuilt
 * synchronously from legal actions, and a new tween on the same object first
 * `end()`s the previous one so the final pose always converges to the state.
 */
import { Easing, Group, Tween } from "@tweenjs/tween.js";
import { Euler, Quaternion, Vector3, type Object3D } from "three";
import type { SceneVec3 } from "./scene-model";

export const MOTION_MS = {
  place: 280,
  remove: 160,
  robber: 720,
  dice: 900,
  camera: 600,
} as const;

export type MotionKind = keyof typeof MOTION_MS;

/** User drag within this window suppresses automatic camera reframes (§4.5). */
export const CAMERA_DRAG_GRACE_MS = 3000;

export function prefersReducedMotion(
  win: Pick<Window, "matchMedia"> | undefined = typeof window === "undefined" ? undefined : window,
): boolean {
  try {
    return Boolean(win?.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  } catch {
    return false;
  }
}

export function motionDurationMs(kind: MotionKind, reduced: boolean): number {
  return reduced ? 0 : MOTION_MS[kind];
}

export type MotionLogEntry = {
  kind: MotionKind;
  id: string;
  durationMs: number;
  reduced: boolean;
  at: number;
};

type MotionLogHost = { __g3dMotionLog?: MotionLogEntry[] };

/** Bounded in-page log (read by e2e: `window.__g3dMotionLog`). */
export function recordMotion(entry: MotionLogEntry): void {
  const host = globalThis as MotionLogHost;
  const log = (host.__g3dMotionLog ??= []);
  log.push(entry);
  if (log.length > 200) log.splice(0, log.length - 200);
}

/** Euler (x, y, z) that leaves pip `face` on top of a unit die. */
export const DIE_FACE_EULER: Readonly<Record<number, SceneVec3>> = {
  1: [0, 0, 0],
  2: [Math.PI / 2, 0, 0],
  3: [0, 0, Math.PI / 2],
  4: [0, 0, -Math.PI / 2],
  5: [-Math.PI / 2, 0, 0],
  6: [Math.PI, 0, 0],
};

export function dieFaceEuler(face: number | null | undefined): SceneVec3 {
  return DIE_FACE_EULER[face ?? 1] ?? DIE_FACE_EULER[1]!;
}

export type DiceKeyframe = {
  /** Normalised time 0..1. */
  t: number;
  rotation: SceneVec3;
  /** Height offset above the rest position. */
  lift: number;
};

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic tumble curve: a few whole turns per axis that decay into the
 * target face, with two damped bounces. Pure so it can be unit-tested.
 */
export function precomputeDiceTumble(face: number, seed: number, frames = 18): DiceKeyframe[] {
  const rng = mulberry32(seed * 2654435761 + face * 97);
  const [fx, fy, fz] = dieFaceEuler(face);
  const turns: SceneVec3 = [
    (2 + Math.floor(rng() * 3)) * Math.PI * 2,
    (1 + Math.floor(rng() * 2)) * Math.PI * 2,
    (1 + Math.floor(rng() * 3)) * Math.PI * 2,
  ];
  const lift0 = 0.9 + rng() * 0.4;
  const out: DiceKeyframe[] = [];
  for (let i = 0; i <= frames; i += 1) {
    const t = i / frames;
    const spin = 1 - (1 - t) ** 3; // ease-out cubic toward rest
    const remain = 1 - spin;
    const bounce = Math.abs(Math.cos(t * Math.PI * 2.5)) * (1 - t) ** 2;
    out.push({
      t,
      rotation: [fx + turns[0] * remain, fy + turns[1] * remain, fz + turns[2] * remain],
      lift: i === frames ? 0 : lift0 * bounce,
    });
  }
  return out;
}

export function sampleDiceTumble(keys: readonly DiceKeyframe[], t: number): DiceKeyframe {
  if (keys.length === 0) return { t, rotation: [0, 0, 0], lift: 0 };
  if (t <= 0) return keys[0]!;
  if (t >= 1) return keys[keys.length - 1]!;
  const scaled = t * (keys.length - 1);
  const i = Math.floor(scaled);
  const f = scaled - i;
  const a = keys[i]!;
  const b = keys[Math.min(i + 1, keys.length - 1)]!;
  const lerp = (x: number, y: number) => x + (y - x) * f;
  return {
    t,
    rotation: [lerp(a.rotation[0], b.rotation[0]), lerp(a.rotation[1], b.rotation[1]), lerp(a.rotation[2], b.rotation[2])],
    lift: lerp(a.lift, b.lift),
  };
}

/** Height of the robber arc at normalised progress p. */
export function arcLift(p: number, height = 1.35): number {
  return Math.sin(Math.PI * Math.min(Math.max(p, 0), 1)) * height;
}

/**
 * Robber hop-walk: horizontal path bows sideways (quadratic arc), the figure
 * makes `hops` small hops plus a gentle overall lift, and faces the travel
 * direction. Pure so it can be unit-tested.
 */
export function hopPath(
  from: SceneVec3,
  to: SceneVec3,
  p: number,
  hops = 3,
): { position: SceneVec3; facing: number } {
  const t = Math.min(Math.max(p, 0), 1);
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const len = Math.hypot(dx, dz) || 1;
  // Perpendicular control-point offset (bow), proportional to distance, capped.
  const bow = Math.min(len * 0.22, 0.9);
  const cx = (from[0] + to[0]) / 2 + (-dz / len) * bow;
  const cz = (from[2] + to[2]) / 2 + (dx / len) * bow;
  const u = 1 - t;
  const x = u * u * from[0] + 2 * u * t * cx + t * t * to[0];
  const z = u * u * from[2] + 2 * u * t * cz + t * t * to[2];
  // Tangent of the quadratic Bézier.
  const tx = 2 * u * (cx - from[0]) + 2 * t * (to[0] - cx);
  const tz = 2 * u * (cz - from[2]) + 2 * t * (to[2] - cz);
  const baseY = from[1] + (to[1] - from[1]) * t;
  const y = t >= 1 ? to[1] : baseY + Math.abs(Math.sin(Math.PI * hops * t)) * 0.38 + Math.sin(Math.PI * t) * 0.28;
  return { position: t >= 1 ? [to[0], to[1], to[2]] : [x, y, z], facing: Math.atan2(tx, tz) };
}

/** Robber idle bob offset (y) at time `ms`; 0 when frozen. */
export function idleBob(ms: number, frozen: boolean): { y: number; tilt: number } {
  if (frozen) return { y: 0, tilt: 0 };
  const s = ms / 1000;
  return { y: (Math.sin(s * 2.4) * 0.5 + 0.5) * 0.045, tilt: Math.sin(s * 1.2) * 0.06 };
}

const _yawQ = new Quaternion();
const _faceQ = new Quaternion();
const _euler = new Euler();
const _yAxis = new Vector3(0, 1, 0);

/** Rest orientation of a die: yaw about world Y, then face-up rotation. */
export function applyDieOrientation(object: Object3D, face: number | null | undefined, yaw = 0): void {
  const [x, y, z] = dieFaceEuler(face);
  _faceQ.setFromEuler(_euler.set(x, y, z));
  _yawQ.setFromAxisAngle(_yAxis, yaw);
  object.quaternion.copy(_yawQ.multiply(_faceQ));
}

export type MotionControllerOptions = {
  reduced?: () => boolean;
  now?: () => number;
};

export class MotionController {
  readonly group = new Group();
  private readonly running = new Map<object, Tween<{ p: number }>>();
  private readonly reduced: () => boolean;
  private readonly now: () => number;
  private lastUserDragAt = Number.NEGATIVE_INFINITY;
  /** Objects whose pose a tween touched since the last `drainDirty()` (InstancedMesh sync). */
  private readonly dirty = new Set<object>();
  private readonly cameraKey = {};

  constructor(options: MotionControllerOptions = {}) {
    this.reduced = options.reduced ?? (() => prefersReducedMotion());
    this.now = options.now ?? (() => (typeof performance !== "undefined" ? performance.now() : Date.now()));
  }

  update(time = this.now()): void {
    this.group.update(time);
  }

  /** True while any tween is in flight. */
  get busy(): boolean {
    return this.running.size > 0;
  }

  /** True while `object` has a tween in flight. */
  isAnimating(object: object): boolean {
    return this.running.has(object);
  }

  /** Objects posed by tweens since the previous call (includes just-finished tweens). */
  drainDirty(): object[] {
    if (this.dirty.size === 0) return [];
    const out = [...this.dirty];
    this.dirty.clear();
    return out;
  }

  noteUserDrag(at = this.now()): void {
    this.lastUserDragAt = at;
  }

  /** Last user camera drag (judge mode pins this to +∞). */
  get lastDragAt(): number {
    return this.lastUserDragAt;
  }

  /** Finish every tween immediately (unmount / remount). */
  finishAll(): void {
    for (const tween of [...this.running.values()]) tween.end();
    this.running.clear();
    this.group.removeAll();
  }

  private run(
    key: object,
    kind: MotionKind,
    id: string,
    easing: (amount: number) => number,
    step: (p: number) => void,
    done?: () => void,
    durationOverrideMs?: number,
  ): number {
    this.running.get(key)?.end();
    const touch = step;
    step = (p: number) => {
      touch(p);
      this.dirty.add(key);
    };
    const reduced = this.reduced();
    const durationMs = reduced ? 0 : durationOverrideMs ?? motionDurationMs(kind, reduced);
    recordMotion({ kind, id, durationMs, reduced, at: this.now() });
    if (durationMs === 0) {
      step(1);
      done?.();
      return 0;
    }
    const state = { p: 0 };
    step(0);
    const tween = new Tween(state)
      .to({ p: 1 }, durationMs)
      .easing(easing)
      .onUpdate(() => step(state.p))
      .onComplete(() => {
        this.running.delete(key);
        this.group.remove(tween);
        done?.();
      })
      .onStop(() => {
        this.running.delete(key);
        this.group.remove(tween);
      });
    this.group.add(tween);
    this.running.set(key, tween);
    tween.start(this.now());
    return durationMs;
  }

  /** Drop-in placement (out-back). Object already sits at its final pose. */
  place(object: Object3D, id: string): number {
    const sx = object.scale.x;
    const sy = object.scale.y;
    const sz = object.scale.z;
    const y = object.position.y;
    return this.run(object, "place", id, Easing.Back.Out, (p) => {
      const s = Math.max(p, 0.001);
      object.scale.set(sx * s, sy * s, sz * s);
      object.position.y = y + (1 - Math.min(p, 1)) * 0.6;
    });
  }

  /** Scale fade-out, then `done` (caller detaches + disposes). */
  remove(object: Object3D, id: string, done: () => void): number {
    const sx = object.scale.x;
    const sy = object.scale.y;
    const sz = object.scale.z;
    return this.run(object, "remove", id, Easing.Quadratic.In, (p) => {
      const s = Math.max(1 - p, 0.001);
      object.scale.set(sx * s, sy * s, sz * s);
    }, done);
  }

  /** Arc move from `from` to the object's current (final) position. */
  moveArc(object: Object3D, id: string, from: SceneVec3): number {
    const to: SceneVec3 = [object.position.x, object.position.y, object.position.z];
    return this.run(object, "robber", id, Easing.Sinusoidal.InOut, (p) => {
      if (p >= 1) {
        object.position.set(to[0], to[1], to[2]);
        return;
      }
      object.position.set(
        from[0] + (to[0] - from[0]) * p,
        from[1] + (to[1] - from[1]) * p + arcLift(p),
        from[2] + (to[2] - from[2]) * p,
      );
    });
  }

  /** Hop-walk along a bowed arc to the object's current (final) position, facing travel. */
  hop(object: Object3D, id: string, from: SceneVec3): number {
    const to: SceneVec3 = [object.position.x, object.position.y, object.position.z];
    const finalYaw = object.rotation.y;
    return this.run(object, "robber", id, Easing.Sinusoidal.InOut, (p) => {
      const { position, facing } = hopPath(from, to, p);
      object.position.set(position[0], position[1], position[2]);
      object.rotation.set(0, p >= 1 ? (Math.hypot(to[0] - from[0], to[2] - from[2]) > 1e-6 ? facing : finalYaw) : facing, 0);
    });
  }

  /**
   * Precomputed tumble ending on `face`; rest position = object's current position.
   * The die is thrown in from `slide` (local offset, decays to 0) and settles with `yaw`.
   */
  dice(object: Object3D, id: string, face: number, seed: number, yaw = 0, slide: readonly [number, number] = [0, 0]): number {
    const restX = object.position.x;
    const restY = object.position.y;
    const restZ = object.position.z;
    const keys = precomputeDiceTumble(face, seed);
    return this.run(object, "dice", id, Easing.Linear.None, (p) => {
      const k = sampleDiceTumble(keys, p);
      if (p >= 1) {
        applyDieOrientation(object, face, yaw);
        object.position.set(restX, restY, restZ);
        return;
      }
      _faceQ.setFromEuler(_euler.set(k.rotation[0], k.rotation[1], k.rotation[2]));
      _yawQ.setFromAxisAngle(_yAxis, yaw);
      object.quaternion.copy(_yawQ.multiply(_faceQ));
      const remain = (1 - p) ** 2;
      object.position.set(restX + slide[0] * remain, restY + k.lift * 0.45, restZ + slide[1] * remain);
    });
  }

  /** Stop an in-flight camera tween where it is (user grabbed the camera). */
  stopCamera(): void {
    this.running.get(this.cameraKey)?.stop();
  }

  /** Generic camera tween (logged as kind "camera", 600 ms; reduced motion → instant). */
  camera(id: string, step: (p: number) => void, options: { ms?: number; done?: () => void } = {}): number {
    return this.run(this.cameraKey, "camera", id, Easing.Sinusoidal.InOut, step, options.done, options.ms);
  }
}
