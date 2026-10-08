/**
 * Track B framing helper (G3D-judge-hud 2h4).
 * Track C (#151) owns the full camera-rig; this only exposes a fill/polar
 * viewport param so the HUD can ask for “island fills ~80% of canvas height”.
 */
import type { SceneVec3 } from "./scene-model";
import { orbit } from "./judge-camera";

export type ViewportFrame = {
  /** Island diameter as a fraction of the viewport height (0.5–0.95). */
  fill?: number;
  /** Degrees from vertical (0 = top-down). Desktop ~42, phone ~14. */
  polarDeg?: number;
  azimuthDeg?: number;
  fovDeg?: number;
};

/** Desktop a/d: island ~78–85% of canvas height, sea margins OK left/right. */
export const DEFAULT_DESKTOP_FRAME: Required<ViewportFrame> = {
  // R24：对齐 settlecoast 源码默认 φ≈54° / θ≈11.5°；FOV 锁 40°。
  // R26：fill 0.92→0.96，贴 settlecoast jg 满桌观感（正交 halfH 同步收紧）。
  fill: 0.96,
  polarDeg: 54,
  azimuthDeg: 12,
  fovDeg: 40,
};

/** iPhone: top-down-ish, fill width. */
export const DEFAULT_NARROW_FRAME: Required<ViewportFrame> = {
  fill: 0.96,
  polarDeg: 12,
  azimuthDeg: 6,
  fovDeg: 40,
};

/**
 * Distance so a ground-plane disk of `radius` fills `fill` of viewport height.
 * Calibrated vs round-2h3 desktop-a canvas (~70.7% measured at ~9.5 dist):
 * target ~82% → ~8.2. Height-driven on landscape; width only gates portrait.
 */
export function distanceForIslandFill(
  radius: number,
  aspect: number,
  fill: number,
  fovDeg: number,
  polarDeg: number,
): number {
  const fov = (Math.max(20, Math.min(75, fovDeg)) * Math.PI) / 180;
  const halfV = fov / 2;
  const halfH = Math.atan(mathTanSafe(halfV) * Math.max(aspect, 0.2));
  const f = Math.max(0.55, Math.min(0.95, fill));
  const polar = (polarDeg * Math.PI) / 180;
  // Empirical foreshorten so landscape a-default lands ~80% height (not ~70%).
  const foreshorten = Math.max(0.36, 0.16 + Math.cos(polar) * 0.36);
  const projectedHalf = radius * foreshorten;
  const byHeight = projectedHalf / (f * Math.tan(halfV));
  if (aspect >= 1) {
    // Desktop / landscape: prefer height fill; sea left/right is fine.
    return Math.max(byHeight, radius * 1.1);
  }
  // Portrait: also keep island inside width.
  const byWidth = (radius * 0.95) / (f * Math.tan(halfH));
  return Math.max(byHeight, byWidth * 0.9, radius * 1.1);
}

function mathTanSafe(halfV: number): number {
  return Math.tan(halfV);
}

export function framePose(
  center: SceneVec3,
  radius: number,
  aspect: number,
  frame: ViewportFrame = {},
): { position: SceneVec3; target: SceneVec3; fov: number; distance: number } {
  const fill = frame.fill ?? DEFAULT_DESKTOP_FRAME.fill;
  const polarDeg = frame.polarDeg ?? DEFAULT_DESKTOP_FRAME.polarDeg;
  const azimuthDeg = frame.azimuthDeg ?? DEFAULT_DESKTOP_FRAME.azimuthDeg;
  const fovDeg = frame.fovDeg ?? DEFAULT_DESKTOP_FRAME.fovDeg;
  const distance = distanceForIslandFill(radius, aspect, fill, fovDeg, polarDeg);
  const target: SceneVec3 = [center[0], center[1] + radius * 0.02, center[2]];
  return {
    position: orbit(target, distance, polarDeg, azimuthDeg),
    target,
    fov: fovDeg,
    distance,
  };
}
