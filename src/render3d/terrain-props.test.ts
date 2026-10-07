import { describe, expect, it } from "vitest";
import { dressingInputs } from "./hex-dressing";
import { beginnerSceneInput } from "./terrain-dressing.fixture";
import {
  PROP_CENTER_CLEAR,
  PROP_COUNTS,
  PROP_KINDS,
  TERRAIN_PROPS,
  createTerrainPropLayer,
  hexMetric,
  inPropRegion,
  layoutProps,
  placeTileProps,
  buildPropGeometry,
} from "./terrain-props";

const tiles = dressingInputs(beginnerSceneInput()).tiles;
const total = (m: Map<string, unknown[]>) => [...m.values()].reduce((n, a) => n + a.length, 0);

describe("G3D-PROPS terrain props", () => {
  it("region keeps the number token centre and settlement corners clear", () => {
    expect(inPropRegion(0, 0)).toBe(false);
    expect(inPropRegion(PROP_CENTER_CLEAR * 0.9, 0)).toBe(false);
    expect(inPropRegion(0.95, 0)).toBe(false); // corner
    expect(inPropRegion(0, 0.6)).toBe(true);
    expect(hexMetric(0, 0.5)).toBeCloseTo(0.5);
  });

  it("places the full high-tier count per terrain, all inside the region", () => {
    for (const tile of tiles) {
      const counts = PROP_COUNTS.high[tile.terrain] ?? {};
      const props = placeTileProps(tile, counts);
      for (const kind of TERRAIN_PROPS[tile.terrain] ?? []) {
        const got = props.filter((p) => p.kind === kind).length;
        const want = counts[kind] ?? 0;
        if (kind === "canopy" || kind.startsWith("pine") || kind === "wheatrow") {
          expect(got, `${tile.terrain}/${kind}`).toBeGreaterThanOrEqual(Math.min(want, Math.max(6, want - 4)));
        } else expect(got, `${tile.terrain}/${kind}`).toBe(want);
      }
      for (const p of props) expect(inPropRegion(p.x - tile.center[0], p.z - tile.center[2])).toBe(true);
    }
    const woodHigh = PROP_COUNTS.high.wood!;
    expect((woodHigh.pineTall ?? 0) + (woodHigh.pineRound ?? 0) + (woodHigh.pineSmall ?? 0)).toBeGreaterThanOrEqual(50);
    expect(woodHigh.canopy ?? 0).toBeGreaterThanOrEqual(12);
    expect(PROP_COUNTS.high.sheep!.sheep).toBeGreaterThanOrEqual(16);
    expect(PROP_COUNTS.high.wheat!.wheatrow ?? 0).toBeGreaterThanOrEqual(36);
  });

  it("is deterministic; medium is reduced and low is empty", () => {
    expect(layoutProps(tiles, "high")).toEqual(layoutProps(tiles, "high"));
    const high = total(layoutProps(tiles, "high"));
    const medium = total(layoutProps(tiles, "medium"));
    expect(medium).toBeGreaterThan(0);
    expect(medium).toBeLessThan(high);
    expect(total(layoutProps(tiles, "low"))).toBe(0);
  });

  it("uses at most one instanced mesh (draw call) per prop type", () => {
    const layer = createTerrainPropLayer();
    layer.sync(tiles, "high", true);
    const names = layer.group.children.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    expect(layer.stats().meshes).toBeLessThanOrEqual(PROP_KINDS.length);
    expect(layer.group.children.every((c) => (c as { isInstancedMesh?: boolean }).isInstancedMesh)).toBe(true);
    layer.sync(tiles, "low", false);
    expect(layer.stats().meshes).toBe(0);
    layer.dispose();
  });

  it("builds distinct pine species and readable sheep / wheatrow geometry", () => {
    const tall = buildPropGeometry("pineTall");
    const round = buildPropGeometry("pineRound");
    const small = buildPropGeometry("pineSmall");
    tall.computeBoundingBox();
    round.computeBoundingBox();
    small.computeBoundingBox();
    const h = (g: ReturnType<typeof buildPropGeometry>) => g.boundingBox!.max.y - g.boundingBox!.min.y;
    const w = (g: ReturnType<typeof buildPropGeometry>) => g.boundingBox!.max.x - g.boundingBox!.min.x;
    expect(h(tall)).toBeGreaterThan(h(round) + 0.08);
    expect(h(round)).toBeGreaterThan(h(small) + 0.05);
    expect(w(round)).toBeGreaterThan(w(tall));
    // R15: lobed crowns add verts beyond smooth lathe cones.
    expect(tall.getAttribute("position").count).toBeGreaterThan(180);
    const sheep = buildPropGeometry("sheep");
    expect(sheep.getAttribute("position").count).toBeGreaterThan(120);
    const wheat = buildPropGeometry("wheatrow");
    expect(wheat.getAttribute("position").count).toBeGreaterThan(200);
    tall.dispose(); round.dispose(); small.dispose(); sheep.dispose(); wheat.dispose();
  });


  it("R16 canopy: brush-card feather geometry denser than R15 sphere cloud", () => {
    const canopy = buildPropGeometry("canopy");
    canopy.computeBoundingBox();
    expect(canopy.getAttribute("position").count).toBeGreaterThan(250);
    const h = canopy.boundingBox!.max.y - canopy.boundingBox!.min.y;
    expect(h).toBeLessThan(0.35); // flat brush stack, not tall umbrella
    canopy.dispose();
  });
  it("R15 silhouettes: mountain mass + brick mound hierarchy readable in bounds", () => {
    const boulder = buildPropGeometry("boulder");
    const clay = buildPropGeometry("clay");
    const bricks = buildPropGeometry("bricks");
    boulder.computeBoundingBox();
    clay.computeBoundingBox();
    bricks.computeBoundingBox();
    const h = (g: ReturnType<typeof buildPropGeometry>) => g.boundingBox!.max.y - g.boundingBox!.min.y;
    expect(h(boulder)).toBeGreaterThan(0.28);
    expect(boulder.getAttribute("position").count).toBeGreaterThan(200);
    expect(h(clay)).toBeGreaterThan(0.1);
    expect(bricks.getAttribute("position").count).toBeGreaterThan(80);
    expect(h(bricks)).toBeGreaterThan(0.07);
    boulder.dispose(); clay.dispose(); bricks.dispose();
  });
});
