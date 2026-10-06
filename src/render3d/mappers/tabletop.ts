/**
 * G3D-14 · 通用 3D 桌面 mapper（平台默认底座）。
 *
 * 纯函数，不依赖 three：把「桌面布局」（区域格位 + 对象 + 连线 + 合法目标，见 tabletop-kernels.ts
 * 里各空间 Kernel 的适配）与 RenderSpec（bindings / materials / camera / water）映射成 SceneModel，
 * 并给出节点 → LegalAction 的拾取表。三维对象由 tabletop-objects.ts 按 `mesh` 构建。
 */
import type { SceneModel, SceneNode, SceneVec3 } from "../scene-model";
import type { LightingSpec, MaterialPattern, MaterialToken, PbrSetId } from "../tokens";

export type TabletopAction = { type: string; payload?: Record<string, unknown> };

/** RenderSpec 中 mapper 用到的部分（与 creator `RenderSpec` 结构兼容）。 */
export type TabletopRenderInput = {
  camera: { fovDeg: number; distance: number; minPolarDeg: number; maxPolarDeg: number; pan: boolean };
  lighting: LightingSpec;
  water: { enabled: boolean; shallow: string; deep: string };
  materials: Record<string, {
    base: string;
    roughness: number;
    metalness: number;
    clearcoat?: number;
    pattern: MaterialPattern;
  }>;
  bindings: ReadonlyArray<{ objectKind: string; mesh: string; material: string; scale: number }>;
};

export type TabletopCell = {
  id: string;
  objectKind: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  action?: TabletopAction;
};

export type TabletopPiece = {
  id: string;
  objectKind: string;
  x: number;
  z: number;
  /** 底面高度（缺省：放在格位 / 底板顶面）。 */
  y?: number;
  /** 基准尺寸（世界单位），再乘 binding.scale。 */
  size: number;
  seat?: number | null;
  /** 覆盖 binding 的材质 key。 */
  materialKey?: string;
  /** 只替换底色（例如各货物颜色），其余沿用 binding 材质。 */
  tint?: string;
  rotationY?: number;
  action?: TabletopAction;
};

export type TabletopLink = {
  id: string;
  objectKind: string;
  from: readonly [number, number];
  to: readonly [number, number];
  width: number;
  seat?: number | null;
  materialKey?: string;
  action?: TabletopAction;
};

export type TabletopHint = { id: string; x: number; z: number; radius: number; action: TabletopAction };

export type TabletopLayout = {
  kernelType: string;
  board: {
    objectKind: string;
    materialKey?: string;
    width: number;
    depth: number;
    /** 规则网格（翻转棋）：底板画网格线，拾取按落点换算格子。 */
    grid?: { rows: number; cols: number; actions: Record<string, TabletopAction> };
  };
  cells: readonly TabletopCell[];
  pieces: readonly TabletopPiece[];
  links: readonly TabletopLink[];
  hints: readonly TabletopHint[];
};

export type TabletopScene = {
  model: SceneModel;
  /** 材质库 key → token（key 含材质值摘要）。 */
  materials: Record<string, MaterialToken>;
  /** 节点 id → 动作。 */
  actions: Record<string, TabletopAction>;
  grid: { x0: number; z0: number; cell: number; rows: number; cols: number; actions: Record<string, TabletopAction> } | null;
  bounds: { center: SceneVec3; radius: number };
  /** 布局（格位集合）摘要：变化时重算阴影相机。 */
  layoutKey: string;
  camera: TabletopRenderInput["camera"];
};

export const BOARD_THICKNESS = 0.24;
export const CELL_THICKNESS = 0.1;
const TABLE_Y = -0.06;

/** 没有 binding 时的内置图元（SPEC：mapper 找不到 binding 时回退内置图元）。 */
const FALLBACK_MESH: Record<string, string> = {
  cell: "tile-square",
  region: "tile-square",
  berth: "tile-square",
  map: "tile-square",
  disc: "disc",
  station: "disc",
  resource: "disc",
  cargo: "disc",
  worker: "pawn",
  token: "pawn",
  building: "house",
  ship: "ship",
  route: "road-bar",
  claim: "road-bar",
  card: "card",
  die: "die",
};

/**
 * cloth（呢面盘面）不借 PBR 套件（G3D-14 follow-up）：t10-canvas 是粗帆布纹，KTX2 只有 1 级 mip。
 * 盘面盒子的 UV 按面归一，整块盘面只铺半张贴图 → 帆布纹被放大成约 2 px 的硬边方块（低太阳角下法线放大更明显）；
 * 若按世界单位加密又会在无 mip 的情况下缩小走样闪烁。呢面保留程序化 cloth pattern（细、柔），与 GPU / SwiftShader 无关。
 */
