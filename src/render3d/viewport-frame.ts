/**
 * Track B framing helper (G3D-judge-hud 2h3).
 * Track C (#151) owns the full camera-rig; this only exposes a fill/polar
 * viewport param so the HUD can ask for “island fills ~80% of canvas height”.
 */
import type { SceneVec3 } from "./scene-model";
import { orbit } from "./judge-camera";

export type ViewportFrame = {
  /** Island diameter as a fraction of the viewport’s shorter axis (0.5–0.95). */
  fill?: number;
  /** Degrees from vertical (0 = top-down). Desktop ~48, phone ~26. */
  polarDeg?: number;
  azimuthDeg?: number;
  fovDeg?: number;
};

export const DEFAULT_DESKTOP_FRAME: Required<ViewportFrame> = {
  fill: 0.82,
  polarDeg: 46,
  azimuthDeg: 18,
  fovDeg: 42,
};

export const DEFAULT_NARROW_FRAME: Required<ViewportFrame> = {
  fill: 0.9,
  polarDeg: 18,
  azimuthDeg: 8,
  fovDeg: 42,
};

/** Distance so a ground-plane disk of `radius` fills `fill` of the shorter view axis. */
export function distanceForIslandFill(
  radius: number,
  aspect: number,
  fill: number,
  fovDeg: number,
  polarDeg: number,
): number {
  const fov = (Math.max(20, Math.min(75, fovDeg)) * Math.PI) / 180;
  const halfV = fov / 2;
  const halfH = Math.atan(Math.tan(halfV) * Math.max(aspect, 0.2));
  const f = Math.max(0.45, Math.min(0.95, fill));
  const polar = (polarDeg * Math.PI) / 180;
  // Oblique view: ground disk projects smaller on the vertical axis → must move closer.
  // cos(polar)≈1 top-down, ≈0.67 at 48°. Keep a floor so we never over-zoom into one hex.
  const foreshorten = Math.max(0.42, 0.28 + Math.cos(polar) * 0.55);
  const effective = radius * foreshorten;
  const byHeight = effective / (f * Math.tan(halfV));
  const byWidth = effective / (f * Math.tan(halfH));
  return Math.max(byHeight, byWidth, radius * 1.35);
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
  return {
    position: orbit(center, distance, polarDeg, azimuthDeg),
    target: [center[0], center[1], center[2]],
    fov: fovDeg,
    distance,
  };
}
