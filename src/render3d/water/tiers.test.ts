import { describe, expect, it } from "vitest";
import { waterFeaturesFor } from "./tiers";

describe("waterFeaturesFor shoreFoam", () => {
  it("high has strong shore foam; medium faint; low off", () => {
    expect(waterFeaturesFor("high").shoreFoam).toBe(1);
    expect(waterFeaturesFor("medium").shoreFoam).toBeGreaterThan(0);
    expect(waterFeaturesFor("medium").shoreFoam).toBeLessThan(0.5);
    expect(waterFeaturesFor("low").shoreFoam).toBe(0);
  });
});
