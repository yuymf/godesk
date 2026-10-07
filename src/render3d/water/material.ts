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
  // R12：绘本感 — 近岸青绿更快沉入中/远深蓝，崖脚白沫加宽可读。
  "  vec3 tideNear = mix(uTideShallow, uTideDeep, 0.32);",
  "  vec3 tideMid = mix(uTideShallow, uTideDeep, 0.72);",
  "  vec3 tideFar = mix(uTideShallow, uTideDeep, 0.98);",
  "  vec3 waterCol = mix(uTideShallow, tideNear, smoothstep(0.0, 0.04, d));",
  "  waterCol = mix(waterCol, tideMid, smoothstep(0.04, 0.28, d));",
  "  waterCol = mix(waterCol, tideFar, smoothstep(0.28, 0.85, d));",
  // R12：岸沫加宽 + 浪花冠更亮；远景浅沫带更密（绘本非塑料）。
  "  float foamBand = (1.0 - smoothstep(0.0, 0.22, d)) * uTideFoam;",
  "  float foamCrest = (1.0 - smoothstep(0.0, 0.055, d)) * uTideFoam;",
  "  float foamFar = (1.0 - smoothstep(0.14, 0.52, d)) * smoothstep(0.04, 0.18, d) * uTideFoam * 0.55;",
  "  vec2 fuv = vTideWorld.xz * 0.42 + vec2(uTideTime * 0.04 * uTideWaveS, uTideTime * -0.028 * uTideWaveS);",
  "  float foamN = texture2D(uTideFoamMap, fuv).r;",
  "  waterCol = mix(waterCol, vec3(0.93, 0.97, 0.96), foamBand * (0.55 + 0.45 * foamN));",
  "  waterCol = mix(waterCol, vec3(1.0, 1.0, 0.99), foamCrest * (0.82 + 0.18 * foamN));",
  "  waterCol = mix(waterCol, vec3(0.9, 0.95, 0.94), foamFar * (0.42 + 0.45 * foamN));",
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
    `tide-w${features.waveCount}-n${features.normals ? 1 : 0}-f${features.foam ? 1 : 0}`;

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
