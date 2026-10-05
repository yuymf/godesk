import { describe, expect, it } from "vitest";
import {
  ASSET_MANIFEST,
  expectedLicenseRowCount,
  listManifestIds,
  LICENSE_SPDX_WHITELIST,
} from "./manifest";

describe("ASSET_MANIFEST (G3D-11 + G3D-23)", () => {
  it("registers baseline + UI parchment assets", () => {
    const ids = ASSET_MANIFEST.map((e) => e.id).sort();
    expect(ids).toEqual([
      "font/fraunces-display",
      "font/manrope",
      "ui/godesk-mark",
      "ui/ink-icons",
      "ui/paper-edge-card",
      "ui/paper-edge-panel",
      "ui/paper-noise",
    ].sort());
    expect(listManifestIds().length).toBe(7);
    expect(expectedLicenseRowCount()).toBe(7);
    expect(ASSET_MANIFEST.every((e) => e.license.status === "cleared")).toBe(true);
    expect(LICENSE_SPDX_WHITELIST).toContain("OFL-1.1");
  });
});
