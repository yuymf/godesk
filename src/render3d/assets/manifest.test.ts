import { describe, expect, it } from "vitest";
import {
  ASSET_MANIFEST,
  expectedLicenseRowCount,
  listManifestIds,
} from "./manifest";

describe("ASSET_MANIFEST union", () => {
  it("keeps license row parity and known ids", () => {
    const ids = ASSET_MANIFEST.map((e) => e.id);
    expect(ids.length).toBeGreaterThan(10);
    expect(ids).toContain("font/manrope");
    expect(expectedLicenseRowCount()).toBe(listManifestIds().length);
  });
});
