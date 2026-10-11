import type { Object3D, WebGLRenderer } from "three";
import type { SceneModel } from "../scene-model";
import { createWaterController, type WaterController } from "./mesh";

/** Mount tide water for tabletop surround.sea (same controller as hex). */
export async function mountTabletopSea(opts: {
  renderer: WebGLRenderer;
  parent: Object3D;
  model: SceneModel;
  tier: "high" | "medium" | "low";
  signal?: AbortSignal;
  hideTable?: () => void;
}): Promise<WaterController | null> {
  try {
    const water = await createWaterController(opts);
    opts.hideTable?.();
    return water;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return null;
    throw error;
  }
}
