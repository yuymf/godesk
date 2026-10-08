import { describe, expect, it } from "vitest";
import { MeshPhysicalMaterial, MeshStandardMaterial, Texture } from "three";
import {
  MaterialLibrary,
  PATTERN_IDS,
  PATTERN_STRENGTH_WITH_PBR,
  createMaterial,
  installPattern,
} from "./materials";
import { PROP_MATERIALS, TERRAIN_MATERIALS, seatMaterial } from "./tokens";
import type { MaterialToken } from "./tokens";

/** Glossy fixture — seats dropped clearcoat in round-6tex (anti-plastic). */
const GLOSSY_SEAT: MaterialToken = {
  ...seatMaterial(0),
  roughness: 0.5,
  clearcoat: 0.12,
  pbrBaseColor: false,
};

function compile(material: MeshStandardMaterial) {
  const shader = {
    uniforms: {} as Record<string, { value: unknown }>,
    vertexShader: "#include <common>\nvoid main() {\n#include <project_vertex>\n}",
    fragmentShader: "#include <common>\nvoid main() {\n#include <color_fragment>\n#include <roughnessmap_fragment>\n}",
  };
  material.onBeforeCompile(shader as never, undefined as never);
  return shader;
}

function maps() {
  return { map: new Texture(), normalMap: new Texture(), ormMap: new Texture() };
}

describe("G3D-07 materials", () => {
  it("injects a world-space procedural pattern per pattern id and shares programs by pattern", () => {
    const material = new MeshStandardMaterial();
    const strength = installPattern(material, "grass");
    expect(material.defines?.GD_PATTERN).toBe(PATTERN_IDS.grass);
    expect(material.customProgramCacheKey()).toBe("gd-pattern-4");
    const shader = compile(material);
    expect(shader.uniforms.uGdPattern).toBe(strength);
    expect(shader.vertexShader).toContain("vGdWorld = (modelMatrix * gdWorld).xyz;");
    expect(shader.fragmentShader).toContain("float gdP = gdPattern(vGdWorld);");
    expect(shader.fragmentShader).toContain("roughnessFactor = clamp(roughnessFactor + (gdP - 0.5)");
    const plain = new MeshStandardMaterial();
    expect(installPattern(plain, "none").value).toBe(0);
    expect(plain.defines?.GD_PATTERN).toBeUndefined();
  });

  it("uses MeshPhysicalMaterial clearcoat only when the tier allows it", () => {
    const high = createMaterial(GLOSSY_SEAT, { clearcoat: true });
    expect(high).toBeInstanceOf(MeshPhysicalMaterial);
    expect((high as MeshPhysicalMaterial).clearcoat).toBeCloseTo(0.12);
    const medium = createMaterial(GLOSSY_SEAT, { clearcoat: false });
    expect(medium).not.toBeInstanceOf(MeshPhysicalMaterial);
    expect(medium.roughness).toBeCloseTo(0.5);
    // Round-6tex seats: matte wood, no clearcoat even on high tier.
    const matte = createMaterial(seatMaterial(0), { clearcoat: true });
    expect(matte).not.toBeInstanceOf(MeshPhysicalMaterial);
    expect(createMaterial(TERRAIN_MATERIALS.wood!, { clearcoat: true })).not.toBeInstanceOf(MeshPhysicalMaterial);
  });

  it("shares one material per key and lists the PBR sets in use", () => {
    const library = new MaterialLibrary({ clearcoat: false });
    const a = library.get("terrain-wood", TERRAIN_MATERIALS.wood!);
    const b = library.get("terrain-wood", TERRAIN_MATERIALS.wood!);
    expect(a).toBe(b);
    expect(a.userData.gdShared).toBe(true);
    library.get("seat-0", seatMaterial(0));
    library.get("seat-1", seatMaterial(1));
    library.get("robber", PROP_MATERIALS.robber);
    expect(library.size).toBe(4);
    expect(library.pbrSetsInUse()).toEqual(["t01-pine", "t09-paintwood"]);
  });

  it("streams PBR maps into every material of a set; seat pieces multiply wood albedo", () => {
    const library = new MaterialLibrary({ clearcoat: false });
    const wood = library.get("terrain-wood", TERRAIN_MATERIALS.wood!);
    const seat = library.get("seat-0", seatMaterial(0));
    const woodMaps = maps();
    expect(library.applyPbrSet("t01-pine", woodMaps)).toBe(1);
    expect(wood.map).toBe(woodMaps.map);
    expect(wood.normalMap).toBe(woodMaps.normalMap);
    expect(wood.aoMap).toBe(woodMaps.ormMap);
    expect(wood.roughnessMap).toBe(woodMaps.ormMap);
    expect(wood.metalnessMap).toBe(woodMaps.ormMap);
    expect((wood.userData.gdPatternStrength as { value: number }).value).toBe(PATTERN_STRENGTH_WITH_PBR);
    const seatMaps = maps();
    library.applyPbrSet("t09-paintwood", seatMaps);
    // Round-6tex: wood albedo on (multiplies with vertex / seat colour).
    expect(seat.map).toBe(seatMaps.map);
    expect(seat.normalMap).toBe(seatMaps.normalMap);
    const late = library.get("terrain-wood-2", TERRAIN_MATERIALS.wood!);
    expect(late.map).toBe(woodMaps.map);
  });

  it("disposes shared materials and streamed textures exactly once on teardown", () => {
    const library = new MaterialLibrary({ clearcoat: true });
    const material = library.get("seat-0", seatMaterial(0));
    const set = maps();
    library.applyPbrSet("t09-paintwood", set);
    let materialDisposed = 0;
    let texturesDisposed = 0;
    material.addEventListener("dispose", () => { materialDisposed += 1; });
    for (const texture of [set.map, set.normalMap, set.ormMap]) texture.addEventListener("dispose", () => { texturesDisposed += 1; });
    library.dispose();
    expect(materialDisposed).toBe(1);
    expect(texturesDisposed).toBe(3);
    const late = maps();
    let lateDisposed = 0;
    for (const texture of [late.map, late.normalMap, late.ormMap]) texture.addEventListener("dispose", () => { lateDisposed += 1; });
    expect(library.applyPbrSet("t01-pine", late)).toBe(0);
    expect(lateDisposed).toBe(3);
  });

  it("drops clearcoat when a runtime downgrade leaves high", () => {
    const library = new MaterialLibrary({ clearcoat: true });
    const seat = library.get("glossy-0", GLOSSY_SEAT) as MeshPhysicalMaterial;
    expect(seat.clearcoat).toBeCloseTo(0.12);
    library.setClearcoat(false);
    expect(seat.clearcoat).toBe(0);
  });
});

