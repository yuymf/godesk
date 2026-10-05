/**
 * G3D-09 motion layer (SPEC §3 动效映射 + §4.5): every tween runs on one
 * `@tweenjs/tween.js` Group ticked from SceneHost's render loop.
 *
 * - node added → drop-in, `placeMs` 280, out-back
 * - node removed (settlement → city) → scale fade-out 160 ms
 * - robber position change → arc `moveMs` 420
 * - lastDice change → precomputed tumble `diceMs` 900 (no physics engine)
 * - turn / dice / robber / build → camera reframe `cameraMs` 600, in-out-sine;
 *   skipped when the user dragged within the last 3 s
 * - `prefers-reduced-motion: reduce` → every duration is 0 and the camera never auto-moves
 *
 * Tweens never gate input: picks hit the hit-overlay layer, which is rebuilt
 * synchronously from legal actions, and a new tween on the same object first
 * `end()`s the previous one so the final pose always converges to the state.
 */
import { Easing, Group, Tween } from "@tweenjs/tween.js";
import type { Object3D } from "three";
import type { SceneVec3 } from "./scene-model";

export const MOTION_MS = {
  place: 280,
  remove: 160,
  robber: 420,
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
export function arcLift(p: number, height = 0.9): number {
  return Math.sin(Math.PI * Math.min(Math.max(p, 0), 1)) * height;
}

type CameraLike = { position: { x: number; y: number; z: number; set(x: number, y: number, z: number): unknown } };
type ControlsLike = { target: { x: number; y: number; z: number; set(x: number, y: number, z: number): unknown } };

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

  noteUserDrag(at = this.now()): void {
    this.lastUserDragAt = at;
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
  ): number {
    this.running.get(key)?.end();
    const reduced = this.reduced();
    const durationMs = motionDurationMs(kind, reduced);
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

  /** Precomputed tumble ending on `face`; rest position = object's current position. */
  dice(object: Object3D, id: string, face: number, seed: number): number {
    const restY = object.position.y;
    const keys = precomputeDiceTumble(face, seed);
    return this.run(object, "dice", id, Easing.Linear.None, (p) => {
      const k = sampleDiceTumble(keys, p);
      object.rotation.set(k.rotation[0], k.rotation[1], k.rotation[2]);
      object.position.y = restY + k.lift;
    });
  }

  /**
   * Reframe camera + orbit target toward `focus` (keeps the current camera offset).
   * Returns -1 when skipped (reduced motion or recent user drag).
   */
  reframe(camera: CameraLike, controls: ControlsLike, focus: SceneVec3, id: string, pull = 0.35): number {
    if (this.reduced()) {
      recordMotion({ kind: "camera", id, durationMs: 0, reduced: true, at: this.now() });
      return -1;
    }
    if (this.now() - this.lastUserDragAt < CAMERA_DRAG_GRACE_MS) return -1;
    const fromT: SceneVec3 = [controls.target.x, controls.target.y, controls.target.z];
    const toT: SceneVec3 = [focus[0] * pull, 0, focus[2] * pull];
    const offset: SceneVec3 = [
      camera.position.x - fromT[0],
      camera.position.y - fromT[1],
      camera.position.z - fromT[2],
    ];
    return this.run(controls, "camera", id, Easing.Sinusoidal.InOut, (p) => {
      const tx = fromT[0] + (toT[0] - fromT[0]) * p;
      const ty = fromT[1] + (toT[1] - fromT[1]) * p;
      const tz = fromT[2] + (toT[2] - fromT[2]) * p;
      controls.target.set(tx, ty, tz);
      camera.position.set(tx + offset[0], ty + offset[1], tz + offset[2]);
    });
  }
}
