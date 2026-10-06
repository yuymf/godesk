import { describe, expect, it } from "vitest";
import {
  examplesForHomepage,
  HOMEPAGE_CLASSIC,
  HOMEPAGE_SHOWCASE,
} from "./default-examples";
import { resolveTidewellHomepageFlag } from "./tidewell-feature";

describe("G3D-16 tidewell homepage flag", () => {
  it("defaults off without query or env", () => {
    expect(resolveTidewellHomepageFlag({})).toBe(false);
    expect(examplesForHomepage(false).map((e) => e.id)).toEqual(HOMEPAGE_CLASSIC);
  });

  it("enables via ?tidewell=1 and shows only showcase", () => {
    expect(
      resolveTidewellHomepageFlag({
        searchParams: new URLSearchParams("tidewell=1"),
      }),
    ).toBe(true);
    expect(examplesForHomepage(true).map((e) => e.id)).toEqual(HOMEPAGE_SHOWCASE);
  });

  it("forces classic gallery with ?tidewell=0 even if env is on", () => {
    expect(
      resolveTidewellHomepageFlag({
        searchParams: new URLSearchParams("tidewell=0"),
        envValue: "1",
      }),
    ).toBe(false);
  });

  it("enables via GODESK_FEATURE_TIDEWELL env", () => {
    expect(resolveTidewellHomepageFlag({ envValue: "1" })).toBe(true);
    expect(resolveTidewellHomepageFlag({ envValue: "true" })).toBe(true);
  });
});
