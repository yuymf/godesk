import { describe, expect, it } from "vitest";
import {
  ASSET_MANIFEST,
  expectedLicenseRowCount,
  listManifestIds,
} from "./manifest";

describe("ASSET_MANIFEST (G3D-23/24/25/26/27)", () => {
  it("includes parchment, cards, brand, sfx, music", () => {
    const ids = ASSET_MANIFEST.map((e) => e.id);
    expect(ids).toContain("font/fraunces-display");
    expect(ids).toContain("audio/sfx-core");
    expect(ids).toContain("music/tide-harbor");
    expect(ids).toContain("illustration/resource-wood");
    expect(ids).toContain("illustration/seat-0");
    expect(ids).toContain("illustration/island-flourish");
    expect(ids).toContain("illustration/loading-tidewell");
    expect(expectedLicenseRowCount()).toBe(listManifestIds().length);
  });
});
