
import { describe, expect, it } from "vitest";
import { roleFromModel, tabletopLandFromNodes } from "./imported-props";
import type { SceneNode } from "./scene-model";

describe("step3 R3 imported props on tabletop", () => {
  it("classifies pull titles into tree / station / rail roles", () => {
    expect(roleFromModel({ id: "a", url: "x", title: "Pine Tree 01" })).toBe("tree");
    expect(roleFromModel({ id: "b", url: "x", title: "Forest Cabin" })).toBe("station");
    expect(roleFromModel({ id: "c", url: "x", title: "Scan Train railwall" })).toBe("rail");
    expect(roleFromModel({ id: "d", url: "x", title: "Barrel_01" })).toBe("prop");
  });

  it("reads natural shore footprint from scene nodes", () => {
    const nodes = [
      { id: "shore", kind: "cell", mesh: "shore-natural", tag: "5:sea:natural", position: [0, 0, 0], scale: [10, 0.2, 8] },
    ] as SceneNode[];
    const land = tabletopLandFromNodes(nodes)!;
    expect(land.natural).toBe(true);
    expect(land.halfW).toBe(5);
    expect(land.seed).toBe(5);
  });
});
