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
  camera: {
    fovDeg: number;
    distance: number;
    minPolarDeg: number;
    maxPolarDeg: number;
    pan: boolean;
    projection?: "perspective" | "orthographic";
    polarDeg?: number;
    azimuthDeg?: number;
    fill?: number;
  };
  /** step3：盘面散布景物（树 / 石），确定性、避开连线 / 棋子 / 格位。 */
  decor?: { trees: number; rocks: number; seed: number; ground?: "flat" | "varied"; forest?: "sparse" | "clustered" };
  /** step3 R2：盘外环境（海 / 草原）+ 岸边宽度。 */
  surround?: { kind: "none" | "sea" | "meadow"; shore: number; coast?: "rect" | "natural"; seed?: number };
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
  /** step3：平放在棋子前方的名牌（城市名等）。 */
  label?: string;
  /** step3：重点对象（枢纽 / 终点），网格可据此加细节（`tag: "major"`）。 */
  emphasis?: boolean;
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
  resource: "gem-chip",
  cargo: "disc",
  worker: "pawn",
  token: "disc",
  tile: "glazed-tile",
  plaque: "plaque",
  building: "house",
  ship: "ship",
  route: "road-bar",
  claim: "road-bar",
  "decor-tree": "tree",
  "decor-rock": "rock",
  "decor-broadleaf": "broadleaf",
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

/** step3：景物材质缺省（作者可用 configure_render materials.foliage / rock 覆盖）。 */
const NAMED_DEFAULTS: Record<string, TabletopRenderInput["materials"][string]> = {
  foliage: { base: "#3d7a3a", roughness: 0.82, metalness: 0, pattern: "none" },
  rock: { base: "#8d8678", roughness: 0.92, metalness: 0, pattern: "stone" },
  "foliage-dark": { base: "#2c5a30", roughness: 0.85, metalness: 0, pattern: "none" },
  "foliage-broad": { base: "#5f8f3c", roughness: 0.8, metalness: 0, pattern: "none" },
  "ground-dirt": { base: "#8a6b48", roughness: 1, metalness: 0, pattern: "none" },
  "ground-dark": { base: "#4e7034", roughness: 0.97, metalness: 0, pattern: "grass" },
  "ground-mound": { base: "#6f8f45", roughness: 0.97, metalness: 0, pattern: "grass" },
  "ground-sand": { base: "#dcc896", roughness: 0.98, metalness: 0, pattern: "sand" },
};

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** 可作为连线绑定的网格（其余网格绑定到连线时回退 road-bar）。 */
const LINK_MESHES: ReadonlySet<string> = new Set(["road-bar", "rail-track"]);

/** 确定性 PRNG（mulberry32）。 */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function segmentDistance(px: number, pz: number, a: readonly [number, number], b: readonly [number, number]): number {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / len2));
  return Math.hypot(px - (a[0] + t * dx), pz - (a[1] + t * dz));
}

/**
 * step3 · 通用盘面景物：在底板内确定性撒树 / 石，避开连线、棋子、格位与名牌。
 * 任何空间 Kernel 都可用（RenderSpec.decor），不认识具体游戏。
 */
