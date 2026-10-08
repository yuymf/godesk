/**
 * G3D-07 · 3D 设计 tokens（SPEC §3.7，preset = "tabletop-day"）。
 *
 * 这里只放纯数据，不引用 three，方便单测与 G3D-14 通用 mapper 复用。
 * 光照结构与 `src/creator/render-spec.ts` 的 `RenderSpec.lighting` /
 * `materials[*]` 同形（结构类型，不依赖 zod），`defaultRenderSpec` 的灯光默认值
 * 必须与 `SCENE_TOKENS.lighting` 一致（见 tokens.test.ts）。
 */

export type MaterialPattern = "none" | "grain" | "cloth" | "stone" | "grass" | "sand";

/** 与 RenderSpec.lighting 同形。 */
export type LightingSpec = {
  sun: { azimuthDeg: number; elevationDeg: number; intensity: number; color: string };
  hemisphere: { sky: string; ground: string; intensity: number };
  shadow: { enabled: boolean; softness: number };
  exposure: number;
};

/** 与 RenderSpec.materials[*] 同形，外加可选的 PBR 贴图套件。 */
export type MaterialToken = {
  base: string;
  roughness: number;
  metalness: number;
  clearcoat?: number;
  pattern: MaterialPattern;
  /** G3D-22 PBR 套件目录名（`assets/textures/pbr/<set>/`），可交互后按档位流式替换。 */
  pbrSet?: PbrSetId;
  /** 贴图平铺次数（世界单位 1 → repeat 次）。 */
  pbrRepeat?: number;
  /**
   * false：只用套件的 normal + ORM，不用 baseColor（底色保持 token.base 原值）。
   * 座位棋子用：彩漆木的木纹底色会把座位色压成棕色，座位色必须可辨认。
   */
  pbrBaseColor?: boolean;
  /** R18：油彩笔触层强度（仅地块；0 / 缺省 = 无笔触层，崖壁 / 棋子 / 桌面不受影响）。 */
  brush?: number;
};

export type PbrSetId =
  | "t01-pine"
  | "t02-clay"
  | "t03-meadow"
  | "t04-wheat"
  | "t05-reef"
  | "t06-sand"
  | "t07-cliff"
  | "t08-wood"
  | "t09-paintwood"
  | "t10-canvas"
  | "t11-parchment";

export const SEAT_COLORS = ["#c0392b", "#2980b9", "#27ae60", "#f39c12"] as const;

export const SCENE_TOKENS = {
  preset: "tabletop-day",
  toneMapping: "agx",
  outputColorSpace: "srgb",
  lighting: {
    // round-5d：再暖一点主光 + 更软投影，压塑料感。
    sun: { azimuthDeg: 128, elevationDeg: 46, intensity: 3.05, color: "#ffc890" },
    hemisphere: { sky: "#f2e6d2", ground: "#c9a878", intensity: 1.05 },
    shadow: { enabled: true, softness: 0.92 },
    exposure: 1.12,
  } satisfies LightingSpec,
  shadow: {
    /** high / medium 的 PCF 半径；low 档用 TierCaps.shadowRadius（= 1）。 */
    radius: 4,
    bias: -0.0004,
    normalBias: 0.02,
    /** 阴影相机正交范围 = 岛屿包围半径 + 1.5 单位（§4.3）。 */
    boundsPadding: 1.5,
  },
  environment: { intensity: 0.2, pmremSigma: 0.05 },
  /** §5.5 S-01 程序化渐变天空穹顶。 */
  sky: { top: "#9ab8cc", horizon: "#efe6d4", bottom: "#d4c4a4", exponent: 0.75, radius: 60 },
  camera: { fovDeg: 35, distance: 16, minPolarDeg: 25, maxPolarDeg: 70 },
  tile: { roughness: 0.98, metalness: 0 },
  piece: { roughness: 0.82, metalness: 0, clearcoat: 0 },
} as const;

/** 地块材质（颜色沿用现有地形色，pattern 按地形，贴图取 G3D-22 套件）。 */
/** R17: matte hex faces + denser PBR repeat — continuous oil-paint brush, not flat plastic. */
export const TERRAIN_MATERIALS: Record<string, MaterialToken> = {
  wood: { base: "#2f6b3a", roughness: 0.98, metalness: 0, pattern: "grass", pbrSet: "t01-pine", pbrRepeat: 1.65, brush: 0.6 },
  brick: { base: "#b85a3a", roughness: 0.98, metalness: 0, pattern: "stone", pbrSet: "t02-clay", pbrRepeat: 1.65, brush: 0.6 },
  sheep: { base: "#8fbf6a", roughness: 0.98, metalness: 0, pattern: "grass", pbrSet: "t03-meadow", pbrRepeat: 1.7, brush: 0.6 },
  wheat: { base: "#d4b84a", roughness: 0.97, metalness: 0, pattern: "grass", pbrSet: "t04-wheat", pbrRepeat: 1.7, brush: 0.6 },
  ore: { base: "#6a6f78", roughness: 0.96, metalness: 0, pattern: "stone", pbrSet: "t05-reef", pbrRepeat: 1.55, brush: 0.6 },
  desert: { base: "#c9b896", roughness: 0.98, metalness: 0, pattern: "sand", pbrSet: "t06-sand", pbrRepeat: 1.45, brush: 0.6 },
};

