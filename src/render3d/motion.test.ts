import { Object3D } from "three";
import { describe, expect, it } from "vitest";
import {
  arcLift,
  dieFaceEuler,
  MOTION_MS,
  MotionController,
  motionDurationMs,
  precomputeDiceTumble,
  sampleDiceTumble,
} from "./motion";
import { reconcileScene, type ReconcileHost } from "./reconcile";
import type { SceneModel, SceneNode } from "./scene-model";

function clock(start = 1000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => { t += ms; return t; } };
}

describe("G3D-09 motion durations", () => {
  it("matches SPEC §4.5: place 280, robber 720, dice 900, camera 600, remove 160", () => {
    expect(MOTION_MS).toEqual({ place: 280, remove: 160, robber: 720, dice: 900, camera: 600 });
  });
  it("reduced motion zeroes every duration", () => {
    for (const kind of Object.keys(MOTION_MS) as (keyof typeof MOTION_MS)[]) {
      expect(motionDurationMs(kind, true)).toBe(0);
      expect(motionDurationMs(kind, false)).toBe(MOTION_MS[kind]);
    }
  });
});

describe("dice tumble", () => {
  it("is deterministic and lands exactly on the face, at rest", () => {
    for (let face = 1; face <= 6; face += 1) {
      const a = precomputeDiceTumble(face, 7);
      expect(precomputeDiceTumble(face, 7)).toEqual(a);
      const last = a[a.length - 1]!;
      expect(last.t).toBe(1);
      expect(last.lift).toBe(0);
      const [x, y, z] = dieFaceEuler(face);
      expect(last.rotation[0]).toBeCloseTo(x);
      expect(last.rotation[1]).toBeCloseTo(y);
      expect(last.rotation[2]).toBeCloseTo(z);
      expect(a[0]!.lift).toBeGreaterThan(0.5);
    }
  });
  it("different seeds give different curves; sampling clamps", () => {
    expect(precomputeDiceTumble(3, 1)).not.toEqual(precomputeDiceTumble(3, 2));
    const keys = precomputeDiceTumble(4, 3);
    expect(sampleDiceTumble(keys, 2)).toEqual(keys[keys.length - 1]);
    expect(sampleDiceTumble(keys, -1)).toEqual(keys[0]);
  });
  it("arc lift peaks mid-way and is 0 at both ends", () => {
    expect(arcLift(0)).toBeCloseTo(0);
    expect(arcLift(1)).toBeCloseTo(0);
    expect(arcLift(0.5)).toBeGreaterThan(0.8);
  });
});

describe("MotionController", () => {
  it("place animates over 280 ms then rests at the final pose", () => {
    const c = clock();
    const motion = new MotionController({ reduced: () => false, now: c.now });
    const obj = new Object3D();
    obj.position.set(1, 0.35, 2);
    expect(motion.place(obj, "settle:x")).toBe(280);
    expect(obj.scale.x).toBeLessThan(0.01);
    expect(motion.busy).toBe(true);
    motion.update(c.advance(40));
    expect(obj.position.y).toBeGreaterThan(0.35);
    motion.update(c.advance(241));
    expect(motion.busy).toBe(false);
    expect(obj.scale.x).toBeCloseTo(1);
    expect(obj.position.y).toBeCloseTo(0.35);
  });

  it("reduced motion applies the final pose synchronously (0 ms)", () => {
    const motion = new MotionController({ reduced: () => true, now: () => 0 });
    const obj = new Object3D();
    obj.position.set(0, 0.85, 0);
    expect(motion.place(obj, "a")).toBe(0);
    expect(obj.scale.x).toBeCloseTo(1);
    expect(motion.moveArc(obj, "robber", [3, 0.85, 3])).toBe(0);
    expect(obj.position.y).toBeCloseTo(0.85);
    expect(obj.position.x).toBeCloseTo(0);
    expect(motion.dice(obj, "die:0", 6, 1)).toBe(0);
    expect(obj.rotation.x).toBeCloseTo(Math.PI);
    let removed = false;
    expect(motion.remove(obj, "settle:y", () => { removed = true; })).toBe(0);
    expect(removed).toBe(true);
    expect(motion.busy).toBe(false);
  });

  it("robber arcs for 720 ms; a new tween on the same object finishes the old one", () => {
    const c = clock();
    const motion = new MotionController({ reduced: () => false, now: c.now });
    const robber = new Object3D();
    robber.position.set(2, 0.85, 0);
    expect(motion.moveArc(robber, "robber", [0, 0.85, 0])).toBe(720);
    motion.update(c.advance(210));
    expect(robber.position.y).toBeGreaterThan(1.2);
    // state moves again mid-flight: final pose must converge to the new target
    robber.position.set(-2, 0.85, 0);
    motion.moveArc(robber, "robber", [1, 0.85, 0]);
    motion.update(c.advance(721));
    expect(robber.position.x).toBeCloseTo(-2);
    expect(robber.position.y).toBeCloseTo(0.85);
    expect(motion.busy).toBe(false);
  });

  it("dice tumble lasts 900 ms", () => {
    const c = clock();
    const motion = new MotionController({ reduced: () => false, now: c.now });
    const die = new Object3D();
    die.position.set(4, 0.25, 3.2);
    expect(motion.dice(die, "die:0", 5, 3)).toBe(900);
    motion.update(c.advance(450));
    expect(motion.busy).toBe(true);
    motion.update(c.advance(451));
    expect(motion.busy).toBe(false);
    expect(die.position.y).toBeCloseTo(0.25);
    expect(die.rotation.x).toBeCloseTo(-Math.PI / 2);
  });

  it("G3D-06 low tier (maxFps 30): durations are wall-clock, not frame-count", () => {
    const c = clock();
    const motion = new MotionController({ reduced: () => false, now: c.now });
    const obj = new Object3D();
    motion.place(obj, "settle:low");
    let frames = 0;
    while (motion.busy && frames < 100) {
      motion.update(c.advance(1000 / 30));
      frames += 1;
    }
    // 280 ms at 30 fps → 9 frames (33.3 ms each); never stretched by the cap.
    expect(frames).toBe(9);
    expect(obj.scale.x).toBeCloseTo(1);
  });

  it("finishAll completes pending removals", () => {
    const c = clock();
    const motion = new MotionController({ reduced: () => false, now: c.now });
    let detached = 0;
    motion.remove(new Object3D(), "a", () => { detached += 1; });
    motion.finishAll();
    expect(detached).toBe(1);
    expect(motion.busy).toBe(false);
  });
});

