/**
 * G3D-JUDGE-PIECES · own-modelled low-poly pieces (no external assets).
 * Lives under `render3d/assets/` (procedural "model assets", render3d-assets chunk).
 *
 * Every piece is assembled from primitive parts, flattened to non-indexed
 * triangles (faceted low-poly shading) and merged into ONE BufferGeometry with
 * baked vertex colours. Seat colour lives in the vertex colours, so a single
 * shared white `vertexColors` material serves every seat and the scene still
 * costs exactly one InstancedMesh draw call per (kind, seat).
 *
 * Local frames (base on y = 0, front = +Z):
 * - settlement: pitched-roof cottage, chimney, door + windows, ~0.39 wide × 0.43 tall
 * - city: hall + square tower with pyramid roof and pennant, ~0.53 wide, ~0.65 tall
 * - road: painted plank beam along +X with wooden end caps, 0.56 × 0.14 × 0.09
 * - robber: hooded cloaked figure holding a fog lantern, ~0.6 tall
 */
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  ExtrudeGeometry,
  Float32BufferAttribute,
  LatheGeometry,
  Matrix4,
  Quaternion,
  Shape,
  SphereGeometry,
  Vector2,
  Vector3,
} from "three";
import { SEAT_COLORS } from "../tokens";

export type PieceKind = "settlement" | "city" | "road" | "robber";

type Vec3 = readonly [number, number, number];

export type PartOptions = {
  pos?: Vec3;
  rot?: Vec3;
  scale?: Vec3;
  /** Keep smooth normals (hood / lantern glass); default flat (faceted low-poly). */
  smooth?: boolean;
};

const _m = new Matrix4();
const _q = new Quaternion();
const _e = new Euler();
const _c = new Color();

/** Transform + flatten + paint one primitive. Consumes `geom`. */
export function paintPart(geom: BufferGeometry, color: string, options: PartOptions = {}): BufferGeometry {
  const flat = geom.index ? geom.toNonIndexed() : geom;
  if (flat !== geom) geom.dispose();
  for (const name of Object.keys(flat.attributes)) {
    if (name !== "position" && name !== "normal") flat.deleteAttribute(name);
  }
  flat.clearGroups();
  const [px, py, pz] = options.pos ?? [0, 0, 0];
  const [rx, ry, rz] = options.rot ?? [0, 0, 0];
  const [sx, sy, sz] = options.scale ?? [1, 1, 1];
  _q.setFromEuler(_e.set(rx, ry, rz));
  _m.compose(new Vector3(px, py, pz), _q, new Vector3(sx, sy, sz));
  flat.applyMatrix4(_m);
  if (!options.smooth || !flat.getAttribute("normal")) flat.computeVertexNormals();
  _c.set(color);
  const count = flat.getAttribute("position").count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    colors[i * 3] = _c.r;
    colors[i * 3 + 1] = _c.g;
    colors[i * 3 + 2] = _c.b;
  }
  flat.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return flat;
}

/**
 * Concatenate painted, non-indexed parts (position / normal / color only).
 * Hand-rolled instead of BufferGeometryUtils.mergeGeometries to keep the
 * render3d core chunk inside its size budget.
 */