export function scatterDecor(layout: TabletopLayout, decor: NonNullable<TabletopRenderInput["decor"]>): TabletopPiece[] {
  const random = rng(decor.seed || 1);
  // 远边多留一点：斜视下靠远边的树会探出底板轮廓。
  const halfW = layout.board.width / 2 - 0.45;
  const halfD = layout.board.depth / 2 - 0.45;
  const zMin = -halfD + 0.25;
  const out: TabletopPiece[] = [];
  const clear = (x: number, z: number, margin: number) =>
    // 连线留白按固定 0.18（不随占领后线宽变化），景物位置在整局中保持不变。
    layout.links.every((link) => segmentDistance(x, z, link.from, link.to) > 0.18 + margin) &&
    layout.pieces.every((piece) => Math.hypot(piece.x - x, piece.z - z) > piece.size * 0.8 + margin &&
      (!piece.label || Math.abs(piece.x - x) > piece.label.length * 0.16 + 0.25 || Math.abs(piece.z + piece.size * 0.9 + 0.3 - z) > 0.4)) &&
    layout.cells.every((cell) => Math.abs(cell.x - x) > cell.width / 2 + margin || Math.abs(cell.z - z) > cell.depth / 2 + margin) &&
    out.every((other) => Math.hypot(other.x - x, other.z - z) > (other.size + 0.1) * 0.55);
  const place = (count: number, kind: "decor-tree" | "decor-rock", min: number, span: number) => {
    let placed = 0;
    // 成簇：先选簇心，再在簇心附近撒点（比均匀撒点更像林地 / 碎石滩）。
    for (let attempt = 0; attempt < count * 40 && placed < count; attempt += 1) {
      const cx = (random() * 2 - 1) * halfW;
      const cz = (random() * 2 - 1) * halfD;
      const cluster = 1 + Math.floor(random() * (kind === "decor-tree" ? 5 : 3));
      for (let k = 0; k < cluster && placed < count; k += 1) {
        const x = cx + (random() - 0.5) * 0.9;
        const z = cz + (random() - 0.5) * 0.9;
        if (Math.abs(x) > halfW || z > halfD || z < zMin) continue;
        const size = min + random() * span;
        if (!clear(x, z, 0.22)) continue;
        out.push({ id: `${kind}:${out.length}`, objectKind: kind, materialKey: kind === "decor-tree" ? "foliage" : "rock", x: round(x), z: round(z), size: round(size), rotationY: round(random() * Math.PI * 2) });
        placed += 1;
      }
    }
  };
  if (decor.forest === "clustered") {
    // R5：沿线林带 + 岸边林缘，成簇松树 / 阔叶树混种。
    const grove = (cx: number, cz: number, n: number) => {
      for (let k = 0; k < n; k += 1) {
        const x = cx + (random() - 0.5) * 0.7;
        const z = cz + (random() - 0.5) * 0.7;
        if (Math.abs(x) > halfW + 0.2 || z > halfD + 0.2 || z < zMin) continue;
        if (!clear(x, z, 0.14)) continue;
        const broad = random() < 0.4;
        out.push({ id: `decor-${broad ? "broadleaf" : "tree"}:${out.length}`, objectKind: broad ? "decor-broadleaf" : "decor-tree", materialKey: broad ? "foliage-broad" : random() < 0.5 ? "foliage-dark" : "foliage", x: round(x), z: round(z), size: round(0.26 + random() * 0.24), rotationY: round(random() * Math.PI * 2) });
      }
    };
    for (const link of layout.links) {
      const dx = link.to[0] - link.from[0], dz = link.to[1] - link.from[1];
      const len = Math.hypot(dx, dz) || 1;
      for (let t = 0.25; t < 0.8; t += 0.5) {
        const side = random() < 0.5 ? -1 : 1, off = 0.55 + random() * 0.35;
        grove(link.from[0] + dx * t - (dz / len) * off * side, link.from[1] + dz * t + (dx / len) * off * side, 3);
      }
    }
    for (let i = 0; i < 18; i += 1) {
      const t = (i / 18) * Math.PI * 2;
      grove(Math.cos(t) * halfW * 0.95, Math.sin(t) * halfD * 0.95, 2);
    }
  }
  place(decor.trees, "decor-tree", 0.34, 0.26);
  place(decor.rocks, "decor-rock", 0.18, 0.16);
  return out;
}

