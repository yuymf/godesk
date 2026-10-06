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
 * Round-3/4 knife ②: readable *miniature* buildings (multi-part meshes merged into
 * one BufferGeometry so InstancedMesh pools stay 1 draw call per kind×seat).
 * Not placeholder boxes — cottage / manor / plank road / cloaked figure silhouettes.
 *
 * Local frames (base on y = 0, front = +Z):
 * - settlement: half-timbered cottage with porch, recessed windows, chimney
 * - city: two-gable hall + square keep, arched windows, pennant
 * - road: individual seat-painted planks on sleepers
 * - robber: cloaked hooded figure (limbs + torso under cloak), pale rim, lantern
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
  /** Extra storey band for city halls. */
  storeys?: number;
};

/** Recessed window: dark reveal + warm glass pane. */
function windowRecess(w: number, h: number, x: number, y: number, z: number, facing: "front" | "back" | "left" | "right", glass: string): BufferGeometry[] {
  const reveal = PIECE_PALETTE.hoodShadow;
  const depth = 0.014;
  if (facing === "front" || facing === "back") {
    const s = facing === "front" ? 1 : -1;
    return [
      paintPart(new BoxGeometry(w + 0.012, h + 0.012, depth), reveal, { pos: [x, y, z + s * (depth / 2)] }),
      paintPart(new BoxGeometry(w, h, 0.006), glass, { pos: [x, y, z + s * (depth + 0.002)] }),
      // Mullion cross.
      paintPart(new BoxGeometry(0.006, h, 0.007), PIECE_PALETTE.timber, { pos: [x, y, z + s * (depth + 0.005)] }),
      paintPart(new BoxGeometry(w, 0.006, 0.007), PIECE_PALETTE.timber, { pos: [x, y, z + s * (depth + 0.005)] }),
    ];
  }
  const s = facing === "right" ? 1 : -1;
  return [
    paintPart(new BoxGeometry(depth, h + 0.012, w + 0.012), reveal, { pos: [x + s * (depth / 2), y, z] }),
    paintPart(new BoxGeometry(0.006, h, w), glass, { pos: [x + s * (depth + 0.002), y, z] }),
    paintPart(new BoxGeometry(0.007, h, 0.006), PIECE_PALETTE.timber, { pos: [x + s * (depth + 0.005), y, z] }),
    paintPart(new BoxGeometry(0.007, 0.006, w), PIECE_PALETTE.timber, { pos: [x + s * (depth + 0.005), y, z] }),
  ];
}

/** Door with frame + step. */
function frontDoor(w: number, h: number, x: number, y: number, zFront: number): BufferGeometry[] {
  return [
    paintPart(new BoxGeometry(w + 0.02, h + 0.016, 0.012), PIECE_PALETTE.timber, { pos: [x, y + h / 2, zFront + 0.004] }),
    paintPart(new BoxGeometry(w, h, 0.01), PIECE_PALETTE.doorWood, { pos: [x, y + h / 2, zFront + 0.012] }),
    paintPart(new BoxGeometry(0.01, 0.01, 0.01), shade(PIECE_PALETTE.lanternGlow, -0.4), { pos: [x + w * 0.28, y + h * 0.5, zFront + 0.02] }),
    paintPart(new BoxGeometry(w + 0.04, 0.018, 0.05), PIECE_PALETTE.stoneDark, { pos: [x, y + 0.006, zFront + 0.03] }),
  ];
}

/**
 * Cottage / hall shell: stone plinth, limewash walls, half-timber, shingled roof
 * with bargeboards and ridge crest — reads as a miniature building from play tilt.
 */
