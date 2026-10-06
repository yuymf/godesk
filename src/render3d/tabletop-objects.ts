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
  ExtrudeGeometry,
  Float32BufferAttribute,
  LatheGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  type Object3D,
  RingGeometry,
  Shape,
  Vector2,
  type BufferGeometry as Geometry,
  type Material,
} from "three";
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

function translated(geom: Geometry, y: number): Geometry {
  geom.translate(0, y, 0);
  return geom;
}

function geometryFor(mesh: string): Geometry {
  switch (mesh) {
    case "tile-square":
    case "road-bar":
      return new BoxGeometry(1, 1, 1);
    case "hex-prism":
      return hexPrism();
    case "disc":
      return translated(new CylinderGeometry(0.45, 0.45, 0.16, 32), 0.08);
    case "house":
      return house();
    case "tower":
      return translated(new CylinderGeometry(0.26, 0.32, 0.9, 10), 0.45);
    case "card":
      return translated(new BoxGeometry(0.62, 0.03, 0.88), 0.015);
    case "die":
      return translated(new BoxGeometry(0.5, 0.5, 0.5), 0.25);
    case "ship":
      return ship();
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
  const mesh = object as Mesh;
  if (!mesh.isMesh || node.mesh === "ring") return;
  // 座位 / 材质变化（翻面、configure_render 改色）：换成对应的共享材质。
  const next = materialFor(node, ctx);
  if (mesh.material !== next) mesh.material = next;
}
