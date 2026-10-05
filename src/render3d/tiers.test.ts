import { describe, expect, it } from "vitest";
import {
  autoDetectTier,
  downgradeTier,
  effectiveSaverOn,
  resolveTier,
  type DetectEnv,
} from "./tiers";

const desktopHigh: DetectEnv = {
  pointerCoarse: false,
  hardwareConcurrency: 8,
  deviceMemoryGb: 8,
  maxTextureSize: 8192,
  preferMobileSaver: false,
};

const mobile: DetectEnv = {
  pointerCoarse: true,
  hardwareConcurrency: 8,
  deviceMemoryGb: 8,
  maxTextureSize: 4096,
  preferMobileSaver: true,
};

const weakDesktop: DetectEnv = {
  pointerCoarse: false,
  hardwareConcurrency: 4,
  deviceMemoryGb: 8,
  maxTextureSize: 8192,
  preferMobileSaver: false,
};

const lowMem: DetectEnv = {
  pointerCoarse: false,
  hardwareConcurrency: 8,
  deviceMemoryGb: 4,
  maxTextureSize: 8192,
  preferMobileSaver: false,
};

describe("G3D-06 tier auto-detect (SPEC §4.7)", () => {
  it("detects high on fine pointer + ≥8 cores + MAX_TEXTURE_SIZE ≥ 8192", () => {
    expect(autoDetectTier(desktopHigh)).toBe("high");
  });

  it("falls to medium when fine pointer but not high-capable", () => {
    expect(
      autoDetectTier({ ...desktopHigh, hardwareConcurrency: 6, maxTextureSize: 4096 }),
    ).toBe("medium");
  });

  it("hardwareConcurrency ≤ 4 forces low", () => {
    expect(autoDetectTier(weakDesktop)).toBe("low");
  });

  it("deviceMemory ≤ 4 forces low", () => {
    expect(autoDetectTier(lowMem)).toBe("low");
  });

  it("coarse pointer auto-detects low", () => {
    expect(autoDetectTier(mobile)).toBe("low");
  });
});

describe("G3D-06 resolveTier", () => {
  it("honors ?tier= override", () => {
    const r = resolveTier({ search: "?tier=medium", env: desktopHigh, quality: "auto", saver: "auto" });
    expect(r.tier).toBe("medium");
    expect(r.source).toBe("query");
  });

  it("EP-I / mobile saver=auto → low", () => {
    const r = resolveTier({ search: "", env: mobile, quality: "auto", saver: "auto" });
    expect(r.tier).toBe("low");
    expect(r.saverEffective).toBe(true);
  });

  it("mobile saver=off uses quality preference or auto (medium if not high-capable)", () => {
    const r = resolveTier({ search: "", env: mobile, quality: "auto", saver: "off" });
    // coarse still makes autoDetect low even with saver off
    expect(r.tier).toBe("low");
  });

  it("desktop saver=auto does not force low; auto-detects high", () => {
    expect(effectiveSaverOn("auto", false)).toBe(false);
    const r = resolveTier({ search: "", env: desktopHigh, quality: "auto", saver: "auto" });
    expect(r.tier).toBe("high");
    expect(r.source).toBe("auto");
  });

  it("settings quality=medium when saver off", () => {
    const r = resolveTier({ search: "", env: desktopHigh, quality: "medium", saver: "off" });
    expect(r.tier).toBe("medium");
    expect(r.source).toBe("settings");
  });

  it("runtime floor never upgrades", () => {
    const r = resolveTier({
      search: "?tier=high",
      env: desktopHigh,
      runtimeFloor: "medium",
    });
    expect(r.tier).toBe("medium");
    expect(r.source).toBe("runtime-downgrade");
  });

  it("downgradeTier steps down once", () => {
    expect(downgradeTier("high")).toBe("medium");
    expect(downgradeTier("medium")).toBe("low");
    expect(downgradeTier("low")).toBe("low");
  });
});