function houseParts({ width, depth, wallHeight, ridgeHeight, base, wall, roof, storeys = 1 }: HouseSpec): BufferGeometry[] {
  const [bx, by, bz] = base;
  const parts: BufferGeometry[] = [];
  // Stone plinth / foundation.
  parts.push(paintPart(new BoxGeometry(width + 0.03, 0.028, depth + 0.03), PIECE_PALETTE.stone, { pos: [bx, by + 0.014, bz] }));
  parts.push(paintPart(new BoxGeometry(width + 0.018, 0.012, depth + 0.018), PIECE_PALETTE.stoneDark, { pos: [bx, by + 0.03, bz] }));
  const wallY0 = by + 0.032;
  // Walls (optionally banded storeys).
  const bandH = wallHeight / storeys;
  for (let storey = 0; storey < storeys; storey += 1) {
    const y = wallY0 + bandH * storey + bandH / 2;
    const tint = storey === 0 ? wall : shade(wall, -0.04);
    parts.push(paintPart(new BoxGeometry(width, bandH - 0.004, depth), tint, { pos: [bx, y, bz] }));
    if (storey > 0) {
      parts.push(paintPart(new BoxGeometry(width + 0.008, 0.012, depth + 0.008), PIECE_PALETTE.timber, { pos: [bx, wallY0 + bandH * storey, bz] }));
    }
  }
  // Gable fill.
  const half = depth / 2;
  const gable = new Shape();
  gable.moveTo(-half, 0);
  gable.lineTo(half, 0);
  gable.lineTo(0, ridgeHeight);
  gable.closePath();
  const prism = new ExtrudeGeometry(gable, { depth: width, bevelEnabled: false });
  parts.push(paintPart(prism, wall, { pos: [bx - width / 2, wallY0 + wallHeight, bz], rot: [0, Math.PI / 2, 0] }));
  // Half-timber posts + sill + mid rail.
  const post = Math.min(width, depth) * 0.085;
  for (const sx of [1, -1] as const) {
    for (const sz of [1, -1] as const) {
      parts.push(
        paintPart(new BoxGeometry(post, wallHeight, post), PIECE_PALETTE.timber, {
          pos: [bx + sx * (width / 2 - post / 2 + 0.002), wallY0 + wallHeight / 2, bz + sz * (depth / 2 - post / 2 + 0.002)],
        }),
      );
    }
  }
  parts.push(paintPart(new BoxGeometry(width + 0.008, post * 0.7, depth + 0.008), PIECE_PALETTE.timber, { pos: [bx, wallY0 + wallHeight * 0.55, bz] }));
  parts.push(paintPart(new BoxGeometry(width + 0.01, post * 0.85, depth + 0.01), PIECE_PALETTE.timber, { pos: [bx, wallY0 + wallHeight - post * 0.35, bz] }));
  // Shingled roof slopes with bargeboards.
  const angle = Math.atan2(ridgeHeight, half);
  const slant = Math.hypot(half, ridgeHeight);
  const overhang = depth * 0.22;
  const thickness = 0.018;
  const length = slant + overhang;
  const rows = 4;
  for (const side of [1, -1] as const) {
    const theta = side * angle;
    for (let row = 0; row < rows; row += 1) {
      const along = ((row + 0.5) / rows) * length;
      const lift = (rows - row) * 0.004;
      const midZ = side * Math.cos(angle) * along;
      const midY = wallHeight + ridgeHeight - Math.sin(angle) * along;
      const nz = side * Math.sin(angle) * (thickness / 2 + lift);
      const ny = Math.cos(angle) * (thickness / 2 + lift);
      parts.push(
        paintPart(new BoxGeometry(width + overhang * 1.05, thickness, (length / rows) * 1.15), shade(roof, row % 2 === 0 ? 0.06 : -0.08), {
          pos: [bx, wallY0 + midY + ny, bz + midZ + nz],
          rot: [theta, 0, 0],
        }),
      );
    }
    // Bargeboard on the gable ends.
    parts.push(
      paintPart(new BoxGeometry(0.014, thickness * 1.2, length * 0.95), PIECE_PALETTE.timber, {
        pos: [bx + width / 2 + 0.004, wallY0 + wallHeight + ridgeHeight * 0.45, bz + side * (half * 0.35)],
        rot: [theta, 0, 0],
      }),
    );
  }
  // Ridge crest.
  parts.push(
    paintPart(new BoxGeometry(width + overhang * 0.95, thickness * 1.6, thickness * 2.0), shade(roof, -0.28), {
      pos: [bx, wallY0 + wallHeight + ridgeHeight + thickness * 0.75, bz],
    }),
  );
  return parts;
}

/**
 * Table-read scale: modelled as miniatures, then scaled so a cottage reads
 * ~28–34 px tall under the default desktop play framing.
 */
