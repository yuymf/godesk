import { describe, expect, it } from "vitest";
import {
  ASSET_MANIFEST,
  expectedLicenseRowCount,
  listManifestIds,
  LICENSE_SPDX_WHITELIST,
} from "./manifest";

describe("ASSET_MANIFEST (G3D-11 bootstrap)", () => {
  it("registers baseline font + mark and keeps whitelist", () => {
    expect(ASSET_MANIFEST.map((e) => e.id).sort()).toEqual([
      "font/manrope",
      "ui/godesk-mark",
    ]);
    expect(listManifestIds().length).toBe(2);
    expect(expectedLicenseRowCount()).toBe(2);
    expect(ASSET_MANIFEST.every((e) => e.license.status === "cleared")).toBe(true);
    expect(LICENSE_SPDX_WHITELIST).toContain("CC0-1.0");
    expect(LICENSE_SPDX_WHITELIST).toContain("OFL-1.1");
    expect(LICENSE_SPDX_WHITELIST).toContain("LicenseRef-GoDesk-Original");
  });
});
