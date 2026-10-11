import { describe, expect, it } from "vitest";
import { boxCorners, orthoBasis, tabletopOrthoFrame } from "./tabletop-camera";

const project = (p: readonly number[], frame: ReturnType<typeof tabletopOrthoFrame>, polar: number, az: number, W: number, H: number) => {
  const { r, u } = orthoBasis(polar, az);
  const rel = [p[0]! - frame.target[0], p[1]! - frame.target[1], p[2]! - frame.target[2]];
  const x = rel[0]! * r[0] + rel[1]! * r[1] + rel[2]! * r[2];
  const y = rel[0]! * u[0] + rel[1]! * u[1] + rel[2]! * u[2];
  return [W / 2 + x / frame.worldPerPx, H / 2 - y / frame.worldPerPx];
};

describe("tabletopOrthoFrame (step3 · 汐屿同款正交取景)", () => {
  const corners = boxCorners([0, 0.12, 0], [10, 0.24, 8]);
  const insets = { top: 60, bottom: 40, left: 20, right: 20 };

  it("fills 0.945 of the usable area on the binding axis and stays inside insets", () => {
    const W = 1000, H = 640;
    const frame = tabletopOrthoFrame({ points: corners, polarDeg: 54, azimuthDeg: 12, canvasWidth: W, canvasHeight: H, insets, fill: 0.945 });
    const px = corners.map((c) => project(c, frame, 54, 12, W, H));
    const xs = px.map((p) => p[0]!), ys = px.map((p) => p[1]!);
    const fillW = (Math.max(...xs) - Math.min(...xs)) / (W - 40);
    const fillH = (Math.max(...ys) - Math.min(...ys)) / (H - 100);
    expect(Math.max(fillW, fillH)).toBeCloseTo(0.945, 3);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(insets.left - 1e-6);
    expect(Math.max(...xs)).toBeLessThanOrEqual(W - insets.right + 1e-6);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(insets.top - 1e-6);
    expect(Math.max(...ys)).toBeLessThanOrEqual(H - insets.bottom + 1e-6);
    // 视锥与像素比一致
    expect(frame.right - frame.left).toBeCloseTo(W * frame.worldPerPx, 6);
  });

  it("looks down at polar 54° from azimuth 12°", () => {
    const frame = tabletopOrthoFrame({ points: corners, polarDeg: 54, azimuthDeg: 12, canvasWidth: 800, canvasHeight: 600, insets, fill: 0.945 });
    const v = [frame.position[0] - frame.target[0], frame.position[1] - frame.target[1], frame.position[2] - frame.target[2]];
    const len = Math.hypot(v[0]!, v[1]!, v[2]!);
    expect((Math.acos(v[1]! / len) * 180) / Math.PI).toBeCloseTo(54, 6);
    expect((Math.atan2(v[0]!, v[2]!) * 180) / Math.PI).toBeCloseTo(12, 6);
  });

  it("zooms around a focus point without changing the frustum aspect", () => {
    const base = tabletopOrthoFrame({ points: corners, polarDeg: 54, azimuthDeg: 12, canvasWidth: 800, canvasHeight: 600, insets, fill: 0.945 });
    const near = tabletopOrthoFrame({ points: corners, polarDeg: 54, azimuthDeg: 12, canvasWidth: 800, canvasHeight: 600, insets, fill: 0.945, zoom: 2.5, focus: [3, 0, 2] });
    expect(near.worldPerPx).toBeCloseTo(base.worldPerPx, 9);
    expect(Math.hypot(near.target[0] - 3, near.target[2] - 2)).toBeLessThan(1.5);
  });
});
