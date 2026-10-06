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
 * Shading is painted into the vertex colours too (`bakeShading`): a contact
 * darkening toward the base, darker eave / overhang undersides and a slight
 * sky lift on up-facing faces — a cheap baked-AO look with no extra pass.
 * Walls are a warm limewash tinted with the seat colour; roofs carry the full
 * seat colour in alternating shingle rows, so the owner reads from above.
 *
 * Local frames (base on y = 0, front = +Z):
 * - settlement: half-timbered cottage, shingled seat-colour roof, chimney, ~0.40 wide × 0.38 tall
 * - city: hall + square tower with pyramid roof and pennant, ~0.64 wide, ~0.89 tall
 * - road: painted plank beam along +X with wooden end caps, 0.56 × 0.18 × 0.11
 * - robber: hooded cloaked figure holding a fog lantern, pale rim outline, ~0.95 tall
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
  cloak: "#34504a",
  cloakDark: "#22352f",
  hoodShadow: "#0f1413",
  belt: "#5b3b22",
  lanternFrame: "#2b2622",
  lanternGlow: "#ffd27a",
  eyes: "#ffe9a8",
  pennantPole: "#3d2a1a",
  limewash: "#efe4cb",
  timber: "#4b3020",
  rim: "#efe2b4",
} as const;

/** Limewashed wall with a soft seat tint (sRGB mix). */
export function wallTint(seat: string): string {
  const c = new Color(PIECE_PALETTE.limewash).lerp(new Color(seat), 0.24);
  return `#${c.getHexString()}`;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

/**
 * Baked-AO look in the vertex colours: base contact shadow over the lowest
 * `contact` fraction of the height, darker down-facing faces (eaves, overhangs),
 * a little extra light on up-facing faces. Mutates `geom`'s colour attribute.
 */
export function bakeShading(geom: BufferGeometry, contact = 0.3): BufferGeometry {
  geom.computeBoundingBox();
  const box = geom.boundingBox!;
  const height = Math.max(box.max.y - box.min.y, 1e-6);
  const pos = geom.getAttribute("position");
  const normal = geom.getAttribute("normal");
  const color = geom.getAttribute("color");
  for (let i = 0; i < pos.count; i += 1) {
    const h = (pos.getY(i) - box.min.y) / height;
    const ny = normal.getY(i);
    // Stronger contact AO so pieces don't look flat on bright tiles.
    let ao = 0.48 + 0.52 * smoothstep(0, contact, h);
    if (ny < -0.3) ao *= 0.58;
    else if (ny > 0.6) ao *= 1.1;
    color.setXYZ(i, Math.min(color.getX(i) * ao, 1), Math.min(color.getY(i) * ao, 1), Math.min(color.getZ(i) * ao, 1));
  }
  color.needsUpdate = true;
  return geom;
}

/** Soft elliptical contact shadow under a piece (baked into the shared geometry). */
export function contactShadow(rx: number, rz: number, y = 0.004): BufferGeometry {
  // Thin dark disc: darker centre, fades toward the rim via vertex colours.
  const segs = 16;
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const push = (x: number, z: number, a: number) => {
    positions.push(x, y, z);
    normals.push(0, 1, 0);
    colors.push(0.05 * a, 0.04 * a, 0.03 * a);
  };
  for (let i = 0; i < segs; i += 1) {
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    push(0, 0, 1);
    push(Math.cos(a0) * rx, Math.sin(a0) * rz, 0.15);
    push(Math.cos(a1) * rx, Math.sin(a1) * rz, 0.15);
  }
  const geom = new BufferGeometry();
  geom.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geom.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geom.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return geom;
}

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
  // Shingle rows: each slope is split into overlapping strips of alternating shade.
  const rows = 3;
  for (const side of [1, -1] as const) {
    const theta = side * angle;
    for (let row = 0; row < rows; row += 1) {
      // Strip centre along the slope, measured from the ridge (0) to the eave tip (length).
      const along = ((row + 0.5) / rows) * length;
      const lift = (rows - row) * 0.0035; // upper rows sit on the lower ones (overlap)
      const midZ = side * Math.cos(angle) * along;
      const midY = wallHeight + ridgeHeight - Math.sin(angle) * along;
      const nz = side * Math.sin(angle) * (thickness / 2 + lift);
      const ny = Math.cos(angle) * (thickness / 2 + lift);
      parts.push(
        paintPart(new BoxGeometry(width + overhang * 0.9, thickness, (length / rows) * 1.12), shade(roof, row % 2 === 0 ? 0.05 : -0.07), {
          pos: [bx, by + midY + ny, bz + midZ + nz],
          rot: [theta, 0, 0],
        }),
      );
    }
  }
  // Half-timber corner posts and a sill beam.
  const post = Math.min(width, depth) * 0.09;
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      parts.push(
        paintPart(new BoxGeometry(post, wallHeight, post), PIECE_PALETTE.timber, {
          pos: [bx + sx * (width / 2 - post / 2 + 0.002), by + wallHeight / 2, bz + sz * (depth / 2 - post / 2 + 0.002)],
        }),
      );
    }
  }
  parts.push(
    paintPart(new BoxGeometry(width + 0.006, post * 0.8, depth + 0.006), PIECE_PALETTE.timber, { pos: [bx, by + wallHeight - post * 0.4, bz] }),
  );
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
export const SETTLEMENT_SCALE = 1.45;
export const CITY_SCALE = 1.68;