describe("G3D-07 environment reflections", () => {
  it("puts the RoomEnvironment on glossy materials only, so tile shadows stay readable", () => {
    const library = new MaterialLibrary({ clearcoat: true });
    const tile = library.get("terrain-wood", TERRAIN_MATERIALS.wood!);
    const glossy = library.get("glossy-0", GLOSSY_SEAT);
    const env = new Texture();
    library.setEnvironment(env, 0.2);
    expect(glossy.envMap).toBe(env);
    expect(glossy.envMapIntensity).toBe(0.2);
    expect(tile.envMap).toBeNull();
    const robber = library.get("robber", PROP_MATERIALS.robber);
    expect(robber.envMap).toBeNull();
    library.setEnvironment(null, 0);
    expect(glossy.envMap).toBeNull();
  });

  it("R18 oil brush layer only on terrain tiles (brush > 0): own program, AA-faded dabs", () => {
    const tile = createMaterial(TERRAIN_MATERIALS.sheep!, { clearcoat: false });
    expect(tile.defines?.GD_BRUSH).toBe(1);
    expect(tile.customProgramCacheKey()).toBe("gd-pattern-4-brush");
    const shader = compile(tile);
    expect(shader.uniforms.uGdBrush).toEqual({ value: TERRAIN_MATERIALS.sheep!.brush });
    expect(shader.fragmentShader).toContain("vec3 gdB = gdBrushStroke(vGdWorld);");
    expect(shader.fragmentShader).toContain("fwidth(g)");
    const cliff = createMaterial(PROP_MATERIALS.cliff, { clearcoat: false });
    expect(cliff.defines?.GD_BRUSH).toBeUndefined();
    expect(cliff.customProgramCacheKey()).toBe("gd-pattern-3");
    expect(compile(cliff).fragmentShader).not.toContain("gdBrushStroke");
    expect(PATTERN_STRENGTH_WITH_PBR).toBeGreaterThanOrEqual(0.5);
  });
});
