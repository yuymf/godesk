/**
 * G3D-07 · 材质预设、程序化 pattern 与 PBR 贴图替换（SPEC §3.6 / §3.7 / §4.2）。
 *
 * - 地块、棋子、栈桥统一 MeshStandardMaterial；high 档座位棋子用 MeshPhysicalMaterial（clearcoat）。
 * - 首帧用 `onBeforeCompile` 注入的世界坐标程序化噪声（pattern），不等贴图。
 * - 可交互后按档位把 G3D-22 KTX2 套件（512 / low 256）流式替换进同一材质（applyPbrSet）。
 * - 材质按 key 共享：同色同 pattern 的节点共用一个材质；节点移除时不释放共享材质，
 *   由 `MaterialLibrary.dispose()` 在场景卸载时统一释放（含贴图）。
 */
import {
  Color,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  type Texture,
} from "three";
import type { MaterialPattern, MaterialToken, PbrSetId } from "./tokens";
import { TILE_FACE_APOTHEM } from "./tokens";

/** R21 soft hex-edge band: max share the top-face albedo eases toward the shared light earth tone (× brush). R22: 0.45 → 0.25. */
export const SOFT_EDGE_STRENGTH = 0.25;
/** R22: terrain albedo saturation (1 = texture as-is; R19–R21 used 0.86, a 14% pull toward grey). */
export const TERRAIN_SATURATION = 1.12;
/** R22 hairline seam; R23: 0.006 → 0.002 (whole-board a no longer chessboard). */
export const SEAM_HALF_WIDTH = 0.0015;

export const PATTERN_IDS: Record<MaterialPattern, number> = {
  none: 0,
  grain: 1,
  cloth: 2,
  stone: 3,
  grass: 4,
  sand: 5,
};

/** 贴图到达后 pattern 保留的强度（只做细节扰动）。 */
/** R17: oil-paint continuous brush under PBR — hex faces read as painted color fields, not flat plastic.
 *  R18: 0.42 → 0.5 (painted fields read at a glance in default a/b cameras). */
export const PATTERN_STRENGTH_WITH_PBR = 0.5;
/** 贴图到达后底色向白色混合的比例：保留地形色相，又不让贴图被压暗。 */
export const PBR_TINT_TO_WHITE = 0.28;

const PATTERN_GLSL = /* glsl */ `
varying vec3 vGdWorld;
uniform float uGdPattern;
float gdHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float gdNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(gdHash(i), gdHash(i + vec2(1.0, 0.0)), u.x),
             mix(gdHash(i + vec2(0.0, 1.0)), gdHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float gdFbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int k = 0; k < 3; k++) { v += a * gdNoise(p); p *= 2.03; a *= 0.5; }
  return v;
}
float gdPattern(vec3 w) {
#if GD_PATTERN == 1
  float n = gdNoise(vec2(w.x * 1.7, w.z * 12.0));
  return 0.5 + 0.5 * sin((w.x + n * 0.5) * 26.0);
#elif GD_PATTERN == 2
  vec2 g = fract(w.xz * 36.0);
  float weave = abs(step(0.5, g.x) - step(0.5, g.y));
  return mix(0.35, 0.65, weave) + (gdNoise(w.xz * 8.0) - 0.5) * 0.3;
#elif GD_PATTERN == 3
  float rock = gdFbm(w.xz * 2.8 + w.y * 1.2);
  float seam = gdNoise(w.xz * 7.0 + w.y);
  float stroke = gdFbm(w.xz * 1.2 + w.y * 0.5);
  return mix(mix(rock, seam, 0.26), stroke, 0.32);
#elif GD_PATTERN == 4
  float blade = gdFbm(w.xz * 7.2);
  float clump = gdNoise(w.xz * 2.4);
  float stroke = gdFbm(w.xz * 1.35 + vec2(w.z * 0.4, -w.x * 0.25));
  float paint = mix(blade, clump, 0.32);
  return mix(paint, stroke, 0.38);
#elif GD_PATTERN == 5
  return gdNoise(w.xz * 28.0) * 0.4 + gdFbm(w.xz * 1.8) * 0.35 + gdFbm(w.xz * 0.9) * 0.25;
#else
  return 0.5;
#endif
}
`;

/**
 * R18 油彩笔触层（仅地块 token.brush > 0）：沿低频流场取向的细长笔触 dab + 冷暖色相起伏；
 * fwidth 抗锯齿——远处 / 掠射角笔触频率逼近像素时淡回均值（海岸机位不闪、不加噪）。
 */