export const SETTLEMENT_SCALE = 1.36;
export const CITY_SCALE = 1.62;

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
  // Small porch / stoop in front of the door.
  parts.push(paintPart(new BoxGeometry(0.1, 0.022, 0.055), PIECE_PALETTE.stone, { pos: [0, 0.011, 0.115] }));
  parts.push(paintPart(new BoxGeometry(0.018, 0.05, 0.018), PIECE_PALETTE.timber, { pos: [-0.04, 0.04, 0.13] }));
  parts.push(paintPart(new BoxGeometry(0.018, 0.05, 0.018), PIECE_PALETTE.timber, { pos: [0.04, 0.04, 0.13] }));
  parts.push(paintPart(new BoxGeometry(0.11, 0.012, 0.018), PIECE_PALETTE.timber, { pos: [0, 0.068, 0.13] }));
  parts.push(
    ...houseParts({ width: 0.22, depth: 0.16, wallHeight: 0.125, ridgeHeight: 0.095, base: [0, 0, 0], wall, roof }),
  );
  const frontZ = 0.08;
  parts.push(...frontDoor(0.045, 0.078, -0.03, 0.032, frontZ));
  parts.push(...windowRecess(0.038, 0.036, 0.055, 0.11, frontZ, "front", PIECE_PALETTE.window));
  parts.push(...windowRecess(0.036, 0.034, 0.11, 0.11, 0, "right", PIECE_PALETTE.window));
  parts.push(...windowRecess(0.036, 0.034, -0.11, 0.11, 0, "left", PIECE_PALETTE.window));
  parts.push(...windowRecess(0.034, 0.032, 0.02, 0.11, -0.08, "back", PIECE_PALETTE.window));
  // Chimney with pot.
  parts.push(paintPart(new BoxGeometry(0.038, 0.12, 0.038), PIECE_PALETTE.stone, { pos: [0.06, 0.2, -0.03] }));
  parts.push(paintPart(new BoxGeometry(0.048, 0.016, 0.048), PIECE_PALETTE.stoneDark, { pos: [0.06, 0.268, -0.03] }));
  parts.push(paintPart(new CylinderGeometry(0.01, 0.01, 0.03, 6), PIECE_PALETTE.stoneDark, { pos: [0.06, 0.29, -0.03] }));
  parts.push(contactShadow(0.15, 0.14));
  return scaled(bakeShading(mergeParts(parts), 0.36), SETTLEMENT_SCALE);
}

export function buildCityGeometry(seat: number): BufferGeometry {
  const main = seatColor(seat);
  const wall = wallTint(main);
  const roof = shade(main, -0.04);
  const parts: BufferGeometry[] = [];
  parts.push(paintPart(new BoxGeometry(0.42, 0.04, 0.28), PIECE_PALETTE.stone, { pos: [0, 0.02, 0] }));
  // Two-storey hall.
  parts.push(
    ...houseParts({ width: 0.24, depth: 0.18, wallHeight: 0.2, ridgeHeight: 0.1, base: [-0.08, 0.02, 0.02], wall, roof, storeys: 2 }),
  );
  parts.push(...frontDoor(0.055, 0.095, -0.12, 0.052, 0.11));
  parts.push(...windowRecess(0.04, 0.04, -0.02, 0.14, 0.11, "front", PIECE_PALETTE.window));
  parts.push(...windowRecess(0.04, 0.04, -0.02, 0.22, 0.11, "front", PIECE_PALETTE.window));
  parts.push(...windowRecess(0.038, 0.038, -0.2, 0.14, 0.02, "left", PIECE_PALETTE.window));
  parts.push(...windowRecess(0.038, 0.038, -0.2, 0.22, 0.02, "left", PIECE_PALETTE.window));
  // Square keep / tower with arched look (stacked recesses) + pyramid roof.
  const tw = 0.135;
  const th = 0.34;
  const tx = 0.13;
  const tz = -0.02;
  parts.push(paintPart(new BoxGeometry(tw, th, tw), wall, { pos: [tx, 0.04 + th / 2, tz] }));
  // Corner buttresses.
  for (const sx of [1, -1] as const) {
    for (const sz of [1, -1] as const) {
      parts.push(
        paintPart(new BoxGeometry(0.028, th * 0.85, 0.028), PIECE_PALETTE.stoneDark, {
          pos: [tx + sx * (tw / 2 + 0.006), 0.04 + th * 0.42, tz + sz * (tw / 2 + 0.006)],
        }),
      );
    }
  }
  parts.push(paintPart(new BoxGeometry(tw + 0.03, 0.028, tw + 0.03), PIECE_PALETTE.stoneDark, { pos: [tx, 0.04 + th + 0.012, tz] }));
  parts.push(
    paintPart(new ConeGeometry(0.11, 0.15, 4, 1), roof, { pos: [tx, 0.04 + th + 0.028 + 0.075, tz], rot: [0, Math.PI / 4, 0] }),
  );
  parts.push(...windowRecess(0.036, 0.055, tx, 0.12, tz + tw / 2, "front", PIECE_PALETTE.window));
  parts.push(...windowRecess(0.036, 0.04, tx, 0.24, tz + tw / 2, "front", PIECE_PALETTE.window));
  parts.push(...windowRecess(0.036, 0.04, tx + tw / 2, 0.24, tz, "right", PIECE_PALETTE.window));
  // Battlement nubs.
  for (const sx of [-0.04, 0.04] as const) {
    for (const sz of [-0.04, 0.04] as const) {
      parts.push(paintPart(new BoxGeometry(0.03, 0.035, 0.03), PIECE_PALETTE.stone, { pos: [tx + sx, 0.04 + th + 0.035, tz + sz] }));
    }
  }
  // Pennant.
  const poleTop = 0.04 + th + 0.028 + 0.15 + 0.08;
  parts.push(paintPart(new CylinderGeometry(0.005, 0.005, 0.12, 5), PIECE_PALETTE.pennantPole, { pos: [tx, poleTop - 0.06, tz] }));
  const flag = new Shape();
  flag.moveTo(0, 0);
  flag.lineTo(0.08, -0.02);
  flag.lineTo(0, -0.04);
  flag.closePath();
  parts.push(
    paintPart(new ExtrudeGeometry(flag, { depth: 0.006, bevelEnabled: false }), shade(main, -0.12), {
      pos: [tx + 0.004, poleTop, tz - 0.003],
    }),
  );
  parts.push(contactShadow(0.22, 0.18));
  return scaled(bakeShading(mergeParts(parts), 0.3), CITY_SCALE);
}

