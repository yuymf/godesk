import { InstancedMesh, Matrix4, PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { dressingInputs, tileCenter, vertexWorld, withoutReplacedNodes } from "./hex-dressing";
import { mapHexSettlementToScene } from "./mappers/hex-settlement";
import { SIGN_KINDS, SKIRT_BOTTOM_Y, SKIRT_TOP_Y, WATER_Y, boatGeometry, coastEdges, coastWallGeometry, createIslandLayer, dockGeometry, docksFor, outerTiles, reefClusterSize, reefEdgeMask, signCell } from "./island";
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

  it("builds one continuous coast wall (irregular segs × 4 rows) plus a cap per tile", () => {
    const geom = coastWallGeometry(tiles);
    const pos = geom.getAttribute("position");
    // R14：每边 4–6 不规则分段；30 边 ×[4,6] ×4 rows ×6 verts + caps
    expect(pos.count).toBeGreaterThanOrEqual(30 * 4 * 4 * 6 + tiles.length * 18);
    expect(pos.count).toBeLessThanOrEqual(30 * 6 * 4 * 6 + tiles.length * 18);
    expect((pos.count - tiles.length * 18) % 6).toBe(0);
    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < pos.count; i += 1) { minY = Math.min(minY, pos.getY(i)); maxY = Math.max(maxY, pos.getY(i)); }
    expect(maxY).toBeCloseTo(SKIRT_TOP_Y, 5);
    expect(minY).toBeCloseTo(SKIRT_BOTTOM_Y, 5);
    geom.dispose();
  });


  it("reef mask is discontinuous (not every coast edge) and clusters are small", () => {
    const edges = coastEdges(tiles);
    let on = 0;
    for (let i = 0; i < edges.length; i += 1) if (reefEdgeMask(i)) on += 1;
    expect(on).toBeGreaterThan(8);
    expect(on).toBeLessThan(edges.length); // gaps → not a full ring
    expect(reefClusterSize(0)).toBeGreaterThanOrEqual(2);
    expect(reefClusterSize(0)).toBeLessThanOrEqual(4);
  });

  it("high shore-stones include reef clusters + gap wall-huggers; medium count unchanged", () => {
    const layer = createIslandLayer();
    layer.sync(tiles, ports, "medium", true);
    const mid = layer.group.children.find((c) => c.name === "island:shore-stones") as InstancedMesh;
    expect(mid.count).toBe(coastEdges(tiles).length * 4);
    layer.sync(tiles, ports, "high", true);
    const hi = layer.group.children.find((c) => c.name === "island:shore-stones") as InstancedMesh;
    // base 120 + reef clusters on ~55% edges + 1–2 huggers on the rest
    expect(hi.count).toBeGreaterThan(mid.count + 20);
    expect(layer.group.children.some((c) => c.name === "island:beach-steps")).toBe(false);
    const mm = new Matrix4();
    const pp = new Vector3();
    let raised = 0;
    for (let i = 0; i < hi.count; i += 1) {
      hi.getMatrixAt(i, mm);
      pp.setFromMatrixPosition(mm);
      if (pp.y > WATER_Y + 0.04) raised += 1;
    }
    expect(raised).toBeGreaterThan(6);
    // gap edges (~45%) each add 1–2 wall-huggers on top of reef clusters
    const edges = coastEdges(tiles).length;
    let gaps = 0;
    for (let i = 0; i < edges; i += 1) if (!reefEdgeMask(i)) gaps += 1;
    expect(hi.count).toBeGreaterThanOrEqual(mid.count + gaps);
    layer.dispose();
  });


  it("high cliff wetFootDark darkens the lower skirt vs default", () => {
    const plain = coastWallGeometry(tiles);
    const wet = coastWallGeometry(tiles, { wetFootDark: true });
    const c0 = plain.getAttribute("color");
    const c1 = wet.getAttribute("color");
    const y0 = plain.getAttribute("position");
    let sum0 = 0, sum1 = 0, n = 0;
    for (let i = 0; i < y0.count; i += 1) {
      if (y0.getY(i) > WATER_Y) continue;
      sum0 += c0.getX(i) + c0.getY(i) + c0.getZ(i);
      sum1 += c1.getX(i) + c1.getY(i) + c1.getZ(i);
      n += 1;
    }
    expect(n).toBeGreaterThan(100);
    expect(sum1 / n).toBeLessThan(sum0 / n);
    plain.dispose(); wet.dispose();
  });

  it("midBandDark darkens cliff mid verts; top rim stays brighter", () => {
    const plain = coastWallGeometry(tiles, { wetFootDark: true });
    const mid = coastWallGeometry(tiles, { wetFootDark: true, midBandDark: 1 });
    const faint = coastWallGeometry(tiles, { wetFootDark: true, midBandDark: 0.34 });
    const y0 = plain.getAttribute("position");
    const c0 = plain.getAttribute("color");
    const c1 = mid.getAttribute("color");
    const c2 = faint.getAttribute("color");
    const tOf = (i: number) => {
      const y = y0.getY(i);
      return (SKIRT_TOP_Y - y) / (SKIRT_TOP_Y - SKIRT_BOTTOM_Y);
    };
    let mid0 = 0, mid1 = 0, mid2 = 0, midN = 0;
    let rim0 = 0, rim1 = 0, rimN = 0;
    for (let i = 0; i < y0.count; i += 1) {
      const t = tOf(i);
      const s0 = c0.getX(i) + c0.getY(i) + c0.getZ(i);
      const s1 = c1.getX(i) + c1.getY(i) + c1.getZ(i);
      const s2 = c2.getX(i) + c2.getY(i) + c2.getZ(i);
      if (t > 0.10 && t < 0.30) { mid0 += s0; mid1 += s1; mid2 += s2; midN += 1; }
      if (t < 0.05) { rim0 += s0; rim1 += s1; rimN += 1; }
    }
    expect(midN).toBeGreaterThan(50);
    expect(rimN).toBeGreaterThan(20);
    expect(mid1 / midN).toBeLessThan(mid0 / midN);
    expect(mid2 / midN).toBeGreaterThan(mid1 / midN);
    expect(mid2 / midN).toBeLessThan(mid0 / midN);
    // Rim largely unchanged (mid band gate starts ~0.06).
    expect(Math.abs(rim1 / rimN - rim0 / rimN)).toBeLessThan(0.05);
    expect(plain.getAttribute("position").count).toBe(mid.getAttribute("position").count);
    plain.dispose(); mid.dispose(); faint.dispose();
  });

  it("pier wetFoot darkens post verts near waterline; deck stays dry", () => {
    const dry = dockGeometry(0.62, 0);
    const wet = dockGeometry(0.62, 1);
    const faint = dockGeometry(0.62, 0.32);
    // Wet adds skirt rings → more verts than dry; compare colors on the shared post band via dry positions.
    const pDry = dry.getAttribute("position");
    const c0 = dry.getAttribute("color");
    let footDry = 0, footN = 0, deckDry = 0, deckN = 0;
    for (let i = 0; i < pDry.count; i += 1) {
      const y = pDry.getY(i);
      const s0 = c0.getX(i) + c0.getY(i) + c0.getZ(i);
      if (y < -0.05) { footDry += s0; footN += 1; }
      else if (y > 0.0) { deckDry += s0; deckN += 1; }
    }
    expect(footN).toBeGreaterThan(20);
    expect(deckN).toBeGreaterThan(20);
    // Wet/faint geometries include skirts; mean luminance of verts below waterline damp band should be darker.
    const meanBelow = (g: ReturnType<typeof dockGeometry>) => {
      const p = g.getAttribute("position");
      const c = g.getAttribute("color");
      let s = 0, n = 0;
      for (let i = 0; i < p.count; i += 1) {
        if (p.getY(i) > -0.04) continue;
        s += c.getX(i) + c.getY(i) + c.getZ(i);
        n += 1;
      }
      return s / n;
    };
    const mDry = meanBelow(dry);
    const mWet = meanBelow(wet);
    const mFaint = meanBelow(faint);
    expect(mWet).toBeLessThan(mDry);
    expect(mFaint).toBeGreaterThan(mWet);
    expect(mFaint).toBeLessThan(mDry);
    // Skirts add verts; deck planks on dry geom sit above dampTop and are not the wet target.
    expect(wet.getAttribute("position").count).toBeGreaterThan(dry.getAttribute("position").count);
    expect(faint.getAttribute("position").count).toBeGreaterThan(dry.getAttribute("position").count);
    dry.dispose(); wet.dispose(); faint.dispose();
  });

  it("boat wetLine darkens hull near waterline; sail stays bright", () => {
    const dry = boatGeometry(0);
    const wet = boatGeometry(1);
    const faint = boatGeometry(0.32);
    const meanBand = (g: ReturnType<typeof boatGeometry>, lo: number, hi: number) => {
      const p = g.getAttribute("position");
      const c = g.getAttribute("color");
      let s = 0, n = 0;
      for (let i = 0; i < p.count; i += 1) {
        const y = p.getY(i);
        if (y < lo || y > hi) continue;
        s += c.getX(i) + c.getY(i) + c.getZ(i);
        n += 1;
      }
      return { mean: s / Math.max(1, n), n };
    };
    const hullDry = meanBand(dry, -0.05, 0.02);
    const hullWet = meanBand(wet, -0.05, 0.02);
    const hullFaint = meanBand(faint, -0.05, 0.02);
    const sailDry = meanBand(dry, 0.15, 0.55);
    const sailWet = meanBand(wet, 0.15, 0.55);
    expect(hullDry.n).toBeGreaterThan(10);
    expect(sailDry.n).toBeGreaterThan(4);
    expect(hullWet.mean).toBeLessThan(hullDry.mean);
    expect(hullFaint.mean).toBeGreaterThan(hullWet.mean);
    expect(hullFaint.mean).toBeLessThan(hullDry.mean);
    expect(Math.abs(sailWet.mean - sailDry.mean)).toBeLessThan(0.05);
    expect(wet.getAttribute("position").count).toBeGreaterThan(dry.getAttribute("position").count);
    dry.dispose(); wet.dispose(); faint.dispose();
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
    expect(layer.group.children.some((c) => c.name === "island:beach-steps")).toBe(false);

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
