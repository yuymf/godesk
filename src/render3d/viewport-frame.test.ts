import { describe, expect, it } from "vitest";
import {
  DEFAULT_DESKTOP_FRAME,
  DEFAULT_NARROW_FRAME,
  distanceForIslandFill,
  framePose,
} from "./viewport-frame";

describe("viewport-frame", () => {
  it("zooms closer when fill increases", () => {
    const far = distanceForIslandFill(4.5, 16 / 9, 0.55, 40, 42);
    const near = distanceForIslandFill(4.5, 16 / 9, 0.82, 40, 42);
    expect(near).toBeLessThan(far);
  });

  it("narrow default is more top-down than desktop", () => {
    expect(DEFAULT_NARROW_FRAME.polarDeg).toBeLessThan(DEFAULT_DESKTOP_FRAME.polarDeg);
    expect(DEFAULT_NARROW_FRAME.fill).toBeGreaterThanOrEqual(DEFAULT_DESKTOP_FRAME.fill);
  });

  it("desktop distance is close enough for ~90% height fill", () => {
    // Stage-ish aspect after thinner side rails (~960×684 → ~1.4)
    // R24 polar 54° foreshortens more than 37°, so distance rises a bit vs R23.
    const d = distanceForIslandFill(4.5, 1.4, 0.92, 40, 54);
    expect(d).toBeLessThan(9.5);
    expect(d).toBeGreaterThan(4.5);
  });

  it("framePose returns orbit above the island centre", () => {
    const pose = framePose([0, 0, 0], 4.5, 1.6, { fill: 0.92, polarDeg: 54 });
    expect(pose.position[1]).toBeGreaterThan(2);
    expect(pose.distance).toBeGreaterThan(3);
  });

  it("desktop defaults align settlecoast-like 3/4 (R24)", () => {
    expect(DEFAULT_DESKTOP_FRAME.polarDeg).toBe(54);
    expect(DEFAULT_DESKTOP_FRAME.fovDeg).toBe(40);
    expect(DEFAULT_DESKTOP_FRAME.azimuthDeg).toBeGreaterThanOrEqual(11);
    expect(DEFAULT_DESKTOP_FRAME.azimuthDeg).toBeLessThanOrEqual(14);
    expect(DEFAULT_DESKTOP_FRAME.fill).toBe(0.92);
  });
});
