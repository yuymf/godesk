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
import type { MaterialLibrary } from "./materials";
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
  // Base → eaves → ridge (readable pitched roof, not a toy block)
  shape.moveTo(-0.36, 0);
  shape.lineTo(0.36, 0);
  shape.lineTo(0.36, 0.38);
  shape.lineTo(0, 0.78);
  shape.lineTo(-0.36, 0.38);
  shape.closePath();
  const geom = new ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false });
  geom.translate(0, 0, -0.25);
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
  // Classic meeple outline (Y up, X right); base at y=0.
  shape.moveTo(0, 0);
  shape.lineTo(0.16, 0);
  shape.quadraticCurveTo(0.2, 0.08, 0.14, 0.18); // right foot
  shape.lineTo(0.08, 0.28);
  shape.lineTo(0.22, 0.38); // right arm tip
  shape.quadraticCurveTo(0.28, 0.48, 0.16, 0.52);
  shape.lineTo(0.1, 0.55);
  shape.quadraticCurveTo(0.12, 0.7, 0, 0.78); // head right→top
  shape.quadraticCurveTo(-0.12, 0.7, -0.1, 0.55);
  shape.lineTo(-0.16, 0.52);
  shape.quadraticCurveTo(-0.28, 0.48, -0.22, 0.38);
  shape.lineTo(-0.08, 0.28);
  shape.lineTo(-0.14, 0.18);
  shape.quadraticCurveTo(-0.2, 0.08, -0.16, 0);
  shape.closePath();
  const geom = new ExtrudeGeometry(shape, {
    depth: 0.22,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.015,
    bevelSegments: 2,
    curveSegments: 8,
  });
  // Extrude along +Z; shift so base y=0 and centered in Z.
  geom.translate(0, 0, -0.11);
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
  group.add(softContactShadow(0.35, 0.28));
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
  const w = 0.31;
  const h = 0.44;
  const r = 0.04;
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
    depth: 0.045,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
  });
  geom.rotateX(-Math.PI / 2);
  geom.translate(0, 0, 0);
  // Extrude depth along +Z before rotate → after rotateX(-90) thickness is +Y.
  return geom;
}


/** T033 · cut gem chip: short faceted cylinder. */
function gemChip(): Geometry {
  const geom = new CylinderGeometry(0.42, 0.46, 0.18, 8);
  geom.translate(0, 0.09, 0);
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
  const s = 0.42;
  const r = 0.06;
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
    depth: 0.08,
    bevelEnabled: true,
    bevelThickness: 0.018,
    bevelSize: 0.018,
    bevelSegments: 2,
  });
  geom.rotateX(-Math.PI / 2);
  return geom;
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
      g.fillStyle = "#1f2937";
      g.font = '700 34px "Noto Serif CJK SC","Songti SC",serif';
      g.textAlign = "center";
      g.textBaseline = "middle";
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

function glazedTileWithFace(node: SceneNode, ctx: TabletopObjectContext): Object3D {
  const group = new Group();
  const body = new Mesh(glazedTileGeom(), materialFor(node, ctx));
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  // glossy top glaze plate
  const base = node.material && ctx.materials[node.material]?.base
    ? ctx.materials[node.material]!.base
    : "#e7e5e4";
  const glaze = new Mesh(
    (() => {
      const plane = new PlaneGeometry(0.72, 0.72);
      plane.rotateX(-Math.PI / 2);
      plane.translate(0, 0.09, 0);
      return plane;
    })(),
    new MeshPhysicalMaterial({
      color: base,
      roughness: 0.22,
      metalness: 0.08,
      clearcoat: 0.85,
      clearcoatRoughness: 0.25,
    }),
  );
  group.add(glaze);
  return group;
}

/** T037/T048 · card face: illustration band + reward bar + cost + prestige (shared atlas). */
function cardWithFace(node: SceneNode, ctx: TabletopObjectContext): Object3D {
  const group = new Group();
  const stock = new Mesh(cardStock(), materialFor(node, ctx));
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
        const plane = new PlaneGeometry(0.58, 0.82);
        plane.rotateX(-Math.PI / 2);
        // Sit clearly above extruded card stock (~0.045 + bevel).
        plane.translate(0, 0.09, 0);
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
  return ctx.library.get(key, ctx.materials[key] ?? FALLBACK_TOKEN);
}