const PATTERN_PBR: Partial<Record<MaterialPattern, { set: PbrSetId; repeat: number }>> = {
  grain: { set: "t08-wood", repeat: 0.5 },
  stone: { set: "t07-cliff", repeat: 0.5 },
  grass: { set: "t03-meadow", repeat: 0.5 },
  sand: { set: "t06-sand", repeat: 0.5 },
};

function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

/**
 * RenderSpec 材质 → 材质库 token：pattern 对应 G3D-22 贴图套件。
 * 作者写的底色必须原样可辨认（configure_render 改色要看得见），所以只借套件的法线 / ORM；
 * 唯一例外是木桌 `table`，木纹底色贴图本身就是它的外观。座位材质借彩漆木的法线 / ORM。
 */
export function tokenForRenderMaterial(
  key: string,
  material: TabletopRenderInput["materials"][string],
): MaterialToken {
  if (/^seat\d$/.test(key)) {
    return { ...material, pattern: "none", pbrSet: "t09-paintwood", pbrRepeat: 1, pbrBaseColor: false };
  }
  const pbr = PATTERN_PBR[material.pattern];
  if (!pbr) return { ...material };
  return { ...material, pbrSet: pbr.set, pbrRepeat: pbr.repeat, ...(key === "table" ? {} : { pbrBaseColor: false }) };
}

type Resolved = { mesh: string; materialKey: string; scale: number };

function bindingFor(render: TabletopRenderInput, objectKind: string): Resolved {
  const binding = render.bindings.find((entry) => entry.objectKind === objectKind);
  if (binding) return { mesh: binding.mesh, materialKey: binding.material, scale: binding.scale };
  const materialKey = render.materials.piece ? "piece" : Object.keys(render.materials)[0] ?? "piece";
  return { mesh: FALLBACK_MESH[objectKind] ?? "pawn", materialKey, scale: 1 };
}

