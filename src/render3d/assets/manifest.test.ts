import { describe, expect, it } from "vitest";
import { ASSET_MANIFEST, expectedLicenseRowCount, listManifestIds } from "./manifest";
describe("ASSET_MANIFEST (G3D-23 + G3D-26)", () => {
  it("has parchment UI and audio sprites", () => {
    const ids = ASSET_MANIFEST.map((e) => e.id);
    expect(ids).toContain("ui/paper-noise");
    expect(ids).toContain("audio/sfx-core");
    expect(ids).toContain("audio/sfx-extended");
    expect(expectedLicenseRowCount()).toBe(listManifestIds().length);
  });
});