describe("reconcile motion hooks", () => {
  const node = (id: string, kind: SceneNode["kind"], x = 0): SceneNode => ({ id, kind, position: [x, 0, 0] });
  function host(log: string[]): ReconcileHost & { pending: (() => void)[] } {
    const pending: (() => void)[] = [];
    return {
      pending,
      root: new Object3D(),
      create: () => new Object3D(),
      update: (o, n) => { o.position.set(...n.position); },
      disposeObject: () => log.push("dispose"),
      motion: {
        added: (_o, n) => log.push(`added:${n.id}`),
        updated: (_o, p, n) => log.push(`updated:${n.id}:${p.position[0]}->${n.position[0]}`),
        removed: (_o, id, detach) => { log.push(`removed:${id}`); pending.push(detach); },
      },
    };
  }

  it("initial reconcile never animates; later diffs call hooks; registry updates immediately", () => {
    const log: string[] = [];
    const h = host(log);
    const registry = new Map<string, Object3D>();
    const first: SceneModel = { nodes: [node("robber", "robber", 0), node("settle:a", "settlement")] };
    reconcileScene(h, null, first, registry);
    expect(log).toEqual([]);
    const second: SceneModel = { nodes: [node("robber", "robber", 2), node("city:a", "city")] };
    reconcileScene(h, first, second, registry);
    expect(log).toEqual(["removed:settle:a", "added:city:a", "updated:robber:0->2"]);
    expect([...registry.keys()].sort()).toEqual(["city:a", "robber"]);
    // fading object still attached until detach; then disposed exactly once
    expect(h.root.children).toHaveLength(3);
    h.pending[0]!();
    h.pending[0]!();
    expect(h.root.children).toHaveLength(2);
    expect(log.filter((e) => e === "dispose")).toHaveLength(1);
  });
});

describe("G3D-JUDGE-PIECES motion additions", () => {
  it("hopPath starts / ends exactly, hops above the straight line, faces travel", async () => {
    const { hopPath } = await import("./motion");
    const from = [0, 0.28, 0] as const;
    const to = [2, 0.28, 0] as const;
    expect(hopPath(from, to, 0).position).toEqual([0, 0.28, 0]);
    expect(hopPath(from, to, 1).position).toEqual([2, 0.28, 0]);
    const mid = hopPath(from, to, 0.25);
    expect(mid.position[1]).toBeGreaterThan(0.28);
    // Bowed sideways (not on the straight segment).
    expect(Math.abs(hopPath(from, to, 0.5).position[2])).toBeGreaterThan(0.1);
    // Moving along +X → facing ≈ +π/2 (atan2(dx, dz)), within the bow angle.
    expect(Math.abs(hopPath(from, to, 0.5).facing - Math.PI / 2)).toBeLessThan(0.05);
  });

  it("idleBob is zero when frozen and small otherwise", async () => {
    const { idleBob } = await import("./motion");
    expect(idleBob(1234, true)).toEqual({ y: 0, tilt: 0 });
    for (const t of [0, 300, 900, 4000]) {
      const bob = idleBob(t, false);
      expect(bob.y).toBeGreaterThanOrEqual(0);
      expect(bob.y).toBeLessThan(0.06);
      expect(Math.abs(bob.tilt)).toBeLessThan(0.08);
    }
  });

  it("drainDirty reports objects posed by tweens, including the final frame", async () => {
    const { MotionController } = await import("./motion");
    const { Object3D } = await import("three");
    let now = 0;
    const motion = new MotionController({ reduced: () => false, now: () => now });
    const piece = new Object3D();
    motion.place(piece, "p");
    expect(motion.drainDirty()).toContain(piece);
    now = 1000;
    motion.update(now);
    expect(motion.busy).toBe(false);
    expect(motion.drainDirty()).toContain(piece);
    expect(motion.drainDirty()).toEqual([]);
  });

  it("camera tweens log kind camera 600 ms, reduced → 0, and stopCamera halts in place", async () => {
    const { MotionController } = await import("./motion");
    let now = 0;
    const seen: number[] = [];
    const motion = new MotionController({ reduced: () => false, now: () => now });
    expect(motion.camera("c", (p) => seen.push(p))).toBe(600);
    now = 300;
    motion.update(now);
    motion.stopCamera();
    expect(motion.busy).toBe(false);
    expect(seen.at(-1)!).toBeLessThan(1);
    const reduced = new MotionController({ reduced: () => true, now: () => 0 });
    expect(reduced.camera("c", () => {})).toBe(0);
  });
});
