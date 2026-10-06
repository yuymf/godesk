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
    expect(Math.hypot(pose.position[0] - c[0], pose.position[1] - c[1], pose.position[2] - c[2])).toBeCloseTo(3.6, 5);
  });

  it("coast picks the camera-side harbour and stands out at sea, low and looking inward", () => {
    expect(pickCoast(NODES)!.port).toEqual([0.5, 0.05, 4.4]);
    const pose = judgeCamera("c-coast", NODES, 1.6)!;
    expect(pose.position[2]).toBeGreaterThan(pose.target[2]);
    expect(pose.position[1]).toBeLessThan(2.5);
  });

  it("dice preset frames die:0; narrow (iPhone) presets pull back further", () => {
    const wide = judgeCamera("f-dice", NODES, 1.6)!;
    const narrow = judgeCamera("f-dice", NODES, 0.46)!;
    expect(wide.target[0]).toBeCloseTo(4.2, 5);
    const d = (p: typeof wide) => Math.hypot(...p.position.map((v, i) => v - p.target[i]!) as [number, number, number]);
    expect(d(narrow)).toBeGreaterThan(d(wide));
  });

  it("orbit puts polar 0 straight above the target", () => {
    const p = orbit([1, 0, 2], 5, 0, 0);
    expect(p[0]).toBeCloseTo(1, 6);
    expect(p[1]).toBeCloseTo(5, 6);
    expect(p[2]).toBeCloseTo(2, 6);
    expect(JUDGE_PRESETS).toContain("g-midgame");
  });
});
