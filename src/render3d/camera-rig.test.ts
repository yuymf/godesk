import { describe, expect, it } from "vitest";
import { MathUtils, PerspectiveCamera, Vector3 } from "three";
import { playFraming,
  angleDelta,
  cameraModeFor,
  clampTarget,
  clampZoom,
  fitDistance,
  framingPoints,
  islandCenter,
  maxSeaDistance,
  maxSeaPolar,
  orbitOffset,
  PLAY_MIN_POLAR_DEG,
  SEA_EDGE_PAD,
  SEA_HALF_EXTENT,
  seaSafeFraming,
  ZOOM_LIMITS,
  type V3,
} from "./camera-rig";
import { WATER_HALF_EXTENT } from "./water/mesh";
import { mapHexSettlementToScene } from "./mappers/hex-settlement";

const TILES = (() => {
  const tiles: { q: number; r: number; terrain: string; number: number | null }[] = [];
  for (let q = -2; q <= 2; q += 1) {
    for (let r = -2; r <= 2; r += 1) {
      if (Math.abs(q + r) > 2) continue;
      tiles.push({ q, r, terrain: q === 0 && r === 0 ? "desert" : "wood", number: q === 0 && r === 0 ? null : 6 });
    }
  }
  return tiles;
})();

function model() {
  return mapHexSettlementToScene({ tiles: TILES, robberHex: "0,0", ports: [], players: [], lastDice: [3, 4] });
}

/** Standard island + a ring of nine harbour markers just off the coast (as the mapper places them). */
function islandWithHarbours() {
  const nodes = [...model().nodes];
  for (let i = 0; i < 9; i += 1) {
    const a = (i / 9) * Math.PI * 2 + 0.2;
    nodes.push({ id: `port:${i}`, kind: "port", position: [Math.cos(a) * 4.7, 0.05, Math.sin(a) * 4.7] });
  }
  return nodes;
}

/** Where each frustum corner ray meets y = 0 (null when it misses: horizon / sky in view). */
function cornerHits(target: V3, distance: number, polar: number, azimuth: number, aspect: number) {
  const camera = new PerspectiveCamera(45, aspect, 0.1, 500);
  const [ox, oy, oz] = orbitOffset(distance, polar, azimuth);
  camera.position.set(target[0] + ox, target[1] + oy, target[2] + oz);
  camera.lookAt(target[0], target[1], target[2]);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, y]) => {
    const dir = new Vector3(x, y, 0.5).unproject(camera).sub(camera.position).normalize();
    if (dir.y >= 0) return null;
    const t = -camera.position.y / dir.y;
    return camera.position.clone().addScaledVector(dir, t);
  });
}

function insideSea(hits: ReturnType<typeof cornerHits>, half = SEA_HALF_EXTENT) {
  return hits.every((h) => h !== null && Math.abs(h.x) <= half + 1e-6 && Math.abs(h.z) <= half + 1e-6);
}

function projectAll(points: readonly V3[], target: V3, distance: number, polar: number, azimuth: number, aspect: number) {
  const camera = new PerspectiveCamera(45, aspect, 0.1, 200);
  const [ox, oy, oz] = orbitOffset(distance, polar, azimuth);
  camera.position.set(target[0] + ox, target[1] + oy, target[2] + oz);
  camera.lookAt(target[0], target[1], target[2]);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return points.map((p) => new Vector3(...p).project(camera));
}

