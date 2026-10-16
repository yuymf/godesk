import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { LABEL_LIFT } from "../number-labels";
import { TERRAIN_MATERIALS } from "../tokens";
import { CHIP_FACE_RECESS, CHIP_FACE_RIM } from "../SceneHost";

describe("T261 · mesh face-well + oil-film clearcoat", () => {
  it("carves chip well topology and oils terrain with clearcoat normals", () => {
    expect(CHIP_FACE_RECESS).toBeGreaterThan(0.025);
    expect(CHIP_FACE_RIM).toBeGreaterThan(0.01);
    expect(LABEL_LIFT).toBeLessThan(0); // seated into mesh well
    for (const key of ["wood", "brick", "sheep", "wheat", "ore", "desert"] as const) {
      expect(TERRAIN_MATERIALS[key]!.clearcoat!).toBeGreaterThan(0.55);
      expect(TERRAIN_MATERIALS[key]!.brush!).toBeGreaterThan(0.9);
    }
    const host = readFileSync("src/render3d/SceneHost.tsx", "utf8");
    expect(host).toContain("T261");
    expect(host).toContain("CHIP_FACE_RECESS");
    expect(host).toMatch(/mesh face well|carved/);
    const mats = readFileSync("src/render3d/materials.ts", "utf8");
    expect(mats).toContain("oilFilm");
    expect(mats).toContain("gdBn");
    expect(mats).toContain("brush-t261");
    const plaque = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(plaque).toContain("mesh-recessed parchment");
    const objs = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(objs).toContain("pile-height displacement");
    expect(objs).toContain("oil-film felt");
  });
});
