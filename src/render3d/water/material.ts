/**
 * G3D-08 · Tide water material (MeshStandardMaterial + onBeforeCompile).
 * Uniforms use uTide* prefix (SPEC §4.4). Lean GLSL for chunk budget.
 *
 * Sampler uniforms start as null (three binds its emptyTexture singleton) so we
 * never allocate extra 1×1 DataTextures that remount leak accounting would see.
 */
import {
  Color,
  MeshStandardMaterial,
  type IUniform,
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from "three";
import type { WaterTierFeatures } from "./tiers";

export type TideWaterUniforms = {
  uTideTime: IUniform<number>;
  uTideDist: IUniform<Texture | null>;
  uTideHalf: IUniform<number>;
  uTideShallow: IUniform<Color>;
  uTideDeep: IUniform<Color>;
  uTideWaveH: IUniform<number>;
  uTideWaveS: IUniform<number>;
  uTideFoam: IUniform<number>;
  uTideWaves: IUniform<number>;
  uTideUseN: IUniform<number>;
  uTideNormal: IUniform<Texture | null>;
  uTideFoamMap: IUniform<Texture | null>;
};

export type TideWaterSpec = {
  shallow: string;
  deep: string;
  waveHeight: number;
  waveSpeed: number;
  foam: number;
};

const VERT_PARS = [
  "uniform float uTideTime;",
  "uniform float uTideWaveH;",
  "uniform float uTideWaveS;",
  "uniform float uTideWaves;",
  "uniform float uTideHalf;",
  "varying vec3 vTideWorld;",
  "vec3 tideGerstner(vec3 p, vec2 dir, float steep, float waveLen, float speed) {",
  "  float k = 6.2831853 / waveLen;",
  "  float c = sqrt(9.8 / k);",
  "  float a = steep / k;",
  "  float f = k * (dot(dir, p.xz) - c * speed * uTideTime * uTideWaveS);",
  "  float s = sin(f), co = cos(f);",
  "  p.x += dir.x * a * s;",
  "  p.z += dir.y * a * s;",
  "  p.y += a * co * uTideWaveH;",
  "  return p;",
  "}",
].join("\n");

const VERT_MAIN = [
  // G3D-ISLAND：外圈远海环（同材质、平面）与主水面无缝衔接 —— 波浪位移在主水面外缘淡出到 0。
  "vec3 tideRest = transformed;",
  "if (uTideWaves > 0.5 && uTideWaveH > 0.0001) {",
  "  transformed = tideGerstner(transformed, normalize(vec2(1.0, 0.35)), 0.22, 2.4, 1.0);",
  "  if (uTideWaves > 1.5) {",
  "    transformed = tideGerstner(transformed, normalize(vec2(-0.55, 1.0)), 0.14, 1.5, 1.25);",
  "  }",
  "}",
  "float tideEdge = 1.0 - smoothstep(uTideHalf * 0.7, uTideHalf * 0.97, max(abs(tideRest.x), abs(tideRest.z)));",
  "transformed = mix(tideRest, transformed, tideEdge);",
  "vTideWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;",
].join("\n");

const FRAG_PARS = [
  "uniform sampler2D uTideDist;",
  "uniform float uTideHalf;",
  "uniform vec3 uTideShallow;",
  "uniform vec3 uTideDeep;",
  "uniform float uTideFoam;",
  "uniform float uTideTime;",
  "uniform float uTideWaveS;",
  "uniform float uTideUseN;",
  "uniform sampler2D uTideNormal;",
  "uniform sampler2D uTideFoamMap;",
  "varying vec3 vTideWorld;",
].join("\n");

const FRAG_COLOR = [
  "{",
  "  vec2 wu = vTideWorld.xz / max(uTideHalf * 2.0, 0.001) + 0.5;",
  "  float dTex = texture2D(uTideDist, clamp(wu, 0.0, 1.0)).r;",
  // round-3d：场外直接深水，抹掉 ±half 方形 UV 环接缝。
  "  float fieldEdge = smoothstep(uTideHalf * 0.82, uTideHalf * 1.02, max(abs(vTideWorld.x), abs(vTideWorld.z)));",
  "  float d = mix(dTex, 1.0, fieldEdge);",
  // R20：明亮青绿海 + 岛周一圈浅滩环（settlecoast 读感，自有实现）。
  // 0–0.05 浅滩核心（亮水绿）→ 0.15 环缘（落差处一道浅色唇线）→ 0.45 中海青绿 → 0.95 外海（仍是亮青，不回深蓝）。
  "  vec3 tideRing = mix(uTideShallow, uTideDeep, 0.22);",
  "  vec3 tideMid = mix(uTideShallow, uTideDeep, 0.66);",
  "  vec3 waterCol = mix(uTideShallow, tideRing, smoothstep(0.03, 0.11, d));",
  "  waterCol = mix(waterCol, tideMid, smoothstep(0.12, 0.2, d));",
  "  waterCol = mix(waterCol, uTideDeep, smoothstep(0.24, 0.95, d));",
  "  float ringLip = exp(-pow((d - 0.125) / 0.018, 2.0));",
  "  waterCol = mix(waterCol, uTideShallow * 1.06, ringLip * 0.35);",
  // R14：在 R13 切向笔触上提高默认机位浪脊密度与节奏分段（自有算法，非抄 settlecoast）。
  "  vec2 fuv = vTideWorld.xz * 0.78 + vec2(uTideTime * 0.028 * uTideWaveS, uTideTime * -0.02 * uTideWaveS);",
  "  float foamN = texture2D(uTideFoamMap, fuv).r;",
  "  float foamN2 = texture2D(uTideFoamMap, fuv * 2.15 + vec2(0.31, -0.17)).r;",
  "  float foamN3 = texture2D(uTideFoamMap, fuv * 3.4 + vec2(-0.19, 0.41)).r;",
  "  float ang = atan(vTideWorld.z, vTideWorld.x);",
  // 三层切向节奏：密笔触 + 中段团块 + 稀疏空隙，破匀密锯齿。
  "  float strokeFine = 0.5 + 0.5 * sin(ang * 38.0 + foamN * 12.0 + vTideWorld.x * 2.1);",
  "  float strokeMid = 0.5 + 0.5 * sin(ang * 17.0 - foamN2 * 8.0 + vTideWorld.z * 1.4);",
  "  float strokeGap = 0.5 + 0.5 * sin(ang * 7.0 + foamN3 * 5.5 + vTideWorld.x * 0.55);",
  "  float strokeRaw = strokeFine * strokeMid;",
  "  strokeRaw *= mix(0.55, 1.0, smoothstep(0.22, 0.62, strokeGap));",
  "  float strokeGate = smoothstep(0.32, 0.58, strokeRaw);",
  "  strokeGate *= smoothstep(0.18, 0.6, foamN2);",
  // 极弱底 + 更多窄浪脊带（默认机位可读密度，非软晕宽带）。
  "  float foamSoft = (1.0 - smoothstep(0.0, 0.08, d)) * uTideFoam * 0.07;",
  "  float r1 = exp(-pow((d - 0.008) / 0.0058, 2.0));",
  "  float r2 = exp(-pow((d - 0.024) / 0.0075, 2.0));",
  "  float r3 = exp(-pow((d - 0.046) / 0.009, 2.0));",
  "  float r4 = exp(-pow((d - 0.074) / 0.011, 2.0));",
  "  float rLace = exp(-pow((d - 0.108) / 0.014, 2.0));",
  "  float rSpray = exp(-pow((d - 0.145) / 0.018, 2.0));",
  "  float ridges = (r1 * 1.55 + r2 * 1.25 + r3 * 0.95 + r4 * 0.65) * uTideFoam * mix(0.1, 1.0, strokeGate);",
  "  float lace = (rLace * 0.85 + rSpray * 0.5) * uTideFoam * strokeGate * (0.28 + 0.72 * foamN);",
  "  float crest = r1 * mix(0.08, 1.35, strokeGate) * uTideFoam * (0.6 + 0.4 * foamN3);",
  "  waterCol = mix(waterCol, vec3(0.84, 0.9, 0.89), foamSoft);",
  "  waterCol = mix(waterCol, vec3(0.95, 0.98, 0.97), ridges * (0.5 + 0.5 * foamN));",
  "  waterCol = mix(waterCol, vec3(1.0, 1.0, 0.995), crest);",
  "  waterCol = mix(waterCol, vec3(0.91, 0.96, 0.95), lace);",
  "  diffuseColor.rgb = waterCol;",
  "}",
].join("\n");

const FRAG_NORMAL = [
  "if (uTideUseN > 0.5) {",
  "  vec3 nTex = texture2D(uTideNormal, vTideWorld.xz * 0.15 + uTideTime * 0.01 * uTideWaveS).xyz * 2.0 - 1.0;",
  "  normal = normalize(normal + nTex * 0.35);",
  "}",
].join("\n");

export type TideWaterMaterialBundle = {
  material: MeshStandardMaterial;
  uniforms: TideWaterUniforms;
  setOwnedTexture(slot: "uTideDist" | "uTideNormal" | "uTideFoamMap", next: Texture | null): void;
  releaseOwned(tex: Texture | null): void;
  disposeOwnedTextures(): void;
};

export function createTideWaterMaterial(
  spec: TideWaterSpec,
  features: WaterTierFeatures,
): TideWaterMaterialBundle {
  const owned = new Set<Texture>();

  const uniforms: TideWaterUniforms = {
    uTideTime: { value: 0 },
    uTideDist: { value: null },
    uTideHalf: { value: 9 },
    uTideShallow: { value: new Color(spec.shallow) },
    uTideDeep: { value: new Color(spec.deep) },
    uTideWaveH: { value: features.waveCount === 0 ? 0 : spec.waveHeight },
    uTideWaveS: { value: spec.waveSpeed },
    uTideFoam: { value: features.foam ? spec.foam : 0 },
    uTideWaves: { value: features.waveCount },
    uTideUseN: { value: features.normals ? 1 : 0 },
    uTideNormal: { value: null },
    uTideFoamMap: { value: null },
  };

  const material = new MeshStandardMaterial({
    color: spec.shallow,
    // R12：略哑光，绘本感非镜面塑料。
    roughness: 0.42,
    metalness: 0.03,
    envMapIntensity: 0.38,
  });
  material.userData.gdShared = false;
  material.userData.tideUniforms = uniforms;

  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${VERT_PARS}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${VERT_MAIN}`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${FRAG_PARS}`)
      .replace("#include <color_fragment>", `#include <color_fragment>\n${FRAG_COLOR}`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>\n${FRAG_NORMAL}`);
  };
  material.customProgramCacheKey = () =>
    `tide-r20-w${features.waveCount}-n${features.normals ? 1 : 0}-f${features.foam ? 1 : 0}`;

  return {
    material,
    uniforms,
    setOwnedTexture(slot, next) {
      const prev = uniforms[slot].value;
      uniforms[slot].value = next;
      if (prev && owned.has(prev)) {
        owned.delete(prev);
        prev.dispose();
      }
      if (next) owned.add(next);
    },
    releaseOwned(tex) {
      if (tex) owned.delete(tex);
    },
    disposeOwnedTextures() {
      for (const tex of owned) tex.dispose();
      owned.clear();
      uniforms.uTideDist.value = null;
      uniforms.uTideNormal.value = null;
      uniforms.uTideFoamMap.value = null;
    },
  };
}

export function setTideTime(uniforms: TideWaterUniforms, seconds: number): void {
  uniforms.uTideTime.value = seconds;
}

export function setTideWaveHeight(uniforms: TideWaterUniforms, height: number): void {
  uniforms.uTideWaveH.value = height;
}
