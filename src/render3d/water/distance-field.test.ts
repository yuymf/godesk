import { describe, expect, it } from "vitest";
import {
  buildCoastDistanceField,
  buildLandMask,
  computeCoastDistance,
  distanceTransform1D,
} from "./distance-field";

describe("distanceTransform1D", () => {
  it("keeps zeros and rises away from seeds", () => {
    const n = 5;
    const f = new Float64Array([1e20, 1e20, 0, 1e20, 1e20]);
    const out = new Float64Array(n);
    distanceTransform1D(f, n, out);
    expect(out[2]).toBe(0);
    expect(out[1]).toBe(1);
    expect(out[3]).toBe(1);
    expect(out[0]).toBe(4);
    expect(out[4]).toBe(4);
  });
});

describe("coast distance field", () => {
  it("marks hex centres as land and rises offshore", () => {
    const size = 64;
    const half = 8;
    const coasts = [{ x: 0, z: 0, radius: 1 }];
    const mask = buildLandMask(size, half, coasts);
    const mid = (size / 2) * size + size / 2;
    expect(mask[mid]).toBe(1);
    expect(mask[0]).toBe(0);

    const dist = computeCoastDistance(mask, size);
    expect(dist[mid]!).toBe(0);
    expect(dist[0]!).toBeGreaterThan(10);

    const field = buildCoastDistanceField(coasts, size, half);
    expect(field.data[mid]!).toBe(0);
    expect(field.data[0]!).toBeGreaterThan(0.5);
    expect(field.elapsedMs).toBeLessThan(60);
  });
});