const BRUSH_GLSL = /* glsl */ `
uniform float uGdBrush;
vec3 gdBrushStroke(vec3 w) {
  // Cellular oil dabs (~0.17 world units, R19: 7→6 cells/unit so b3 reads distinct strokes): each cell
  // owns one short elongated stroke with its own angle (loosely coherent), value and warm/cool hue.
  vec2 g = w.xz * 6.0;
  vec2 i = floor(g);
  vec2 f = fract(g);
  float val = 0.0;
  float hue = 0.0;
  float wsum = 0.0;
  float kmax = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 c = vec2(float(x), float(y));
      vec2 id = i + c;
      vec2 o = c + vec2(gdHash(id), gdHash(id + 17.3)) - f;
      float ang = gdNoise(id * 0.21) * 3.6 + gdHash(id + 41.7) * 1.2;
      vec2 d = vec2(cos(ang), sin(ang));
      vec2 q = vec2(dot(o, d), dot(o, vec2(-d.y, d.x)));
      float e = q.x * q.x * 3.2 + q.y * q.y * 30.0;
      float k = exp(-e * 2.2);
      // R19: k^4 → the top stroke dominates (distinct dabs instead of a blurred average).
      float k4 = k * k;
      k4 *= k4;
      val += k4 * gdHash(id + 5.1);
      hue += k4 * gdHash(id + 9.9);
      wsum += k4;
      kmax = max(kmax, k);
    }
  }
  // Between strokes (low kmax) reads as a slightly darker paint seam.
  float dab = (wsum > 1e-6 ? val / wsum : 0.5) - (1.0 - smoothstep(0.08, 0.5, kmax)) * 0.18;
  float hu = wsum > 1e-6 ? hue / wsum : 0.5;
  float fw = length(fwidth(g));
  float aa = 1.0 - smoothstep(0.35, 0.9, fw);
  return vec3(mix(0.5, dab, aa), mix(0.5, hu, aa), aa);
}
`;

type PatternUniform = { value: number };

/**
 * 给材质注入程序化 pattern。同一 pattern 的材质共享一个 program（customProgramCacheKey）。
 */
