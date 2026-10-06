import { describe, expect, it } from "vitest";
import { JUDGE_PRESETS, judgeCamera, orbit, pickCoast, pickTerrainCluster } from "./judge-camera";
import type { SceneNode } from "./scene-model";

const R = 0.95 * 2;
const tile = (id: string, x: number, z: number, tag: string): SceneNode => ({ id, kind: "tile", position: [x, 0, z], tag });
const NODES: SceneNode[] = [
  tile("t0", 0, 0, "desert"),
  tile("t1", R, 0, "wood"),
  tile("t2", R * 1.5, R * 0.87, "sheep"),
  tile("t3", R * 2, 0, "ore"),
  tile("t4", R * 1.5, -R * 0.87, "wheat"),
  tile("t5", -R * 2, 0, "brick"),
  { id: "port:0", kind: "port", position: [0.5, 0.05, 4.4], tag: "3:1" },
  { id: "port:1", kind: "port", position: [0, 0.05, -4.4], tag: "3:1" },
  { id: "die:0", kind: "die", position: [4, 0.25, 3.2], number: 3 },
];

describe("judge camera presets (G3D-JUDGE, ?judge=1 only)", () => {
  it("default keeps SceneHost's fitted camera", () => {
    expect(judgeCamera("a-default", NODES, 1.6)).toBeNull();
  });

  it("terrain close-up targets the tile cluster covering forest/pasture/mountain/fields", () => {
    const c = pickTerrainCluster(NODES)!;
    // 以 t2 为中心的簇（t1..t4 互为邻居）在岛的 +X 侧。
    expect(c[0]).toBeGreaterThan(R);
    const pose = judgeCamera("b-terrain", NODES, 1.6)!;
    expect(pose.target).toEqual(c);
    expect(Math.hypot(pose.position[0] - c[0], pose.position[1] - c[1], pose.position[2] - c[2])).toBeCloseTo(4.6, 5);
  });

  it("coast picks the camera-side harbour; c-coast / a3 frame the whole island like the reference", () => {
    expect(pickCoast(NODES)!.port).toEqual([0.5, 0.05, 4.4]);
    const pitch = (p: { position: readonly number[]; target: readonly number[] }) => {
      const dy = p.position[1]! - p.target[1]!;
      const h = Math.hypot(p.position[0]! - p.target[0]!, p.position[2]! - p.target[2]!);
      return (Math.atan2(dy, h) * 180) / Math.PI;
    };
    const coast = judgeCamera("c-coast", NODES, 1.6)!;
    expect(pitch(coast)).toBeGreaterThan(55);
    expect(pitch(coast)).toBeLessThan(62);
    expect(coast.position[2]).toBeGreaterThan(coast.target[2]);
    expect(pitch(judgeCamera("a3-topdown", NODES, 1.6)!)).toBeGreaterThan(85);
    const d = (p: { position: readonly number[]; target: readonly number[] }) => Math.hypot(...p.position.map((v, i) => v - p.target[i]!) as [number, number, number]);
    expect(d(judgeCamera("c-coast", NODES, 0.46)!)).toBeGreaterThan(d(coast));
  });

  it("dice preset uses the director's play framing (tray is a screen-corner overlay)", () => {
    expect(judgeCamera("f-dice", NODES, 1.6)).toBeNull();
    expect(judgeCamera("f-dice", NODES, 0.46)).toBeNull();
  });

  it("orbit puts polar 0 straight above the target", () => {
    const p = orbit([1, 0, 2], 5, 0, 0);
    expect(p[0]).toBeCloseTo(1, 6);
    expect(p[1]).toBeCloseTo(5, 6);
    expect(p[2]).toBeCloseTo(2, 6);
    expect(JUDGE_PRESETS).toContain("g-midgame");
  });
});
