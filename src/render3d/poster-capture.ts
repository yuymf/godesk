/**
 * G3D-16: offline homepage hero capture (`?poster=1`).
 * Lazy-loaded from SceneHost so it never counts toward render3d core gzip.
 */
import type { Camera, Object3D, PerspectiveCamera } from "three";
import { islandBounds } from "./tokens";
import type { SceneModel } from "./scene-model";

declare global {
  interface Window {
    __godeskPoster?: {
      setHeroView: (options?: {
        fill?: number;
        polarDeg?: number;
        azimuthDeg?: number;
      }) => boolean;
    };
  }
}

type PosterControls = {
  target: { set: (x: number, y: number, z: number) => void };
  minDistance: number;
  maxDistance: number;
  update: () => void;
};

export type PosterCaptureHandles = {
  camera: Camera | null;
  controls: PosterControls | null;
  model: SceneModel | null;
  markShadowsDirty: () => void;
};

/** Activate board-only poster mode and expose `window.__godeskPoster.setHeroView`. */
export function mountPosterCapture(getHandles: () => PosterCaptureHandles): () => void {
  document.documentElement.dataset.g3dPoster = "1";
  const api = {
    setHeroView(options?: { fill?: number; polarDeg?: number; azimuthDeg?: number }) {
      const { camera, controls, model, markShadowsDirty } = getHandles();
      if (!camera || !controls) return false;
      const bounds = model ? islandBounds(model.nodes) : null;
      const center = bounds?.center ?? [0, 0, 0];
      const radius = Math.max(bounds?.radius ?? 7.5, 1);
      const fill = Math.min(Math.max(options?.fill ?? 0.8, 0.5), 0.95);
      const polar = ((options?.polarDeg ?? 52) * Math.PI) / 180;
      const azimuth = ((options?.azimuthDeg ?? 38) * Math.PI) / 180;
      const halfFov =
        ((("fov" in camera ? (camera as { fov: number }).fov : 45) as number) * Math.PI) / 360;
      const distance = radius / (fill * Math.tan(halfFov));
      (camera as Object3D).position.set(
        center[0] + distance * Math.sin(polar) * Math.sin(azimuth),
        center[1] + distance * Math.cos(polar),
        center[2] + distance * Math.sin(polar) * Math.cos(azimuth),
      );
      (camera as PerspectiveCamera).updateProjectionMatrix();
      controls.target.set(center[0], center[1] * 0.15, center[2]);
      controls.minDistance = distance * 0.4;
      controls.maxDistance = distance * 2.2;
      controls.update();
      markShadowsDirty();
      return true;
    },
  };
  window.__godeskPoster = api;
  const t = window.setTimeout(() => {
    api.setHeroView();
  }, 400);
  return () => {
    window.clearTimeout(t);
    if (window.__godeskPoster === api) delete window.__godeskPoster;
    delete document.documentElement.dataset.g3dPoster;
  };
}
