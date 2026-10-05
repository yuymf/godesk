import { describe, expect, it } from "vitest";
import {
  ASSET_MANIFEST,
  expectedLicenseRowCount,
  listManifestIds,
} from "./manifest";

describe("ASSET_MANIFEST (G3D-23/24/26/27)", () => {
  it("includes parchment UI, cards, sfx, music", () => {
    const ids = ASSET_MANIFEST.map((e) => e.id);
    expect(ids).toContain("font/manrope");
    expect(ids).toContain("font/fraunces-display");
    expect(ids).toContain("ui/paper-noise");
    expect(ids).toContain("audio/sfx-core");
    expect(ids).toContain("music/tide-harbor");
    for (const kind of ["wood", "brick", "sheep", "wheat", "ore"]) {
      expect(ids).toContain(`illustration/resource-${kind}`);
    }
    for (const kind of ["fog-signal", "tide-plenty", "harbor-charter"]) {
      expect(ids).toContain(`illustration/dev-${kind}`);
    }
    expect(expectedLicenseRowCount()).toBe(listManifestIds().length);
    for (const e of ASSET_MANIFEST.filter((x) => x.id.startsWith("illustration/resource-"))) {
      expect(e.bytes).toBeLessThanOrEqual(40 * 1024);
    }
    for (const e of ASSET_MANIFEST.filter((x) => x.id.startsWith("illustration/dev-"))) {
      expect(e.bytes).toBeLessThanOrEqual(60 * 1024);
    }
  });
});
