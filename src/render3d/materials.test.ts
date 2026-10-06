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
    const high = createMaterial(seatMaterial(0), { clearcoat: true });
    expect(high).toBeInstanceOf(MeshPhysicalMaterial);
    expect((high as MeshPhysicalMaterial).clearcoat).toBeCloseTo(0.3);
    const medium = createMaterial(seatMaterial(0), { clearcoat: false });
    expect(medium).not.toBeInstanceOf(MeshPhysicalMaterial);
    expect(medium.roughness).toBeCloseTo(0.45);
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

  it("streams PBR maps into every material of a set; seat pieces keep their colour", () => {
    const library = new MaterialLibrary({ clearcoat: false });
    const wood = library.get("terrain-wood", TERRAIN_MATERIALS.wood!);
    const seat = library.get("seat-0", seatMaterial(0));
    const seatColour = seat.color.getHex();
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
    expect(seat.map).toBeNull();
    expect(seat.normalMap).toBe(seatMaps.normalMap);
    expect(seat.color.getHex()).toBe(seatColour);
    // Materials created after the set arrived get it too.
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
    // Late arrivals after teardown are disposed immediately, never applied.
    const late = maps();
    let lateDisposed = 0;
    for (const texture of [late.map, late.normalMap, late.ormMap]) texture.addEventListener("dispose", () => { lateDisposed += 1; });
    expect(library.applyPbrSet("t01-pine", late)).toBe(0);
    expect(lateDisposed).toBe(3);
  });

  it("drops clearcoat when a runtime downgrade leaves high", () => {
    const library = new MaterialLibrary({ clearcoat: true });
    const seat = library.get("seat-0", seatMaterial(0)) as MeshPhysicalMaterial;
    expect(seat.clearcoat).toBeCloseTo(0.3);
    library.setClearcoat(false);
    expect(seat.clearcoat).toBe(0);
  });
});

describe("G3D-07 environment reflections", () => {
  it("puts the RoomEnvironment on glossy materials only, so tile shadows stay readable", () => {
    const library = new MaterialLibrary({ clearcoat: true });
    const tile = library.get("terrain-wood", TERRAIN_MATERIALS.wood!);
    const seat = library.get("seat-0", seatMaterial(0));
    const env = new Texture();
    library.setEnvironment(env, 0.35);
    expect(seat.envMap).toBe(env);
    expect(seat.envMapIntensity).toBe(0.35);
    expect(tile.envMap).toBeNull();
    const robber = library.get("robber", PROP_MATERIALS.robber);
    expect(robber.envMap).toBe(env);
    library.setEnvironment(null, 0);
    expect(seat.envMap).toBeNull();
  });
});
