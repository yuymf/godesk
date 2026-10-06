import { describe, expect, it } from "vitest";
import { materialFor } from "./SceneHost";
import type { SceneNode } from "./scene-model";

const node = (partial: Partial<SceneNode> & Pick<SceneNode, "kind">): SceneNode => ({ id: "n", position: [0, 0, 0], ...partial });

describe("G3D-07 SceneNode → shared material preset", () => {
  it("maps tiles to terrain presets with PBR sets and a desert fallback", () => {
    expect(materialFor(node({ kind: "tile", tag: "wheat" }))).toMatchObject({ key: "terrain-wheat", token: { pattern: "grass", pbrSet: "t04-wheat" } });
    expect(materialFor(node({ kind: "tile", tag: "lava" })).key).toBe("terrain-desert");
  });

  it("gives all seat pieces one material per seat (settlement / city / road share it)", () => {
    const keys = (["settlement", "city", "road"] as const).map((kind) => materialFor(node({ kind, seat: 2 })).key);
    expect(new Set(keys)).toEqual(new Set(["seat-2"]));
    expect(materialFor(node({ kind: "city", seat: 2 })).token.base).toBe("#27ae60");
  });

  it("keeps decor procedural only (too small for texture streaming)", () => {
    const { key, token } = materialFor(node({ kind: "decor", tag: "ore" }));
    expect(key).toBe("decor-ore");
    expect(token.pbrSet).toBeUndefined();
    expect(token.pattern).toBe("stone");
  });

  it("maps props: hot tokens, wood for ports / ships / tray, cliff fallback", () => {
    expect(materialFor(node({ kind: "number-token", tag: "hot" })).key).toBe("number-token-hot");
    expect(materialFor(node({ kind: "number-token", tag: "normal" })).token.pbrSet).toBe("t11-parchment");
    for (const kind of ["port", "ship", "dice-tray"] as const) expect(materialFor(node({ kind })).key).toBe("wood");
    expect(materialFor(node({ kind: "cliff" })).token.pbrSet).toBe("t07-cliff");
  });
});
