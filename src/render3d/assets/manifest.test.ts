import { describe, expect, it } from "vitest";
import { ASSET_MANIFEST, expectedLicenseRowCount, listManifestIds } from "./manifest";
describe("ASSET_MANIFEST G3D-20", () => {
  it("registers pieces.glb under 200KB", () => {
    const p = ASSET_MANIFEST.find((e) => e.id === "model/pieces");
    expect(p).toBeTruthy();
    expect(p!.bytes).toBeLessThanOrEqual(200 * 1024);
    expect(ASSET_MANIFEST.some((e) => e.id === "model/sheep")).toBe(true);
    expect(expectedLicenseRowCount()).toBe(listManifestIds().length);
  });
});
