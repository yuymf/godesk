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

  it("desktop distance is close enough for ~80% height fill", () => {
    // Stage-ish aspect after side rails (~920×684 → 1.34)
    const d = distanceForIslandFill(4.5, 1.34, 0.82, 40, 42);
    // 2h3 was ~9.5 with optimistic foreshorten; 2h4 should be clearly closer.
    expect(d).toBeLessThan(8.5);
    expect(d).toBeGreaterThan(5.5);
  });

  it("framePose returns orbit above the island centre", () => {
    const pose = framePose([0, 0, 0], 4.5, 1.6, { fill: 0.82, polarDeg: 42 });
    expect(pose.position[1]).toBeGreaterThan(2);
    expect(pose.distance).toBeGreaterThan(3);
  });
});
