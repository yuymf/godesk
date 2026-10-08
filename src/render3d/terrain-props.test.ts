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
  createSheepDissolveMaterial,
  SHEEP_DISSOLVE_BAND,
  TILE_TOP,
  SHEEP_CLUMP_GAP,
  SHEEP_CLUMP_RADIUS,
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
    // R21: low, dense small-conifer clusters (more trees, none taller — see "R20 forest + ore" height test).
    const trees = (woodHigh.pineTall ?? 0) + (woodHigh.pineRound ?? 0) + (woodHigh.pineSmall ?? 0);
    expect(trees).toBeGreaterThanOrEqual(44);
    expect(trees).toBeLessThanOrEqual(64);
    expect(woodHigh.canopy ?? 0).toBeLessThanOrEqual(8);
    expect(PROP_COUNTS.high.ore!.boulder ?? 0).toBeLessThanOrEqual(5);
    // R19: a small readable flock (settlecoast-like), not a shrub carpet.
    expect(PROP_COUNTS.high.sheep!.sheep).toBeGreaterThanOrEqual(5);
    expect(PROP_COUNTS.high.sheep!.sheep).toBeLessThanOrEqual(9);
    // R23: continuous golden ground field — no wheatrow / sheaf props (readable rows gone).
    expect(PROP_COUNTS.high.wheat!.wheatrow ?? 0).toBe(0);
    expect(PROP_COUNTS.high.wheat!.sheaf ?? 0).toBe(0);
    expect(PROP_COUNTS.medium.wheat!.wheatrow ?? 0).toBe(0);
  });

  it("is deterministic; medium is reduced and low keeps only short forest trees", () => {
    expect(layoutProps(tiles, "high")).toEqual(layoutProps(tiles, "high"));
    const high = total(layoutProps(tiles, "high"));
    const medium = total(layoutProps(tiles, "medium"));
    expect(medium).toBeGreaterThan(0);
    expect(medium).toBeLessThan(high);
    // R20: low tier (phone power-save) — forests still show short trees, nothing else.
    const low = layoutProps(tiles, "low");
    expect(total(low)).toBeGreaterThan(0);
    expect(total(low)).toBeLessThan(medium);
    expect([...low.keys()].sort()).toEqual(["pineRound", "pineSmall"]);
    for (const list of low.values()) expect(list.every((p) => p.terrain === "wood")).toBe(true);
    const woodTiles = tiles.filter((t) => t.terrain === "wood").length;
    expect(total(low)).toBeGreaterThanOrEqual(woodTiles * 10);
  });

  it("uses at most one instanced mesh (draw call) per prop type", () => {
    const layer = createTerrainPropLayer();
    layer.sync(tiles, "high", true);
    const names = layer.group.children.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    expect(layer.stats().meshes).toBeLessThanOrEqual(PROP_KINDS.length);
    expect(layer.group.children.every((c) => (c as { isInstancedMesh?: boolean }).isInstancedMesh)).toBe(true);
    layer.sync(tiles, "low", false);
    // R20: low = 2 meshes (short pines), no shadows
    expect(layer.stats().meshes).toBe(2);
    expect(layer.group.children.every((c) => !(c as { castShadow?: boolean }).castShadow)).toBe(true);
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
    // R21: low stubble rows (R20 rows were ≈0.31 tall)
    wheat.computeBoundingBox();
    expect(wheat.boundingBox!.max.y - wheat.boundingBox!.min.y).toBeLessThan(0.18);
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

  it("R17 sheep: meadow-tinted blotch silhouette denser than white toy ball", () => {
    const sheep = buildPropGeometry("sheep");
    sheep.computeBoundingBox();
    // brush cards + dual bleed discs + blotches → more verts than R16 cream wool
    expect(sheep.getAttribute("position").count).toBeGreaterThan(200);
    const h = sheep.boundingBox!.max.y - sheep.boundingBox!.min.y;
    expect(h).toBeLessThan(0.28); // flattened color-blotch silhouette, not tall toy
    expect(h).toBeGreaterThan(0.12);
    sheep.dispose();
  });
  it("R15 silhouettes: mountain mass + brick mound hierarchy readable in bounds", () => {
    const boulder = buildPropGeometry("boulder");
    const clay = buildPropGeometry("clay");
    const bricks = buildPropGeometry("bricks");
    boulder.computeBoundingBox();
    clay.computeBoundingBox();
    bricks.computeBoundingBox();
    const h = (g: ReturnType<typeof buildPropGeometry>) => g.boundingBox!.max.y - g.boundingBox!.min.y;
    // R20: low ground-hugging rock cluster (R19 was > 0.28 tall)
    expect(h(boulder)).toBeGreaterThan(0.08);
    expect(h(boulder)).toBeLessThan(0.16);
    expect(boulder.getAttribute("position").count).toBeGreaterThan(200);
    expect(h(clay)).toBeGreaterThan(0.1);
    expect(bricks.getAttribute("position").count).toBeGreaterThan(80);
    expect(h(bricks)).toBeGreaterThan(0.07);
    boulder.dispose(); clay.dispose(); bricks.dispose();
  });

  it("R18 sheep: edges dissolve — RGBA bleed with alpha→0 rim, no contact blob shadow, no cast shadow", () => {
    const sheep = buildPropGeometry("sheep");
    const col = sheep.getAttribute("color");
    expect(col.itemSize).toBe(4);
    let minA = 1;
    for (let i = 0; i < col.count; i += 1) minA = Math.min(minA, col.getW(i));
    expect(minA).toBeLessThan(0.05);
    sheep.computeBoundingBox();
    // R19: stands on legs (readable sheep), still below the R17 0.28 toy height
    expect(sheep.boundingBox!.max.y - sheep.boundingBox!.min.y).toBeLessThan(0.25);
    sheep.dispose();
    const sheepTile = tiles.find((t) => t.terrain === "sheep")!;
    const props = placeTileProps(sheepTile, PROP_COUNTS.high.sheep!);
    const sheepXZ = props.filter((p) => p.kind === "sheep").map((p) => `${p.x},${p.z}`);
    const blobXZ = props.filter((p) => p.kind === "blobshadow").map((p) => `${p.x},${p.z}`);
    expect(sheepXZ.some((k) => blobXZ.includes(k))).toBe(false);
    const layer = createTerrainPropLayer();
    layer.sync(tiles, "high", true);
    const mesh = layer.group.children.find((c) => c.name === "prop:sheep") as unknown as { castShadow: boolean; material: { transparent: boolean } };
    expect(mesh.castShadow).toBe(false);
    expect(mesh.material.transparent).toBe(true);
    layer.dispose();
  });

  it("R18 sheep material: world grass pattern + height band fades into meadow ground", () => {
    const m = createSheepDissolveMaterial();
    expect(m.transparent).toBe(true);
    expect(m.customProgramCacheKey()).toBe("gd-sheep-dissolve-r19");
    const shader = {
      uniforms: {} as Record<string, { value: unknown }>,
      vertexShader: "#include <common>\nvoid main() {\n#include <project_vertex>\n}",
      fragmentShader: "#include <common>\nvoid main() {\n#include <color_fragment>\n#include <roughnessmap_fragment>\n}",
    };
    m.onBeforeCompile(shader as never, undefined as never);
    expect(shader.uniforms.uGdGround).toBeDefined();
    expect(shader.fragmentShader).toContain("float gdLow");
    expect(shader.fragmentShader).toContain("diffuseColor.a *=");
    expect(SHEEP_DISSOLVE_BAND[0]).toBeGreaterThan(TILE_TOP);
    expect(SHEEP_DISSOLVE_BAND[1]).toBeLessThan(TILE_TOP + 0.12);
    m.dispose();
  });

  it("R19 sheep: white fleece + dark head/legs, ground disc is bright pasture (no dark contact shadow)", () => {
    const sheep = buildPropGeometry("sheep");
    const col = sheep.getAttribute("color");
    const pos = sheep.getAttribute("position");
    let fleece = 0;
    let fleeceLum = 0;
    let dark = 0;
    let discMin = 1;
    for (let i = 0; i < col.count; i += 1) {
      const [r, g, b, a] = [col.getX(i), col.getY(i), col.getZ(i), col.getW(i)];
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (a < 1) {
        discMin = Math.min(discMin, lum);
        continue;
      }
      if (pos.getY(i) > 0.12 && Math.max(r, g, b) - Math.min(r, g, b) < 0.12) {
        fleece += 1;
        fleeceLum += lum;
      }
      if (lum < 0.12) dark += 1;
    }
    expect(fleece).toBeGreaterThan(200);
    expect(fleeceLum / fleece).toBeGreaterThan(0.6);
    expect(dark).toBeGreaterThan(20); // head + legs keep the silhouette
    expect(discMin).toBeGreaterThan(0.15); // pasture tone, not a dark blob
    sheep.dispose();
  });

  it("R18 canopies: clumped painted crowns (no smooth lathe umbrella), brush cards kept", () => {
    const canopy = buildPropGeometry("canopy");
    canopy.computeBoundingBox();
    // umbrella volume gone: canopy is a near-flat feathered card stack only
    expect(canopy.boundingBox!.max.y - canopy.boundingBox!.min.y).toBeLessThan(0.3);
    canopy.dispose();
    for (const kind of ["pineTall", "pineRound", "pineSmall"] as const) {
      const g = buildPropGeometry(kind);
      // clumps are icosahedron(detail 1) lobes: 240 verts each → far more facets than R17 lathe crowns
      expect(g.getAttribute("position").count, kind).toBeGreaterThan(kind === "pineSmall" ? 900 : 1100);
      g.computeBoundingBox();
      // brush cards keep a near-flat feathered layer (R16 close-up feather not regressed)
      expect(g.boundingBox!.max.x - g.boundingBox!.min.x, kind).toBeGreaterThan(0.12);
      g.dispose();
    }
  });

  it("R20 forest + ore: lower and smaller than R19 at placement scale", () => {
    const wood = tiles.find((t) => t.terrain === "wood")!;
    const props = placeTileProps(wood, PROP_COUNTS.high.wood!);
    const pines = props.filter((p) => p.kind.startsWith("pine"));
    // tallest placed tree ≈ geometry height × scale × stretch stays well under the R19 ~0.9
    const tall = buildPropGeometry("pineTall");
    tall.computeBoundingBox();
    const tallH = tall.boundingBox!.max.y - tall.boundingBox!.min.y;
    for (const p of pines.filter((q) => q.kind === "pineTall")) expect(tallH * p.scale * p.stretch).toBeLessThan(0.5);
    for (const p of pines) expect(p.scale).toBeLessThanOrEqual(0.86);
    // R21: denser forest must not grow taller — every pine stays within R20's max scale per species
    const r20Max = { pineTall: 0.78, pineRound: 0.8, pineSmall: 0.86 } as Record<string, number>;
    for (const p of pines) expect(p.scale, p.kind).toBeLessThanOrEqual(r20Max[p.kind]!);
    tall.dispose();
    const ore = tiles.find((t) => t.terrain === "ore")!;
    for (const p of placeTileProps(ore, PROP_COUNTS.high.ore!).filter((q) => q.kind === "boulder")) {
      expect(p.scale * p.stretch).toBeLessThan(1.25);
    }
  });

  it("R20 sheep: clumps of 3–5 with gaps between clumps (not a uniform scatter)", () => {
    for (const tier of ["high", "medium"] as const) {
      for (const tile of tiles.filter((t) => t.terrain === "sheep")) {
        const sheep = placeTileProps(tile, PROP_COUNTS[tier].sheep!).filter((p) => p.kind === "sheep");
        expect(sheep.length).toBe(PROP_COUNTS[tier].sheep!.sheep);
        // single-linkage clusters at 0.3 (≈ 2× in-clump spacing)
        const parent = sheep.map((_, i) => i);
        const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
        for (let i = 0; i < sheep.length; i += 1) {
          for (let j = i + 1; j < sheep.length; j += 1) {
            if (Math.hypot(sheep[i]!.x - sheep[j]!.x, sheep[i]!.z - sheep[j]!.z) < 0.3) parent[find(i)] = find(j);
          }
        }
        const sizes = new Map<number, number>();
        for (let i = 0; i < sheep.length; i += 1) sizes.set(find(i), (sizes.get(find(i)) ?? 0) + 1);
        for (const n of sizes.values()) {
          expect(n, `${tier} ${tile.q},${tile.r}`).toBeGreaterThanOrEqual(3);
          expect(n, `${tier} ${tile.q},${tile.r}`).toBeLessThanOrEqual(5);
        }
        if (tier === "high") expect(sizes.size).toBe(2);
        // R21: in-clump spread — no two sheep closer than ~0.2 (one wool cloud otherwise)
        for (let i = 0; i < sheep.length; i += 1) {
          for (let j = i + 1; j < sheep.length; j += 1) {
            expect(Math.hypot(sheep[i]!.x - sheep[j]!.x, sheep[i]!.z - sheep[j]!.z)).toBeGreaterThanOrEqual(0.195);
          }
        }
      }
    }
    expect(SHEEP_CLUMP_GAP).toBeGreaterThan(SHEEP_CLUMP_RADIUS * 2);
  });
});

