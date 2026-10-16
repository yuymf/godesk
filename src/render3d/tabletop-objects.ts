/**
 * G3D-14 · 通用桌面的内置网格工厂（RenderSpec builtInMesh → three 对象）。
 * 只被 creator 侧懒加载的 TabletopScene3D 引用，打进该 chunk，不计入 render3d 核心预算。
 * 棋子类网格底面在 y=0、单位尺寸 1（节点 scale = 尺寸）；格位 / 连线 / 桌面为中心对齐的单位盒。
 */
import {
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  DynamicDrawUsage,
  ExtrudeGeometry,
  Float32BufferAttribute,
  InstancedMesh,
  LatheGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  MeshPhysicalMaterial,
  Object3D,
  RingGeometry,
  Shape,
  CanvasTexture,
  ConeGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  ShapeGeometry,
  SphereGeometry,
  Group,
  PlaneGeometry,
  SRGBColorSpace,
  RepeatWrapping,
  Vector2,
  type BufferGeometry as Geometry,
  type Material,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { installPattern, type MaterialLibrary } from "./materials";
import type { SceneNode } from "./scene-model";
import type { MaterialToken } from "./tokens";
import type { TierCaps } from "./tiers";
import { parseFaceSchema } from "./mappers/tabletop-face-schema";
import { paintCardFace, paintIllustrationBand } from "./mappers/tabletop-card-face-t048";

export type TabletopObjectContext = {
  library: MaterialLibrary;
  caps: TierCaps;
  materials: Readonly<Record<string, MaterialToken>>;
};

const FALLBACK_TOKEN: MaterialToken = { base: "#f4efe6", roughness: 0.5, metalness: 0, pattern: "none" };
export const HINT_COLOR = "#f6c85f";

/** 扁平件（棋子圆片 / 卡牌）不投影：阴影几乎不可见，却会让阴影重绘帧的 draw call 翻倍（§4.6 预算）。 */
const NO_CAST = new Set(["disc", "card", "tile-square", "hex-prism", "ring", "grid-lines"]);

function hexPrism(): Geometry {
  const shape = new Shape();
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 3) * i;
    const x = 0.5 * Math.cos(angle);
    const y = 0.5 * Math.sin(angle);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geom = new ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false });
  geom.rotateX(-Math.PI / 2);
  geom.translate(0, -0.5, 0);
  return geom;
}

/** T060 · pitched-roof cottage silhouette (generic house mesh; hex uses pieces.ts). */
function house(): Geometry {
  const shape = new Shape();
  // T210/T217 · board-game house: wider eaves, steeper ridge, bevelled edges (settlement readable)
  shape.moveTo(-0.48, 0);
  shape.lineTo(0.48, 0);
  shape.lineTo(0.48, 0.42);
  shape.lineTo(0.54, 0.42); // eave overhang
  shape.lineTo(0, 0.98);
  shape.lineTo(-0.54, 0.42);
  shape.lineTo(-0.48, 0.42);
  shape.closePath();
  const geom = new ExtrudeGeometry(shape, {
    depth: 0.62,
    bevelEnabled: true,
    bevelThickness: 0.024,
    bevelSize: 0.018,
    bevelSegments: 3,
    curveSegments: 4,
  });
  geom.translate(0, 0, -0.31);
  geom.computeVertexNormals();
  return geom;
}

function pawn(): Geometry {
  const profile = [
    [0, 0], [0.3, 0], [0.3, 0.06], [0.2, 0.12], [0.13, 0.42], [0.2, 0.5], [0.12, 0.56],
    [0.17, 0.64], [0.17, 0.74], [0.11, 0.82], [0, 0.85],
  ].map(([x, y]) => new Vector2(x, y));
  return new LatheGeometry(profile, 14);
}

/** T042 · board-game meeple: extruded silhouette + front face (eyes); back plain. */
function meepleBody(): Geometry {
  const shape = new Shape();
  // T210 · classic meeple silhouette with fuller limbs + rounder head (tabletop plastic feel)
  shape.moveTo(0, 0);
  shape.lineTo(0.17, 0);
  shape.quadraticCurveTo(0.22, 0.09, 0.15, 0.2); // right foot
  shape.lineTo(0.09, 0.3);
  shape.lineTo(0.24, 0.4); // right arm tip
  shape.quadraticCurveTo(0.3, 0.5, 0.17, 0.54);
  shape.lineTo(0.11, 0.57);
  shape.quadraticCurveTo(0.13, 0.74, 0, 0.84); // head right→top
  shape.quadraticCurveTo(-0.13, 0.74, -0.11, 0.57);
  shape.lineTo(-0.17, 0.54);
  shape.quadraticCurveTo(-0.3, 0.5, -0.24, 0.4);
  shape.lineTo(-0.09, 0.3);
  shape.lineTo(-0.15, 0.2);
  shape.quadraticCurveTo(-0.22, 0.09, -0.17, 0);
  shape.closePath();
  const geom = new ExtrudeGeometry(shape, {
    depth: 0.26,
    bevelEnabled: true,
    bevelThickness: 0.028,
    bevelSize: 0.02,
    bevelSegments: 3,
    curveSegments: 10,
  });
  // Extrude along +Z; shift so base y=0 and centered in Z.
  geom.translate(0, 0, -0.13);
  geom.computeVertexNormals();
  return geom;
}

function meepleFigure(node: SceneNode, ctx: TabletopObjectContext): Object3D {
  const group = new Group();
  const body = new Mesh(meepleBody(), materialFor(node, ctx));
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  // Front face markers (+Z): two eyes + chest notch — distinguishes front from back.
  const faceMat = new MeshStandardMaterial({
    color: "#1e293b",
    roughness: 0.55,
    metalness: 0.05,
  });
  for (const x of [-0.035, 0.035] as const) {
    const eye = new Mesh(new SphereGeometry(0.022, 8, 6), faceMat);
    eye.position.set(x, 0.62, 0.12);
    eye.castShadow = false;
    eye.receiveShadow = false;
    group.add(eye);
  }
  const chest = new Mesh(new BoxGeometry(0.08, 0.06, 0.02), faceMat);
  chest.position.set(0, 0.42, 0.12);
  chest.castShadow = false;
  group.add(chest);
  // Back cue: small collar ridge on -Z (readable from behind, not a face).
  const backMat = new MeshStandardMaterial({
    color: "#0f172a",
    roughness: 0.7,
    metalness: 0,
  });
  const collar = new Mesh(new BoxGeometry(0.14, 0.03, 0.03), backMat);
  collar.position.set(0, 0.54, -0.12);
  group.add(collar);
  // T090 · cream rim disc under meeple — stage-wide silhouette on green felt
  // T116 · dim rim albedo (was #f8f1e3) so base disc does not blow out; keep T090/T106.
  // T123 · slightly larger rim for hex/ortho + stage-wide readability (shared figure).
  // T210 · warmer wood plinth under meeple (reads as tabletop stand, not flat disc)
  const rimMat = new MeshStandardMaterial({
    color: "#b08960",
    roughness: 0.82,
    metalness: 0.04,
  });
  const rim = new Mesh(new CylinderGeometry(0.30, 0.33, 0.055, 20), rimMat);
  rim.position.set(0, 0.025, 0);
  rim.castShadow = true;
  rim.receiveShadow = true;
  group.add(rim);
  group.add(softContactShadow(0.38, 0.34, { opacity: 0.62 })); // T106/T139/T210 meeple footprint
  return group;
}



function ship(): Geometry {
  const shape = new Shape();
  shape.moveTo(-0.45, -0.16);
  shape.lineTo(0.28, -0.16);
  shape.quadraticCurveTo(0.5, -0.1, 0.5, 0);
  shape.quadraticCurveTo(0.5, 0.1, 0.28, 0.16);
  shape.lineTo(-0.45, 0.16);
  shape.closePath();
  const geom = new ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: false });
  geom.rotateX(-Math.PI / 2);
  return geom;
}

/** step3 · 低多边形针叶树：两层锥冠 + 树干（单几何，便于实例化合批）。 */
function tree(): Geometry {
  const trunk = new CylinderGeometry(0.05, 0.07, 0.22, 6);
  trunk.translate(0, 0.11, 0);
  const low = new ConeGeometry(0.34, 0.5, 7);
  low.translate(0, 0.42, 0);
  const high = new ConeGeometry(0.25, 0.42, 7);
  high.translate(0, 0.7, 0);
  const merged = mergeGeometries([trunk.toNonIndexed(), low.toNonIndexed(), high.toNonIndexed()]) ?? low;
  merged.computeVertexNormals();
  return merged;
}

/** step3 R5 · 阔叶树：短干 + 两团低多边形树冠。 */
function broadleaf(): Geometry {
  const trunk = new CylinderGeometry(0.05, 0.07, 0.3, 6);
  trunk.translate(0, 0.15, 0);
  const a = new IcosahedronGeometry(0.3, 0);
  a.translate(0, 0.52, 0);
  const b = new IcosahedronGeometry(0.22, 0);
  b.translate(0.12, 0.68, 0.06);
  const merged = mergeGeometries([trunk.toNonIndexed(), a.toNonIndexed(), b.toNonIndexed()]) ?? a;
  merged.computeVertexNormals();
  return merged;
}

/** step3 R5 · 地面斑块：不规则扁平圆片（单位直径）。 */
function patch(): Geometry {
  const shape = new Shape();
  for (let i = 0; i <= 14; i += 1) {
    const t = (i / 14) * Math.PI * 2;
    const r = 0.5 * (1 + 0.14 * Math.sin(t * 3) + 0.08 * Math.cos(t * 5));
    if (i === 0) shape.moveTo(Math.cos(t) * r, Math.sin(t) * r);
    else shape.lineTo(Math.cos(t) * r, Math.sin(t) * r);
  }
  const geom = new ShapeGeometry(shape);
  geom.rotateX(-Math.PI / 2);
  return geom;
}

function rock(): Geometry {
  const geom = new DodecahedronGeometry(0.5, 0);
  geom.scale(1, 0.55, 0.8);
  geom.translate(0, 0.2, 0);
  return geom;
}

function translated(geom: Geometry, y: number): Geometry {
  geom.translate(0, y, 0);
  return geom;
}


/** T030 · card stock: rounded-rect extrude, bottom on y=0. */
function cardStock(): Geometry {
  const shape = new Shape();
  // T213 · thicker board-game card stock + fuller corner radius (readable stage-wide)
  const w = 0.34;
  const h = 0.48;
  const r = 0.05;
  shape.moveTo(-w + r, -h);
  shape.lineTo(w - r, -h);
  shape.quadraticCurveTo(w, -h, w, -h + r);
  shape.lineTo(w, h - r);
  shape.quadraticCurveTo(w, h, w - r, h);
  shape.lineTo(-w + r, h);
  shape.quadraticCurveTo(-w, h, -w, h - r);
  shape.lineTo(-w, -h + r);
  shape.quadraticCurveTo(-w, -h, -w + r, -h);
  shape.closePath();
  const geom = new ExtrudeGeometry(shape, {
    depth: 0.062,
    bevelEnabled: true,
    bevelThickness: 0.014,
    bevelSize: 0.012,
    bevelSegments: 3,
  });
  geom.rotateX(-Math.PI / 2);
  geom.translate(0, 0, 0);
  geom.computeVertexNormals();
  // Extrude depth along +Z before rotate → after rotateX(-90) thickness is +Y.
  return geom;
}


/** T033 · cut gem chip: short faceted cylinder. */
function gemChip(): Geometry {
  // T213 · cut gem: taller faceted cylinder (tabletop crystal chip, not a flat slug)
  const geom = new CylinderGeometry(0.40, 0.48, 0.26, 10);
  geom.translate(0, 0.13, 0);
  geom.computeVertexNormals();
  return geom;
}

/** T034 · beveled glazed tile (color face + micro clearcoat feel via physical material). */
/** T058 · elongated recessed trough for pattern lines / floor row (not a round pit). */
function lineTroughGeom(): Geometry {
  // Unit footprint: length along X, shallow Y, narrow Z — scaled by node.scale[0].
  return translated(new BoxGeometry(1, 0.08, 0.34), 0.04);
}

