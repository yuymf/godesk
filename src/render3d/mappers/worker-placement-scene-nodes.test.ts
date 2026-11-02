import { describe, expect, it } from "vitest";
import { defaultRenderSpec } from "../../creator/render-spec";
import { layoutForStage } from "../../creator/tabletop-stage-layout";
import {
  applyWorkerPlacementIntent,
  createWorkerPlacementState,
} from "../../runtime/worker-placement";
import { mapTabletopToScene } from "./tabletop";

/**
 * After a place, Room gates onAct when it is no longer the viewer's turn.
 * Layout must still expose the new pawn (and active-seat hints) so
 * data-scene-nodes changes — otherwise E2E sees before===after (often 6).
 */
describe("worker-placement scene node counts under onAct gating", () => {
  it("changes node count after place when stage keeps an onAct wrapper", () => {
    let state = createWorkerPlacementState({
      playerCount: 2,
      workersPerSeat: 3,
      startingCoins: 4,
      regions: [
        { id: "region-1", name: "资源区", capacity: 3, cost: 0, resolvePoints: 0, yieldWood: 1 },
        { id: "region-2", name: "工坊", capacity: 2, cost: 0, resolvePoints: 0, convertWoodToBuilding: 1 },
        { id: "region-3", name: "建筑区", capacity: 2, cost: 0, resolvePoints: 1 },
      ],
      victoryBuildings: 2,
    } as Parameters<typeof createWorkerPlacementState>[0]);
    const render = defaultRenderSpec("worker-placement-v1", "table");
    const noop = () => undefined;
    const before = mapTabletopToScene(
      layoutForStage({ kernel: "worker-placement-v1", state, onAct: noop }),
      render,
    ).model.nodes.length;
    const applied = applyWorkerPlacementIntent(state, state.activeSeat, "place:region-1");
    expect(applied).toBeTruthy();
    state = applied!.state;
    // Mimic WorkerPlacementBoard stageAct: function still passed after turn passes.
    const after = mapTabletopToScene(
      layoutForStage({ kernel: "worker-placement-v1", state, onAct: noop }),
      render,
    ).model.nodes.length;
    expect(after).not.toBe(before);
  });
});
