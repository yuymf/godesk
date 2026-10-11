import type { Object3D, WebGLRenderer } from "three";
import type { SceneModel } from "../scene-model";
import { createWaterController, type WaterController } from "./mesh";
import type { RenderTierId } from "../tiers";

/** step3 R2/R3: mount tide water for surround=sea tabletop; hide flat sea panel. */
export async function mountTabletopSea(opts: {
  renderer: WebGLRenderer;
  parent: Object3D;
  model: SceneModel;
  tier: RenderTierId;
  signal?: AbortSignal;
  hideTable: () => void;
}): Promise<WaterController | null> {
  if (!opts.model.nodes.some((n) => n.id === "table" && n.tag === "sea")) return null;
  const water = await createWaterController({
    renderer: opts.renderer,
    parent: opts.parent,
    model: opts.model,
    tier: opts.tier,
    signal: opts.signal,
  });
  opts.hideTable();
  return water;
}