/** step3 R5 · 地面变化：线路土路基、深色草斑、缓坡土丘，以及（海岛）盘缘沙带过渡。 */
export function groundVariation(layout: TabletopLayout, seed: number, top: number, sandEdge: boolean): Array<{ id: string; mesh: string; key: string; x: number; y: number; z: number; sx: number; sy: number; sz: number; r: number }> {
  const random = rng(seed + 313);
  const out: Array<{ id: string; mesh: string; key: string; x: number; y: number; z: number; sx: number; sy: number; sz: number; r: number }> = [];
  const hw = layout.board.width / 2, hd = layout.board.depth / 2;
  layout.links.forEach((link, i) => {
    const dx = link.to[0] - link.from[0], dz = link.to[1] - link.from[1];
    out.push({ id: `ground:path:${i}`, mesh: "patch", key: "ground-dirt", x: (link.from[0] + link.to[0]) / 2, y: top + 0.003, z: (link.from[1] + link.to[1]) / 2, sx: Math.hypot(dx, dz) * 0.95, sy: 1, sz: 0.4, r: -Math.atan2(dz, dx) });
  });
  for (let i = 0; i < 14; i += 1) {
    out.push({ id: `ground:dark:${i}`, mesh: "patch", key: "ground-dark", x: (random() * 2 - 1) * hw * 0.85, y: top + 0.002, z: (random() * 2 - 1) * hd * 0.85, sx: 0.9 + random() * 1.6, sy: 1, sz: 0.7 + random() * 1.2, r: random() * Math.PI });
  }
  for (let i = 0; i < 6; i += 1) {
    const x = (random() * 2 - 1) * hw * 0.8, z = (random() * 2 - 1) * hd * 0.8;
    if (layout.links.some((l) => segmentDistance(x, z, l.from, l.to) < 0.7) || layout.pieces.some((p) => Math.hypot(p.x - x, p.z - z) < 0.8)) continue;
    out.push({ id: `ground:mound:${i}`, mesh: "mound", key: "ground-mound", x, y: top, z, sx: 0.9 + random() * 0.9, sy: 0.12 + random() * 0.1, sz: 0.7 + random() * 0.7, r: random() * Math.PI });
  }
  if (sandEdge) {
    const n = Math.round((layout.board.width + layout.board.depth) * 1.5);
    for (let i = 0; i < n; i += 1) {
      const t = (i / n) * Math.PI * 2;
      const ux = Math.cos(t), uz = Math.sin(t);
      const sq = Math.pow(Math.abs(ux) ** 4 + Math.abs(uz) ** 4, -0.25);
      const f = 0.99 - random() * 0.03;
      out.push({ id: `ground:sand:${i}`, mesh: "patch", key: "ground-sand", x: Math.max(-hw + 0.2, Math.min(hw - 0.2, ux * sq * hw * f)), y: top + 0.005, z: Math.max(-hd + 0.2, Math.min(hd - 0.2, uz * sq * hd * f)), sx: 0.45 + random() * 0.5, sy: 1, sz: 0.22 + random() * 0.3, r: -t + Math.PI / 2 });
    }
  }
  return out.map((g) => ({ ...g, x: round(g.x), y: round(g.y), z: round(g.z), sx: round(g.sx), sy: round(g.sy), sz: round(g.sz), r: round(g.r) }));
}

/**
 * step3 R2 · 盘外景物：岸边碎石 / 灌木 + （草原）外圈林带。确定性，只落在底板之外，
 * 让正交画面里底板四周不再是空桌面。任何空间 Kernel 可用（RenderSpec.surround）。
 */
export function scatterSurround(
  layout: TabletopLayout,
  surround: NonNullable<TabletopRenderInput["surround"]>,
  shoreTop: number,
): TabletopPiece[] {
  const random = rng((surround.seed ?? 7) + 101);
  const out: TabletopPiece[] = [];
  const bw = layout.board.width / 2;
  const bd = layout.board.depth / 2;
  const s = surround.shore;
  const insideBoard = (x: number, z: number, pad: number) => Math.abs(x) < bw + pad && Math.abs(z) < bd + pad;
  const push = (kind: "decor-tree" | "decor-rock", x: number, z: number, size: number, y: number) => {
    if (out.some((o) => Math.hypot(o.x - x, o.z - z) < (o.size + size) * 0.45)) return;
    out.push({ id: `${kind}:s${out.length}`, objectKind: kind, materialKey: kind === "decor-tree" ? "foliage" : "rock", x: round(x), z: round(z), y: round(y), size: round(size), rotationY: round(random() * Math.PI * 2) });
  };
  if (s > 0) {
    const natural = (surround.coast ?? "natural") === "natural";
    const count = Math.round((2 * (layout.board.width + layout.board.depth + 4 * s)) / (surround.kind === "sea" ? 1.1 : 0.7));
    const w = layout.board.width + 2 * s;
    const d = layout.board.depth + 2 * s;
    for (let i = 0; i < count; i += 1) {
      let x: number, z: number;
      if (natural) {
        const t = ((i + random() * 0.4) / count) * Math.PI * 2;
        const ux = Math.cos(t);
        const uz = Math.sin(t);
        const squircle = Math.pow(Math.abs(ux) ** 4 + Math.abs(uz) ** 4, -0.25);
        const wobble = 1 + 0.12 * Math.sin(t * 3 + (surround.seed ?? 7)) + 0.08 * Math.sin(t * 5);
        const rx = (w / 2) * squircle * wobble * (0.72 + random() * 0.18);
        const rz = (d / 2) * squircle * wobble * (0.72 + random() * 0.18);
        x = ux * rx;
        z = uz * rz;
      } else {
        const perimeter = 2 * (w + d);
        const along = ((i + random() * 0.6) / count) * perimeter;
        if (along < w) { x = -w / 2 + along; z = -d / 2; }
        else if (along < w + d) { x = w / 2; z = -d / 2 + (along - w); }
        else if (along < 2 * w + d) { x = w / 2 - (along - w - d); z = d / 2; }
        else { x = -w / 2; z = d / 2 - (along - 2 * w - d); }
        const inset = s * (0.25 + random() * 0.45);
        x -= Math.sign(x) * (Math.abs(x) >= w / 2 - 1e-6 ? inset : 0);
        z -= Math.sign(z) * (Math.abs(z) >= d / 2 - 1e-6 ? inset : 0);
      }
      if (insideBoard(x, z, 0.12)) continue;
      const rockish = surround.kind === "sea" ? random() < 0.45 : random() < 0.25;
      push(rockish ? "decor-rock" : "decor-tree", x, z, rockish ? 0.16 + random() * 0.22 : 0.3 + random() * 0.25, shoreTop);
    }
  }
  if (surround.kind === "meadow") {
    // 外圈林带：底板 + 岸之外再撒成簇的树，铺满画面左右空档。
    const reachX = bw + s + Math.max(3, layout.board.width * 0.9);
    const reachZ = bd + s + Math.max(1.5, layout.board.depth * 0.35);
    for (let attempt = 0; attempt < 900 && out.length < 220; attempt += 1) {
      const x = (random() * 2 - 1) * reachX;
      const z = (random() * 2 - 1) * reachZ;
      if (insideBoard(x, z, s + 0.2)) continue;
      push("decor-tree", x, z, 0.36 + random() * 0.34, TABLE_Y + 0.05);
    }
  }
  return out;
}