const DEFAULT_MATERIAL = { base: "#f4efe6", roughness: 0.5, metalness: 0, pattern: "none" as MaterialPattern };

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** 布局 + RenderSpec → SceneModel（纯函数，可单测）。 */
export function mapTabletopToScene(layout: TabletopLayout, render: TabletopRenderInput): TabletopScene {
  const materials: Record<string, MaterialToken> = {};
  const libraryKey = (key: string, override?: TabletopRenderInput["materials"][string]): string => {
    const source = override ?? render.materials[key] ?? DEFAULT_MATERIAL;
    const token = tokenForRenderMaterial(key, source);
    const id = `tt-${key}-${hashString(JSON.stringify(token))}`;
    materials[id] ??= token;
    return id;
  };
  const seatKey = (seat: number | null | undefined, fallback: string): string =>
    seat !== null && seat !== undefined && render.materials[`seat${seat}`] ? `seat${seat}` : fallback;

  const nodes: SceneNode[] = [];
  const actions: Record<string, TabletopAction> = {};
  const { board } = layout;
  const boardTop = BOARD_THICKNESS;

  // 桌面：开启 water 时为一片水面色的平面（简化表现，非 G3D-08 水体 shader），否则为木桌。
  const tableSize = Math.max(board.width, board.depth) * 1.9;
  nodes.push({
    id: "table",
    kind: "table",
    mesh: "tile-square",
    position: [0, TABLE_Y, 0],
    scale: [tableSize, 0.1, tableSize],
    tag: render.water.enabled ? "water" : "wood",
    material: render.water.enabled
      ? libraryKey("water", { base: render.water.shallow, roughness: 0.32, metalness: 0, pattern: "none" })
      : libraryKey("table"),
  });

  const boardBinding = bindingFor(render, board.objectKind);
  nodes.push({
    id: "board",
    kind: "cell",
    mesh: "tile-square",
    position: [0, boardTop / 2, 0],
    scale: [round(board.width), BOARD_THICKNESS, round(board.depth)],
    material: libraryKey(board.materialKey ?? boardBinding.materialKey),
  });

  let grid: TabletopScene["grid"] = null;
  if (board.grid) {
    const cell = Math.min(board.width / (board.grid.cols + 0.5), board.depth / (board.grid.rows + 0.5));
    const x0 = -(cell * board.grid.cols) / 2;
    const z0 = -(cell * board.grid.rows) / 2;
    grid = { x0, z0, cell, rows: board.grid.rows, cols: board.grid.cols, actions: board.grid.actions };
    nodes.push({
      id: "grid",
      kind: "table",
      mesh: "grid-lines",
      tag: `${board.grid.rows}x${board.grid.cols}`,
      position: [0, boardTop + 0.004, 0],
      scale: [round(cell * board.grid.cols), 1, round(cell * board.grid.rows)],
      material: libraryKey("ink", render.materials.ink ?? { base: "#1d2a24", roughness: 0.8, metalness: 0, pattern: "none" }),
    });
  }

  for (const cell of layout.cells) {
    const resolved = bindingFor(render, cell.objectKind);
    const mesh = resolved.mesh === "hex-prism" ? "hex-prism" : "tile-square";
    // 网格类型进 id：binding 改网格时 reconcile 重建对象。
    const id = `cell:${mesh}:${cell.id}`;
    nodes.push({
      id,
      kind: "cell",
      mesh,
      position: [round(cell.x), boardTop + CELL_THICKNESS / 2, round(cell.z)],
      scale: [round(cell.width), CELL_THICKNESS, round(cell.depth)],
      material: libraryKey(resolved.materialKey),
    });
    if (cell.action) actions[id] = cell.action;
  }

  for (const piece of layout.pieces) {
    const resolved = bindingFor(render, piece.objectKind);
    const size = round(piece.size * resolved.scale);
    const id = `piece:${resolved.mesh}:${piece.id}`;
    const onCell = layout.cells.some((cell) =>
      Math.abs(cell.x - piece.x) <= cell.width / 2 && Math.abs(cell.z - piece.z) <= cell.depth / 2);
    const baseY = piece.y ?? (onCell ? boardTop + CELL_THICKNESS : boardTop);
    nodes.push({
      id,
      kind: "piece",
      mesh: resolved.mesh,
      position: [round(piece.x), round(baseY), round(piece.z)],
      ...(piece.rotationY ? { rotationY: round(piece.rotationY) } : {}),
      scale: [size, size, size],
      ...(piece.seat !== null && piece.seat !== undefined ? { seat: piece.seat } : {}),
      material: piece.tint
        ? libraryKey(`${resolved.materialKey}-tint`, {
          ...(render.materials[resolved.materialKey] ?? DEFAULT_MATERIAL),
          base: piece.tint,
        })
        : libraryKey(piece.materialKey ?? seatKey(piece.seat, resolved.materialKey)),
    });
    if (piece.action) actions[id] = piece.action;
  }

  for (const link of layout.links) {
    const resolved = bindingFor(render, link.objectKind);
    const dx = link.to[0] - link.from[0];
    const dz = link.to[1] - link.from[1];
    const length = Math.hypot(dx, dz);
    const id = `link:${link.id}`;
    const width = link.width * resolved.scale;
    nodes.push({
      id,
      kind: "link",
      mesh: "road-bar",
      position: [round((link.from[0] + link.to[0]) / 2), round(boardTop + width * 0.3), round((link.from[1] + link.to[1]) / 2)],
      rotationY: round(-Math.atan2(dz, dx)),
      scale: [round(length), round(width * 0.6), round(width)],
      ...(link.seat !== null && link.seat !== undefined ? { seat: link.seat } : {}),
      material: libraryKey(link.materialKey ?? seatKey(link.seat, resolved.materialKey)),
    });
    if (link.action) actions[id] = link.action;
  }

  for (const hint of layout.hints) {
    const id = `hint:${hint.id}`;
    nodes.push({
      id,
      kind: "hint",
      mesh: "ring",
      position: [round(hint.x), boardTop + CELL_THICKNESS + 0.03, round(hint.z)],
      scale: [round(hint.radius), 1, round(hint.radius)],
    });
    actions[id] = hint.action;
  }

  const radius = Math.hypot(board.width, board.depth) / 2 + 0.6;
  const layoutKey = [
    layout.kernelType,
    round(board.width),
    round(board.depth),
    ...layout.cells.map((cell) => cell.id),
  ].join("|");
  return {
    model: { nodes },
    materials,
    actions,
    grid,
    bounds: { center: [0, 0, 0], radius },
    layoutKey,
    camera: render.camera,
  };
}

/** 拾取：节点动作优先；落在网格底板上时按落点换算格子。 */
export function resolveTabletopPick(
  scene: Pick<TabletopScene, "actions" | "grid">,
  target: { nodeId: string; point?: readonly [number, number, number] },
): TabletopAction | null {
  const direct = scene.actions[target.nodeId];
  if (direct) return { type: direct.type, ...(direct.payload ? { payload: { ...direct.payload } } : {}) };
  const grid = scene.grid;
  if (grid && target.point && (target.nodeId === "board" || target.nodeId.startsWith("piece:"))) {
    const col = Math.floor((target.point[0] - grid.x0) / grid.cell);
    const row = Math.floor((target.point[2] - grid.z0) / grid.cell);
    if (row < 0 || col < 0 || row >= grid.rows || col >= grid.cols) return null;
    const action = grid.actions[`${row},${col}`];
    if (action) return { type: action.type, ...(action.payload ? { payload: { ...action.payload } } : {}) };
  }
  return null;
}
