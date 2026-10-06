import { describe, expect, it } from "vitest";
import {
  DEFAULT_DESKTOP_FRAME,
  DEFAULT_NARROW_FRAME,
  distanceForIslandFill,
  framePose,
} from "./viewport-frame";

describe("viewport-frame", () => {
  it("zooms closer when fill increases", () => {
    const far = distanceForIslandFill(4.5, 16 / 9, 0.5, 45, 48);
    const near = distanceForIslandFill(4.5, 16 / 9, 0.8, 45, 48);
    expect(near).toBeLessThan(far);
  });

  it("narrow default is more top-down than desktop", () => {
    expect(DEFAULT_NARROW_FRAME.polarDeg).toBeLessThan(DEFAULT_DESKTOP_FRAME.polarDeg);
    expect(DEFAULT_NARROW_FRAME.fill).toBeGreaterThan(DEFAULT_DESKTOP_FRAME.fill);
  });

  it("framePose returns orbit above the island centre", () => {
    const pose = framePose([0, 0, 0], 4.5, 1.6, { fill: 0.8, polarDeg: 48 });
    expect(pose.position[1]).toBeGreaterThan(2);
    expect(pose.target).toEqual([0, 0, 0]);
    expect(pose.distance).toBeGreaterThan(3);
  });
});