describe("R22 forest haze + R23 continuous wheat field", () => {
  it("wood hexes carry no translucent canopy cards (light-green haze in close view)", () => {
    for (const tier of ["high", "medium", "low"] as const) {
      expect(PROP_COUNTS[tier].wood?.canopy ?? 0, tier).toBe(0);
      expect(layoutProps(tiles, tier).get("canopy") ?? []).toHaveLength(0);
    }
  });

  it("wheat hexes place no wheatrow / sheaf props (continuous golden ground field)", () => {
    for (const tier of ["high", "medium", "low"] as const) {
      expect(PROP_COUNTS[tier].wheat?.wheatrow ?? 0, tier).toBe(0);
      expect(PROP_COUNTS[tier].wheat?.sheaf ?? 0, tier).toBe(0);
      for (const tile of tiles.filter((t) => t.terrain === "wheat")) {
        const placed = placeTileProps(tile, PROP_COUNTS[tier].wheat ?? {});
        expect(placed.filter((p) => p.kind === "wheatrow" || p.kind === "sheaf"), `${tier} ${tile.q},${tile.r}`).toHaveLength(0);
      }
      expect(layoutProps(tiles, tier).get("wheatrow") ?? []).toHaveLength(0);
      expect(layoutProps(tiles, tier).get("sheaf") ?? []).toHaveLength(0);
    }
    // geometry kept for potential sparse accents; still low if ever re-enabled
    const geom = buildPropGeometry("wheatrow");
    geom.computeBoundingBox();
    expect(geom.boundingBox!.max.y - geom.boundingBox!.min.y).toBeLessThan(0.18);
    geom.dispose();
  });
});