/** 布局 + RenderSpec → SceneModel（纯函数，可单测）。 */
export function mapTabletopToScene(layout: TabletopLayout, render: TabletopRenderInput): TabletopScene {
  const materials: Record<string, MaterialToken> = {};
  const libraryKey = (key: string, override?: TabletopRenderInput["materials"][string], span?: number): string => {
    const source = override ?? render.materials[key] ?? NAMED_DEFAULTS[key] ?? DEFAULT_MATERIAL;
    let token = tokenForRenderMaterial(key, source);
    // step3：大底板按世界尺寸加密贴图重复（盒子 UV 按面归一，固定 0.5 会把整块草地 / 石面放大成糊块）。
    if (span && token.pbrSet && key !== "table") token = { ...token, pbrRepeat: round(Math.max(token.pbrRepeat ?? 0.5, span / 3.2)) };
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
  // step3 R2：surround = sea → 标记 tag "sea"（SceneHost 挂 G3D-08 潮水 shader 后隐藏它，之前作兜底）；
  // meadow → 草地桌面。两者都放大到铺满正交画面，不再露出木纹。
  const surround = render.surround && render.surround.kind !== "none" ? render.surround : null;
  const tableSize = Math.max(board.width, board.depth) * (surround ? 6 : 1.9);
  const sea = surround?.kind === "sea" || (!surround && render.water.enabled);
  nodes.push({
    id: "table",
    kind: "table",
    mesh: "tile-square",
    position: [0, TABLE_Y, 0],
    scale: [tableSize, 0.1, tableSize],
    tag: surround?.kind === "sea" ? "sea" : sea ? "water" : surround?.kind === "meadow" ? "meadow" : "wood",
    material: sea
      ? libraryKey("water", { base: render.water.shallow, roughness: 0.32, metalness: 0, pattern: "none" })
      : surround?.kind === "meadow"
        ? libraryKey("meadow", render.materials.meadow ?? { base: "#6f9a4c", roughness: 0.96, metalness: 0, pattern: "grass" }, tableSize)
        : libraryKey("table"),
  });
  const shore = surround ? surround.shore : 0;
  const shoreTop = boardTop - 0.07;
  if (surround && shore > 0) {
    // 岸：比底板大一圈、略低的台地。R3：coast=natural（默认）用起伏岛缘，打破直角硬边。
    const coast = surround.coast ?? "natural";
    const shoreMat = surround.kind === "sea"
      ? libraryKey("shore", render.materials.shore ?? { base: "#e6d3a0", roughness: 0.97, metalness: 0, pattern: "sand" }, board.width + shore * 2)
      : libraryKey("shore", render.materials.shore ?? { base: "#7c9a4e", roughness: 0.97, metalness: 0, pattern: "grass" }, board.width + shore * 2);
    nodes.push({
      id: "shore",
      kind: "cell",
      mesh: coast === "natural" ? "shore-natural" : "tile-square",
      tag: `${surround.seed ?? 7}:${surround.kind}:${coast}`,
      position: [0, round((shoreTop + TABLE_Y) / 2), 0],
      scale: [round(board.width + shore * 2), round(shoreTop - TABLE_Y), round(board.depth + shore * 2)],
      material: shoreMat,
    });
  }

  const boardBinding = bindingFor(render, board.objectKind);
  const boardMatKey = board.materialKey ?? boardBinding.materialKey;
  // T033 · when RenderSpec has cloth board + wood table, emit wood rim + felt inset
  // (desk layouts often mark the slab as materialKey "table"; still prefer felt center).
  const feltInset = Boolean(render.materials.table && render.materials.board?.pattern === "cloth");
  if (feltInset) {
    const rim = 0.55;
    nodes.push({
      id: "board-rim",
      kind: "cell",
      mesh: "tile-square",
      position: [0, boardTop / 2 - 0.02, 0],
      scale: [round(board.width + rim), BOARD_THICKNESS + 0.04, round(board.depth + rim)],
      material: libraryKey("table", undefined, Math.max(board.width, board.depth) + rim),
    });
    nodes.push({
      id: "board",
      kind: "cell",
      mesh: "tile-square",
      position: [0, boardTop / 2 + 0.02, 0],
      scale: [round(board.width - 0.25), BOARD_THICKNESS * 0.55, round(board.depth - 0.25)],
      material: libraryKey("board", undefined, Math.max(board.width, board.depth)),
    });
  } else {
    nodes.push({
      id: "board",
      kind: "cell",
      mesh: "tile-square",
      position: [0, boardTop / 2, 0],
      scale: [round(board.width), BOARD_THICKNESS, round(board.depth)],
      material: libraryKey(boardMatKey, undefined, Math.max(board.width, board.depth)),
    });
  }

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

  if (render.decor?.ground === "varied") {
    for (const g of groundVariation(layout, render.decor.seed || 1, boardTop, surround?.kind === "sea")) {
      nodes.push({ id: g.id, kind: "piece", mesh: g.mesh, position: [g.x, g.y, g.z], rotationY: g.r, scale: [g.sx, g.sy, g.sz], material: libraryKey(g.key) });
    }
  }
  const decorPieces = [
    ...(render.decor ? scatterDecor(layout, render.decor) : []),
    ...(surround ? scatterSurround(layout, surround, shoreTop) : []),
  ];
  for (const piece of layout.pieces) {
    if (!piece.label) continue;
    // 名牌：平放在棋子南侧（朝向默认机位），羊皮纸底 + 墨字（tabletop-objects `label` 网格）。
    nodes.push({
      id: `label:${piece.id}`,
      kind: "label",
      mesh: "label",
      tag: piece.label,
      position: [round(piece.x), boardTop + 0.02, round(piece.z + piece.size * 0.9 + 0.3)],
      scale: [1, 1, 1],
    });
  }
  for (const piece of [...layout.pieces, ...decorPieces]) {
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
      ...(piece.label ? { tag: piece.label } : piece.emphasis ? { tag: "major" } : {}),
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
    const linkMesh = LINK_MESHES.has(resolved.mesh) ? resolved.mesh : "road-bar";
    // 网格类型进 id：route → claim 换网格时重建对象。
    const claimedLink = link.seat !== null && link.seat !== undefined;
    const id = linkMesh === "road-bar" ? `link:${link.id}` : `link:${linkMesh}:${claimedLink ? "c" : "o"}:${link.id}`;
    const width = link.width * resolved.scale;
    const track = linkMesh === "rail-track";
    nodes.push({
      id,
      kind: "link",
      mesh: linkMesh,
      // rail-track：几何按长度生成（枕木间距不随缩放拉伸），tag 带长度 / 轨距，scale 保持 1。
      ...(track ? { tag: `${round(length)}:${round(width)}` } : {}),
      position: [round((link.from[0] + link.to[0]) / 2), round(track ? boardTop : boardTop + width * 0.3), round((link.from[1] + link.to[1]) / 2)],
      rotationY: round(-Math.atan2(dz, dx)),
      scale: track ? [1, 1, 1] : [round(length), round(width * 0.6), round(width)],
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
