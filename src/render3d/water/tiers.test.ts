import { describe, expect, it } from "vitest";
import { waterFeaturesFor } from "./tiers";

describe("waterFeaturesFor shoreFoam / shoreWave", () => {
  it("high has strong shore foam + shore wave; medium faint; low off", () => {
    expect(waterFeaturesFor("high").shoreFoam).toBe(1);
    expect(waterFeaturesFor("high").shoreWave).toBe(1);
    expect(waterFeaturesFor("medium").shoreFoam).toBeGreaterThan(0);
    expect(waterFeaturesFor("medium").shoreFoam).toBeGreaterThan(0.5); // T266
    expect(waterFeaturesFor("medium").shoreWave).toBeGreaterThan(0);
    expect(waterFeaturesFor("medium").shoreWave).toBeLessThan(0.5);
    expect(waterFeaturesFor("low").shoreFoam).toBeGreaterThan(0); // T266
    expect(waterFeaturesFor("low").shoreWave).toBeGreaterThan(0); // T266
  });
});