export function installPattern(material: MeshStandardMaterial, pattern: MaterialPattern, brush = 0): PatternUniform {
  const strength: PatternUniform = { value: pattern === "none" ? 0 : 1 };
  material.userData.gdPattern = pattern;
  material.userData.gdPatternStrength = strength;
  if (pattern === "none") return strength;
  const id = PATTERN_IDS[pattern];
  const brushUniform = { value: brush };
  material.userData.gdBrush = brushUniform;
  material.defines = { ...(material.defines ?? {}), GD_PATTERN: id, ...(brush > 0 ? { GD_BRUSH: 1 } : {}) };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGdPattern = strength;
    if (brush > 0) shader.uniforms.uGdBrush = brushUniform;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vGdWorld;${brush > 0 ? "\nvarying vec2 vGdLocal;\nvarying float vGdUp;" : ""}`)
      .replace(
        "#include <project_vertex>",
        [
          "#include <project_vertex>",
          ...(brush > 0 ? ["vGdLocal = position.xz;", "vGdUp = normal.y;"] : []),
          "vec4 gdWorld = vec4(transformed, 1.0);",
          "#ifdef USE_INSTANCING",
          "  gdWorld = instanceMatrix * gdWorld;",
          "#endif",
          "vGdWorld = (modelMatrix * gdWorld).xyz;",
        ].join("\n"),
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>\n${PATTERN_GLSL}${brush > 0 ? `varying vec2 vGdLocal;\nvarying float vGdUp;\n${BRUSH_GLSL}` : ""}`,
      )
      .replace(
        "#include <color_fragment>",
        [
          "#include <color_fragment>",
          "float gdP = gdPattern(vGdWorld);",
          "diffuseColor.rgb *= mix(1.0, 0.52 + 0.96 * gdP, uGdPattern);",
          ...(brush > 0
            ? [
                // R18/R19 oil dabs: dominant-stroke luminance + warm/cool hue drift, faded by AA term.
                "vec3 gdB = gdBrushStroke(vGdWorld);",
                "diffuseColor.rgb *= 1.0 + (gdB.x - 0.5) * 1.3 * uGdBrush;",
                "diffuseColor.rgb *= mix(vec3(1.0), mix(vec3(0.9, 0.99, 1.1), vec3(1.1, 1.0, 0.86), gdB.y), uGdBrush * gdB.z);",
                // R19 pulled terrain albedo 14% toward its luminance (0.86); R22: saturation restored + a light lift
                // (1.12 = 12% away from luminance) so the six resources read at a glance — no grey wash.
                `diffuseColor.rgb = max(mix(vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), diffuseColor.rgb, ${TERRAIN_SATURATION.toFixed(2)}), vec3(0.0));`,
                // R21 soft hex edge: within ~0.2 of the face edge, albedo eases toward one shared light warm
                // earth tone (same for every terrain) so neighbouring tiles melt into each other — no grid lines.
                "float gdHexM = max(abs(vGdLocal.y), max(abs(0.8660254 * vGdLocal.x + 0.5 * vGdLocal.y), abs(0.8660254 * vGdLocal.x - 0.5 * vGdLocal.y)));",
                `float gdEdge = smoothstep(${(TILE_FACE_APOTHEM - 0.2).toFixed(4)}, ${TILE_FACE_APOTHEM.toFixed(4)}, gdHexM);`,
                // top face only — tile sides keep their own darker material so cliffs / shoreline stay readable
                "float gdTop = smoothstep(0.5, 0.9, vGdUp);",
                "gdEdge = gdEdge * gdEdge * (0.7 + 0.6 * gdB.x) * gdTop;",
                // R22: band strength 0.45 → 0.25 (faded halo gone; tiles keep their own colour up to the edge).
                `diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.72, 0.65, 0.5), clamp(gdEdge, 0.0, 1.0) * ${SOFT_EDGE_STRENGTH.toFixed(2)} * uGdBrush);`,
                // R22: faces touch (TILE_FACE_RADIUS 1.0). R23: seam narrower (0.002) + ground-coloured
                // (slight self-darken, not bright sandy paths) so camera a no longer reads as a chessboard.
                "float gdSeamFw = max(fwidth(gdHexM), 1e-4);",
                `float gdSeam = smoothstep(${(TILE_FACE_APOTHEM - SEAM_HALF_WIDTH).toFixed(4)} - gdSeamFw, ${(TILE_FACE_APOTHEM - SEAM_HALF_WIDTH).toFixed(4)} + gdSeamFw * 0.5, gdHexM) * gdTop;`,
                "diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.9, gdSeam * 0.25);",
              ]
            : []),
        ].join("\n"),
      )
      .replace(
        "#include <roughnessmap_fragment>",
        [
          "#include <roughnessmap_fragment>",
          "roughnessFactor = clamp(roughnessFactor + (gdP - 0.5) * 0.32 * uGdPattern, 0.04, 1.0);",
        ].join("\n"),
      );
  };
  material.customProgramCacheKey = () => (brush > 0 ? `gd-pattern-${id}-brush` : `gd-pattern-${id}`);
  return strength;
}

export type MaterialFeatures = {
  /** high 档：座位棋子 clearcoat（MeshPhysicalMaterial）。 */
  clearcoat: boolean;
};

export type PbrMaps = {
  map: Texture;
  normalMap: Texture;
  /** ORM：R = AO，G = roughness，B = metalness。 */
  ormMap: Texture;
};

type Entry = {
  material: MeshStandardMaterial;
  token: MaterialToken;
};

/** 按 key 共享的材质库（每个 SceneHost 一个）。 */
export class MaterialLibrary {
  private readonly entries = new Map<string, Entry>();
  private readonly textures = new Set<Texture>();
  private readonly appliedSets = new Map<PbrSetId, PbrMaps>();
  private disposed = false;
  private environment: { texture: Texture | null; intensity: number } = { texture: null, intensity: 0 };

  constructor(private features: MaterialFeatures) {}

  get size(): number {
    return this.entries.size;
  }

  /** 取共享材质；第一次请求时按 token 创建。 */
  get(key: string, token: MaterialToken): MeshStandardMaterial {
    const existing = this.entries.get(key);
    if (existing) return existing.material;
    const material = createMaterial(token, this.features);
    material.name = `gd:${key}`;
    material.userData.gdShared = true;
    this.entries.set(key, { material, token });
    const maps = token.pbrSet ? this.appliedSets.get(token.pbrSet) : undefined;
    if (maps) applyMaps(material, token, maps);
    applyEnvironment(material, token, this.environment);
    return material;
  }

  /** 当前材质引用到的 PBR 套件（去重，按名称排序）。 */
  pbrSetsInUse(): PbrSetId[] {
    const sets = new Set<PbrSetId>();
    for (const { token } of this.entries.values()) if (token.pbrSet) sets.add(token.pbrSet);
    return [...sets].sort();
  }