export const ROAD_LENGTH = 0.56;

export function buildRoadGeometry(seat: number): BufferGeometry {
  const main = seatColor(seat);
  const parts: BufferGeometry[] = [];
  const plankCount = 5;
  const plankLen = ROAD_LENGTH - 0.06;
  const plankW = 0.034;
  const plankH = 0.028;
  const span = 0.175;
  // Sleepers under the planks.
  for (const x of [-plankLen * 0.42, -plankLen * 0.14, plankLen * 0.14, plankLen * 0.42]) {
    parts.push(paintPart(new BoxGeometry(0.04, 0.02, span + 0.02), PIECE_PALETTE.beamWoodDark, { pos: [x, 0.01, 0] }));
  }
  // Individual seat-painted planks with wood-grain shade variation.
  for (let i = 0; i < plankCount; i += 1) {
    const z = -span / 2 + (span / (plankCount - 1)) * i;
    const tint = shade(main, (i % 2 === 0 ? -0.05 : -0.18));
    parts.push(paintPart(new BoxGeometry(plankLen, plankH, plankW), tint, { pos: [0, 0.022 + plankH / 2, z] }));
    // Grain groove.
    parts.push(paintPart(new BoxGeometry(plankLen * 0.92, 0.003, 0.004), shade(main, -0.35), { pos: [0, 0.022 + plankH + 0.001, z] }));
  }
  // End caps / kerbs.
  for (const x of [-(ROAD_LENGTH / 2 - 0.018), ROAD_LENGTH / 2 - 0.018]) {
    parts.push(paintPart(new BoxGeometry(0.036, 0.04, span + 0.03), PIECE_PALETTE.beamWood, { pos: [x, 0.02, 0] }));
  }
  parts.push(contactShadow(plankLen * 0.45, span * 0.55, 0.003));
  return bakeShading(mergeParts(parts), 0.55);
}

/** Robber ≈ hooded miniature (not a lathe cylinder). */
export const ROBBER_SCALE = 1.85;

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
  const normal = geom.getAttribute("normal");
  for (let i = 0; i < normal.count; i += 1) normal.setXYZ(i, 0, 1, 0);
  return geom;
}

