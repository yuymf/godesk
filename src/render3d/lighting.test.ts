import { describe, expect, it } from "vitest";
import { AgXToneMapping, DirectionalLight, HemisphereLight, PCFShadowMap, Scene, SRGBColorSpace, ShaderMaterial } from "three";
import { configureRenderer, createLightingRig, createSkyDome } from "./lighting";
import { TIER_CAPS } from "./tiers";
import { SCENE_TOKENS, shadowFrustumForBounds } from "./tokens";

describe("G3D-07 lighting rig", () => {
  it("configures AgX tone mapping, exposure, sRGB output and PCF shadows", () => {
    const renderer = { toneMapping: 0, toneMappingExposure: 0, outputColorSpace: "", shadowMap: { enabled: false, type: -1 } };
    configureRenderer(renderer as never, { ...SCENE_TOKENS.lighting, exposure: 1.2 });
    expect(renderer.toneMapping).toBe(AgXToneMapping);
    expect(renderer.toneMappingExposure).toBe(1.2);
    expect(renderer.outputColorSpace).toBe(SRGBColorSpace);
    expect(renderer.shadowMap).toEqual({ enabled: true, type: PCFShadowMap });
  });

  it("builds sun + hemisphere from tokens and scales shadows per tier", () => {
    const scene = new Scene();
    const rig = createLightingRig(scene, SCENE_TOKENS.lighting, TIER_CAPS.high);
    expect(rig.sun).toBeInstanceOf(DirectionalLight);
    expect(rig.hemisphere).toBeInstanceOf(HemisphereLight);
    expect(rig.sun.intensity).toBe(2.6);
    expect(rig.sun.color.getHexString()).toBe(new DirectionalLight("#fff4e0").color.getHexString());
    expect(rig.hemisphere.intensity).toBe(0.7);
    expect(rig.sun.castShadow).toBe(true);
    expect(rig.sun.shadow.mapSize.x).toBe(2048);
    expect(rig.sun.shadow.radius).toBe(4);
    expect(rig.sun.shadow.bias).toBe(-0.0004);
    expect(rig.sun.shadow.normalBias).toBe(0.02);
    rig.applyCaps(TIER_CAPS.medium);
    expect(rig.sun.shadow.mapSize.x).toBe(1024);
    expect(rig.sun.shadow.radius).toBe(4);
    rig.applyCaps(TIER_CAPS.low);
    expect(rig.sun.shadow.mapSize.x).toBe(512);
    expect(rig.sun.shadow.radius).toBe(1);
    rig.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it("fits the orthographic shadow camera to the island once per layout", () => {
    const scene = new Scene();
    const rig = createLightingRig(scene, SCENE_TOKENS.lighting, TIER_CAPS.high);
    rig.fitToBounds([1, 0, -1], 4.4);
    const expected = shadowFrustumForBounds(4.4, SCENE_TOKENS.lighting.sun);
    const camera = rig.sun.shadow.camera;
    expect(camera.right).toBeCloseTo(expected.half);
    expect(camera.left).toBeCloseTo(-expected.half);
    expect(camera.near).toBeCloseTo(expected.near);
    expect(camera.far).toBeCloseTo(expected.far);
    expect(rig.sun.target.position.toArray()).toEqual([1, 0, -1]);
    expect(rig.sun.position.x).toBeCloseTo(1 + expected.lightOffset[0]);
    rig.dispose();
  });

  it("applies RenderSpec.lighting changes (G3D-15 configure_render)", () => {
    const scene = new Scene();
    const rig = createLightingRig(scene, SCENE_TOKENS.lighting, TIER_CAPS.medium);
    rig.applyLighting({ ...SCENE_TOKENS.lighting, sun: { ...SCENE_TOKENS.lighting.sun, intensity: 1.5 }, shadow: { enabled: false, softness: 1 } });
    expect(rig.sun.intensity).toBe(1.5);
    expect(rig.sun.castShadow).toBe(false);
    expect(rig.sun.shadow.radius).toBe(7);
    rig.dispose();
  });

  it("draws a procedural gradient sky dome in one draw, behind everything", () => {
    const sky = createSkyDome();
    expect(sky.material).toBeInstanceOf(ShaderMaterial);
    const material = sky.material as ShaderMaterial;
    expect(material.depthWrite).toBe(false);
    expect(material.fragmentShader).toContain("#include <colorspace_fragment>");
    expect(sky.castShadow).toBe(false);
    expect(sky.receiveShadow).toBe(false);
    expect(sky.frustumCulled).toBe(false);
    sky.geometry.dispose();
    material.dispose();
  });
});