export function mergeParts(parts: BufferGeometry[]): BufferGeometry {
  let count = 0;
  for (const part of parts) count += part.getAttribute("position").count;
  const merged = new BufferGeometry();
  for (const name of ["position", "normal", "color"] as const) {
    const out = new Float32Array(count * 3);
    let offset = 0;
    for (const part of parts) {
      const attr = part.getAttribute(name);
      for (let i = 0; i < attr.count; i += 1) {
        out[offset] = attr.getX(i);
        out[offset + 1] = attr.getY(i);
        out[offset + 2] = attr.getZ(i);
        offset += 3;
      }
    }
    merged.setAttribute(name, new Float32BufferAttribute(out, 3));
  }
  for (const part of parts) part.dispose();
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

/** Shade a hex colour toward black (amount < 0) or white (amount > 0), in sRGB. */
export function shade(hex: string, amount: number): string {
  const c = new Color(hex);
  const target = amount < 0 ? new Color(0, 0, 0) : new Color(1, 1, 1);
  c.lerp(target, Math.min(Math.abs(amount), 1));
  return `#${c.getHexString()}`;
}

export const PIECE_PALETTE = {
  stone: "#8d877b",
  stoneDark: "#6e695f",
  doorWood: "#4a2f1d",
  beamWood: "#7a4e2b",
  beamWoodDark: "#5a3820",
  window: "#f4dfa0",
  cloak: "#263b36",
  cloakDark: "#1a2826",
  hoodShadow: "#0f1413",
  belt: "#5b3b22",
  lanternFrame: "#2b2622",
  lanternGlow: "#ffd27a",
  eyes: "#ffe9a8",
  pennantPole: "#3d2a1a",
} as const;

export function seatColor(seat: number): string {
  return SEAT_COLORS[((seat % SEAT_COLORS.length) + SEAT_COLORS.length) % SEAT_COLORS.length] ?? "#ffffff";
}

type HouseSpec = {
  /** Wall footprint (x = ridge direction, z = depth). */
  width: number;
  depth: number;
  wallHeight: number;
  ridgeHeight: number;
  base: Vec3;
  wall: string;
  roof: string;
};

/** Walls + gable fill + two overhanging roof slabs; ridge along X. */
function houseParts({ width, depth, wallHeight, ridgeHeight, base, wall, roof }: HouseSpec): BufferGeometry[] {
  const [bx, by, bz] = base;
  const parts: BufferGeometry[] = [];
  parts.push(paintPart(new BoxGeometry(width, wallHeight, depth), wall, { pos: [bx, by + wallHeight / 2, bz] }));
  const half = depth / 2;
  const gable = new Shape();
  gable.moveTo(-half, 0);
  gable.lineTo(half, 0);
  gable.lineTo(0, ridgeHeight);
  gable.closePath();
  const prism = new ExtrudeGeometry(gable, { depth: width, bevelEnabled: false });
  // Shape XY, extrude +Z → rotate so the extrusion runs along +X.
  parts.push(paintPart(prism, wall, { pos: [bx - width / 2, by + wallHeight, bz], rot: [0, Math.PI / 2, 0] }));
  const angle = Math.atan2(ridgeHeight, half);
  const slant = Math.hypot(half, ridgeHeight);
  const overhang = depth * 0.16;
  const thickness = 0.016;
  const length = slant + overhang;
  for (const side of [1, -1] as const) {
    const theta = side * angle;
    // Midpoint between ridge and eave, nudged outward by half the overhang along the slope.
    const midZ = (side * half) / 2 + side * Math.cos(angle) * (overhang / 2);
    const midY = wallHeight + ridgeHeight / 2 - Math.sin(angle) * (overhang / 2);
    const nz = side * Math.sin(angle) * (thickness / 2);
    const ny = Math.cos(angle) * (thickness / 2);
    parts.push(
      paintPart(new BoxGeometry(width + overhang * 0.9, thickness, length), roof, {
        pos: [bx, by + midY + ny, bz + midZ + nz],
        rot: [theta, 0, 0],
      }),
    );
  }
  // Ridge cap.
  parts.push(
    paintPart(new BoxGeometry(width + overhang * 0.9, thickness * 1.4, thickness * 1.8), shade(roof, -0.25), {
      pos: [bx, by + wallHeight + ridgeHeight + thickness * 0.7, bz],
    }),
  );
  return parts;
}

/** Thin decal box glued onto the +Z face (door / window). */
function frontDecal(w: number, h: number, x: number, y: number, z: number, color: string): BufferGeometry {
  return paintPart(new BoxGeometry(w, h, 0.008), color, { pos: [x, y, z + 0.004] });
}

/** Window on the ±X side wall. */
function sideDecal(w: number, h: number, x: number, y: number, z: number, side: 1 | -1, color: string): BufferGeometry {
  return paintPart(new BoxGeometry(0.008, h, w), color, { pos: [x + side * 0.004, y, z] });
}

/**
 * Table-read scale: pieces are modelled at a "true" miniature size, then scaled
 * so they read from the fitted overview camera (≈ a fifth of a hex width for a
 * cottage, settlecoast-like proportions).
 */
export const SETTLEMENT_SCALE = 1.5;
export const CITY_SCALE = 1.4;

function scaled(geom: BufferGeometry, s: number): BufferGeometry {
  geom.scale(s, s, s);
  geom.computeBoundingBox();
  geom.computeBoundingSphere();
  return geom;
}

export function buildSettlementGeometry(seat: number): BufferGeometry {
  const main = seatColor(seat);
  const wall = shade(main, 0.38);
  const roof = shade(main, -0.08);
  const parts: BufferGeometry[] = [];
  parts.push(paintPart(new BoxGeometry(0.24, 0.03, 0.2), PIECE_PALETTE.stone, { pos: [0, 0.015, 0] }));
  parts.push(
    ...houseParts({ width: 0.2, depth: 0.15, wallHeight: 0.12, ridgeHeight: 0.085, base: [0, 0.03, 0], wall, roof }),
  );
  const front = 0.075;
  parts.push(frontDecal(0.042, 0.07, -0.035, 0.03 + 0.035, front, PIECE_PALETTE.doorWood));
  parts.push(frontDecal(0.036, 0.034, 0.045, 0.03 + 0.07, front, PIECE_PALETTE.window));
  parts.push(sideDecal(0.034, 0.034, 0.1, 0.03 + 0.07, 0, 1, PIECE_PALETTE.window));
  parts.push(sideDecal(0.034, 0.034, -0.1, 0.03 + 0.07, 0, -1, PIECE_PALETTE.window));
  // Back door-less wall window.
  parts.push(paintPart(new BoxGeometry(0.036, 0.034, 0.008), PIECE_PALETTE.window, { pos: [0.02, 0.1, -0.079] }));
  // Chimney through the back roof slope.
  parts.push(paintPart(new BoxGeometry(0.034, 0.1, 0.034), PIECE_PALETTE.stone, { pos: [0.055, 0.03 + 0.12 + 0.05, -0.035] }));
  parts.push(paintPart(new BoxGeometry(0.042, 0.014, 0.042), PIECE_PALETTE.stoneDark, { pos: [0.055, 0.03 + 0.12 + 0.105, -0.035] }));
  return scaled(mergeParts(parts), SETTLEMENT_SCALE);
}

export function buildCityGeometry(seat: number): BufferGeometry {
  const main = seatColor(seat);
  const wall = shade(main, 0.38);
  const roof = shade(main, -0.08);
  const parts: BufferGeometry[] = [];
  parts.push(paintPart(new BoxGeometry(0.38, 0.035, 0.24), PIECE_PALETTE.stone, { pos: [0, 0.0175, 0] }));
  const by = 0.035;
  // Hall.
  parts.push(
    ...houseParts({ width: 0.22, depth: 0.17, wallHeight: 0.14, ridgeHeight: 0.095, base: [-0.07, by, 0.01], wall, roof }),
  );
  parts.push(frontDecal(0.05, 0.085, -0.1, by + 0.0425, 0.095, PIECE_PALETTE.doorWood));
  parts.push(frontDecal(0.036, 0.036, -0.02, by + 0.09, 0.095, PIECE_PALETTE.window));
  parts.push(sideDecal(0.036, 0.036, -0.18, by + 0.085, 0.01, -1, PIECE_PALETTE.window));
  // Tower.
  const tw = 0.12;
  const th = 0.27;
  const tx = 0.11;
  const tz = -0.02;
  parts.push(paintPart(new BoxGeometry(tw, th, tw), wall, { pos: [tx, by + th / 2, tz] }));
  parts.push(paintPart(new BoxGeometry(tw + 0.02, 0.022, tw + 0.02), PIECE_PALETTE.stoneDark, { pos: [tx, by + th + 0.011, tz] }));
  parts.push(
    paintPart(new ConeGeometry(0.098, 0.13, 4, 1), roof, { pos: [tx, by + th + 0.022 + 0.065, tz], rot: [0, Math.PI / 4, 0] }),
  );
  parts.push(frontDecal(0.034, 0.05, tx, by + 0.19, tz + tw / 2, PIECE_PALETTE.window));
  parts.push(frontDecal(0.034, 0.034, tx, by + 0.08, tz + tw / 2, PIECE_PALETTE.window));
  parts.push(sideDecal(0.034, 0.05, tx + tw / 2, by + 0.19, tz, 1, PIECE_PALETTE.window));
  // Pennant.
  const poleTop = by + th + 0.022 + 0.13 + 0.07;
  parts.push(
    paintPart(new CylinderGeometry(0.005, 0.005, 0.1, 5), PIECE_PALETTE.pennantPole, { pos: [tx, poleTop - 0.05, tz] }),
  );
  const flag = new Shape();
  flag.moveTo(0, 0);
  flag.lineTo(0.07, -0.018);
  flag.lineTo(0, -0.036);
  flag.closePath();
  parts.push(
    paintPart(new ExtrudeGeometry(flag, { depth: 0.006, bevelEnabled: false }), shade(main, -0.15), {
      pos: [tx + 0.004, poleTop, tz - 0.003],
    }),
  );
  return scaled(mergeParts(parts), CITY_SCALE);
}

export const ROAD_LENGTH = 0.56;

export function buildRoadGeometry(seat: number): BufferGeometry {
  const main = seatColor(seat);
  const parts: BufferGeometry[] = [];
  const beamLen = ROAD_LENGTH - 0.06;
  parts.push(paintPart(new BoxGeometry(beamLen, 0.066, 0.12), main, { pos: [0, 0.033 + 0.004, 0] }));
  // Plank seams on top.
  for (const z of [-0.02, 0.02]) {
    parts.push(paintPart(new BoxGeometry(beamLen - 0.02, 0.003, 0.005), shade(main, -0.35), { pos: [0, 0.07 + 0.0015, z] }));
  }
  // Unpainted wooden end caps / sleepers.
  for (const x of [-(ROAD_LENGTH / 2 - 0.025), ROAD_LENGTH / 2 - 0.025]) {
    parts.push(paintPart(new BoxGeometry(0.05, 0.082, 0.136), PIECE_PALETTE.beamWood, { pos: [x, 0.041, 0] }));
    parts.push(paintPart(new BoxGeometry(0.014, 0.012, 0.014), PIECE_PALETTE.beamWoodDark, { pos: [x, 0.084, 0.036] }));
    parts.push(paintPart(new BoxGeometry(0.014, 0.012, 0.014), PIECE_PALETTE.beamWoodDark, { pos: [x, 0.084, -0.036] }));
  }
  return mergeParts(parts);
}

/** Robber reads at ≈ 0.6 world units tall (≈ a third of a hex width). */
export const ROBBER_SCALE = 1.35;

export function buildRobberGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const profile = [
    new Vector2(0.0, 0.0),
    new Vector2(0.125, 0.0),
    new Vector2(0.128, 0.02),
    new Vector2(0.108, 0.12),
    new Vector2(0.088, 0.24),
    new Vector2(0.07, 0.3),
    new Vector2(0.0, 0.31),
  ];
  parts.push(paintPart(new LatheGeometry(profile, 9), PIECE_PALETTE.cloak));
  // Hem trim and belt.
  parts.push(paintPart(new CylinderGeometry(0.129, 0.131, 0.02, 9), PIECE_PALETTE.cloakDark, { pos: [0, 0.01, 0] }));
  parts.push(paintPart(new CylinderGeometry(0.1, 0.104, 0.018, 9), PIECE_PALETTE.belt, { pos: [0, 0.17, 0] }));
  // Shoulder cape.
  parts.push(paintPart(new CylinderGeometry(0.075, 0.105, 0.06, 9), PIECE_PALETTE.cloakDark, { pos: [0, 0.27, 0] }));
  // Hood: rounded dome + swept-back peak.
  parts.push(paintPart(new SphereGeometry(0.072, 9, 7), PIECE_PALETTE.cloak, { pos: [0, 0.35, -0.004], scale: [1, 1.12, 1.05] }));
  parts.push(paintPart(new ConeGeometry(0.05, 0.085, 7), PIECE_PALETTE.cloak, { pos: [0, 0.425, -0.03], rot: [-0.55, 0, 0] }));
  // Shadowed face opening + two glints.
  parts.push(
    paintPart(new SphereGeometry(0.05, 8, 6), PIECE_PALETTE.hoodShadow, { pos: [0, 0.342, 0.036], scale: [1, 1.05, 0.55] }),
  );
  for (const x of [-0.017, 0.017]) {
    parts.push(paintPart(new BoxGeometry(0.012, 0.008, 0.006), PIECE_PALETTE.eyes, { pos: [x, 0.348, 0.064] }));
  }
  // Arm + fog lantern held on the right side.
  parts.push(
    paintPart(new CylinderGeometry(0.022, 0.026, 0.13, 6), PIECE_PALETTE.cloakDark, { pos: [0.098, 0.2, 0.03], rot: [0.35, 0, 0.35] }),
  );
  parts.push(paintPart(new BoxGeometry(0.004, 0.035, 0.004), PIECE_PALETTE.lanternFrame, { pos: [0.12, 0.125, 0.07] }));
  parts.push(paintPart(new BoxGeometry(0.05, 0.012, 0.05), PIECE_PALETTE.lanternFrame, { pos: [0.12, 0.1, 0.07] }));
  parts.push(paintPart(new BoxGeometry(0.04, 0.05, 0.04), PIECE_PALETTE.lanternGlow, { pos: [0.12, 0.07, 0.07] }));
  parts.push(paintPart(new BoxGeometry(0.05, 0.01, 0.05), PIECE_PALETTE.lanternFrame, { pos: [0.12, 0.04, 0.07] }));
  return scaled(mergeParts(parts), ROBBER_SCALE);
}

const CACHE = new Map<string, BufferGeometry>();

/** Cached procedural geometry for a piece kind × seat (robber ignores seat). */
export function pieceGeometry(kind: PieceKind, seat = 0): BufferGeometry {
  const key = kind === "robber" ? "robber" : `${kind}:${seat}`;
  let geom = CACHE.get(key);
  if (!geom) {
    geom =
      kind === "settlement"
        ? buildSettlementGeometry(seat)
        : kind === "city"
          ? buildCityGeometry(seat)
          : kind === "road"
            ? buildRoadGeometry(seat)
            : buildRobberGeometry();
    geom.userData.gdShared = true;
    CACHE.set(key, geom);
  }
  return geom;
}

export function disposePieceGeometries(): void {
  for (const geom of CACHE.values()) geom.dispose();
  CACHE.clear();
}