  /** 把一套 PBR 贴图换进所有引用它的材质；贴图归材质库所有。 */
  applyPbrSet(set: PbrSetId, maps: PbrMaps): number {
    if (this.disposed) {
      maps.map.dispose();
      maps.normalMap.dispose();
      maps.ormMap.dispose();
      return 0;
    }
    for (const texture of [maps.map, maps.normalMap, maps.ormMap]) {
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      this.textures.add(texture);
    }
    this.appliedSets.set(set, maps);
    let count = 0;
    for (const { material, token } of this.entries.values()) {
      if (token.pbrSet !== set) continue;
      applyMaps(material, token, maps);
      count += 1;
    }
    return count;
  }

  /** 运行时降档离开 high：关闭 clearcoat（clearcoat = 0 时 three 走不含 clearcoat 的 program）。 */
  setClearcoat(enabled: boolean): void {
    if (this.features.clearcoat === enabled) return;
    this.features = { ...this.features, clearcoat: enabled };
    for (const { material, token } of this.entries.values()) {
      if (!(material instanceof MeshPhysicalMaterial)) continue;
      material.clearcoat = enabled ? token.clearcoat ?? 0 : 0;
    }
  }

  /**
   * high 档环境反射：RoomEnvironment 只挂到光泽材质（棋子、雾灯、骰子，roughness ≤ 0.6），
   * 不挂到地块 / 崖壁。scene.environment 会给所有表面加一层漫反射补光，把地块上的软阴影冲淡
   * （同机位截图里 high 的阴影明显淡于 medium），所以按材质挂 envMap。
   */
  setEnvironment(texture: Texture | null, intensity: number): void {
    this.environment = { texture, intensity };
    for (const { material, token } of this.entries.values()) applyEnvironment(material, token, this.environment);
  }

  hasPbr(set: PbrSetId): boolean {
    return this.appliedSets.has(set);
  }

  dispose(): void {
    this.disposed = true;
    for (const { material } of this.entries.values()) material.dispose();
    for (const texture of this.textures) texture.dispose();
    this.entries.clear();
    this.textures.clear();
    this.appliedSets.clear();
  }
}

export function createMaterial(token: MaterialToken, features: MaterialFeatures): MeshStandardMaterial {
  const params = {
    color: new Color(token.base),
    roughness: token.roughness,
    metalness: token.metalness,
  };
  const material =
    features.clearcoat && token.clearcoat !== undefined && token.clearcoat > 0
      ? new MeshPhysicalMaterial({ ...params, clearcoat: token.clearcoat, clearcoatRoughness: 0.55 })
      : new MeshStandardMaterial(params);
  installPattern(material, token.pattern, token.brush ?? 0);
  return material;
}

/** 光泽材质阈值：roughness ≤ 0.6 的材质接收环境反射。 */
export const ENV_REFLECTION_MAX_ROUGHNESS = 0.6;

function applyEnvironment(
  material: MeshStandardMaterial,
  token: MaterialToken,
  environment: { texture: Texture | null; intensity: number },
): void {
  const next = token.roughness <= ENV_REFLECTION_MAX_ROUGHNESS ? environment.texture : null;
  if (material.envMap === next && material.envMapIntensity === environment.intensity) return;
  const programChange = Boolean(material.envMap) !== Boolean(next);
  material.envMap = next;
  material.envMapIntensity = environment.intensity;
  if (programChange) material.needsUpdate = true;
}

function applyMaps(material: MeshStandardMaterial, token: MaterialToken, maps: PbrMaps): void {
  const repeat = token.pbrRepeat ?? 1;
  // 贴图共享：同一套件的材质 repeat 相同（tokens 约定），这里只在首个材质上设置。
  maps.map.repeat.set(repeat, repeat);
  maps.normalMap.repeat.set(repeat, repeat);
  maps.ormMap.repeat.set(repeat, repeat);
  const useBaseColor = token.pbrBaseColor !== false;
  material.map = useBaseColor ? maps.map : null;
  material.normalMap = maps.normalMap;
  // R17: stronger oil-paint micro-relief + AO so hex faces read continuous painted fields.
  material.normalScale.set(1.65, 1.65);
  material.aoMap = maps.ormMap;
  material.aoMapIntensity = 1.32;
  material.roughnessMap = maps.ormMap;
  material.metalnessMap = maps.ormMap;
  material.color.set(token.base);
  if (useBaseColor) material.color.lerp(new Color(0xffffff), token.pbrTint ?? PBR_TINT_TO_WHITE);
  const strength = material.userData.gdPatternStrength as PatternUniform | undefined;
  if (strength && token.pattern !== "none") strength.value = PATTERN_STRENGTH_WITH_PBR;
  material.userData.gdPbr = token.pbrSet;
  material.needsUpdate = true;
}
