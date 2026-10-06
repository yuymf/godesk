import { describe, expect, it } from "vitest";
import { Color, MathUtils, PerspectiveCamera, Vector3 } from "three";
import { framingPoints, islandCenter, orbitOffset, playFraming, type V3 } from "./camera-rig";
import {
  buildCityGeometry,
  buildRoadGeometry,
  buildRobberGeometry,
  buildSettlementGeometry,
  disposePieceGeometries,
  pieceGeometry,
  PIECE_PALETTE,
  ROAD_LENGTH,
  seatColor,
  wallTint,
} from "./assets/pieces";
import { SEAT_COLORS } from "./tokens";

function size(geom: ReturnType<typeof buildSettlementGeometry>) {
  geom.computeBoundingBox();
  const box = geom.boundingBox!;
  return { x: box.max.x - box.min.x, y: box.max.y - box.min.y, z: box.max.z - box.min.z, minY: box.min.y };
}

/** Some vertex carries `hex` up to a uniform (baked-AO) brightness factor in [0.35, 1.1]. */
function hasColor(geom: ReturnType<typeof buildSettlementGeometry>, hex: string): boolean {
  const target = new Color(hex);
  const colors = geom.getAttribute("color");
  for (let i = 0; i < colors.count; i += 1) {
    const r = colors.getX(i);
    const g = colors.getY(i);
    const b = colors.getZ(i);
    const k = (r + g + b) / Math.max(target.r + target.g + target.b, 1e-6);
    if (k < 0.35 || k > 1.1) continue;
    if (Math.abs(r - target.r * k) < 2e-3 && Math.abs(g - target.g * k) < 2e-3 && Math.abs(b - target.b * k) < 2e-3) return true;
  }
  return false;
}

/** Mean vertex luminance of vertices within a height band (fraction of the bbox height). */
function bandLuma(geom: ReturnType<typeof buildSettlementGeometry>, from: number, to: number, kind: "side" | "top"): number {
  geom.computeBoundingBox();
  const box = geom.boundingBox!;
  const pos = geom.getAttribute("position");
  const nrm = geom.getAttribute("normal");
  const col = geom.getAttribute("color");
  let sum = 0;
  let n = 0;
  for (let i = 0; i < pos.count; i += 1) {
    const h = (pos.getY(i) - box.min.y) / (box.max.y - box.min.y);
    if (h < from || h > to) continue;
    const ny = nrm.getY(i);
    if (kind === "side" ? Math.abs(ny) > 0.2 : ny < 0.6) continue;
    sum += 0.2126 * col.getX(i) + 0.7152 * col.getY(i) + 0.0722 * col.getZ(i);
    n += 1;
  }
  return sum / Math.max(n, 1);
}

/** Screen-space height (CSS px) of a piece standing at `at` for the default desktop play framing. */
function projectedHeightPx(geom: ReturnType<typeof buildSettlementGeometry>, at: V3, width: number, height: number): number {
  const tiles: { kind: string; position: V3 }[] = [];
  for (let q = -2; q <= 2; q += 1) {
    for (let r = -2; r <= 2; r += 1) {
      if (Math.abs(q + r) > 2) continue;
      tiles.push({ kind: "tile", position: [1.5 * q, 0, (Math.sqrt(3) / 2) * q + Math.sqrt(3) * r] });
    }
  }
  const ports = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * Math.PI * 2 + 0.2;
    return { kind: "port", position: [Math.cos(a) * 4.7, 0.05, Math.sin(a) * 4.7] as V3 };
  });
  const { center } = islandCenter(tiles);
  const aspect = width / height;
  // Same own-turn framing the director uses (flattens on wide canvases instead of showing sky).
  const f = playFraming(framingPoints([...tiles, ...ports]), framingPoints(tiles), center, MathUtils.degToRad(50), 0, 45, aspect);
  const camera = new PerspectiveCamera(45, aspect, 0.1, 200);
  const [ox, oy, oz] = orbitOffset(f.distance, f.polar, 0);
  camera.position.set(center[0] + ox, center[1] + oy, center[2] + oz);
  camera.lookAt(center[0], center[1], center[2]);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  geom.computeBoundingBox();
  const b = geom.boundingBox!;
  let top = Infinity;
  let bottom = -Infinity;
  for (const x of [b.min.x, b.max.x]) {
    for (const y of [b.min.y, b.max.y]) {
      for (const z of [b.min.z, b.max.z]) {
        const v = new Vector3(at[0] + x, at[1] + y, at[2] + z).project(camera);
        const py = ((1 - v.y) / 2) * height;
        top = Math.min(top, py);
        bottom = Math.max(bottom, py);
      }
    }
  }
  return bottom - top;
}

