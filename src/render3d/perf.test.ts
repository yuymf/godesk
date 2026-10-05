import { describe, expect, it } from "vitest";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from "three";
import { estimateGpuMemoryBytes, percentile, perfModeEnabled, requestedTier, WARMUP_FRAMES } from "./perf";

describe("perf probe helpers (G3D-05, SPEC §4.6.3)", () => {
  it("enables perf mode only for ?perf=1 / ?perf=true", () => {
    expect(perfModeEnabled("?perf=1")).toBe(true);
    expect(perfModeEnabled("?share=x&perf=true")).toBe(true);
    expect(perfModeEnabled("")).toBe(false);
    expect(perfModeEnabled("?perf=0")).toBe(false);
  });

  it("reads ?tier= and defaults to high until G3D-06 adds automatic tiering", () => {
    expect(requestedTier("?tier=low")).toEqual({ tier: "low", source: "query" });
    expect(requestedTier("?tier=medium")).toEqual({ tier: "medium", source: "query" });
    expect(requestedTier("?tier=ultra")).toEqual({ tier: "high", source: "default" });
    expect(requestedTier("")).toEqual({ tier: "high", source: "default" });
  });

  it("uses nearest-rank percentiles", () => {
    const samples = Array.from({ length: 100 }, (_, index) => index + 1);
    expect(percentile(samples, 50)).toBe(50);
    expect(percentile(samples, 95)).toBe(95);
    expect(percentile([16.7], 95)).toBe(16.7);
    expect(percentile([], 50)).toBeNull();
  });

  it("discards the first 180 frames as warm-up", () => {
    expect(WARMUP_FRAMES).toBe(180);
  });

  it("estimates GPU memory from shared geometries once, plus extra texture bytes", () => {
    const geometry = new BoxGeometry(1, 1, 1);
    const material = new MeshStandardMaterial();
    const root = new Group();
    root.add(new Mesh(geometry, material), new Mesh(geometry, material));
    const attributeBytes = Object.values(geometry.attributes).reduce((sum, attribute) => sum + attribute.array.byteLength, 0);
    const indexBytes = geometry.index?.array.byteLength ?? 0;
    expect(estimateGpuMemoryBytes(root)).toBe(attributeBytes + indexBytes);
    expect(estimateGpuMemoryBytes(root, 4096)).toBe(attributeBytes + indexBytes + 4096);
  });
});