function scaled(geom: BufferGeometry, s: number): BufferGeometry {
  geom.scale(s, s, s);
  geom.computeBoundingBox();
  geom.computeBoundingSphere();
  return geom;
}

export function buildSettlementGeometry(seat: number): BufferGeometry {
  const main = seatColor(seat);
  const wall = wallTint(main);
  const roof = shade(main, -0.04);
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
  parts.push(contactShadow(0.14, 0.13));
  return scaled(bakeShading(mergeParts(parts), 0.36), SETTLEMENT_SCALE);
}

export function buildCityGeometry(seat: number): BufferGeometry {
  const main = seatColor(seat);
  const wall = wallTint(main);
  const roof = shade(main, -0.04);
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
  parts.push(contactShadow(0.18, 0.16));
  return scaled(bakeShading(mergeParts(parts), 0.3), CITY_SCALE);
}

export const ROAD_LENGTH = 0.56;

export function buildRoadGeometry(seat: number): BufferGeometry {
  const main = seatColor(seat);
  const parts: BufferGeometry[] = [];
  const beamLen = ROAD_LENGTH - 0.04;
  const beamH = 0.11;
  const beamW = 0.195;
  // Seat paint with wood-grain plank strips (alternating shade along the beam).
  parts.push(paintPart(new BoxGeometry(beamLen, beamH, beamW), main, { pos: [0, beamH / 2 + 0.004, 0] }));
  for (let i = -2; i <= 2; i += 1) {
    const shadeAmt = i % 2 === 0 ? -0.12 : -0.28;
    parts.push(
      paintPart(new BoxGeometry(beamLen * 0.18, 0.004, beamW - 0.02), shade(main, shadeAmt), {
        pos: [(i / 2.4) * beamLen * 0.35, beamH + 0.005, 0],
      }),
    );
  }
  // Plank seams on top (grain lines).
  for (const z of [-beamW / 5, 0, beamW / 5]) {
    parts.push(paintPart(new BoxGeometry(beamLen - 0.02, 0.003, 0.007), shade(PIECE_PALETTE.beamWood, -0.25), { pos: [0, beamH + 0.006, z] }));
  }
  // Unpainted wooden end caps / sleepers.
  for (const x of [-(ROAD_LENGTH / 2 - 0.02), ROAD_LENGTH / 2 - 0.02]) {
    parts.push(paintPart(new BoxGeometry(0.055, beamH + 0.02, beamW + 0.022), PIECE_PALETTE.beamWood, { pos: [x, (beamH + 0.02) / 2, 0] }));
    parts.push(paintPart(new BoxGeometry(0.018, 0.014, 0.018), PIECE_PALETTE.beamWoodDark, { pos: [x, beamH + 0.026, beamW * 0.32] }));
    parts.push(paintPart(new BoxGeometry(0.018, 0.014, 0.018), PIECE_PALETTE.beamWoodDark, { pos: [x, beamH + 0.026, -beamW * 0.32] }));
  }
  parts.push(contactShadow(beamLen * 0.42, beamW * 0.45, 0.003));
  return bakeShading(mergeParts(parts), 0.55);
}

/** Robber reads at ≈ 0.72 world units tall (≈ 40% of a hex width). */
export const ROBBER_SCALE = 1.9;

/**
 * Reverse a non-indexed geometry's triangle winding (swap 2nd / 3rd vertex)
 * and flip its normals: an inverted hull drawn with the normal front-face
 * material shows only where it sticks out behind the figure → an outline.
 */
function invertHull(geom: BufferGeometry): BufferGeometry {
  for (const name of ["position", "normal", "color"]) {
    const attr = geom.getAttribute(name);
    if (!attr) continue;
    const a = attr.array as Float32Array;
    const size = attr.itemSize;
    for (let tri = 0; tri < attr.count; tri += 3) {
      for (let k = 0; k < size; k += 1) {
        const i1 = (tri + 1) * size + k;
        const i2 = (tri + 2) * size + k;
        const t = a[i1]!;
        a[i1] = a[i2]!;
        a[i2] = t;
      }
    }
  }
  // The visible (far, inner) faces would light as if facing away; point them up so the rim reads pale.
  const normal = geom.getAttribute("normal");
  for (let i = 0; i < normal.count; i += 1) normal.setXYZ(i, 0, 1, 0);
  return geom;
}

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
  // Pale rim: inverted hull of the cloak + hood silhouette, so the dark figure
  // reads against grey mountain tiles from the overview camera.
  const rimProfile = [
    new Vector2(0.0, -0.004),
    new Vector2(0.168, -0.004),
    new Vector2(0.172, 0.02),
    new Vector2(0.134, 0.12),
    new Vector2(0.113, 0.24),
    new Vector2(0.102, 0.3),
    new Vector2(0.098, 0.36),
    new Vector2(0.077, 0.425),
    new Vector2(0.032, 0.478),
    new Vector2(0.0, 0.52),
  ];
  parts.push(invertHull(paintPart(new LatheGeometry(rimProfile, 12), PIECE_PALETTE.rim, { pos: [0, 0, -0.012] })));
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
  // Taller hood peak for a clearer silhouette against mountain tiles.
  parts.push(paintPart(new ConeGeometry(0.055, 0.11, 7), PIECE_PALETTE.cloakDark, { pos: [0, 0.455, -0.038], rot: [-0.6, 0, 0] }));
  parts.push(contactShadow(0.13, 0.13, 0.003));
  return scaled(bakeShading(mergeParts(parts), 0.22), ROBBER_SCALE);
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