export function buildRobberGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  // Legs under the cloak hem (readable stance, not a peg).
  for (const x of [-0.035, 0.035] as const) {
    parts.push(paintPart(new BoxGeometry(0.04, 0.1, 0.045), PIECE_PALETTE.cloakDark, { pos: [x, 0.05, 0.01] }));
    parts.push(paintPart(new BoxGeometry(0.045, 0.025, 0.06), PIECE_PALETTE.hoodShadow, { pos: [x, 0.012, 0.02] }));
  }
  // Torso block + shoulders.
  parts.push(paintPart(new BoxGeometry(0.12, 0.16, 0.09), PIECE_PALETTE.cloak, { pos: [0, 0.18, 0] }));
  parts.push(paintPart(new BoxGeometry(0.16, 0.05, 0.1), PIECE_PALETTE.cloakDark, { pos: [0, 0.27, 0] }));
  // Cloak panels (front flaps + back drape) — figure silhouette, not a lathe.
  parts.push(paintPart(new BoxGeometry(0.07, 0.2, 0.03), PIECE_PALETTE.cloak, { pos: [-0.055, 0.14, 0.05], rot: [0.15, 0.25, 0.1] }));
  parts.push(paintPart(new BoxGeometry(0.07, 0.2, 0.03), PIECE_PALETTE.cloak, { pos: [0.055, 0.14, 0.05], rot: [0.15, -0.25, -0.1] }));
  parts.push(paintPart(new BoxGeometry(0.14, 0.22, 0.04), PIECE_PALETTE.cloakDark, { pos: [0, 0.15, -0.05], rot: [-0.2, 0, 0] }));
  // Belt.
  parts.push(paintPart(new BoxGeometry(0.13, 0.02, 0.1), PIECE_PALETTE.belt, { pos: [0, 0.15, 0.01] }));
  // Hood: deep cowl (sphere + swept peak) with shadowed face cavity.
  parts.push(paintPart(new SphereGeometry(0.075, 10, 8), PIECE_PALETTE.cloak, { pos: [0, 0.36, -0.01], scale: [1.05, 1.15, 1.1], smooth: true }));
  parts.push(paintPart(new ConeGeometry(0.055, 0.12, 8), PIECE_PALETTE.cloakDark, { pos: [0, 0.46, -0.05], rot: [-0.65, 0, 0] }));
  parts.push(paintPart(new SphereGeometry(0.048, 8, 6), PIECE_PALETTE.hoodShadow, { pos: [0, 0.35, 0.045], scale: [1, 1.05, 0.55], smooth: true }));
  for (const x of [-0.018, 0.018] as const) {
    parts.push(paintPart(new BoxGeometry(0.014, 0.01, 0.008), PIECE_PALETTE.eyes, { pos: [x, 0.355, 0.072] }));
  }
  // Pale rim outline (inverted hull of a slightly larger cowl) for mountain tiles.
  const rimProfile = [
    new Vector2(0.0, 0.08),
    new Vector2(0.1, 0.08),
    new Vector2(0.12, 0.16),
    new Vector2(0.11, 0.28),
    new Vector2(0.095, 0.38),
    new Vector2(0.07, 0.48),
    new Vector2(0.03, 0.55),
    new Vector2(0.0, 0.58),
  ];
  parts.push(invertHull(paintPart(new LatheGeometry(rimProfile, 14), PIECE_PALETTE.rim, { pos: [0, 0, -0.015] })));
  // Arms + fog lantern.
  parts.push(paintPart(new BoxGeometry(0.035, 0.12, 0.035), PIECE_PALETTE.cloakDark, { pos: [-0.1, 0.2, 0.03], rot: [0.4, 0, 0.35] }));
  parts.push(paintPart(new BoxGeometry(0.035, 0.12, 0.035), PIECE_PALETTE.cloakDark, { pos: [0.1, 0.2, 0.04], rot: [0.5, 0, -0.4] }));
  parts.push(paintPart(new BoxGeometry(0.004, 0.04, 0.004), PIECE_PALETTE.lanternFrame, { pos: [0.13, 0.12, 0.09] }));
  parts.push(paintPart(new BoxGeometry(0.055, 0.014, 0.055), PIECE_PALETTE.lanternFrame, { pos: [0.13, 0.095, 0.09] }));
  parts.push(paintPart(new BoxGeometry(0.045, 0.055, 0.045), PIECE_PALETTE.lanternGlow, { pos: [0.13, 0.06, 0.09] }));
  parts.push(paintPart(new BoxGeometry(0.055, 0.012, 0.055), PIECE_PALETTE.lanternFrame, { pos: [0.13, 0.028, 0.09] }));
  parts.push(contactShadow(0.14, 0.14, 0.003));
  return scaled(bakeShading(mergeParts(parts), 0.24), ROBBER_SCALE);
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
