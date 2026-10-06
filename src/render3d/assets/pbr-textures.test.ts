import { describe, expect, it } from "vitest";
import { bundledPbrSets, pbrSetUrls, pickPbrUrls } from "./pbr-textures";

describe("G3D-07 PBR texture table (G3D-22 KTX2 set)", () => {
  it("bundles all 11 G3D-22 sets", () => {
    expect(bundledPbrSets()).toEqual([
      "t01-pine", "t02-clay", "t03-meadow", "t04-wheat", "t05-reef", "t06-sand",
      "t07-cliff", "t08-wood", "t09-paintwood", "t10-canvas", "t11-parchment",
    ]);
  });

  it("resolves baseColor / normal / ORM for both resolutions", () => {
    for (const resolution of [512, 256] as const) {
      const urls = pbrSetUrls("t03-meadow", resolution);
      expect(urls).not.toBeNull();
      expect(urls!.baseColor).toMatch(/baseColor/);
      expect(urls!.normal).toMatch(/normal/);
      expect(urls!.orm).toMatch(/orm/);
    }
  });

  it("returns null when a map is missing", () => {
    const urls = {
      "/assets/textures/pbr/t01-pine/512/baseColor.ktx2": "a",
      "/assets/textures/pbr/t01-pine/512/normal.ktx2": "b",
    };
    expect(pbrSetUrls("t01-pine", 512, urls)).toBeNull();
    expect(pbrSetUrls("t01-pine", 256, urls)).toBeNull();
  });

  it("low reuses an already-downloaded 512 set after a runtime downgrade instead of fetching 256", () => {
    const urls = {
      "/assets/textures/pbr/t01-pine/512/baseColor.ktx2": "p512-b",
      "/assets/textures/pbr/t01-pine/512/normal.ktx2": "p512-n",
      "/assets/textures/pbr/t01-pine/512/orm.ktx2": "p512-o",
      "/assets/textures/pbr/t01-pine/256/baseColor.ktx2": "p256-b",
      "/assets/textures/pbr/t01-pine/256/normal.ktx2": "p256-n",
      "/assets/textures/pbr/t01-pine/256/orm.ktx2": "p256-o",
    };
    const nothing = () => false;
    expect(pickPbrUrls("t01-pine", 256, nothing, urls)).toEqual({
      urls: { baseColor: "p256-b", normal: "p256-n", orm: "p256-o" }, resolution: 256,
    });
    const all512 = (url: string) => url.startsWith("p512");
    expect(pickPbrUrls("t01-pine", 256, all512, urls)?.resolution).toBe(512);
    const partial = (url: string) => url === "p512-b";
    expect(pickPbrUrls("t01-pine", 256, partial, urls)?.resolution).toBe(256);
    expect(pickPbrUrls("t01-pine", 512, nothing, urls)?.urls.orm).toBe("p512-o");
  });
});
