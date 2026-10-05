import { describe, expect, it } from "vitest";
import { ASSET_MANIFEST } from "../render3d/assets/manifest";
import {
  clearedRenderAssetCount,
  isClearedRenderAsset,
} from "./render-asset-registry";

describe("render-asset-registry (G3D-11 wiring)", () => {
  it("exposes cleared ids from ASSET_MANIFEST only", () => {
    expect(clearedRenderAssetCount()).toBe(
      ASSET_MANIFEST.filter((e) => e.license.status === "cleared").length,
    );
    for (const entry of ASSET_MANIFEST) {
      expect(isClearedRenderAsset(entry.id)).toBe(entry.license.status === "cleared");
    }
    expect(isClearedRenderAsset("not-a-real-asset")).toBe(false);
  });
});