/** 其余物件材质。 */
export const PROP_MATERIALS = {
  cliff: { base: "#7a7368", roughness: 0.9, metalness: 0, pattern: "stone", pbrSet: "t07-cliff", pbrRepeat: 5 },
  "number-token": { base: "#f5f0e1", roughness: 0.7, metalness: 0, pattern: "none", pbrSet: "t11-parchment", pbrRepeat: 1 },
  // G3D-ART-2：6/8 不再整块涂红（与座位 0 红色混淆、且盖住数字）；同用 N1 筹码面，数字用赤陶色高亮（number-labels.ts）。
  "number-token-hot": { base: "#f7e6d2", roughness: 0.7, metalness: 0, pattern: "none", pbrSet: "t11-parchment", pbrRepeat: 1 },
  robber: { base: "#2c3e50", roughness: 0.7, metalness: 0, pattern: "none" },
  wood: { base: "#8b6914", roughness: 0.7, metalness: 0, pattern: "grain", pbrSet: "t08-wood", pbrRepeat: 1 },
  die: { base: "#f8f8f8", roughness: 0.5, metalness: 0, pattern: "none" },
  ground: { base: "#d7e6c8", roughness: 0.9, metalness: 0, pattern: "cloth" },
} satisfies Record<string, MaterialToken>;

/** 座位棋子：roughness 0.82、clearcoat 0（r6tex 去塑料）（仅 high 档），pattern none，贴图彩漆木。 */
export function seatMaterial(seat: number): MaterialToken {
  return {
    base: SEAT_COLORS[seat] ?? "#ffffff",
    roughness: SCENE_TOKENS.piece.roughness,
    metalness: SCENE_TOKENS.piece.metalness,
    clearcoat: SCENE_TOKENS.piece.clearcoat,
    pattern: "none",
    pbrSet: "t09-paintwood",
    pbrRepeat: 2.2,
    pbrBaseColor: true,
  };
}

/**
 * 罗盘方位角 → 太阳方向单位向量（指向光源）。
 * 方位 0° = 北（-Z），90° = 东（+X），180° = 南（+Z，默认机位一侧）。
 */
export function sunDirection(azimuthDeg: number, elevationDeg: number): [number, number, number] {
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (elevationDeg * Math.PI) / 180;
  const horizontal = Math.cos(el);
  return [Math.sin(az) * horizontal, Math.sin(el), -Math.cos(az) * horizontal];
}

export type ShadowFrustum = {
  /** 正交相机半宽（left = -half, right = half, 上下同）。 */
  half: number;
  near: number;
  far: number;
  /** 太阳光位置（相对包围中心），target 放在包围中心。 */
  lightOffset: [number, number, number];
};

/**
 * 阴影相机紧贴岛屿包围球：正交范围 = radius + padding，
 * 光源沿太阳方向放在包围球外，near/far 恰好覆盖包围球（§4.3 第 3 条）。
 */
export function shadowFrustumForBounds(
  radius: number,
  sun: { azimuthDeg: number; elevationDeg: number },
  padding: number = SCENE_TOKENS.shadow.boundsPadding,
): ShadowFrustum {
  const half = Math.max(radius, 0.5) + padding;
  const distance = half * 2;
  const [x, y, z] = sunDirection(sun.azimuthDeg, sun.elevationDeg);
  return {
    half,
    near: Math.max(distance - half * 1.5, 0.1),
    far: distance + half * 1.5,
    lightOffset: [x * distance, y * distance, z * distance],
  };
}

/** PCF 半径：low 档用档位表（轻阴影 radius 1），其余用 tokens 半径并随 softness 缩放。 */
export function shadowRadiusFor(tier: "high" | "medium" | "low", tierRadius: number, softness: number): number {
  if (tier === "low") return tierRadius;
  const clamped = Math.min(Math.max(softness, 0), 1);
  // softness 0.5（默认）→ 4；0 → 1；1 → 7。
  return Math.max(1, Math.round((1 + clamped * 6) * 10) / 10);
}

/** 档位 → PBR 贴图分辨率（§4.7：low 档贴图 256，其余 512）。 */
export function pbrResolutionFor(tier: "high" | "medium" | "low"): 512 | 256 {
  return tier === "low" ? 256 : 512;
}

/** 地块外接半径（与 SceneHost 六棱柱一致）。 */
export const TILE_RADIUS = 0.95;

/** G3D-ART-2：点数筹码水平放大倍数（0.22 半径只占六角宽 23%，远看读不出数字；放大到 ≈42%，G3D-ART-3 由 1.6 调到 1.8 保证 iPhone 低档远处筹码可读）。 */
export const NUMBER_TOKEN_SCALE = 1.45;

/**
 * 由场景节点求岛屿包围球（XZ 平面）：中心 = 地块中心均值，半径 = 最远地块中心距离 + 地块外接半径。
 * 没有地块时（测试立方体）返回 radius 4 的默认值。
 */
export function islandBounds(
  nodes: readonly { kind: string; position: readonly [number, number, number] }[],
): { center: [number, number, number]; radius: number } {
  const tiles = nodes.filter((node) => node.kind === "tile");
  if (tiles.length === 0) return { center: [0, 0, 0], radius: 4 };
  let cx = 0;
  let cz = 0;
  for (const tile of tiles) {
    cx += tile.position[0];
    cz += tile.position[2];
  }
  cx /= tiles.length;
  cz /= tiles.length;
  let radius = 0;
  for (const tile of tiles) {
    radius = Math.max(radius, Math.hypot(tile.position[0] - cx, tile.position[2] - cz));
  }
  return { center: [cx, 0, cz], radius: radius + TILE_RADIUS };
}