function pose(object: Object3D, node: SceneNode): void {
  object.position.set(node.position[0], node.position[1], node.position[2]);
  object.rotation.y = node.rotationY ?? 0;
  if (node.scale) object.scale.set(node.scale[0], node.scale[1], node.scale[2]);
  else object.scale.set(1, 1, 1);
}

const STEEL: MaterialToken = { base: "#9aa1a6", roughness: 0.32, metalness: 0.85, pattern: "none" };
const SLEEPER: MaterialToken = { base: "#5a3b22", roughness: 0.86, metalness: 0, pattern: "grain" };
const TRACK_SLOT: MaterialToken = { base: "#94a3b8", roughness: 0.85, metalness: 0.05, pattern: "none" };
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
  const tieMat = claimed ? ctx.library.get("tt-sleeper", SLEEPER) : materialFor(node, ctx);
  const steel = ctx.library.get("tt-steel", STEEL);
  const ties: Geometry[] = [];
  for (let i = 0; i < count; i += 1) {
    const x = start + i * step;
    // Slightly thicker / taller ties so they read as lumber, not printed dashes.
    ties.push(boxAt(claimed ? 0.08 : 0.07, claimed ? 0.04 : 0.028, gauge * 1.05, x, claimed ? 0.055 : 0.03, 0));
  }
  const sleepers = new Mesh(mergeGeometries(ties) ?? ties[0]!, tieMat);
  sleepers.castShadow = true;
  sleepers.receiveShadow = true;
  // I-ish rail: web + head (two boxes per side) for a raised bar look in ortho close-up.
  const railY = claimed ? 0.095 : 0.055;
  const railH = claimed ? 0.04 : 0.028;
  const head = claimed ? 0.034 : 0.024;
  const web = claimed ? 0.016 : 0.012;
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
      // seat-colored body
      bodies.push(boxAt(cw, 0.16, cd, cx, 0.18, 0));
      bodies.push(boxAt(cw * 0.96, 0.05, cd * 0.92, cx, 0.28, 0)); // roof lip
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
    // Unclaimed: faint empty track + T051 countable length tick/slots (ghost wagon bays).
    group.add(sleepers, rails);
    const slotCount = Math.max(1, Math.min(6, Math.round(usable / 0.42)));
    const slotStep = usable / slotCount;
    const ghosts: Geometry[] = [];
    for (let i = 0; i < slotCount; i += 1) {
      const cx = -usable / 2 + slotStep * (i + 0.5);
      // hollow bay: thin rim boxes (readable length marks, not claimed cars)
      ghosts.push(boxAt(slotStep * 0.7, 0.02, gauge * 0.75, cx, 0.07, 0));
      ghosts.push(boxAt(0.02, 0.05, gauge * 0.75, cx - slotStep * 0.32, 0.09, 0));
      ghosts.push(boxAt(0.02, 0.05, gauge * 0.75, cx + slotStep * 0.32, 0.09, 0));
    }
    const ghostMat = ctx.library.get("tt-track-slot", TRACK_SLOT);
    const ghostMesh = new Mesh(mergeGeometries(ghosts) ?? ghosts[0]!, ghostMat);
    ghostMesh.castShadow = false;
    ghostMesh.receiveShadow = true;
    group.add(ghostMesh);
  }
  const hit = new Mesh(new BoxGeometry(usable, 0.1, gauge * 1.7), new MeshBasicMaterial({ visible: false }));
  hit.position.y = 0.05;
  group.add(hit);
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
  const platform = new Mesh(boxAt(0.95, 0.06, 1.15, 0, 0.03, -0.08), stone);
  platform.receiveShadow = true;
  platform.castShadow = true;
  const curb = new Mesh(boxAt(0.98, 0.03, 1.18, 0, 0.065, -0.08), ink);
  curb.receiveShadow = true;
  // Round pad on top of platform (station footprint)
  const plinth = new Mesh(translated(new CylinderGeometry(0.52, 0.56, 0.09, 20), 0.11), stone);
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
  if (stationName && typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    const W = Math.max(220, stationName.length * 52 + 64);
    const H = 88;
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext("2d");
    if (g) {
      g.fillStyle = isHub ? "#fbbf24" : "#fff7ed";
      g.fillRect(0, 0, W, H);
      g.strokeStyle = "#5b3a1a";
      g.lineWidth = 8;
      g.strokeRect(4, 4, W - 8, H - 8);
      g.fillStyle = "#111827";
      g.font = '700 48px "Noto Serif CJK SC","Songti SC",serif';
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(stationName.slice(0, 8), W / 2, H / 2 + 2);
      const tex = new CanvasTexture(canvas);
      tex.colorSpace = SRGBColorSpace;
      tex.anisotropy = 4;
      const pw = Math.min(1.15, 0.42 + stationName.length * 0.14);
      const plane = new PlaneGeometry(pw, 0.32);
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
function softContactShadow(rx = 0.55, rz = 0.55): Mesh {
  const geom = new CircleGeometry(1, 24);
  geom.rotateX(-Math.PI / 2);
  geom.scale(rx, 1, rz);
  geom.translate(0, 0.002, 0);
  const mat = new MeshBasicMaterial({
    color: "#0c0a08",
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new Mesh(geom, mat);
  mesh.name = "contact-shadow";
  mesh.raycast = () => {};
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = -1;
  return mesh;
}


/** T041 · wood rim with slight top bevel (reads as table-edge product frame). */
function feltWoodRim(): Geometry {
  const outer = new BoxGeometry(1, 1, 1);
  // Bevel cue: thinner top lip via a second box slightly inset on Y.
  return outer;
}


/** T044 · product green felt pile: dark cloth + micro-noise map (shared desk cloth look). */
function feltPileMaterial(node: SceneNode, ctx: TabletopObjectContext): Material {
  const token = node.material ? ctx.materials[node.material] : undefined;
  const base = token?.base ?? "#1a8a45";
  const canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
  if (canvas) {
    const W = 128, H = 128;
    canvas.width = W; canvas.height = H;
    const g = canvas.getContext("2d");
    if (g) {
      g.fillStyle = base;
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < 2200; i += 1) {
        const x = Math.random() * W;
        const y = Math.random() * H;
        const a = 0.04 + Math.random() * 0.08;
        g.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a * 0.7})`;
        g.fillRect(x, y, 1 + Math.random() * 1.5, 1 + Math.random() * 2.5);
      }
    }
  }
  const map = canvas ? new CanvasTexture(canvas) : null;
  if (map) {
    map.wrapS = map.wrapT = RepeatWrapping;
    map.repeat.set(6, 6);
    map.colorSpace = SRGBColorSpace;
  }
  return new MeshStandardMaterial({
    color: base,
    map: map ?? undefined,
    roughness: Math.max(0.95, token?.roughness ?? 0.99),
    metalness: 0,
  });
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
    opacity: 0.55,
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
      const grd = g.createRadialGradient(W / 2, H / 2, W * 0.22, W / 2, H / 2, W * 0.62);
      grd.addColorStop(0, "rgba(0,0,0,0)");
      grd.addColorStop(0.55, "rgba(0,0,0,0.05)");
      grd.addColorStop(1, "rgba(12,8,4,0.42)");
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
  g.fillStyle = pal[0]!;
  g.fillRect(0, 0, W, H);
  g.fillStyle = pal[1]!;
  g.fillRect(0, 0, W * 0.55, H * 0.72);
  g.fillStyle = pal[2]!;
  g.fillRect(W * 0.42, H * 0.08, W * 0.52, H * 0.5);
  g.fillStyle = pal[3]!;
  g.beginPath();
  g.moveTo(W * 0.55, H * 0.12);
  g.lineTo(W * 0.92, H * 0.38);
  g.lineTo(W * 0.55, H * 0.64);
  g.lineTo(W * 0.28, H * 0.38);
  g.closePath();
  g.fill();
  // secondary blocks for value structure at stage distance
  g.fillStyle = pal[1]!;
  g.fillRect(W * 0.08, H * 0.48, W * 0.28, H * 0.22);
  g.fillStyle = pal[3]!;
  g.fillRect(W * 0.62, H * 0.52, W * 0.28, H * 0.18);
  g.globalAlpha = 1;
  // Title plate
  g.fillStyle = "rgba(15,23,42,0.72)";
  g.fillRect(12, H - 72, W - 24, 56);
  g.fillStyle = "#f8fafc";
  g.font = "bold 22px system-ui,sans-serif";
  g.textAlign = "left";
  g.fillText((schema.title || "拍品").slice(0, 10), 24, H - 40);
  g.font = "16px system-ui,sans-serif";
  g.fillStyle = "#fde68a";
  const bits: string[] = [];
  if (schema.prestige != null) bits.push(`底 ${schema.prestige}`);
  if (schema.bid != null && schema.bid > 0) bits.push(`价 ${schema.bid}`);
  g.fillText(bits.join(" · ") || "画廊拍品", 24, H - 18);
  return canvas;
}

function framedArtWithFace(node: SceneNode, ctx: TabletopObjectContext): Object3D {
  const group = new Group();
  // Wood frame (outer)
  const frame = new Mesh(
    translated(new BoxGeometry(0.95, 0.08, 1.2), 0.04),
    new MeshStandardMaterial({ color: "#6b4423", roughness: 0.78, metalness: 0.05 }),
  );
  frame.castShadow = true;
  frame.receiveShadow = true;
  group.add(frame);
  // Inner mat
  const mat = new Mesh(
    translated(new BoxGeometry(0.78, 0.02, 1.0), 0.075),
    new MeshStandardMaterial({ color: "#f5f0e6", roughness: 0.9, metalness: 0 }),
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
  const artGeom = new PlaneGeometry(0.72, 0.92);
  artGeom.rotateX(-Math.PI / 2);
  const art = new Mesh(
    artGeom,
    new MeshBasicMaterial({ map: tex, toneMapped: false }),
  );
  art.position.set(0, 0.09, 0);
  art.renderOrder = 2;
  group.add(art);
  group.add(softContactShadow(0.55, 0.7));
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
    const group = new Group();
    const mat = materialFor(node, ctx);
    const t = 0.085; // frame thickness in unit UV
    const mk = (sx: number, sy: number, sz: number, x: number, y: number, z: number) => {
      const m = new Mesh(new BoxGeometry(sx, sy, sz), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
    };
    mk(1, 1, t, 0, 0, 0.5 - t / 2);
    mk(1, 1, t, 0, 0, -0.5 + t / 2);
    mk(t, 1, 1 - 2 * t, 0.5 - t / 2, 0, 0);
    mk(t, 1, 1 - 2 * t, -0.5 + t / 2, 0, 0);
    object = group;
  } else if (mesh === "felt-wood-lip") {
    const built = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({
      color: "#8b5a2b",
      roughness: 0.72,
      metalness: 0.08,
    }));
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
  } else if (mesh === "framed-art") {
    object = framedArtWithFace(node, ctx);
  } else if (mesh === "meeple") {
    object = meepleFigure(node, ctx);
  } else if (mesh === "card") {
    object = cardWithFace(node, ctx);
    (object as Group).add(softContactShadow(0.48, 0.68));
  } else if (mesh === "glazed-tile") {
    object = glazedTileWithFace(node, ctx);
    (object as Group).add(softContactShadow(0.52, 0.52));
  } else if (mesh === "plaque") {
    object = plaqueWithFace(node, ctx);
    (object as Group).add(softContactShadow(0.5, 0.38));
  } else if (mesh === "gem-chip") {
    const built = new Mesh(geometryFor(mesh), materialFor(node, ctx));
    built.castShadow = true;
    built.receiveShadow = true;
    const g = new Group();
    g.add(built);
    g.add(softContactShadow(0.4, 0.4));
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