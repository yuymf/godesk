import { describe, expect, it } from "vitest";
import { ASSET_MANIFEST, expectedLicenseRowCount, listManifestIds } from "./manifest";
describe("ASSET_MANIFEST (G3D-19)", () => {
  it("registers decor + sea/foam ktx2 under budgets", () => {
    const ids = ASSET_MANIFEST.map(e => e.id);
    expect(ids).toContain("model/decor");
    expect(ids).toContain("texture/sea-normal");
    expect(ids).toContain("texture/foam-noise");
    expect(ASSET_MANIFEST.find(e=>e.id==="model/decor")!.bytes).toBeLessThanOrEqual(250*1024);
    expect(ASSET_MANIFEST.find(e=>e.id==="texture/sea-normal")!.bytes).toBeLessThanOrEqual(120*1024);
    expect(ASSET_MANIFEST.find(e=>e.id==="texture/foam-noise")!.bytes).toBeLessThanOrEqual(30*1024);
    expect(expectedLicenseRowCount()).toBe(listManifestIds().length);
  });
});