function glazedTileGeom(): Geometry {
  const shape = new Shape();
  // T210 · thicker porcelain tile + fuller corner radius (reads as ceramic, not flat chip)
  const s = 0.46;
  const r = 0.08;
  shape.moveTo(-s + r, -s);
  shape.lineTo(s - r, -s);
  shape.quadraticCurveTo(s, -s, s, -s + r);
  shape.lineTo(s, s - r);
  shape.quadraticCurveTo(s, s, s - r, s);
  shape.lineTo(-s + r, s);
  shape.quadraticCurveTo(-s, s, -s, s - r);
  shape.lineTo(-s, -s + r);
  shape.quadraticCurveTo(-s, -s, -s + r, -s);
  shape.closePath();
  const geom = new ExtrudeGeometry(shape, {
    depth: 0.12,
    bevelEnabled: true,
    bevelThickness: 0.028,
    bevelSize: 0.026,
    bevelSegments: 3,
  });
  geom.rotateX(-Math.PI / 2);
  geom.computeVertexNormals();
  return geom;
}


/** T115 · shared opaque name-plaque face (station + framed plaque title band). */
function paintSharedOpaquePlaqueFace(
  g: CanvasRenderingContext2D,
  W: number,
  H: number,
  opts: { title: string; hub?: boolean },
): void {
  // Parchment/amber fill aligned with plaqueWithFace albedo family.
  g.fillStyle = opts.hub ? "#f59e0b" : "#f3e7d3";
  g.fillRect(0, 0, W, H);
  // Outer dark wood frame + inner gold line (plaqueWithFace contrast recipe).
  g.strokeStyle = "#3f2a14";
  g.lineWidth = Math.max(12, Math.round(H * 0.14)); // T119
  g.strokeRect(4, 4, W - 8, H - 8);
  g.strokeStyle = "#a16207";
  g.lineWidth = Math.max(4, Math.round(H * 0.05));
  g.strokeRect(14, 14, W - 28, H - 28);
  const title = opts.title.slice(0, 8);
  const cx = W / 2;
  const cy = H / 2 + 2;
  g.font = `700 ${Math.round(H * 0.60)}px "Noto Serif CJK SC","Songti SC",serif`; // T119/T132
  g.textAlign = "center";
  g.textBaseline = "middle";
  // Halo then ink — stage-wide readability without enlarging layout length rules.
  g.lineWidth = Math.max(7, Math.round(H * 0.09)); // T119/T132
  g.strokeStyle = opts.hub ? "rgba(120,53,15,0.85)" : "rgba(250,246,239,0.95)";
  g.strokeText(title, cx, cy);
  g.fillStyle = "#0f172a";
  g.fillText(title, cx, cy);
}

/** T034/T037 · framed plaque: title + requirement dots (no raw ids). */
function plaqueWithFace(node: SceneNode, ctx: TabletopObjectContext): Object3D {
  const group = new Group();
  const frame = new Mesh(
    translated(new BoxGeometry(0.85, 0.06, 0.55), 0.03),
    new MeshStandardMaterial({ color: "#5b3a1a", roughness: 0.55, metalness: 0.25 }),
  );
  frame.castShadow = true;
  frame.receiveShadow = true;
  group.add(frame);
  const parsed = parseFaceSchema(node.tag && node.tag !== "major" ? node.tag : "");
  const title = parsed && parsed.kind === "plaque"
    ? parsed.title
    : (node.tag && node.tag !== "major" && !String(node.tag).startsWith("face|") ? String(node.tag) : "★");
  const prestige = parsed && parsed.kind === "plaque" ? parsed.prestige : undefined;
  const reqs = parsed && parsed.kind === "plaque" ? parsed.requirements ?? {} : {};
  const chipColors: Record<string, string> = {
    white: "#f4efe6", blue: "#3b82f6", green: "#22c55e", red: "#ef4444", black: "#1f2937", gold: "#eab308",
  };
  const canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
  if (canvas) {
    const W = 320, H = 200;
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext("2d");
    if (g) {
      g.fillStyle = "#f3e7d3";
      g.fillRect(0, 0, W, H);
      g.strokeStyle = "#7c5a32";
      g.lineWidth = 14;
      g.strokeRect(12, 12, W - 24, H - 24);
      g.strokeStyle = "#c4a574";
      g.lineWidth = 4;
      g.strokeRect(28, 28, W - 56, H - 56);
      // T048: shared illustration strip on plaque (procedural, no external art)
      paintIllustrationBand(g, { x: 36, y: 36, w: W - 72, h: 52 }, { title, base: "#c4a574" });
      if (prestige != null) {
        g.fillStyle = "#fbbf24";
        g.beginPath();
        g.arc(W - 52, 52, 22, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#78350f";
        g.font = "700 26px serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(String(prestige), W - 52, 52);
      }
      // T115 · shared plaque title ink+halo (same family as station plaques)
      g.font = '700 34px "Noto Serif CJK SC","Songti SC",serif';
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.lineWidth = 5;
      g.strokeStyle = "rgba(250,246,239,0.95)";
      g.strokeText(title.slice(0, 8), W / 2, 108);
      g.fillStyle = "#0f172a";
      g.fillText(title.slice(0, 8), W / 2, 108);
      // requirement dots
      const entries = Object.entries(reqs).filter(([, n]) => n > 0);
      entries.forEach(([color, n], i) => {
        const cx = 56 + i * 52;
        const cy = 158;
        g.fillStyle = chipColors[color] ?? "#a78bfa";
        g.beginPath();
        g.arc(cx, cy, 16, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = "rgba(0,0,0,0.35)";
        g.lineWidth = 2;
        g.stroke();
        g.fillStyle = color === "white" || color === "yellow" ? "#1f2937" : "#fff";
        g.font = "700 18px sans-serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(String(n), cx, cy);
      });
    }
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 4;
    const face = new Mesh(
      (() => {
        const plane = new PlaneGeometry(0.72, 0.44);
        plane.rotateX(-Math.PI / 2);
        plane.translate(0, 0.09, 0);
        return plane;
      })(),
      new MeshBasicMaterial({ map: tex, toneMapped: false }),
    );
    face.renderOrder = 2;
    group.add(face);
  }
  return group;
}

/** T095 · shared pattern-tile glaze albedo/roughness microdetail (not porcelain T076). */
function tileGlazeMaps(baseHex: string): { map: CanvasTexture | null; roughnessMap: CanvasTexture | null } {
  const W = 128, H = 128;
  const albedo = typeof document !== "undefined" ? document.createElement("canvas") : null;
  const rough = typeof document !== "undefined" ? document.createElement("canvas") : null;
  if (!albedo || !rough) return { map: null, roughnessMap: null };
  albedo.width = W; albedo.height = H;
  rough.width = W; rough.height = H;
  const ga = albedo.getContext("2d");
  const gr = rough.getContext("2d");
  if (!ga || !gr) return { map: null, roughnessMap: null };
  const parse = (hex: string) => {
    const h = hex.replace("#", "");
    return [
      Number.parseInt(h.slice(0, 2), 16) || 230,
      Number.parseInt(h.slice(2, 4), 16) || 229,
      Number.parseInt(h.slice(4, 6), 16) || 228,
    ] as const;
  };
  const [br, bg, bb] = parse(baseHex.startsWith("#") && baseHex.length >= 7 ? baseHex : "#e7e5e4");
  const aImg = ga.createImageData(W, H);
  const rImg = gr.createImageData(W, H);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const u = x / W, v = y / H;
      // fine glaze speck + soft edge darkening + micro crackle
      const speck = (Math.sin(u * 90) * Math.sin(v * 110) + Math.sin(u * 40 + v * 30)) * 0.5;
      const edge = Math.min(u, v, 1 - u, 1 - v);
      const rim = edge < 0.08 ? (0.08 - edge) * 10 : 0;
      const crack = Math.abs(Math.sin((u + v) * 55)) > 0.97 ? 0.35 : 0;
      const shade = speck * 18 - rim * 28 - crack * 40;
      const o = (y * W + x) * 4;
      aImg.data[o] = Math.max(0, Math.min(255, br + shade));
      aImg.data[o + 1] = Math.max(0, Math.min(255, bg + shade * 0.95));
      aImg.data[o + 2] = Math.max(0, Math.min(255, bb + shade * 0.9));
      aImg.data[o + 3] = 255;
      const rv = Math.max(0, Math.min(255, 70 + rim * 90 + crack * 80 + (0.5 - speck) * 25));
      rImg.data[o] = rv; rImg.data[o + 1] = rv; rImg.data[o + 2] = rv; rImg.data[o + 3] = 255;
    }
  }
  ga.putImageData(aImg, 0, 0);
  gr.putImageData(rImg, 0, 0);
  const map = new CanvasTexture(albedo);
  const roughnessMap = new CanvasTexture(rough);
  map.colorSpace = SRGBColorSpace;
  map.wrapS = map.wrapT = RepeatWrapping;
  roughnessMap.wrapS = roughnessMap.wrapT = RepeatWrapping;
  return { map, roughnessMap };
}

function glazedTileWithFace(node: SceneNode, ctx: TabletopObjectContext): Object3D {
  const group = new Group();
  const body = new Mesh(glazedTileGeom(), materialFor(node, ctx));
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  // glossy top glaze plate — T095 microdetail (keep clearcoat; do not whitewash T076 porcelain)
  const base = node.material && ctx.materials[node.material]?.base
    ? ctx.materials[node.material]!.base
    : "#e7e5e4";
  const maps = tileGlazeMaps(String(base));
  const glaze = new Mesh(
    (() => {
      const plane = new PlaneGeometry(0.78, 0.78);
      plane.rotateX(-Math.PI / 2);
      plane.translate(0, 0.125, 0); // T210 · sit on thicker body
      return plane;
    })(),
    new MeshPhysicalMaterial({
      color: base,
      map: maps.map ?? undefined,
      roughnessMap: maps.roughnessMap ?? undefined,
      roughness: 0.22,
      metalness: 0.08,
      clearcoat: 0.92, // T210 · porcelain glaze
      clearcoatRoughness: 0.22,
    }),
  );
  group.add(glaze);
  return group;
}

/** T037/T048 · card face: illustration band + reward bar + cost + prestige (shared atlas). */
function cardWithFace(node: SceneNode, ctx: TabletopObjectContext): Object3D {
  const group = new Group();
  // T169/T213 · card stock micro-glaze (shared; keep face BasicMaterial plate)
  const stockMat = materialFor(node, ctx).clone();
  if ("roughness" in stockMat) (stockMat as MeshStandardMaterial).roughness = Math.min(0.58, (stockMat as MeshStandardMaterial).roughness ?? 0.58);
  if ("metalness" in stockMat) (stockMat as MeshStandardMaterial).metalness = Math.max(0.08, (stockMat as MeshStandardMaterial).metalness ?? 0);
  const stock = new Mesh(cardStock(), stockMat);
  stock.castShadow = true;
  stock.receiveShadow = true;
  group.add(stock);
  const raw = (node.tag && node.tag !== "major" ? node.tag : "").trim();
  const parsed = parseFaceSchema(raw);
  const isCard = !parsed || parsed.kind === "card";
  const tier = isCard && parsed && parsed.kind === "card" ? parsed.tier : undefined;
  const prestige = isCard && parsed && parsed.kind === "card" ? parsed.prestige : undefined;
  const reward = isCard && parsed && parsed.kind === "card" ? parsed.reward : undefined;
  const cost = isCard && parsed && parsed.kind === "card" ? parsed.cost ?? {} : {};
  const title = isCard && parsed && parsed.kind === "card" ? parsed.title : undefined;
  // Forbid drawing debug strings like T1+0|green on the face.
  const showTitle = title && !/^T\d\+/i.test(title) ? title : undefined;
  const canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
  if (canvas) {
    const W = 280, H = 400;
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext("2d");
    if (g) {
      const base = node.material && ctx.materials[node.material]?.base
        ? ctx.materials[node.material]!.base
        : "#c4b5a5";
      // T048: shared zone painter — illustration band + reward bar + cost + prestige (no center-number-only).
      paintCardFace(g, W, H, {
        tier,
        prestige,
        reward,
        cost,
        title: showTitle,
        base,
      });
    }
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 4;
    const face = new Mesh(
      (() => {
        const plane = new PlaneGeometry(0.64, 0.90);
        plane.rotateX(-Math.PI / 2);
        // T213 · sit clearly above thicker card stock
        plane.translate(0, 0.11, 0);
        return plane;
      })(),
      new MeshBasicMaterial({ map: tex, toneMapped: false }),
    );
    face.receiveShadow = false;
    face.renderOrder = 2;
    group.add(face);
  }
  return group;
}