describe("camera rig (pure)", () => {
  it("cameraModeFor: local turn → play, AI / opponent → overview, spectator → play", () => {
    expect(cameraModeFor(0, 0)).toBe("play");
    expect(cameraModeFor(0, 1)).toBe("overview");
    expect(cameraModeFor(null, 1)).toBe("play");
  });

  it("clampZoom keeps 70%–320%", () => {
    expect(clampZoom(10)).toBe(ZOOM_LIMITS.max);
    expect(clampZoom(0.1)).toBe(ZOOM_LIMITS.min);
    expect(clampZoom(Number.NaN)).toBe(1);
  });

  it("clampTarget pulls the pan target back onto a disc around the island", () => {
    expect(clampTarget([10, 3, 0], [0, 0, 0], 2)).toEqual([2, 0, 0]);
    expect(clampTarget([1, 3, 1], [0, 0, 0], 2)).toEqual([1, 0, 1]);
  });

  it("angleDelta takes the short way round", () => {
    expect(angleDelta(0.1, Math.PI * 2 - 0.1)).toBeCloseTo(-0.2, 6);
    expect(angleDelta(-3, 3)).toBeCloseTo(6 - Math.PI * 2, 6);
  });

  for (const [label, aspect] of [
    ["desktop canvas 1.8", 1.8],
    ["4:3 canvas", 1.33],
    ["phone portrait 0.55", 0.55],
  ] as const) {
    for (const polarDeg of [9, 50]) {
      it(`fitDistance frames the island tightly · ${label} · polar ${polarDeg}°`, () => {
        const nodes = model().nodes;
        const points = framingPoints(nodes);
        const { center } = islandCenter(nodes);
        const polar = MathUtils.degToRad(polarDeg);
        const d = fitDistance(points, center, polar, 0, 45, aspect, 0.93);
        const ndc = projectAll(points, center, d, polar, 0, aspect);
        const maxX = Math.max(...ndc.map((v) => Math.abs(v.x)));
        const maxY = Math.max(...ndc.map((v) => Math.abs(v.y)));
        expect(Math.max(maxX, maxY)).toBeLessThanOrEqual(0.93 + 1e-6);
        // Tight: at least one axis touches the margin.
        expect(Math.max(maxX, maxY)).toBeGreaterThan(0.89);
        // The dice tray is a screen overlay now: only tile corners are framed.
        expect(points.length).toBe(TILES.length * 6);
      });
    }
  }

  it("sea extent stays in sync with the water plane", () => {
    expect(SEA_HALF_EXTENT).toBe(WATER_HALF_EXTENT);
  });

  it("maxSeaDistance is exact: corners on the sea at D, past the edge just beyond", () => {
    const half = SEA_HALF_EXTENT - SEA_EDGE_PAD;
    for (const [polarDeg, azDeg, aspect, target] of [
      [9, 0, 1.8, [0, 0, 0]],
      [30, 45, 0.87, [0.6, 0, -0.4]],
      [0, 0, 1.33, [0, 0, 0]],
    ] as const) {
      const polar = MathUtils.degToRad(polarDeg);
      const az = MathUtils.degToRad(azDeg);
      const d = maxSeaDistance(target as V3, polar, az, 45, aspect);
      expect(d).toBeGreaterThan(1);
      expect(insideSea(cornerHits(target as V3, d * 0.999, polar, az, aspect), half)).toBe(true);
      expect(insideSea(cornerHits(target as V3, d * 1.02, polar, az, aspect), half)).toBe(false);
    }
    // Horizon in view → no distance keeps the sky out.
    expect(maxSeaDistance([0, 0, 0], MathUtils.degToRad(75), 0, 45, 1.6)).toBe(0);
  });

  it("maxSeaPolar flattens the tilt until the frame fits on the sea", () => {
    const polar = maxSeaPolar([0, 0, 0], 11, 0, 45, 1.33, MathUtils.degToRad(60));
    expect(polar).toBeLessThan(MathUtils.degToRad(60));
    expect(maxSeaDistance([0, 0, 0], polar, 0, 45, 1.33)).toBeGreaterThanOrEqual(11 - 1e-3);
  });

  const maxNdc = (pts: readonly V3[], center: V3, f: { distance: number; polar: number }, aspect: number) =>
    Math.max(...projectAll(pts, center, f.distance, f.polar, 0, aspect).map((v) => Math.max(Math.abs(v.x), Math.abs(v.y))));

  for (const aspect of [2.1, 1.8, 1.6, 1.33, 0.87, 0.78, 0.6, 0.55]) {
    it(`overview (AI turn) never shows sky · aspect ${aspect}`, () => {
      const nodes = islandWithHarbours();
      const points = framingPoints(nodes);
      const tilePoints = framingPoints(nodes.filter((n) => n.kind === "tile"));
      const { center } = islandCenter(nodes);
      const f = seaSafeFraming(points, tilePoints, center, MathUtils.degToRad(9), 0, 0, 45, aspect, undefined, true);
      expect(f.safe).toBe(true);
      expect(insideSea(cornerHits(center, f.distance, f.polar, 0, aspect))).toBe(true);
      // Every tile stays in frame on real desktop / phone canvases; only an ultra-wide
      // 2.1 canvas trims the island's outer edge (≤ 7%) until the sea grows.
      expect(maxNdc(tilePoints, center, f, aspect)).toBeLessThanOrEqual(aspect >= 2 ? 1.07 : 1);
    });
  }

  for (const aspect of [1.6, 1.33, 0.87, 0.78]) {
    it(`play (own turn) flattens the tilt instead of showing sky, tiles never cropped · aspect ${aspect}`, () => {
      const nodes = islandWithHarbours();
      const points = framingPoints(nodes);
      const tilePoints = framingPoints(nodes.filter((n) => n.kind === "tile"));
      const { center } = islandCenter(nodes);
      const f = seaSafeFraming(points, tilePoints, center, MathUtils.degToRad(50), MathUtils.degToRad(PLAY_MIN_POLAR_DEG), 0, 45, aspect);
      expect(maxNdc(tilePoints, center, f, aspect)).toBeLessThanOrEqual(1);
      expect(f.safe).toBe(true);
      expect(f.polar).toBeLessThan(MathUtils.degToRad(50));
      expect(f.polar).toBeGreaterThanOrEqual(MathUtils.degToRad(PLAY_MIN_POLAR_DEG) - 1e-9);
      expect(insideSea(cornerHits(center, f.distance, f.polar, 0, aspect))).toBe(true);
    });
  }

  for (const aspect of [1.8]) {
    it(`play on a very wide canvas flattens below 18° instead of showing sky, tiles kept · aspect ${aspect}`, () => {
      const nodes = islandWithHarbours();
      const points = framingPoints(nodes);
      const tilePoints = framingPoints(nodes.filter((n) => n.kind === "tile"));
      const { center } = islandCenter(nodes);
      const f = playFraming(points, tilePoints, center, MathUtils.degToRad(50), 0, 45, aspect);
      expect(f.safe).toBe(true);
      expect(f.polar).toBeLessThan(MathUtils.degToRad(PLAY_MIN_POLAR_DEG));
      expect(maxNdc(tilePoints, center, f, aspect)).toBeLessThanOrEqual(1);
      expect(insideSea(cornerHits(center, f.distance, f.polar, 0, aspect))).toBe(true);
      // Normal canvases keep the ≥ 18° tilt.
      const normal = playFraming(points, tilePoints, center, MathUtils.degToRad(50), 0, 45, 1.33);
      expect(normal.polar).toBeGreaterThanOrEqual(MathUtils.degToRad(PLAY_MIN_POLAR_DEG) - 1e-9);
    });
  }

  it("play on a very wide canvas keeps every tile when the 18-unit sea cannot cover it", () => {
    const nodes = islandWithHarbours();
    const points = framingPoints(nodes);
    const tilePoints = framingPoints(nodes.filter((n) => n.kind === "tile"));
    const { center } = islandCenter(nodes);
    const f = seaSafeFraming(points, tilePoints, center, MathUtils.degToRad(50), MathUtils.degToRad(PLAY_MIN_POLAR_DEG), 0, 45, 1.8);
    expect(f.safe).toBe(false);
    expect(f.polar).toBeCloseTo(MathUtils.degToRad(PLAY_MIN_POLAR_DEG), 6);
    expect(maxNdc(tilePoints, center, f, 1.8)).toBeLessThanOrEqual(1);
    // With a far-sea ring (e.g. ±60) the same canvas keeps its tilt and stays sky-free.
    const wide = seaSafeFraming(points, tilePoints, center, MathUtils.degToRad(50), MathUtils.degToRad(PLAY_MIN_POLAR_DEG), 0, 45, 1.8, 60 - SEA_EDGE_PAD);
    expect(wide.safe).toBe(true);
    expect(wide.polar).toBeCloseTo(MathUtils.degToRad(50), 6);
  });
});