describe("procedural pieces (own-modelled, vertex-coloured)", () => {
  it("settlement: cottage stands on y=0, ~a quarter of a hex wide, seat-tinted walls, dark timber", () => {
    const geom = buildSettlementGeometry(1);
    const s = size(geom);
    expect(s.minY).toBeCloseTo(0, 5);
    expect(s.x).toBeGreaterThan(0.38);
    expect(s.x).toBeLessThan(0.46);
    expect(s.y).toBeGreaterThan(0.41);
    expect(s.y).toBeLessThan(0.5);
    expect(geom.getAttribute("color")).toBeDefined();
    expect(geom.index).toBeNull();
    expect(hasColor(geom, wallTint(SEAT_COLORS[1]!))).toBe(true);
    expect(hasColor(geom, PIECE_PALETTE.timber)).toBe(true);
    expect(hasColor(geom, "#4a2f1d")).toBe(true);
  });

  it("house reads 22–28 px tall at the default desktop framing (910×505 canvas)", () => {
    // A vertex one ring out from the centre (pieces stand on the tile top, y = 0.27).
    const px = projectedHeightPx(buildSettlementGeometry(0), [0.5, 0.27, 0.866], 910, 505);
    expect(px).toBeGreaterThanOrEqual(22);
    expect(px).toBeLessThanOrEqual(28);
  });

  it("baked AO: walls darken toward the ground; eave undersides darker than roof tops", () => {
    const geom = buildSettlementGeometry(0);
    expect(bandLuma(geom, 0, 0.1, "side")).toBeLessThan(bandLuma(geom, 0.3, 0.5, "side") * 0.85);
    const roofTop = bandLuma(geom, 0.55, 1, "top");
    expect(roofTop).toBeGreaterThan(0);
  });

  it("city is a larger multi-volume building (tower taller than the cottage)", () => {
    const city = size(buildCityGeometry(0));
    const house = size(buildSettlementGeometry(0));
    expect(city.x).toBeGreaterThan(house.x * 1.3);
    expect(city.y).toBeGreaterThan(house.y * 1.4);
  });

  it("road: plank beam along +X, seat paint baked, length ROAD_LENGTH", () => {
    const geom = buildRoadGeometry(2);
    const s = size(geom);
    expect(s.x).toBeCloseTo(ROAD_LENGTH, 2);
    expect(s.z).toBeGreaterThan(0.15);
    expect(s.z).toBeLessThan(0.2);
    expect(s.y).toBeLessThan(0.13);
    expect(hasColor(geom, SEAT_COLORS[2]!)).toBe(true);
  });

  it("robber: hooded figure ≈0.75 tall on y≈0 with a pale rim outline (inverted hull)", () => {
    const geom = buildRobberGeometry();
    const s = size(geom);
    expect(Math.abs(s.minY)).toBeLessThan(0.01);
    expect(s.y).toBeGreaterThan(0.7);
    expect(s.y).toBeLessThan(0.85);
    expect(hasColor(geom, PIECE_PALETTE.rim)).toBe(true);
    expect(hasColor(geom, PIECE_PALETTE.cloak)).toBe(true);
    // Rim vertices face up (lit pale from any camera).
    const col = geom.getAttribute("color");
    const nrm = geom.getAttribute("normal");
    const rim = new Color(PIECE_PALETTE.rim);
    let rimUp = 0;
    for (let i = 0; i < col.count; i += 1) {
      const k = col.getX(i) / rim.r;
      if (Math.abs(col.getY(i) - rim.g * k) < 2e-3 && Math.abs(col.getZ(i) - rim.b * k) < 2e-3 && nrm.getY(i) === 1) rimUp += 1;
    }
    expect(rimUp).toBeGreaterThan(100);
  });

  it("seat colours differ per seat; cache returns one geometry per kind × seat", () => {
    expect(seatColor(0)).not.toBe(seatColor(1));
    expect(seatColor(5)).toBe(seatColor(1));
    const a = pieceGeometry("settlement", 0);
    expect(pieceGeometry("settlement", 0)).toBe(a);
    expect(pieceGeometry("settlement", 1)).not.toBe(a);
    expect(pieceGeometry("robber", 3)).toBe(pieceGeometry("robber", 0));
    disposePieceGeometries();
    expect(pieceGeometry("settlement", 0)).not.toBe(a);
    disposePieceGeometries();
  });
});
