import { describe, expect, it } from "vitest";
import { ASSET_MANIFEST, expectedLicenseRowCount, listManifestIds } from "./manifest";
describe("ASSET_MANIFEST (23+26+27)", () => {
  it("unions parchment, sfx, music", () => {
    const ids = ASSET_MANIFEST.map(e=>e.id);
    expect(ids).toContain("audio/sfx-core");
    expect(ids).toContain("music/tide-harbor");
    expect(expectedLicenseRowCount()).toBe(listManifestIds().length);
  });
});
