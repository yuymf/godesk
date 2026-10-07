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

export const PATTERN_IDS: Record<MaterialPattern, number> = {
  none: 0,
  grain: 1,
  cloth: 2,
  stone: 3,
  grass: 4,
  sand: 5,
};

/** 贴图到达后 pattern 保留的强度（只做细节扰动）。 */
/** R15: keep more brush variation under PBR so hex faces read painterly, not flat plastic. */
export const PATTERN_STRENGTH_WITH_PBR = 0.22;
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
  float rock = gdFbm(w.xz * 3.6 + w.y * 1.4);
  float seam = gdNoise(w.xz * 9.0 + w.y);
  return mix(rock, seam, 0.28);
#elif GD_PATTERN == 4
  float blade = gdFbm(w.xz * 8.5);
  float clump = gdNoise(w.xz * 3.2);
  return mix(blade, clump, 0.35);
#elif GD_PATTERN == 5
  return gdNoise(w.xz * 34.0) * 0.55 + gdFbm(w.xz * 2.2) * 0.45;
#else
  return 0.5;
#endif
}
`;

type PatternUniform = { value: number };

/**
 * 给材质注入程序化 pattern。同一 pattern 的材质共享一个 program（customProgramCacheKey）。
 */
export function installPattern(material: MeshStandardMaterial, pattern: MaterialPattern): PatternUniform {
  const strength: PatternUniform = { value: pattern === "none" ? 0 : 1 };
  material.userData.gdPattern = pattern;
  material.userData.gdPatternStrength = strength;
  if (pattern === "none") return strength;
  const id = PATTERN_IDS[pattern];
  material.defines = { ...(material.defines ?? {}), GD_PATTERN: id };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGdPattern = strength;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vGdWorld;")
      .replace(
        "#include <project_vertex>",
        [
          "#include <project_vertex>",
          "vec4 gdWorld = vec4(transformed, 1.0);",
          "#ifdef USE_INSTANCING",
          "  gdWorld = instanceMatrix * gdWorld;",
          "#endif",
          "vGdWorld = (modelMatrix * gdWorld).xyz;",
        ].join("\n"),
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${PATTERN_GLSL}`)
      .replace(
        "#include <color_fragment>",
        [
          "#include <color_fragment>",
          "float gdP = gdPattern(vGdWorld);",
          "diffuseColor.rgb *= mix(1.0, 0.72 + 0.56 * gdP, uGdPattern);",
        ].join("\n"),
      )
      .replace(
        "#include <roughnessmap_fragment>",
        [
          "#include <roughnessmap_fragment>",
          "roughnessFactor = clamp(roughnessFactor + (gdP - 0.5) * 0.22 * uGdPattern, 0.04, 1.0);",
        ].join("\n"),
      );
  };
  material.customProgramCacheKey = () => `gd-pattern-${id}`;
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
  installPattern(material, token.pattern);
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
  // R15: stronger normal relief on hex faces → oil-paint micro-relief at a/b.
  material.normalScale.set(1.35, 1.35);
  material.aoMap = maps.ormMap;
  material.aoMapIntensity = 1.15;
  material.roughnessMap = maps.ormMap;
  material.metalnessMap = maps.ormMap;
  material.color.set(token.base);
  if (useBaseColor) material.color.lerp(new Color(0xffffff), PBR_TINT_TO_WHITE);
  const strength = material.userData.gdPatternStrength as PatternUniform | undefined;
  if (strength && token.pattern !== "none") strength.value = PATTERN_STRENGTH_WITH_PBR;
  material.userData.gdPbr = token.pbrSet;
  material.needsUpdate = true;
}
