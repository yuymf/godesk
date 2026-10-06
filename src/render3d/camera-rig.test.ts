import { describe, expect, it } from "vitest";
import { MathUtils, PerspectiveCamera, Vector3 } from "three";
import {
  angleDelta,
  cameraModeFor,
  clampTarget,
  clampZoom,
  fitDistance,
  framingPoints,
  islandCenter,
  orbitOffset,
  ZOOM_LIMITS,
  type V3,
} from "./camera-rig";
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

function model(layout: "landscape" | "portrait" = "landscape") {
  return mapHexSettlementToScene(
    { tiles: TILES, robberHex: "0,0", ports: [], players: [], lastDice: [3, 4] },
    { layout },
  );
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

  for (const [label, aspect, layout] of [
    ["desktop canvas 1.8", 1.8, "landscape"],
    ["4:3 canvas", 1.33, "landscape"],
    ["phone portrait 0.55", 0.55, "portrait"],
  ] as const) {
    for (const polarDeg of [9, 50]) {
      it(`fitDistance frames island + tray tightly · ${label} · polar ${polarDeg}°`, () => {
        const nodes = model(layout).nodes;
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
        // Tray is in the framed set (4 corners) and inside the view.
        const tray = nodes.find((n) => n.kind === "dice-tray")!;
        expect(points.length).toBe(TILES.length * 6 + 4);
        expect(Math.hypot(tray.position[0], tray.position[2])).toBeGreaterThan(4);
      });
    }
  }
});
