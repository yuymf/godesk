/**
 * G3D-14 · 通用桌面的内置网格工厂（RenderSpec builtInMesh → three 对象）。
 * 只被 creator 侧懒加载的 TabletopScene3D 引用，打进该 chunk，不计入 render3d 核心预算。
 * 棋子类网格底面在 y=0、单位尺寸 1（节点 scale = 尺寸）；格位 / 连线 / 桌面为中心对齐的单位盒。
 */
import {
  BoxGeometry,
  BufferGeometry,
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
  Vector2,
  type BufferGeometry as Geometry,
  type Material,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { MaterialLibrary } from "./materials";
import type { SceneNode } from "./scene-model";
import type { MaterialToken } from "./tokens";
import type { TierCaps } from "./tiers";

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

function house(): Geometry {
  const shape = new Shape();
  shape.moveTo(-0.32, 0);
  shape.lineTo(0.32, 0);
  shape.lineTo(0.32, 0.42);
  shape.lineTo(0, 0.7);
  shape.lineTo(-0.32, 0.42);
  shape.closePath();
  const geom = new ExtrudeGeometry(shape, { depth: 0.46, bevelEnabled: false });
  geom.translate(0, 0, -0.23);
  return geom;
}

function pawn(): Geometry {
  const profile = [
    [0, 0], [0.3, 0], [0.3, 0.06], [0.2, 0.12], [0.13, 0.42], [0.2, 0.5], [0.12, 0.56],
    [0.17, 0.64], [0.17, 0.74], [0.11, 0.82], [0, 0.85],
  ].map(([x, y]) => new Vector2(x, y));
  return new LatheGeometry(profile, 14);
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


/** T033 · cut gem chip: short faceted cylinder (reads as varnished token, not a plastic slug). */
function gemChip(): Geometry {
  const geom = new CylinderGeometry(0.42, 0.46, 0.18, 8);
  geom.translate(0, 0.09, 0);
  return geom;
}

/** T033 · card face plate: parchment + color band + mark text. */
function cardWithFace(node: SceneNode, ctx: TabletopObjectContext): Object3D {
  const group = new Group();
  const stock = new Mesh(cardStock(), materialFor(node, ctx));
  stock.castShadow = true;
  stock.receiveShadow = true;
  group.add(stock);
  const mark = (node.tag && node.tag !== "major" ? node.tag : "").slice(0, 10);
  const canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
  if (canvas) {
    const W = 256, H = 360;
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext("2d");
    if (g) {
      g.fillStyle = "#f7efe2";
      g.fillRect(0, 0, W, H);
      g.strokeStyle = "rgba(60,40,20,0.35)";
      g.lineWidth = 8;
      g.strokeRect(10, 10, W - 20, H - 20);
      // color plate from material base
      const base = node.material && ctx.materials[node.material]?.base
        ? ctx.materials[node.material]!.base
        : "#c4b5a5";
      g.fillStyle = base;
      g.fillRect(28, 28, W - 56, 110);
      g.fillStyle = "rgba(255,255,255,0.22)";
      g.fillRect(28, 28, W - 56, 28);
      if (mark) {
        g.fillStyle = "#1f2937";
        g.font = '700 42px "Noto Serif CJK SC","Songti SC",serif';
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(mark, W / 2, 220);
      }
      g.fillStyle = "rgba(55,40,25,0.55)";
      g.fillRect(40, H - 48, W - 80, 10);
    }
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 4;
    const face = new Mesh(
      (() => {
        const plane = new PlaneGeometry(0.58, 0.82);
        plane.rotateX(-Math.PI / 2);
        plane.translate(0, 0.05, 0);
        return plane;
      })(),
      new MeshStandardMaterial({ map: tex, roughness: 0.78, metalness: 0.02 }),
    );
    face.receiveShadow = true;
    group.add(face);
  }
  return group;
}

function geometryFor(mesh: string): Geometry {
  switch (mesh) {
    case "tile-square":
    case "road-bar":
      return new BoxGeometry(1, 1, 1);
    case "hex-prism":
      return hexPrism();
    case "disc":
      // T030: slightly crowned chip (not a flat plastic slug).
      return translated(new CylinderGeometry(0.46, 0.44, 0.14, 40), 0.07);
    case "gem-chip":
      return gemChip();
    case "house":
      return house();
    case "tower":
      return translated(new CylinderGeometry(0.26, 0.32, 0.9, 10), 0.45);
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
  } else {
    group.add(sleepers, rails);
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
  // Round stone platform (reads as a station pad, not a cabinet base).
  const plinth = new Mesh(translated(new CylinderGeometry(0.52, 0.56, 0.09, 20), 0.045), stone);
  plinth.receiveShadow = true;
  plinth.castShadow = true;
  const ring = new Mesh(translated(new CylinderGeometry(0.48, 0.48, 0.025, 20), 0.1), ink);
  ring.receiveShadow = true;
  // Main cabin body
  const walls = new Mesh(boxAt(0.5, 0.34, 0.34, 0, 0.28, 0), wall);
  walls.castShadow = true;
  walls.receiveShadow = true;
  // Door slab + two window insets (dark) so it reads as a house in ortho.
  const door = new Mesh(boxAt(0.12, 0.2, 0.02, 0, 0.22, 0.175), ink);
  const winL = new Mesh(boxAt(0.1, 0.1, 0.02, -0.16, 0.3, 0.175), ink);
  const winR = new Mesh(boxAt(0.1, 0.1, 0.02, 0.16, 0.3, 0.175), ink);
  // Gabled roof
  const roofShape = new Shape();
  roofShape.moveTo(-0.34, 0);
  roofShape.lineTo(0.34, 0);
  roofShape.lineTo(0, 0.22);
  roofShape.closePath();
  const roofGeom = new ExtrudeGeometry(roofShape, { depth: 0.42, bevelEnabled: false });
  roofGeom.translate(0, 0.45, -0.21);
  const roof = new Mesh(roofGeom, roofMat);
  roof.castShadow = true;
  // Short platform canopy toward the tracks
  const canopy = new Mesh(boxAt(0.55, 0.03, 0.18, 0, 0.36, -0.28), roofMat);
  canopy.castShadow = true;
  const postL = new Mesh(boxAt(0.04, 0.28, 0.04, -0.2, 0.2, -0.28), wall);
  const postR = new Mesh(boxAt(0.04, 0.28, 0.04, 0.2, 0.2, -0.28), wall);
  group.add(plinth, ring, walls, door, winL, winR, roof, canopy, postL, postR);
  if (node.tag === "major") {
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
  const worldH = 0.4;
  const geom = new PlaneGeometry((w / h) * worldH, worldH);
  geom.rotateX(-Math.PI / 2);
  const texture = canvas ? new CanvasTexture(canvas) : null;
  if (texture) {
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
  }
  // 名牌永远压在铁轨 / 景物之上（只读标注，不参与深度）。
  const mesh = new Mesh(geom, new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false, toneMapped: false }));
  mesh.raycast = () => {};
  mesh.renderOrder = 10;
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
  } else if (mesh === "card") {
    object = cardWithFace(node, ctx);
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