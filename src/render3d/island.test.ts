import { PerspectiveCamera } from "three";
import { describe, expect, it } from "vitest";
import { dressingInputs, tileCenter, vertexWorld, withoutReplacedNodes } from "./hex-dressing";
import { mapHexSettlementToScene } from "./mappers/hex-settlement";
import { SIGN_KINDS, SKIRT_BOTTOM_Y, SKIRT_TOP_Y, coastEdges, coastWallGeometry, createIslandLayer, docksFor, outerTiles, signCell } from "./island";
import { beginnerSceneInput } from "./terrain-dressing.fixture";

const input = beginnerSceneInput();
const { tiles, ports } = dressingInputs(input);

describe("G3D-ISLAND island + coast", () => {
  it("tile centres match the scene mapper and port vertex ids parse to world", () => {
    const model = mapHexSettlementToScene(input);
    for (const node of model.nodes.filter((n) => n.kind === "tile")) {
      const tile = tiles.find((t) => Math.abs(node.position[0] - t.center[0]) < 1e-6 && Math.abs(node.position[2] - t.center[2]) < 1e-6);
      expect(tile).toBeTruthy();
    }
    expect(tileCenter(0, 0)).toEqual([0, 0, 0]);
    expect(vertexWorld("150:86.6")).toEqual([1.5, 0, 0.866]);
    expect(vertexWorld("bad")).toBeNull();
  });

  it("finds the 12 outer hexes and the 30 coast edges of the beginner board", () => {
    expect(outerTiles(tiles)).toHaveLength(12);
    expect(coastEdges(tiles)).toHaveLength(30);
  });

  it("builds one continuous coast wall (30 edges × 5 segs × 4 rows) plus a cap per tile", () => {
    const geom = coastWallGeometry(tiles);
    const pos = geom.getAttribute("position");
    expect(pos.count).toBe(30 * 5 * 4 * 6 + tiles.length * 18);
    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < pos.count; i += 1) { minY = Math.min(minY, pos.getY(i)); maxY = Math.max(maxY, pos.getY(i)); }
    expect(maxY).toBeCloseTo(SKIRT_TOP_Y, 5);
    expect(minY).toBeCloseTo(SKIRT_BOTTOM_Y, 5);
    geom.dispose();
  });

  it("docks point outward from the island, one per port", () => {
    const docks = docksFor(ports);
    expect(docks).toHaveLength(ports.length);
    for (const d of docks) {
      expect(Math.hypot(...d.dir)).toBeCloseTo(1);
      expect(Math.hypot(d.tip[0], d.tip[2])).toBeGreaterThan(Math.hypot(d.base[0], d.base[2]));
    }
  });

  it("every harbour kind has its own sign cell", () => {
    const cells = SIGN_KINDS.map((k) => signCell(k).join(","));
    expect(new Set(cells).size).toBe(SIGN_KINDS.length);
  });

  it("filters the replaced #138 nodes (grey slab / port boxes / ships / decor)", () => {
    const filtered = withoutReplacedNodes(mapHexSettlementToScene(input));
    expect(filtered.nodes.some((n) => ["cliff", "port", "ship", "decor"].includes(n.kind))).toBe(false);
    expect(filtered.nodes.some((n) => n.kind === "tile")).toBe(true);
  });

  it("builds a fixed small set of instanced meshes and freezes boats when asked", () => {
    const layer = createIslandLayer();
    layer.sync(tiles, ports, "high", true);
    const stats = layer.stats();
    expect(stats.meshes).toBeLessThanOrEqual(6);
    expect(layer.docks()).toHaveLength(ports.length);
    const camera = new PerspectiveCamera();
    camera.position.set(0, 9, 12);
    const boats = layer.group.children.find((c) => c.name.includes("boat"))!;
    expect(boats).toBeTruthy();
    layer.update(1000, camera, true);
    const frozen = JSON.stringify(boats.toJSON().object);
    layer.update(4000, camera, true);
    expect(JSON.stringify(boats.toJSON().object)).toBe(frozen);
    layer.update(4000, camera, false);
    layer.update(5500, camera, false);
    expect(JSON.stringify(boats.toJSON().object)).not.toBe(frozen);
    layer.dispose();
  });
});
