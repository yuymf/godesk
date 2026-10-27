/**
 * G3D-07 · 光照、软阴影、色调映射、环境与天空穹顶（SPEC §3.7 / §4.3 / §5.5 S-01）。
 */
import {
  AgXToneMapping,
  BackSide,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  Object3D,
  PCFShadowMap,
  PMREMGenerator,
  type Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  type Texture,
  type WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { TierCaps } from "./tiers";
import {
  SCENE_TOKENS,
  sunDirection,
  type LightingSpec,
  shadowFrustumForBounds,
  shadowRadiusFor,
} from "./tokens";

/** playable exposure / key ceilings (kill wash-out that crushes UI text).
 *  Applies at renderer+rig time so RenderSpec/HARD authoring stays schema-valid; no suite forks. */
/** UI-surface-contrast · tighter ceilings so wash-out white cannot crush chrome/text. */
export const PLAYABLE_LIGHT_FLOORS = {
  exposureMin: 0.85,
  exposureMax: 1.22,
  sunIntensityMax: 3.05,
  fillIntensityMax: 1.55,
  rimIntensityMax: 1.25,
  hemiIntensityMax: 1.35,
} as const;

export function clampPlayableLighting(lighting: LightingSpec): LightingSpec {
  const f = PLAYABLE_LIGHT_FLOORS;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return {
    ...lighting,
    exposure: clamp(lighting.exposure, f.exposureMin, f.exposureMax),
    sun: { ...lighting.sun, intensity: Math.min(lighting.sun.intensity, f.sunIntensityMax) },
    hemisphere: {
      ...lighting.hemisphere,
      intensity: Math.min(lighting.hemisphere.intensity, f.hemiIntensityMax),
    },
    fill: lighting.fill
      ? { ...lighting.fill, intensity: Math.min(lighting.fill.intensity, f.fillIntensityMax) }
      : lighting.fill,
    rim: lighting.rim
      ? { ...lighting.rim, intensity: Math.min(lighting.rim.intensity, f.rimIntensityMax) }
      : lighting.rim,
  };
}

/** 色调映射 AgX、曝光、sRGB 输出、PCF 阴影（r186 已移除 PCFSoft）。 */
export function configureRenderer(renderer: WebGLRenderer, lighting: LightingSpec): void {
  const playable = clampPlayableLighting(lighting);
  renderer.toneMapping = AgXToneMapping;
  // product tabletop: AgX keeps wood grain / paperboard from blowing out under sun
  // exposure clamp so high-key RenderSpec cannot wash UI chrome
  renderer.toneMappingExposure = playable.exposure;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = playable.shadow.enabled;
  renderer.shadowMap.type = PCFShadowMap;
}

type LightingRig = {
  sun: DirectionalLight;
  hemisphere: HemisphereLight;
  /** T086 · soft fill (no shadow). */
  fill: DirectionalLight;
  /** T086 · rim / kicker (no shadow). */
  rim: DirectionalLight;
  /** 按岛屿包围球收紧阴影相机；只在布局变化时调用。 */
  fitToBounds(center: readonly [number, number, number], radius: number): void;
  /** 档位变化（运行时降档）时更新阴影贴图尺寸 / 半径。 */
  applyCaps(caps: TierCaps): void;
  /** RenderSpec.lighting 变化时更新灯光。 */
  applyLighting(lighting: LightingSpec): void;
  dispose(): void;
};

export function createLightingRig(scene: Scene, lighting: LightingSpec, caps: TierCaps): LightingRig {
  const sun = new DirectionalLight();
  sun.name = "gd:sun";
  sun.castShadow = lighting.shadow.enabled;
  sun.shadow.bias = SCENE_TOKENS.shadow.bias;
  sun.shadow.normalBias = SCENE_TOKENS.shadow.normalBias;
  const target = new Object3D();
  target.name = "gd:sun-target";
  sun.target = target;

  const hemisphere = new HemisphereLight();
  hemisphere.name = "gd:hemisphere";

  // fill + rim: no castShadow so contact-shadow blobs (T079/T081) stay authoritative
  const fill = new DirectionalLight();
  fill.name = "gd:fill";
  fill.castShadow = false;
  const fillTarget = new Object3D();
  fillTarget.name = "gd:fill-target";
  fill.target = fillTarget;

  const rim = new DirectionalLight();
  rim.name = "gd:rim";
  rim.castShadow = false;
  const rimTarget = new Object3D();
  rimTarget.name = "gd:rim-target";
  rim.target = rimTarget;

  scene.add(sun, target, hemisphere, fill, fillTarget, rim, rimTarget);

  let current = lighting;
  let currentCaps = caps;
  let center: readonly [number, number, number] = [0, 0, 0];
  let radius = 4;

  const placeLayer = (
    light: DirectionalLight,
    layerTarget: Object3D,
    layer: { azimuthDeg: number; elevationDeg: number } | undefined,
    distance: number,
  ) => {
    layerTarget.position.set(center[0], center[1], center[2]);
    if (!layer || light.intensity <= 0) {
      light.position.set(center[0], center[1] + distance, center[2]);
      layerTarget.updateMatrixWorld();
      light.updateMatrixWorld();
      return;
    }
    const dir = sunDirection(layer.azimuthDeg, layer.elevationDeg);
    light.position.set(
      center[0] + dir[0] * distance,
      center[1] + dir[1] * distance,
      center[2] + dir[2] * distance,
    );
    layerTarget.updateMatrixWorld();
    light.updateMatrixWorld();
  };

  const place = () => {
    const frustum = shadowFrustumForBounds(radius, current.sun);
    target.position.set(center[0], center[1], center[2]);
    sun.position.set(
      center[0] + frustum.lightOffset[0],
      center[1] + frustum.lightOffset[1],
      center[2] + frustum.lightOffset[2],
    );
    const camera = sun.shadow.camera;
    camera.left = -frustum.half;
    camera.right = frustum.half;
    camera.top = frustum.half;
    camera.bottom = -frustum.half;
    camera.near = frustum.near;
    camera.far = frustum.far;
    camera.updateProjectionMatrix();
    target.updateMatrixWorld();
    sun.updateMatrixWorld();
    const dist = Math.max(6, radius * 2.4);
    placeLayer(fill, fillTarget, current.fill, dist);
    placeLayer(rim, rimTarget, current.rim, dist * 1.1);
  };

  const applyCaps = (next: TierCaps) => {
    currentCaps = next;
    const size = next.shadowMapSize;
    if (sun.shadow.mapSize.x !== size) {
      sun.shadow.mapSize.set(size, size);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
    sun.shadow.radius = shadowRadiusFor(next.id, next.shadowRadius, current.shadow.softness);
  };

  const applyLighting = (next: LightingSpec) => {
    // clamp key/fill/rim/hemi so HARD high-key cannot wash board or crush chrome
    const playable = clampPlayableLighting(next);
    current = playable;
    sun.color.set(playable.sun.color);
    sun.intensity = playable.sun.intensity;
    sun.castShadow = playable.shadow.enabled;
    hemisphere.color.set(playable.hemisphere.sky);
    hemisphere.groundColor.set(playable.hemisphere.ground);
    hemisphere.intensity = playable.hemisphere.intensity;
    if (playable.fill) {
      fill.color.set(playable.fill.color);
      fill.intensity = playable.fill.intensity;
      fill.visible = playable.fill.intensity > 0;
    } else {
      fill.intensity = 0;
      fill.visible = false;
    }
    if (playable.rim) {
      rim.color.set(playable.rim.color);
      rim.intensity = playable.rim.intensity;
      rim.visible = playable.rim.intensity > 0;
    } else {
      rim.intensity = 0;
      rim.visible = false;
    }
    applyCaps(currentCaps);
    place();
  };

  applyLighting(lighting);

  return {
    sun,
    hemisphere,
    fill,
    rim,
    fitToBounds(nextCenter, nextRadius) {
      center = nextCenter;
      radius = nextRadius;
      place();
    },
    applyCaps,
    applyLighting,
    dispose() {
      sun.shadow.dispose();
      scene.remove(sun, target, hemisphere, fill, fillTarget, rim, rimTarget);
      sun.dispose();
      hemisphere.dispose();
      fill.dispose();
      rim.dispose();
    },
  };
}

/** RoomEnvironment → PMREM（只在 high 档开环境反射，§4.7）。 */
export function createRoomEnvironment(renderer: WebGLRenderer): { texture: Texture; dispose(): void } {
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const target = pmrem.fromScene(room, SCENE_TOKENS.environment.pmremSigma);
  room.dispose();
  pmrem.dispose();
  return {
    texture: target.texture,
    dispose() {
      target.dispose();
    },
  };
}

const SKY_VERTEX = /* glsl */ `
varying vec3 vGdDir;
void main() {
  vGdDir = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_Position.z = gl_Position.w; // 永远画在最远处
}
`;

const SKY_FRAGMENT = /* glsl */ `
uniform vec3 uGdTop;
uniform vec3 uGdHorizon;
uniform vec3 uGdBottom;
uniform float uGdExponent;
varying vec3 vGdDir;
void main() {
  float h = vGdDir.y;
  vec3 color = h >= 0.0
    ? mix(uGdHorizon, uGdTop, pow(clamp(h, 0.0, 1.0), uGdExponent))
    : mix(uGdHorizon, uGdBottom, clamp(-h * 3.0, 0.0, 1.0));
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** §5.5 S-01：程序化渐变天空穹顶（0 B 资源，1 次 draw）。
 *  Optional `colors` override (Tidewell sea gradient — avoids light letterbox band). */
export function createSkyDome(colors?: {
  top?: string;
  horizon?: string;
  bottom?: string;
  exponent?: number;
}): Mesh {
  const sky = SCENE_TOKENS.sky;
  const geometry = new SphereGeometry(sky.radius, 24, 12);
  const material = new ShaderMaterial({
    name: "gd:sky",
    uniforms: {
      uGdTop: { value: new Color(colors?.top ?? sky.top) },
      uGdHorizon: { value: new Color(colors?.horizon ?? sky.horizon) },
      uGdBottom: { value: new Color(colors?.bottom ?? sky.bottom) },
      uGdExponent: { value: colors?.exponent ?? sky.exponent },
    },
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    side: BackSide,
    depthWrite: false,
    // 天空颜色已是目标观感，不再走 AgX，避免发灰。
    toneMapped: false,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = "gd:sky";
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  mesh.userData.kind = "sky";
  return mesh;
}
