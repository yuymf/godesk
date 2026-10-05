import { describe, expect, it } from "vitest";
import { ASSET_MANIFEST, expectedLicenseRowCount, listManifestIds } from "./manifest";
describe("ASSET_MANIFEST G3D-22", () => {
  it("registers 11 PBR sets under budgets", () => {
    const pbr = ASSET_MANIFEST.filter((e) => e.id.startsWith("texture/t"));
    expect(pbr).toHaveLength(66);
    expect(expectedLicenseRowCount()).toBe(listManifestIds().length);
    const ids = ["t01-pine","t02-clay","t03-meadow","t04-wheat","t05-reef","t06-sand","t07-cliff","t08-wood","t09-paintwood","t10-canvas","t11-parchment"];
    for (const tid of ids) {
      for (const [res, lim] of [[512, 220 * 1024], [256, 70 * 1024]] as const) {
        const total = pbr
          .filter((e) => e.id.startsWith(`texture/${tid}/${res}/`))
          .reduce((a, e) => a + e.bytes, 0);
        expect(total).toBeLessThanOrEqual(lim);
      }
    }
  });
});
