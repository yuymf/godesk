import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CAMERA_MODE_POLAR_DEG, PLAY_MIN_POLAR_DEG } from "../camera-rig";
import { DEFAULT_DESKTOP_FRAME } from "../viewport-frame";
import { SEAT_COLORS, seatMaterial } from "../tokens";

describe("T265 · polar thickness + seat chrome yield", () => {
  it("raises play polar and demotes seat chroma for board-first share", () => {
    expect(CAMERA_MODE_POLAR_DEG.play).toBeGreaterThanOrEqual(55);
    expect(CAMERA_MODE_POLAR_DEG.play).toBeGreaterThan(54); // tip was 54
    expect(PLAY_MIN_POLAR_DEG).toBeGreaterThan(45); // tip was 45
    expect(DEFAULT_DESKTOP_FRAME.polarDeg).toBeGreaterThan(54);
    expect(SEAT_COLORS[0]).not.toBe("#e74c3c");
    expect(seatMaterial(0).clearcoat!).toBeLessThan(0.2);
    expect(seatMaterial(0).roughness).toBeGreaterThan(0.7);
    const css = readFileSync("src/creator/surface.css", "utf8");
    expect(css).toContain("T265");
    expect(css).toContain("seat chrome yields");
    const rig = readFileSync("src/render3d/camera-rig.ts", "utf8");
    expect(rig).toContain("T265");
  });
});
