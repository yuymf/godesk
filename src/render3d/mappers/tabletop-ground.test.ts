import { describe, expect, it } from "vitest";
import { groundVariation } from "./tabletop";

const layout = {
  board: { width: 8, depth: 6, objectKind: "board" },
  links: [{ id: "l", from: [-2, 0] as [number, number], to: [2, 0] as [number, number], width: 0.2, objectKind: "route" }],
  pieces: [], cells: [], hints: [],
} as never;

describe("groundVariation (step3 R5)", () => {
  it("emits dirt route beds, dark patches, mounds and optional sand edge deterministically", () => {
    const a = groundVariation(layout, 3, 0.2, true);
    expect(a).toEqual(groundVariation(layout, 3, 0.2, true));
    const keys = new Set(a.map((g) => g.key));
    for (const k of ["ground-dirt", "ground-dark", "ground-sand"]) expect(keys.has(k)).toBe(true);
    expect(groundVariation(layout, 3, 0.2, false).some((g) => g.key === "ground-sand")).toBe(false);
  });
});