function geometryFor(mesh: string): Geometry {
  switch (mesh) {
    case "tile-square":
      return new BoxGeometry(1, 1, 1);
    case "road-bar":
      // T060 · edge-aligned prism (length X, shallow Y, narrow Z); base at y=0
      return translated(new BoxGeometry(1, 0.18, 0.32), 0.09);
    case "hex-prism":
      return hexPrism();
    case "disc":
      // T030: slightly crowned chip (not a flat plastic slug).
      return translated(new CylinderGeometry(0.46, 0.44, 0.14, 40), 0.07);
    case "gem-chip":
      return gemChip();
    case "glazed-tile":
      return glazedTileGeom();
    case "felt-wood-rim":
    case "felt-inset":
      return new BoxGeometry(1, 1, 1);
    case "plaque":
      return translated(new BoxGeometry(0.85, 0.06, 0.55), 0.03);
    case "house":
      return house();
    case "tower":
      // T060 · taller keep silhouette vs cottage
      return translated(new CylinderGeometry(0.24, 0.34, 1.25, 8), 0.62);
    case "card":
      // T030: thicker card stock with tiny bevel (reads as cardboard, not a paper plane).
      return cardStock();
    case "die":
      return translated(new BoxGeometry(0.5, 0.5, 0.5), 0.25);
    case "ship":
      return ship();
    case "tree":
      return tree();
    case "rock":
      return rock();
    case "broadleaf":
      return broadleaf();
    case "patch":
      return patch();
    case "mound": {
      const g = new SphereGeometry(0.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
      return g;
    }
    case "line-trough":
      return lineTroughGeom();
    case "framed-art":
      return translated(new BoxGeometry(0.95, 0.08, 1.2), 0.04);
    case "meeple":
      return meepleBody();
    case "pawn":
    default:
      return pawn();
  }
}

function gridLines(tag: string | undefined): BufferGeometry {
  const [rows, cols] = (tag ?? "8x8").split("x").map((part) => Math.max(1, Number(part) || 8));
  const positions: number[] = [];
  for (let r = 0; r <= rows!; r += 1) {
    const z = -0.5 + r / rows!;
    positions.push(-0.5, 0, z, 0.5, 0, z);
  }
  for (let c = 0; c <= cols!; c += 1) {
    const x = -0.5 + c / cols!;
    positions.push(x, 0, -0.5, x, 0, 0.5);
  }
  const geom = new BufferGeometry();
  geom.setAttribute("position", new Float32BufferAttribute(positions, 3));
  return geom;
}

/**
 * 实例化合批（G3D-14 follow-up）：翻转棋满盘 64 子若每子一个 Mesh 就是 64 次 draw call，
 * 超过 low 档 ≤ 60。`disc` 节点改为不渲染的代理 Object3D（位姿 / 动效 / 拾取语义不变），
 * 同一共享材质的代理合进同一个 InstancedMesh：满盘只剩每个座位材质 1 次 draw call。
 */
export const INSTANCED_MESHES: ReadonlySet<string> = new Set(["disc", "tree", "rock", "broadleaf", "patch", "mound"]);
/** 立体景物合批仍投影（树 / 石的影子是桌面体积感的主要来源）。 */
const INSTANCED_CAST: ReadonlySet<string> = new Set(["tree", "rock", "broadleaf"]);

type InstanceBatch = { key: string; mesh: InstancedMesh; proxies: Object3D[] };

/** 父节点（SceneHost 内容根）→ 材质 key → 合批。 */
const batchesByParent = new WeakMap<Object3D, Map<string, InstanceBatch>>();

function syncBatch(batch: InstanceBatch): void {
  const { mesh, proxies } = batch;
  for (let i = 0; i < proxies.length; i += 1) {
    const proxy = proxies[i]!;
    proxy.updateMatrix();
    mesh.setMatrixAt(i, proxy.matrix);
  }
  mesh.count = proxies.length;
  mesh.instanceMatrix.needsUpdate = true;
}

function createBatch(parent: Object3D, key: string, geometryKey: string, material: Material, capacity: number): InstanceBatch {
  const mesh = new InstancedMesh(geometryFor(geometryKey), material, capacity);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.count = 0;
  // 实例遍布整个盘面；包围球按单个几何体算会被错误剔除。
  mesh.frustumCulled = false;
  mesh.castShadow = INSTANCED_CAST.has(geometryKey);
  mesh.receiveShadow = true;
  // 拾取穿过棋子落到盘面（翻转棋已有子的格不是合法目标）。
  mesh.raycast = () => {};
  mesh.userData.instanceBatch = key;
  mesh.userData.mesh = geometryKey;
  const batch: InstanceBatch = { key, mesh, proxies: [] };
  // 渲染器每帧先 updateMatrixWorld 再上传实例缓冲：在这里同步代理位姿，动效当帧生效。
  const base = mesh.updateMatrixWorld.bind(mesh);
  mesh.updateMatrixWorld = (force?: boolean) => {
    syncBatch(batch);
    base(force);
  };
  parent.add(mesh);
  return batch;
}

function attachProxy(proxy: Object3D): void {
  const parent = proxy.parent;
  const key = proxy.userData.batchKey as string | undefined;
  const material = proxy.userData.batchMaterial as Material | undefined;
  if (!parent || !key || !material) return;
  let batches = batchesByParent.get(parent);
  if (!batches) {
    batches = new Map();
    batchesByParent.set(parent, batches);
  }
  let batch = batches.get(key);
  if (batch && batch.proxies.length >= batch.mesh.instanceMatrix.count) {
    // 容量不足：按 2 倍重建（材质共享，只释放旧几何）。
    const grown = createBatch(parent, key, String(proxy.userData.mesh), material, batch.mesh.instanceMatrix.count * 2);
    grown.proxies.push(...batch.proxies);
    parent.remove(batch.mesh);
    batch.mesh.geometry.dispose();
    batch.mesh.dispose();
    batches.set(key, grown);
    batch = grown;
  }
  if (!batch) {
    batch = createBatch(parent, key, String(proxy.userData.mesh), material, 64);
    batches.set(key, batch);
  }
  batch.proxies.push(proxy);
  batch.mesh.count = batch.proxies.length;
  proxy.userData.batchParent = parent;
}

function detachProxy(proxy: Object3D): void {
  const parent = proxy.userData.batchParent as Object3D | undefined;
  const key = proxy.userData.batchKey as string | undefined;
  delete proxy.userData.batchParent;
  if (!parent || !key) return;
  const batches = batchesByParent.get(parent);
  const batch = batches?.get(key);
  if (!batches || !batch) return;
  const index = batch.proxies.indexOf(proxy);
  if (index >= 0) batch.proxies.splice(index, 1);
  batch.mesh.count = batch.proxies.length;
  if (batch.proxies.length === 0) {
    parent.remove(batch.mesh);
    batch.mesh.geometry.dispose();
    batch.mesh.dispose();
    batches.delete(key);
  }
}

function createInstanceProxy(mesh: string, node: SceneNode, ctx: TabletopObjectContext): Object3D {
  const proxy = new Object3D();
  proxy.userData.mesh = mesh;
  proxy.userData.batchKey = node.material ?? "tt-fallback";
  proxy.userData.batchMaterial = materialFor(node, ctx);
  proxy.addEventListener("added", () => attachProxy(proxy));
  proxy.addEventListener("removed", () => detachProxy(proxy));
  return proxy;
}

/** 当前内容根下的实例合批（测试 / perf 诊断用）。 */
export function instanceBatchesOf(parent: Object3D): ReadonlyArray<{ key: string; count: number }> {
  return [...(batchesByParent.get(parent)?.values() ?? [])].map((batch) => ({ key: batch.key, count: batch.proxies.length }));
}

function materialFor(node: SceneNode, ctx: TabletopObjectContext): Material {
  const key = node.material ?? "tt-fallback";
  const token = ctx.materials[key] ?? FALLBACK_TOKEN;
  // T098 · desk exterior wood grain aligned with T092 rim (shared maps)
  if (node.kind === "table" || key === "table") {
    return deskWoodMaterial(node, ctx, token);
  }
  return ctx.library.get(key, token);
}

function pose(object: Object3D, node: SceneNode): void {
  object.position.set(node.position[0], node.position[1], node.position[2]);
  object.rotation.y = node.rotationY ?? 0;
  if (node.scale) object.scale.set(node.scale[0], node.scale[1], node.scale[2]);
  else object.scale.set(1, 1, 1);
}

const STEEL: MaterialToken = { base: "#c2c8ce", roughness: 0.28, metalness: 0.88, pattern: "none" }; // T109 · brighter steel vs felt
const SLEEPER: MaterialToken = { base: "#4a2e18", roughness: 0.88, metalness: 0, pattern: "grain" }; // T109 · warmer/darker ties
const TRACK_SLOT: MaterialToken = { base: "#a8b4c4", roughness: 0.82, metalness: 0.06, pattern: "none" };
const STONE: MaterialToken = { base: "#b8ab92", roughness: 0.9, metalness: 0, pattern: "stone" };
const WALL: MaterialToken = { base: "#efe2c4", roughness: 0.8, metalness: 0, pattern: "none" };
const ROOF: MaterialToken = { base: "#8e3b2c", roughness: 0.7, metalness: 0, pattern: "none" };

function boxAt(w: number, h: number, d: number, x: number, y: number, z: number): Geometry {
  const geom = new BoxGeometry(w, h, d);
  geom.translate(x, y, z);
  return geom.toNonIndexed();
}

/**
 * step3 · 铁轨（沿 +X，中心在原点，底面 y=0）。tag = `长度:轨距`。
 * 已占领（node.seat 有值）：座位色道床 + 木枕 + 钢轨（立体）；未占领：印在图上的墨色枕木虚线。
 */
function railTrack(node: SceneNode, ctx: TabletopObjectContext): Object3D {
  // step3 R4 · stereoscopic track: wood ties + raised rail bars (readable in close-up).
  const [lengthRaw, widthRaw] = (node.tag ?? "1:0.2").split(":").map(Number);
  const length = Math.max(0.2, lengthRaw || 1);
  const gauge = Math.max(0.1, widthRaw || 0.22);
  const claimed = node.seat !== undefined;
  const group = new Group();
  const usable = Math.max(0.35, length - 0.42);
  const step = claimed ? 0.17 : 0.2;
  const count = Math.max(2, Math.floor(usable / step));
  const start = -((count - 1) * step) / 2;
  const railZ = gauge * 0.32;
  // T078 · cold board: wood sleepers even when unclaimed (not bald faint slots)
  // T094 · sleeper/steel microdetail (shared route path)
  const tieMat = railSleeperMaterial(ctx);
  const steel = railSteelMaterial(ctx);
  const ties: Geometry[] = [];
  for (let i = 0; i < count; i += 1) {
    const x = start + i * step;
    // T210 · thicker / taller ties — lumber blocks, not printed dashes
    ties.push(boxAt(claimed ? 0.10 : 0.09, claimed ? 0.055 : 0.048, gauge * 1.22, x, claimed ? 0.07 : 0.05, 0));
  }
  const sleepers = new Mesh(mergeGeometries(ties) ?? ties[0]!, tieMat);
  sleepers.castShadow = true;
  sleepers.receiveShadow = true;
  // T210 · I-ish rail: taller web + head for raised steel bar in stage-wide
  const railY = claimed ? 0.125 : 0.09;
  const railH = claimed ? 0.055 : 0.045;
  const head = claimed ? 0.046 : 0.036;
  const web = claimed ? 0.022 : 0.018;
  const railGeoms = [
    boxAt(usable, railH, web, 0, railY, railZ),
    boxAt(usable, head * 0.55, head, 0, railY + railH * 0.55, railZ),
    boxAt(usable, railH, web, 0, railY, -railZ),
    boxAt(usable, head * 0.55, head, 0, railY + railH * 0.55, -railZ),
  ];
  const rails = new Mesh(mergeGeometries(railGeoms) ?? railGeoms[0]!, claimed ? steel : materialFor(node, ctx));
  rails.castShadow = true;
  if (claimed) {
    const bed = new Mesh(boxAt(usable + 0.12, 0.045, gauge * 1.25, 0, 0.022, 0), materialFor(node, ctx));
    bed.receiveShadow = true;
    bed.castShadow = true;
    group.add(bed, sleepers, rails);
    // T046/T049 · countable seat-colored train/wagon segments (distinct from unclaimed weak slots).
    // T065 · rolling-stock: chassis + windowed body + roof + coupler (not sugar-cube boxes)
    const carMat = materialFor(node, ctx);
    const chassisMat = ctx.library.get("tt-car-chassis", { base: "#1f2937", roughness: 0.7, metalness: 0.25, pattern: "none" as const });
    const glassMat = ctx.library.get("tt-car-glass", { base: "#0f172a", roughness: 0.35, metalness: 0.05, pattern: "none" as const });
    const carCount = Math.max(2, Math.min(6, Math.round(usable / 0.38)));
    const carStep = usable / carCount;
    const bodies: Geometry[] = [];
    const chassis: Geometry[] = [];
    const glass: Geometry[] = [];
    for (let i = 0; i < carCount; i += 1) {
      const cx = -usable / 2 + carStep * (i + 0.5);
      const cw = carStep * 0.78;
      const cd = gauge * 1.05;
      // undercarriage / chassis plate
      chassis.push(boxAt(cw * 0.95, 0.05, cd * 0.95, cx, 0.08, 0));
      // T068 · bogies: axle + dual wheel disks (reads as 车, not a slider)
      const wheelR = 0.055;
      const wheelT = 0.028;
      for (const bogieX of [cx - cw * 0.28, cx + cw * 0.28]) {
        // bogie frame
        chassis.push(boxAt(cw * 0.22, 0.03, cd * 0.7, bogieX, 0.055, 0));
        // axle across gauge
        chassis.push(boxAt(0.02, 0.02, cd * 0.85, bogieX, 0.045, 0));
        for (const side of [1, -1] as const) {
          const disk = new CylinderGeometry(wheelR, wheelR, wheelT, 8);
          disk.rotateX(Math.PI / 2);
          disk.translate(bogieX, wheelR * 0.85, side * (cd * 0.42));
          chassis.push(disk);
        }
      }
      // T210 · seat-colored body + pitched roof lip (rolling stock, not sugar cubes)
      bodies.push(boxAt(cw, 0.18, cd, cx, 0.2, 0));
      bodies.push(boxAt(cw * 0.96, 0.06, cd * 0.88, cx, 0.31, 0)); // roof lip
      bodies.push(boxAt(cw * 0.7, 0.03, cd * 0.7, cx, 0.35, 0)); // roof crown
      // coupler knuckle between cars
      bodies.push(boxAt(0.05, 0.06, cd * 0.35, cx - cw * 0.52, 0.14, 0));
      // window panes (dark recesses — readable vs solid box)
      const winW = cw * 0.18;
      for (const side of [1, -1] as const) {
        glass.push(boxAt(winW, 0.07, 0.02, cx - cw * 0.22, 0.2, side * (cd * 0.52)));
        glass.push(boxAt(winW, 0.07, 0.02, cx + cw * 0.22, 0.2, side * (cd * 0.52)));
      }
    }
    const chassisMesh = new Mesh(mergeGeometries(chassis) ?? chassis[0]!, chassisMat);
    chassisMesh.castShadow = true;
    const bodyMesh = new Mesh(mergeGeometries(bodies) ?? bodies[0]!, carMat);
    bodyMesh.castShadow = true;
    const glassMesh = new Mesh(mergeGeometries(glass) ?? glass[0]!, glassMat);
    glassMesh.castShadow = false;
    group.add(chassisMesh, bodyMesh, glassMesh);
  } else {
    // T078 · cold unclaimed: ballast bed + wood sleepers + length ticks (NOT claimed cars).
    // T094 · ballast gravel microdetail
    const ballastMat = railBallastMaterial();
    const bed = new Mesh(boxAt(usable + 0.16, 0.028, gauge * 1.45, 0, 0.014, 0), ballastMat);
    bed.receiveShadow = true;
    bed.castShadow = false;
    group.add(bed, sleepers, rails);
    const slotCount = Math.max(1, Math.min(6, Math.round(usable / 0.42)));
    const slotStep = usable / slotCount;
    const ghosts: Geometry[] = [];
    for (let i = 0; i < slotCount; i += 1) {
      const cx = -usable / 2 + slotStep * (i + 0.5);
      // hollow bay: thin rim boxes (readable length marks, not claimed cars)
      ghosts.push(boxAt(slotStep * 0.7, 0.02, gauge * 0.75, cx, 0.08, 0));
      ghosts.push(boxAt(0.02, 0.05, gauge * 0.75, cx - slotStep * 0.32, 0.1, 0));
      ghosts.push(boxAt(0.02, 0.05, gauge * 0.75, cx + slotStep * 0.32, 0.1, 0));
    }
    const ghostMat = ctx.library.get("tt-track-slot", TRACK_SLOT);
    const ghostMesh = new Mesh(mergeGeometries(ghosts) ?? ghosts[0]!, ghostMat);
    ghostMesh.castShadow = false;
    ghostMesh.receiveShadow = true;
    group.add(ghostMesh);
  }
  // T079 · ground contact under track corridor
  group.add(softContactShadow(Math.max(1.85, usable * 2.15), Math.max(1.48, gauge * 4.2), { opacity: 1.0 })); // T142…T237 route
  const hit = new Mesh(new BoxGeometry(usable, 0.1, gauge * 1.7), new MeshBasicMaterial({ visible: false }));
  hit.position.y = 0.05;
  group.add(hit);
  return group;
}


/** T078 · decorative wayside signal / switch post (cold-board richness; not a claimed car). */
function signalPost(node: SceneNode, ctx: TabletopObjectContext): Object3D {
  const group = new Group();
  const postMat = ctx.library.get("tt-signal-post", {
    base: "#374151",
    roughness: 0.55,
    metalness: 0.35,
    pattern: "none" as const,
  });
  const lampMat = ctx.library.get("tt-signal-lamp", {
    base: (node.material && ctx.materials[node.material]?.base) || "#f59e0b",
    roughness: 0.35,
    metalness: 0.2,
    pattern: "none" as const,
  });
  const pole = new Mesh(translated(new CylinderGeometry(0.035, 0.045, 0.55, 8), 0.275), postMat);
  pole.castShadow = true;
  const arm = new Mesh(boxAt(0.22, 0.03, 0.04, 0.1, 0.48, 0), postMat);
  arm.castShadow = true;
  const lamp = new Mesh(translated(new SphereGeometry(0.055, 10, 8), 0.5), lampMat);
  lamp.position.x = 0.18;
  lamp.castShadow = true;
  group.add(pole, arm, lamp);
  group.add(softContactShadow(0.32, 0.32)); // T142 signal
  return group;
}

/** step3 R4 · 车站小木屋：月台 + 站房 + 坡顶门廊；枢纽加烟囱/钟楼。可读的建筑轮廓，不用导入柜体顶替。 */
function station(node: SceneNode, ctx: TabletopObjectContext): Object3D {
  const group = new Group();
  const stone = ctx.library.get("tt-stone", STONE);
  const wall = ctx.library.get("tt-wall", WALL);
  const roofMat = ctx.library.get("tt-roof", ROOF);
  const ink = materialFor(node, ctx);
  // T073 · elongated platform/plinth + curb edge (desk not bald at map-close)
  // T172/T177 · denser station pedestal on felt (shared station mesh)
  // T192 · denser station pedestal (shared station mesh)
  const platform = new Mesh(boxAt(1.42, 0.13, 1.62, 0, 0.065, -0.08), stone); // T201/T210 · clearer station foot
  platform.receiveShadow = true;
  platform.castShadow = true;
  const curb = new Mesh(boxAt(1.28, 0.045, 1.48, 0, 0.105, -0.08), ink);
  curb.receiveShadow = true;
  // Round pad on top of platform (station footprint)
  const plinth = new Mesh(translated(new CylinderGeometry(0.64, 0.68, 0.13, 20), 0.15), stone);
  plinth.receiveShadow = true;
  plinth.castShadow = true;
  const ring = new Mesh(translated(new CylinderGeometry(0.48, 0.48, 0.025, 20), 0.165), ink);
  ring.receiveShadow = true;
  // Main cabin body
  const walls = new Mesh(boxAt(0.5, 0.34, 0.34, 0, 0.34, 0), wall);
  walls.castShadow = true;
  walls.receiveShadow = true;
  // Door slab + two window insets (dark) so it reads as a house in ortho.
  const door = new Mesh(boxAt(0.12, 0.2, 0.02, 0, 0.28, 0.175), ink);
  const winL = new Mesh(boxAt(0.1, 0.1, 0.02, -0.16, 0.36, 0.175), ink);
  const winR = new Mesh(boxAt(0.1, 0.1, 0.02, 0.16, 0.36, 0.175), ink);
  // Gabled roof
  const roofShape = new Shape();
  roofShape.moveTo(-0.34, 0);
  roofShape.lineTo(0.34, 0);
  roofShape.lineTo(0, 0.22);
  roofShape.closePath();
  const roofGeom = new ExtrudeGeometry(roofShape, { depth: 0.42, bevelEnabled: false });
  roofGeom.translate(0, 0.51, -0.21);
  const roof = new Mesh(roofGeom, roofMat);
  roof.castShadow = true;
  // Short platform canopy toward the tracks
  const canopy = new Mesh(boxAt(0.55, 0.03, 0.18, 0, 0.42, -0.28), roofMat);
  canopy.castShadow = true;
  const postL = new Mesh(boxAt(0.04, 0.28, 0.04, -0.2, 0.26, -0.28), wall);
  const postR = new Mesh(boxAt(0.04, 0.28, 0.04, 0.2, 0.26, -0.28), wall);
  group.add(platform, curb, plinth, ring, walls, door, winL, winR, roof, canopy, postL, postR);
  const rawTag = (node.tag ?? "").trim();
  const isHub = rawTag === "major" || rawTag.startsWith("hub:");
  const stationName = rawTag.startsWith("hub:")
    ? rawTag.slice(4)
    : rawTag && rawTag !== "major"
      ? rawTag
      : "";
  if (isHub) {
    const chimney = new Mesh(boxAt(0.1, 0.28, 0.1, -0.14, 0.62, -0.02), wall);
    chimney.castShadow = true;
    const tower = new Mesh(boxAt(0.16, 0.48, 0.16, 0.18, 0.42, 0.08), wall);
    tower.castShadow = true;
    const cap = new Mesh(translated(new ConeGeometry(0.13, 0.16, 4), 0.7), roofMat);
    cap.position.set(0.18, 0, 0.08);
    cap.rotation.y = Math.PI / 4;
    cap.castShadow = true;
    group.add(chimney, tower, cap);
  }
  // T051 · large opaque station/hub name plaque (shared; not faint floating mush).
  // T115 · contrast via shared opaque plaque face (length/truncation rules unchanged).
  // T119 · stage-wide residual: larger world plaque + anisotropy (length/truncation kept).
  // T132 · felt/plaque residual: slightly taller world plaque for stage-wide ink.
  if (stationName && typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    const W = Math.max(220, stationName.length * 52 + 64);
    const H = 96;
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext("2d");
    if (g) {
      paintSharedOpaquePlaqueFace(g, W, H, { title: stationName, hub: isHub });
      const tex = new CanvasTexture(canvas);
      tex.colorSpace = SRGBColorSpace;
      tex.anisotropy = 8;
      const pw = Math.min(1.45, 0.52 + stationName.length * 0.16);
      const plane = new PlaneGeometry(pw, 0.50);
      plane.rotateX(-Math.PI / 2);
      const plate = new Mesh(plane, new MeshBasicMaterial({ map: tex, toneMapped: false }));
      plate.position.set(0, 0.14, 0.55);
      plate.renderOrder = 3;
      group.add(plate);
      // wood riser under plaque so it lifts off the pad
      const riser = new Mesh(boxAt(pw * 0.95, 0.04, 0.28, 0, 0.08, 0.55), wall);
      riser.castShadow = true;
      group.add(riser);
    }
  }
  return group;
}

/** step3 · 平放名牌：羊皮纸签 + 墨字（CanvasTexture；中文走系统 CJK 字体）。 */
function label(node: SceneNode): Object3D {
  const text = node.tag ?? "";
  const canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
  const pxPerChar = 56;
  const w = Math.max(2, text.length) * pxPerChar + 48;
  const h = 84;
  if (canvas) {
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext("2d");
    if (g) {
      g.fillStyle = "rgba(243,231,201,0.96)";
      g.strokeStyle = "rgba(74,47,28,0.9)";
      g.lineWidth = 5;
      const r = 18;
      g.beginPath();
      g.moveTo(r, 3); g.lineTo(w - r, 3); g.quadraticCurveTo(w - 3, 3, w - 3, r);
      g.lineTo(w - 3, h - r); g.quadraticCurveTo(w - 3, h - 3, w - r, h - 3);
      g.lineTo(r, h - 3); g.quadraticCurveTo(3, h - 3, 3, h - r);
      g.lineTo(3, r); g.quadraticCurveTo(3, 3, r, 3);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = "#2a1c12";
      g.font = `700 ${Math.round(h * 0.56)}px "Noto Serif CJK SC","Songti SC","Noto Sans CJK SC",serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(text, w / 2, h / 2 + 3);
    }
  }
  // T039: float labels stay very faint so they do not form large white boards on the table.
  const worldH = text.length <= 3 ? 0.22 : 0.28;
  const geom = new PlaneGeometry((w / h) * worldH, worldH);
  geom.rotateX(-Math.PI / 2);
  const texture = canvas ? new CanvasTexture(canvas) : null;
  if (texture) {
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
  }
  const mesh = new Mesh(geom, new MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  }));
  mesh.raycast = () => {};
  mesh.renderOrder = 10;
  mesh.userData.faintLabel = true;
  return mesh;
}


/** step3 R3 · undulating island rim (unit 1×1 footprint, posed by node.scale). */
function shoreNatural(node: SceneNode, ctx: TabletopObjectContext): Object3D {
  const seed = Number((node.tag ?? "7").split(":")[0]) || 7;
  let a = (seed >>> 0) || 1;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const shape = new Shape();
  const steps = 48;
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * Math.PI * 2;
    const ux = Math.cos(t);
    const uz = Math.sin(t);
    const squircle = Math.pow(Math.abs(ux) ** 4 + Math.abs(uz) ** 4, -0.25);
    const wobble = 1 + 0.12 * Math.sin(t * 3 + seed) + 0.08 * Math.sin(t * 5 - seed * 0.3) + (rnd() - 0.5) * 0.04;
    const r = 0.5 * squircle * wobble;
    const x = ux * r;
    const y = uz * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geom = new ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, steps: 1, curveSegments: 1 });
  geom.rotateX(-Math.PI / 2);
  geom.translate(0, -0.5, 0);
  geom.computeVertexNormals();
  const mesh = new Mesh(geom, materialFor(node, ctx));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}


/** T038 · soft contact / ground shadow under desk pieces (cheap, no lightmap). */
function softContactShadow(
  rx = 0.55,
  rz = 0.55,
  opts?: { opacity?: number; boost?: number },
): Object3D {
  // T079 · stronger ground contact so pieces don't float on felt
  // T081 · optional opacity/boost for small tiles/plates (shared API; not H04-only)
  // T079 default opacity: 0.48 (baseline for typical card footprint)
  // T096 · footprint-scaled radius/strength — large discs stay visible but not board-wide blobs
  // T106 · reopen: tighter boost/opacity for large footprints; shadows remain (T079/T081)
  // T135 · residual polish: slightly stronger auto opacity floor/ceiling (keep T106 boost clamp)
  // T138 · stage-wide contact-shadow contrast (keep T106 boost clamp)
  // T139 · pixel residual: larger footprint + opacity ceiling (keep T106 boost clamp + T135/T138 floors)
  // T142 · H02 stage-wide residual: larger shared footprint (keep T139 opacity floors)
  // T145 · mean floor: higher opacity + soft outer halo (keep T106 boost clamp / T142 ge20)
  // T150 · H03/H04 mean: larger soft halo + card/tile footprints (keep H02/T145 floors)
  // T153 · halo softness: gentler opacity falloff on outer rings (keep core / T106 clamp)
  // T154 · H04 mean residual: slightly denser mid/outer + tile footprint (keep H02/H03 / T151)
  // T155 · H02 halo residual: route footprint + soft veil (keep H03/H04 clamps / T151)
  // T157 · lot close absolute-ink stability floor (framed-art shadow stays light)
  // T158 · H04 mean floor ≥5 (tile/mid; keep H02/H03 / T151 ink)
  // T160 · H01/H02 product-frame + H02 route residual (keep H03/H04 / T157 ink)
  // T161 · H04 wide halo dark-clamp: lighter mid ink blot, soft mean via footprint (keep T157)
  // T163 · H01/H02 seat-close dual-lip product-frame (must clear pixel gate)
  // T164 · H02 route residual under dark-clamp (keep T161 upper-ink lighter)
  // T169 · shared material/light microcontrast — softer mid/outer veil (no radial blot)
  const area = Math.max(0.04, rx * rz);
  const autoBoost =
    opts?.boost ??
    Math.min(1.02, Math.max(0.68, 1.00 / Math.sqrt(area / 0.18)));
  const autoOpacity =
    opts?.opacity ??
    Math.min(0.68, Math.max(0.48, 0.56 + 0.12 / Math.sqrt(area / 0.18))); // T161/T218 product opacity (corner/center calm)
  const opacity = autoOpacity;
  const boost = autoBoost;
  const group = new Group();
  group.name = "contact-shadow";
  const mk = (scale: number, op: number, y: number, name?: string) => {
    const geom = new CircleGeometry(1, 24);
    geom.rotateX(-Math.PI / 2);
    geom.scale(rx * boost * scale, 1, rz * boost * scale);
    geom.translate(0, y, 0);
    const mat = new MeshBasicMaterial({
      color: "#000000",
      transparent: true,
      opacity: op,
      depthWrite: false,
      toneMapped: false,
    });
    const mesh = new Mesh(geom, mat);
    if (name) mesh.name = name;
    mesh.raycast = () => {};
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.renderOrder = -1;
    return mesh;
  };
  // T218/T226/T230 · product contact shadow: denser core hug + smoother veil (no bands / no center blot)
  group.add(mk(1.02, Math.min(0.95, opacity * 1.50), 0.00066, "contact-shadow")); // T233/T234 tight core hug
  group.add(mk(1.28, Math.min(0.64, opacity * 0.86), 0.00050)); // near core blend
  group.add(mk(1.72, Math.min(0.26, opacity * 0.38), 0.00038)); // soft mid · center-calm T237
  group.add(mk(2.55, Math.min(0.055, opacity * 0.08), 0.00032)); // mid-outer · corner-calm T237
  group.add(mk(3.10, Math.min(0.022, opacity * 0.035), 0.00018)); // soft outer · T230 corner-calm
  group.add(mk(3.90, Math.min(0.008, opacity * 0.012), 0.00010)); // wide soft veil · T230 corner-calm
  return group;
}


/** T041 · wood rim with slight top bevel (reads as table-edge product frame). */

/** T076 · shallow porcelain plate: dish bed + rim lip + glaze wash (factory/center). */
function porcelainPlate(node: SceneNode, ctx: TabletopObjectContext): Object3D {
  const group = new Group();
  const tint = (node.material && ctx.materials[node.material]?.base) || "#f3efe6";
  const bodyMat = ctx.library.get("tt-porcelain-body", {
    base: String(tint),
    roughness: 0.35,
    metalness: 0.05,
    pattern: "none" as const,
  });
  const rimMat = ctx.library.get("tt-porcelain-rim", {
    base: "#e7e0d4",
    roughness: 0.28,
    metalness: 0.08,
    pattern: "none" as const,
  });
  const glazeMat = ctx.library.get("tt-porcelain-glaze", {
    base: "#ffffff",
    roughness: 0.18,
    metalness: 0.12,
    pattern: "none" as const,
  });
  // shallow dish bed
  const bed = new Mesh(translated(new CylinderGeometry(0.42, 0.46, 0.06, 28), 0.03), bodyMat);
  bed.receiveShadow = true;
  bed.castShadow = true;
  // raised rim lip
  const rim = new Mesh(translated(new CylinderGeometry(0.48, 0.48, 0.045, 28), 0.075), rimMat);
  rim.receiveShadow = true;
  rim.castShadow = true;
  // inner glaze wash (slightly smaller, glossy)
  const glaze = new Mesh(translated(new CylinderGeometry(0.36, 0.36, 0.02, 28), 0.065), glazeMat);
  glaze.receiveShadow = true;
  group.add(bed, rim, glaze);
  group.add(softContactShadow(0.32, 0.32, { opacity: 0.38, boost: 0.82 })); // T081/T096/T106 footprint
  return group;
}

function feltWoodRim(): Geometry {
  const outer = new BoxGeometry(1, 1, 1);
  // Bevel cue: thinner top lip via a second box slightly inset on Y.
  return outer;
}

/** T094/T109 · shared route-path microdetail maps (ballast / sleeper / steel). */
function makeRailMaps(kind: "ballast" | "sleeper" | "steel", baseHex: string): {
  map: CanvasTexture | null;
  normalMap: CanvasTexture | null;
  roughnessMap: CanvasTexture | null;
} {
  const W = 128;
  const H = 128;
  const albedo = typeof document !== "undefined" ? document.createElement("canvas") : null;
  const normal = typeof document !== "undefined" ? document.createElement("canvas") : null;
  const rough = typeof document !== "undefined" ? document.createElement("canvas") : null;
  if (!albedo || !normal || !rough) return { map: null, normalMap: null, roughnessMap: null };
  albedo.width = W; albedo.height = H;
  normal.width = W; normal.height = H;
  rough.width = W; rough.height = H;
  const ga = albedo.getContext("2d");
  const gn = normal.getContext("2d");
  const gr = rough.getContext("2d");
  if (!ga || !gn || !gr) return { map: null, normalMap: null, roughnessMap: null };
  const parse = (hex: string) => {
    const h = hex.replace("#", "");
    return [
      Number.parseInt(h.slice(0, 2), 16) || 90,
      Number.parseInt(h.slice(2, 4), 16) || 90,
      Number.parseInt(h.slice(4, 6), 16) || 90,
    ] as const;
  };
  const [br, bg, bb] = parse(baseHex.startsWith("#") && baseHex.length >= 7 ? baseHex : "#6b7280");
  const height = new Float32Array(W * H);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const u = x / W;
      const v = y / H;
      let h0 = 0.5;
      if (kind === "ballast") {
        // gravel / crushed stone: high-freq noise clumps
        const n1 = Math.sin(u * 70) * Math.sin(v * 55);
        const n2 = Math.sin(u * 140 + 1.7) * Math.cos(v * 110);
        const n3 = (Math.random() - 0.5) * 0.55;
        h0 = 0.5 + n1 * 0.22 + n2 * 0.18 + n3;
      } else if (kind === "sleeper") {
        // cross-grain lumber (ties run across gauge = local Z)
        const ring = Math.sin((v * 14 + Math.sin(u * 4) * 0.4) * Math.PI * 2);
        const pore = Math.sin(u * 55) * Math.sin(v * 40) * 0.15;
        h0 = 0.5 + ring * 0.28 + pore + (Math.random() - 0.5) * 0.06;
      } else {
        // steel: longitudinal scrapes + pit noise
        const scrape = Math.sin((u * 48 + v * 0.3) * Math.PI * 2) * 0.2;
        const pit = (Math.sin(u * 90) * Math.sin(v * 80)) * 0.12;
        h0 = 0.5 + scrape + pit + (Math.random() - 0.5) * 0.05;
      }
      height[y * W + x] = h0;
    }
  }
  const aImg = ga.createImageData(W, H);
  const nImg = gn.createImageData(W, H);
  const rImg = gr.createImageData(W, H);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const i = y * W + x;
      const h0 = height[i]!;
      const hx = height[y * W + ((x + 1) % W)]!;
      const hy = height[((y + 1) % H) * W + x]!;
      // T109 · stronger albedo micro-shade for stage-wide path contrast (T094 maps kept)
      const dx = (h0 - hx) * (kind === "steel" ? 7 : 12);
      const dy = (h0 - hy) * (kind === "steel" ? 7 : 12);
      const shade = (h0 - 0.5) * (kind === "ballast" ? 120 : kind === "sleeper" ? 95 : 85);
      const o = i * 4;
      aImg.data[o] = Math.max(0, Math.min(255, br + shade));
      aImg.data[o + 1] = Math.max(0, Math.min(255, bg + shade * 0.92));
      aImg.data[o + 2] = Math.max(0, Math.min(255, bb + shade * 0.85));
      aImg.data[o + 3] = 255;
      nImg.data[o] = Math.max(0, Math.min(255, 128 + dx * 110));
      nImg.data[o + 1] = Math.max(0, Math.min(255, 128 + dy * 110));
      nImg.data[o + 2] = 255;
      nImg.data[o + 3] = 255;
      let rv = 160;
      if (kind === "ballast") rv = Math.max(0, Math.min(255, 200 + (0.5 - h0) * 70));
      else if (kind === "sleeper") rv = Math.max(0, Math.min(255, 170 + (0.5 - h0) * 80));
      else rv = Math.max(0, Math.min(255, 90 + (0.5 - h0) * 100));
      rImg.data[o] = rv;
      rImg.data[o + 1] = rv;
      rImg.data[o + 2] = rv;
      rImg.data[o + 3] = 255;
    }
  }
  ga.putImageData(aImg, 0, 0);
  gn.putImageData(nImg, 0, 0);
  gr.putImageData(rImg, 0, 0);
  const map = new CanvasTexture(albedo);
  const normalMap = new CanvasTexture(normal);
  const roughnessMap = new CanvasTexture(rough);
  for (const tex of [map, normalMap, roughnessMap]) {
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.repeat.set(kind === "ballast" ? 3.2 : kind === "sleeper" ? 1.6 : 4.0, kind === "ballast" ? 3.2 : kind === "sleeper" ? 1.2 : 1.5);
  }
  map.colorSpace = SRGBColorSpace;
  return { map, normalMap, roughnessMap };
}

function railSleeperMaterial(ctx: TabletopObjectContext): Material {
  const maps = makeRailMaps("sleeper", SLEEPER.base);
  const mat = new MeshStandardMaterial({
    color: SLEEPER.base,
    map: maps.map ?? undefined,
    normalMap: maps.normalMap ?? undefined,
    normalScale: new Vector2(1.45, 1.45), // T109/T210 · lumber microcontrast
    roughnessMap: maps.roughnessMap ?? undefined,
    roughness: SLEEPER.roughness,
    metalness: SLEEPER.metalness,
  });
  installPattern(mat, "grain", 0);
  const strength = mat.userData.gdPatternStrength as { value: number } | undefined;
  if (strength) strength.value = 0.88; // T109/T210
  void ctx;
  return mat;
}

function railBallastMaterial(): Material {
  // T078 tt-ballast · T094 maps · T109 contrast lift
  const maps = makeRailMaps("ballast", "#9aa3b0");
  return new MeshStandardMaterial({
    color: "#9aa3b0",
    map: maps.map ?? undefined,
    normalMap: maps.normalMap ?? undefined,
    normalScale: new Vector2(1.55, 1.55),
    roughnessMap: maps.roughnessMap ?? undefined,
    roughness: 0.93,
    metalness: 0.03,
  });
}

function railSteelMaterial(ctx: TabletopObjectContext): Material {
  const maps = makeRailMaps("steel", STEEL.base);
  const mat = new MeshStandardMaterial({
    color: STEEL.base,
    map: maps.map ?? undefined,
    normalMap: maps.normalMap ?? undefined,
    normalScale: new Vector2(1.05, 1.05), // T210 · steel microcontrast
    roughnessMap: maps.roughnessMap ?? undefined,
    roughness: Math.max(0.28, (STEEL.roughness ?? 0.35) - 0.04),
    metalness: Math.min(0.92, (STEEL.metalness ?? 0.75) + 0.08), // T210
  });
  void ctx;
  return mat;
}

/** T092 · shared wood rim grain/normal/roughness microdetail (align with felt T082/T083; T110 exterior shares). */
function woodRimMaterial(node: SceneNode, ctx: TabletopObjectContext): Material {
  const token = node.material ? ctx.materials[node.material] : undefined;
  const base = token?.base ?? "#a87338"; // T110
  const W = 256;
  const H = 256;
  const albedo = typeof document !== "undefined" ? document.createElement("canvas") : null;
  const normal = typeof document !== "undefined" ? document.createElement("canvas") : null;
  const rough = typeof document !== "undefined" ? document.createElement("canvas") : null;
  if (albedo && normal && rough) {
    albedo.width = W; albedo.height = H;
    normal.width = W; normal.height = H;
    rough.width = W; rough.height = H;
    const ga = albedo.getContext("2d");
    const gn = normal.getContext("2d");
    const gr = rough.getContext("2d");
    if (ga && gn && gr) {
      ga.fillStyle = base;
      ga.fillRect(0, 0, W, H);
      const height = new Float32Array(W * H);
      // Longitudinal grain (rings along Z, variation along X) + fine pore noise
      for (let y = 0; y < H; y += 1) {
        for (let x = 0; x < W; x += 1) {
          const u = x / W;
          const v = y / H;
          const ring = Math.sin((u * 18 + Math.sin(v * 6.2) * 0.35) * Math.PI * 2);
          const ray = Math.sin((v * 3.5 + u * 0.8) * Math.PI * 2) * 0.25;
          const pore = (Math.sin(u * 90) * Math.sin(v * 70)) * 0.12;
          const n = (Math.random() - 0.5) * 0.08;
          height[y * W + x] = 0.5 + ring * 0.32 + ray + pore + n;
        }
      }
      const aImg = ga.createImageData(W, H);
      const nImg = gn.createImageData(W, H);
      const rImg = gr.createImageData(W, H);
      const parse = (hex: string) => {
        const h = hex.replace("#", "");
        return [
          Number.parseInt(h.slice(0, 2), 16),
          Number.parseInt(h.slice(2, 4), 16),
          Number.parseInt(h.slice(4, 6), 16),
        ] as const;
      };
      const [br, bg, bb] = parse(String(base).startsWith("#") && String(base).length >= 7 ? String(base) : "#a87338");
      for (let y = 0; y < H; y += 1) {
        for (let x = 0; x < W; x += 1) {
          const i = y * W + x;
          const h0 = height[i]!;
          const hx = height[y * W + ((x + 1) % W)]!;
          const hy = height[((y + 1) % H) * W + x]!;
          // T110 · stronger shared grain shade (rim+exterior continuous, not cut)
          const dx = (h0 - hx) * 12;
          const dy = (h0 - hy) * 12;
          const shade = (h0 - 0.5) * 220; // T110…T217/T222 · grain (restore tip highlight)
          const o = i * 4;
          aImg.data[o] = Math.max(0, Math.min(255, br + shade));
          aImg.data[o + 1] = Math.max(0, Math.min(255, bg + shade * 0.9));
          aImg.data[o + 2] = Math.max(0, Math.min(255, bb + shade * 0.7));
          aImg.data[o + 3] = 255;
          nImg.data[o] = Math.max(0, Math.min(255, 128 + dx * 120));
          nImg.data[o + 1] = Math.max(0, Math.min(255, 128 + dy * 120));
          nImg.data[o + 2] = 255;
          nImg.data[o + 3] = 255;
          // pores darker = higher roughness; varnish ridges smoother
          const rv = Math.max(0, Math.min(255, 160 + (0.5 - h0) * 90));
          rImg.data[o] = rv;
          rImg.data[o + 1] = rv;
          rImg.data[o + 2] = rv;
          rImg.data[o + 3] = 255;
        }
      }
      ga.putImageData(aImg, 0, 0);
      gn.putImageData(nImg, 0, 0);
      gr.putImageData(rImg, 0, 0);
    }
  }
  const map = albedo ? new CanvasTexture(albedo) : null;
  const normalMap = normal ? new CanvasTexture(normal) : null;
  const roughnessMap = rough ? new CanvasTexture(rough) : null;
  for (const tex of [map, normalMap, roughnessMap]) {
    if (!tex) continue;
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.repeat.set(2.4, 2.4);
  }
  if (map) map.colorSpace = SRGBColorSpace;
  const mat = new MeshStandardMaterial({
    color: base,
    map: map ?? undefined,
    normalMap: normalMap ?? undefined,
    normalScale: new Vector2(3.65, 3.65), // T092…T214/T217 · grain microcontrast
    roughnessMap: roughnessMap ?? undefined,
    roughness: Math.min(0.88, Math.max(0.55, token?.roughness ?? 0.78)),
    metalness: Math.min(0.12, token?.metalness ?? 0.06),
  });
  installPattern(mat, "grain", 0);
  const strength = mat.userData.gdPatternStrength as { value: number } | undefined;
  if (strength) strength.value = 0.92; // T110
  return mat;
}

/** T098/T110/T102 · desk exterior = T092 woodRimMaterial maps; continuous with rim. */
function deskWoodMaterial(node: SceneNode, ctx: TabletopObjectContext, token?: MaterialToken): Material {
  const base = String(token?.base ?? (node.material && ctx.materials[node.material]?.base) ?? "#a87338"); // T110=rim
  const roughKey = token?.roughness !== undefined ? String(token.roughness) : "d";
  const cacheKey = `desk-wood:${base}:${roughKey}`;
  return ctx.library.ensure(
    cacheKey,
    () => {
      const mat = woodRimMaterial({ ...node, material: node.material }, ctx) as MeshStandardMaterial;
      mat.color.set(base);
      for (const tex of [mat.map, mat.normalMap, mat.roughnessMap]) {
        if (!tex) continue;
        // T110 · closer world repeat to rim (was 4.5 vs rim 2.4) — continuity without cutting grain
        tex.repeat.set(3.2, 3.2);
      }
      const strength = mat.userData.gdPatternStrength as { value: number } | undefined;
      if (strength) strength.value = 0.92; // match rim T110
      // Match rim roughness/metalness floors when token silent
      mat.roughness = Math.min(0.88, Math.max(0.55, token?.roughness ?? 0.78));
      mat.metalness = Math.min(0.12, token?.metalness ?? 0.06);
      mat.normalScale = new Vector2(1.35, 1.35); // same as rim T110
      return mat;
    },
    token ?? { base, roughness: 0.78, metalness: 0.06, pattern: "grain" },
  );
}


/** T044/T082/T114/T120 · product green felt: weave albedo + normal/roughness microdetail (shared desk cloth). */
function feltPileMaterial(node: SceneNode, ctx: TabletopObjectContext): Material {
  const token = node.material ? ctx.materials[node.material] : undefined;
  const base = token?.base ?? "#1a8a45";
  const W = 256;
  const H = 256;
  const albedo = typeof document !== "undefined" ? document.createElement("canvas") : null;
  const normal = typeof document !== "undefined" ? document.createElement("canvas") : null;
  const rough = typeof document !== "undefined" ? document.createElement("canvas") : null;
  if (albedo && normal && rough) {
    albedo.width = W; albedo.height = H;
    normal.width = W; normal.height = H;
    rough.width = W; rough.height = H;
    const ga = albedo.getContext("2d");
    const gn = normal.getContext("2d");
    const gr = rough.getContext("2d");
    if (ga && gn && gr) {
      ga.fillStyle = base;
      ga.fillRect(0, 0, W, H);
      // height field for weave (warp/weft)
      const height = new Float32Array(W * H);
      const period = 20; // T083/T114/T120 · coarser weave readable at stage-wide
      for (let y = 0; y < H; y += 1) {
        for (let x = 0; x < W; x += 1) {
          const wx = ((x % period) / period) * Math.PI * 2;
          const wy = ((y % period) / period) * Math.PI * 2;
          const warp = Math.sin(wx) * 0.85;
          const weft = Math.sin(wy) * 0.85;
          const cross = Math.abs(warp) > Math.abs(weft) ? warp : weft;
          const n = (Math.random() - 0.5) * 0.2;
          // T083/T114 · low-frequency pile waves read at stage-wide
          const macro = Math.sin((x / W) * Math.PI * 3.4) * Math.sin((y / H) * Math.PI * 2.8) * 0.42; // T120
          height[y * W + x] = 0.5 + cross * 0.62 + macro + n;
        }
      }
      const aImg = ga.createImageData(W, H);
      const nImg = gn.createImageData(W, H);
      const rImg = gr.createImageData(W, H);
      const parse = (hex: string) => {
        const h = hex.replace("#", "");
        return [
          Number.parseInt(h.slice(0, 2), 16),
          Number.parseInt(h.slice(2, 4), 16),
          Number.parseInt(h.slice(4, 6), 16),
        ] as const;
      };
      const [br, bg, bb] = parse(String(base).startsWith("#") && String(base).length >= 7 ? String(base) : "#1a8a45");
      for (let y = 0; y < H; y += 1) {
        for (let x = 0; x < W; x += 1) {
          const i = y * W + x;
          const h0 = height[i]!;
          const hx = height[y * W + ((x + 1) % W)]!;
          const hy = height[((y + 1) % H) * W + x]!;
          const dx = (h0 - hx) * 14;
          const dy = (h0 - hy) * 14;
          const shade = (h0 - 0.5) * 360; // T083…T214/T217 · wide-stage albedo amplitude
          const o = i * 4;
          aImg.data[o] = Math.max(0, Math.min(255, br + shade));
          aImg.data[o + 1] = Math.max(0, Math.min(255, bg + shade));
          aImg.data[o + 2] = Math.max(0, Math.min(255, bb + shade * 0.85));
          aImg.data[o + 3] = 255;
          nImg.data[o] = Math.max(0, Math.min(255, 128 + dx * 110));
          nImg.data[o + 1] = Math.max(0, Math.min(255, 128 + dy * 110));
          nImg.data[o + 2] = 255;
          nImg.data[o + 3] = 255;
          const rv = Math.max(0, Math.min(255, 210 + (h0 - 0.5) * 70));
          rImg.data[o] = rv;
          rImg.data[o + 1] = rv;
          rImg.data[o + 2] = rv;
          rImg.data[o + 3] = 255;
        }
      }
      // fine pile speckles on top of weave
      for (let i = 0; i < 4800; i += 1) {
        const x = Math.floor(Math.random() * W);
        const y = Math.floor(Math.random() * H);
        const o = (y * W + x) * 4;
        const a = Math.random() < 0.5 ? -10 : 8;
        aImg.data[o] = Math.max(0, Math.min(255, aImg.data[o]! + a));
        aImg.data[o + 1] = Math.max(0, Math.min(255, aImg.data[o + 1]! + a));
        aImg.data[o + 2] = Math.max(0, Math.min(255, aImg.data[o + 2]! + a));
      }
      ga.putImageData(aImg, 0, 0);
      gn.putImageData(nImg, 0, 0);
      gr.putImageData(rImg, 0, 0);
    }
  }
  const map = albedo ? new CanvasTexture(albedo) : null;
  const normalMap = normal ? new CanvasTexture(normal) : null;
  const roughnessMap = rough ? new CanvasTexture(rough) : null;
  for (const tex of [map, normalMap, roughnessMap]) {
    if (!tex) continue;
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.repeat.set(2.4, 2.4); // T083…T190/T196 · weave cells at stage-wide
  }
  if (map) map.colorSpace = SRGBColorSpace;
  const mat = new MeshStandardMaterial({
    color: base,
    map: map ?? undefined,
    normalMap: normalMap ?? undefined,
    normalScale: new Vector2(6.85, 6.85), // T083…T214/T217 · weave microcontrast
    roughnessMap: roughnessMap ?? undefined,
    roughness: Math.max(0.9, token?.roughness ?? 0.97),
    metalness: 0,
    // T083/T169 · AO-ish darkening so weave separates from wood surround
    aoMapIntensity: 0.95,
  });
  // T082 · procedural cloth weave on top of maps (MaterialLibrary cloth pattern)
  installPattern(mat, token?.pattern === "cloth" || !token?.pattern ? "cloth" : token.pattern, 0);
  const strength = mat.userData.gdPatternStrength as { value: number } | undefined;
  if (strength) strength.value = 1;
  return mat;
}

function feltInsetGeom(): Geometry {
  return new BoxGeometry(1, 1, 1);
}

/** Stitch / piping ring on the felt lip (thin dark frame). */
function feltStitchMesh(): Object3D {
  const group = new Group();
  const mat = new MeshBasicMaterial({
    color: "#2a2118",
    transparent: true,
    opacity: 0.38, // T202 · calmer felt lip stitch
    depthWrite: false,
    toneMapped: false,
  });
  // Four thin bars forming a rectangle (unit size; posed by node.scale).
  const mk = (sx: number, sz: number, x: number, z: number) => {
    const m = new Mesh(new BoxGeometry(sx, 0.01, sz), mat);
    m.position.set(x, 0, z);
    m.castShadow = false;
    m.receiveShadow = false;
    m.raycast = () => {};
    group.add(m);
  };
  const t = 0.012;
  mk(1, t, 0, 0.5 - t / 2);
  mk(1, t, 0, -0.5 + t / 2);
  mk(t, 1 - 2 * t, 0.5 - t / 2, 0);
  mk(t, 1 - 2 * t, -0.5 + t / 2, 0);
  return group;
}

/** Soft radial vignette over the table (dark corners; does not fight contact shadows). */
function tableVignetteMesh(): Object3D {
  const canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
  const W = 256, H = 256;
  if (canvas) {
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext("2d");
    if (g) {
      // T193/T202 · softer shared table vignette — larger clear center, milder rim (no hard bait)
      const grd = g.createRadialGradient(W / 2, H / 2, W * 0.42, W / 2, H / 2, W * 0.78);
      grd.addColorStop(0, "rgba(0,0,0,0)");
      grd.addColorStop(0.58, "rgba(0,0,0,0.01)");
      grd.addColorStop(1, "rgba(12,8,4,0.12)");
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);
    }
  }
  const tex = canvas ? new CanvasTexture(canvas) : null;
  if (tex) {
    tex.colorSpace = SRGBColorSpace;
  }
  const geom = new PlaneGeometry(1, 1);
  geom.rotateX(-Math.PI / 2);
  const mesh = new Mesh(
    geom,
    new MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  mesh.raycast = () => {};
  mesh.renderOrder = -2;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}


/** T043 · framed gallery lot: wood frame + procedural color fields / brush blocks (no copyright art). */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function proceduralLotCanvas(schema: { title: string; prestige?: number; bid?: number; artistId?: string }): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const W = 256, H = 320;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d");
  if (!g) return canvas;
  const seed = hashSeed(`${schema.artistId ?? ""}:${schema.title}`);
  let state = seed || 1;
  const rnd = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 1000) / 1000;
  };
  const palettes = [
    ["#0f172a", "#38bdf8", "#f472b6", "#fef3c7"],
    ["#1e1b4b", "#a78bfa", "#fbbf24", "#ecfccb"],
    ["#14532d", "#4ade80", "#f97316", "#e0f2fe"],
    ["#7c2d12", "#fb7185", "#38bdf8", "#fef9c3"],
    ["#334155", "#94a3b8", "#e2e8f0", "#f59e0b"],
  ];
  const pal = palettes[seed % palettes.length]!;
  // T075 · stage-readable full-bleed color masses (pay T072 H05 debt)
  // T137 · auction density pixel residual — higher ink/edge contrast (shared; keep T134 counts)
  // T141 · stage-wide microcontrast — brighter masses + dual rim + hatch (keep T134/T137 floors)
  // T144 · wide ink floor — denser dark plate + ink wash (keep T141 ge20 / T134 counts)
  // T147 · close ink balance — softer mid hatch/wash; keep wide band washes + rim
  // T148 · close calm — no mid hatch; quieter secondary; keep wide bands + rim
  // T151 · absolute close calm — strong mid lift (drop close absolute ink); keep wide edge ink
  // T157 · absolute-ink stability floor under co-shipped shadow residuals
  // NOTE: do not thin mid masses with low alpha over dark base — that raises absolute ink.
  g.fillStyle = pal[0]!;
  g.fillRect(0, 0, W, H);
  // lighten base plate before masses (shared absolute calm)
  g.fillStyle = "rgba(255,250,240,0.48)";
  g.fillRect(0, 0, W, H);
  g.fillStyle = pal[1]!;
  g.fillRect(0, 0, W * 0.62, H * 0.78);
  g.fillStyle = pal[2]!;
  g.fillRect(W * 0.36, H * 0.02, W * 0.58, H * 0.56);
  g.fillStyle = pal[3]!;
  g.beginPath();
  g.moveTo(W * 0.52, H * 0.06);
  g.lineTo(W * 0.96, H * 0.38);
  g.lineTo(W * 0.52, H * 0.68);
  g.lineTo(W * 0.22, H * 0.38);
  g.closePath();
  g.fill();
  // secondary — cream lift (vs dark pal blocks on tip)
  g.fillStyle = "rgba(255,248,235,0.55)";
  g.fillRect(W * 0.05, H * 0.44, W * 0.30, H * 0.24);
  g.fillStyle = "rgba(255,248,235,0.48)";
  g.fillRect(W * 0.58, H * 0.48, W * 0.30, H * 0.20);
  // T151 · strong mid-face luminance lift (close crop center)
  g.fillStyle = "rgba(255,252,245,0.88)";
  g.fillRect(W * 0.05, H * 0.10, W * 0.90, H * 0.62);
  // wide-only ink bands (edges; protect wide mean/ge20)
  g.fillStyle = "rgba(15,23,42,0.62)";
  g.fillRect(0, 0, W, H * 0.22);
  g.fillStyle = "rgba(15,23,42,0.58)";
  g.fillRect(0, H * 0.74, W, H * 0.26);
  g.fillStyle = "rgba(15,23,42,0.32)";
  g.fillRect(0, H * 0.22, W * 0.08, H * 0.52);
  g.fillRect(W * 0.92, H * 0.22, W * 0.08, H * 0.52);
  // dual rim
  g.strokeStyle = "rgba(15,23,42,0.72)";
  g.lineWidth = 10;
  g.strokeRect(3, 3, W - 6, H - 6); // T151 lighter rim
  g.strokeStyle = "rgba(253,230,138,0.76)";
  g.lineWidth = 4;
  g.strokeRect(14, 14, W - 28, H - 28);
  g.globalAlpha = 1;
  // Title plate — light absolute ink (was 0.88 on tip)
  g.fillStyle = "rgba(15,23,42,0.22)";
  g.fillRect(12, H - 54, W - 24, 42);
  g.fillStyle = "#ffffff";
  g.font = "bold 22px system-ui,sans-serif";
  g.textAlign = "left";
  g.fillText((schema.title || "拍品").slice(0, 10), 22, H - 30);
  g.font = "bold 14px system-ui,sans-serif";
  g.fillStyle = "#fde68a";
  const bits: string[] = [];
  if (schema.prestige != null) bits.push(`底 ${schema.prestige}`);
  if (schema.bid != null && schema.bid > 0) bits.push(`价 ${schema.bid}`);
  g.fillText(bits.join(" · ") || "画廊拍品", 22, H - 12);
  return canvas;
}

function framedArtWithFace(node: SceneNode, ctx: TabletopObjectContext): Object3D {
  const group = new Group();
  // T213 · Wood frame (outer) — thicker product gallery frame
  const frame = new Mesh(
    translated(new BoxGeometry(1.02, 0.11, 1.28), 0.055),
    new MeshStandardMaterial({ color: "#c49858", roughness: 0.68, metalness: 0.08 }), // T137…T157/T213
  );
  frame.castShadow = true;
  frame.receiveShadow = true;
  group.add(frame);
  // T159/T213 · shared product-frame bevel lip (seat-close readable across suites)
  const lip = new Mesh(
    translated(new BoxGeometry(1.05, 0.018, 1.32), 0.115),
    new MeshStandardMaterial({ color: "#ffe8b8", roughness: 0.32, metalness: 0.18 }), // T159/T160/T163/T213
  );
  lip.castShadow = false;
  lip.receiveShadow = true;
  group.add(lip);
  // Inner mat
  const mat = new Mesh(
    translated(new BoxGeometry(0.84, 0.025, 1.06), 0.09),
    new MeshStandardMaterial({ color: "#fffaf2", roughness: 0.82, metalness: 0 }), // T157/T213 mat lift
  );
  mat.receiveShadow = true;
  group.add(mat);
  const parsed = parseFaceSchema(node.tag);
  const lot = parsed && parsed.kind === "lot"
    ? parsed
    : { title: "拍品", prestige: undefined as number | undefined, bid: undefined as number | undefined, artistId: undefined as string | undefined };
  const canvas = proceduralLotCanvas({
    title: lot.title,
    prestige: "prestige" in lot ? lot.prestige : undefined,
    bid: "bid" in lot ? (lot as { bid?: number }).bid : undefined,
    artistId: "artistId" in lot ? (lot as { artistId?: string }).artistId : undefined,
  });
  const tex = canvas ? new CanvasTexture(canvas) : null;
  if (tex) tex.colorSpace = SRGBColorSpace;
  const artGeom = new PlaneGeometry(0.78, 0.98);
  artGeom.rotateX(-Math.PI / 2);
  const art = new Mesh(
    artGeom,
    new MeshBasicMaterial({ map: tex, toneMapped: false }),
  );
  art.position.set(0, 0.12, 0);
  art.renderOrder = 2;
  group.add(art);
  group.add(softContactShadow(0.66, 0.82, { opacity: 0.12, boost: 0.62 })); // T139…T213/T218 lot shadow (corner-calm)
  return group;
}


export function createTabletopObject(node: SceneNode, ctx: TabletopObjectContext): Object3D {
  const mesh = node.mesh ?? "pawn";
  let object: Object3D;
  if (mesh === "grid-lines") {
    const token = node.material ? ctx.materials[node.material] : undefined;
    const lines = new LineSegments(gridLines(node.tag), new LineBasicMaterial({ color: token?.base ?? "#1d2a24" }));
    // 网格线不参与拾取：Line 的射线阈值（1 单位）会抢在底板前命中，命中点又不在盘面上。
    lines.raycast = () => {};
    object = lines;
  } else if (mesh === "ring") {
    const geom = new RingGeometry(0.62, 1, 28);
    geom.rotateX(-Math.PI / 2);
    // 合法目标提示：每个提示独立（非共享）材质，随节点释放。
    const hint = new Mesh(geom, new MeshBasicMaterial({ color: HINT_COLOR, transparent: true, opacity: 0.85, side: DoubleSide, depthWrite: false }));
    object = hint;
  } else if (mesh === "rail-track") {
    object = railTrack(node, ctx);
  } else if (mesh === "signal-post") {
    object = signalPost(node, ctx);
  } else if (mesh === "station") {
    object = station(node, ctx);
  } else if (mesh === "shore-natural") {
    object = shoreNatural(node, ctx);
  } else if (mesh === "label") {
    object = label(node);
  } else if (mesh === "contact-shadow") {
    const sx = Math.max(0.2, Math.abs(node.scale?.[0] ?? 1));
    const sz = Math.max(0.2, Math.abs(node.scale?.[2] ?? sx));
    object = softContactShadow(sx, sz);
  } else if (mesh === "felt-wood-rim") {
    // T044: hollow wood frame — solid box was burying the green felt inset.
    // T092 · grain/normal/roughness microdetail on shared wood rim
    // T159/T160 · product-frame seat-close top bevel lip
    // T163 · dual-lip product-frame (dark undercut + bright crown) for seat-close pixel gate
    // T165 · shared rim language across suites
    // T166 · taller crown + outer rail for H03 seat-close/wide residual
    const group = new Group();
    const mat = woodRimMaterial(node, ctx);
    const underMat = new MeshStandardMaterial({
      color: "#3a2414", // T163 · dark undercut for contrast
      roughness: 0.72,
      metalness: 0.04,
    });
    const lipMat = new MeshStandardMaterial({
      color: "#fae6b0", // T163/T169/T190/T196 · crown lip microcontrast vs felt
      roughness: 0.44,
      metalness: 0.12,
    });
    const filletMat = new MeshStandardMaterial({
      color: "#e8bc58", // T163/T190/T196 · inner gold fillet toward felt
      roughness: 0.45,
      metalness: 0.18,
    });
    const t = 0.085; // frame thickness in unit UV
    const mk = (sx: number, sy: number, sz: number, x: number, y: number, z: number, mtl = mat) => {
      const m = new Mesh(new BoxGeometry(sx, sy, sz), mtl);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
    };
    mk(1, 1, t, 0, 0, 0.5 - t / 2);
    mk(1, 1, t, 0, 0, -0.5 + t / 2);
    mk(t, 1, 1 - 2 * t, 0.5 - t / 2, 0, 0);
    mk(t, 1, 1 - 2 * t, -0.5 + t / 2, 0, 0);
    // dark undercut
    mk(1.12, 0.18, t * 1.55, 0, 0.46, 0.5 - t / 2, underMat);
    mk(1.12, 0.18, t * 1.55, 0, 0.46, -0.5 + t / 2, underMat);
    mk(t * 1.55, 0.18, 1 - 2 * t, 0.5 - t / 2, 0.46, 0, underMat);
    mk(t * 1.55, 0.18, 1 - 2 * t, -0.5 + t / 2, 0.46, 0, underMat);
    // bright crown lip (T166 taller for H03 seat-close/wide)
    mk(1.14, 0.36, t * 1.70, 0, 0.74, 0.5 - t / 2, lipMat);
    mk(1.14, 0.36, t * 1.70, 0, 0.74, -0.5 + t / 2, lipMat);
    mk(t * 1.70, 0.36, 1 - 2 * t, 0.5 - t / 2, 0.74, 0, lipMat);
    mk(t * 1.70, 0.36, 1 - 2 * t, -0.5 + t / 2, 0.74, 0, lipMat);
    // outer crown rail (T166 · stage-wide / seat-close residual)
    mk(1.18, 0.12, t * 1.25, 0, 0.92, 0.5 - t / 2, lipMat);
    mk(1.18, 0.12, t * 1.25, 0, 0.92, -0.5 + t / 2, lipMat);
    mk(t * 1.25, 0.12, 1 - 2 * t, 0.5 - t / 2, 0.92, 0, lipMat);
    mk(t * 1.25, 0.12, 1 - 2 * t, -0.5 + t / 2, 0.92, 0, lipMat);
    // inner gold fillet (reads on seat-close board edge)
    mk(0.92, 0.10, t * 0.65, 0, 0.54, 0.5 - t - 0.02, filletMat);
    mk(0.92, 0.10, t * 0.65, 0, 0.54, -0.5 + t + 0.02, filletMat);
    mk(t * 0.65, 0.10, 0.92 - 2 * t, 0.5 - t - 0.02, 0.54, 0, filletMat);
    mk(t * 0.65, 0.10, 0.92 - 2 * t, -0.5 + t + 0.02, 0.54, 0, filletMat);
    object = group;
  } else if (mesh === "felt-wood-lip") {
    // T092 · grain maps via woodRimMaterial; T163/T165 · high-key gold tint for seat-close
    const mat = woodRimMaterial(node, ctx).clone();
    mat.color.set("#f3d59a");
    mat.roughness = 0.42;
    mat.metalness = 0.12;
    const built = new Mesh(new BoxGeometry(1, 1, 1), mat);
    built.castShadow = false;
    built.receiveShadow = true;
    object = built;
  } else if (mesh === "felt-inset") {
    const built = new Mesh(feltInsetGeom(), feltPileMaterial(node, ctx));
    built.castShadow = false;
    built.receiveShadow = true;
    object = built;
  } else if (mesh === "felt-stitch") {
    object = feltStitchMesh();
  } else if (mesh === "table-vignette") {
    object = tableVignetteMesh();
  } else if (mesh === "line-trough") {
    const built = new Mesh(lineTroughGeom(), materialFor(node, ctx));
    built.castShadow = false;
    built.receiveShadow = true;
    object = built;
  } else if (mesh === "porcelain-plate") {
    object = porcelainPlate(node, ctx);
  } else if (mesh === "framed-art") {
    object = framedArtWithFace(node, ctx);
  } else if (mesh === "meeple") {
    object = meepleFigure(node, ctx);
  } else if (mesh === "card") {
    object = cardWithFace(node, ctx);
    (object as Group).add(softContactShadow(1.05, 1.28, { opacity: 0.32 })); // T096…T213/T218 card (center/corner-calm)
  } else if (mesh === "glazed-tile") {
    object = glazedTileWithFace(node, ctx);
    // T081 · larger local blob so small tiles still ground at H02/H03 visibility
    (object as Group).add(softContactShadow(1.18, 1.18, { opacity: 0.78, boost: 1.08 })); // T081…T161/T201/T210 tile mean
  } else if (mesh === "plaque") {
    object = plaqueWithFace(node, ctx);
    (object as Group).add(softContactShadow(0.78, 0.62, { opacity: 0.58 })); // T106/T150 plaque
  } else if (mesh === "gem-chip") {
    // T213 · shared gem chip with clearcoat crystal feel (MaterialLibrary base + physical coat)
    const baseTok = node.material ? ctx.materials[node.material] : undefined;
    const base = baseTok?.base ?? "#ffe9b8";
    const built = new Mesh(
      geometryFor(mesh),
      new MeshPhysicalMaterial({
        color: base,
        roughness: Math.min(0.28, baseTok?.roughness ?? 0.28),
        metalness: Math.max(0.12, baseTok?.metalness ?? 0.12),
        clearcoat: 0.95,
        clearcoatRoughness: 0.18,
      }),
    );
    built.castShadow = true;
    built.receiveShadow = true;
    const g = new Group();
    g.add(built);
    g.add(softContactShadow(0.62, 0.62, { opacity: 0.48 })); // T106/T150/T198/T213/T218 gem-chip (center-calm)
    object = g;
  } else if (INSTANCED_MESHES.has(mesh)) {
    object = createInstanceProxy(mesh, node, ctx);
  } else {
    const built = new Mesh(geometryFor(mesh), materialFor(node, ctx));
    built.castShadow = !NO_CAST.has(mesh) && node.kind !== "table" && node.kind !== "cell";
    built.receiveShadow = true;
    object = built;
  }
  pose(object, node);
  object.userData.nodeId = node.id;
  object.userData.kind = node.kind;
  object.userData.mesh = mesh;
  return object;
}

export function updateTabletopObject(object: Object3D, node: SceneNode, ctx: TabletopObjectContext): void {
  pose(object, node);
  if ((object as LineSegments).isLineSegments) {
    const token = node.material ? ctx.materials[node.material] : undefined;
    ((object as LineSegments).material as LineBasicMaterial).color.set(token?.base ?? "#1d2a24");
    return;
  }
  if (object.userData.batchKey !== undefined) {
    // 翻面 / configure_render 改色：代理换到对应材质的合批。
    const key = node.material ?? "tt-fallback";
    if (key !== object.userData.batchKey) {
      const parent = object.userData.batchParent as Object3D | undefined;
      detachProxy(object);
      object.userData.batchKey = key;
      object.userData.batchMaterial = materialFor(node, ctx);
      if (parent && object.parent === parent) attachProxy(object);
    }
    return;
  }
  const mesh = object as Mesh;
  if (!mesh.isMesh || node.mesh === "ring") return;
  // 座位 / 材质变化（翻面、configure_render 改色）：换成对应的共享材质。
  const next = materialFor(node, ctx);
  if (mesh.material !== next) mesh.material = next;
}