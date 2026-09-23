import { describe, expect, it } from "vitest";
import {
  applyWorkerPlacementIntent,
  canPlaceWorker,
  createWorkerPlacementState,
  deriveWorkerPlacementRegions,
  deriveWorkersPerSeat,
  HARBOR_FLAVOR_IDS,
  isHarborLikeCorpus,
  pickWorkerPlacementBotActionId,
  workerPlacementScores,
} from "./worker-placement";

describe("worker-placement-v1", () => {
  it("derives source region names and never emits harbor cargo IDs", () => {
    const brief =
      "3 players take turns on a shared worker placement board. " +
      "On your turn place one worker onto a resource region; " +
      "occupied spaces cannot be reused. First to finish two buildings wins.";
    const regions = deriveWorkerPlacementRegions(brief);
    expect(regions.length).toBeGreaterThanOrEqual(3);
    const ids = regions.map((region) => region.id);
    const names = regions.map((region) => region.name).join(" ");
    for (const harborId of HARBOR_FLAVOR_IDS) {
      expect(ids).not.toContain(harborId);
    }
    expect(names).not.toMatch(/琥珀货|钴蓝绸|雪松木|东栈桥/);
    expect(isHarborLikeCorpus(brief)).toBe(false);
    expect(isHarborLikeCorpus("港口航线与琥珀货、东栈桥")).toBe(true);
  });

  it("enforces region capacity so occupied spots cannot be reused beyond capacity", () => {
    const state = createWorkerPlacementState({
      playerCount: 2,
      workersPerSeat: 2,
      startingCoins: 0,
      regions: [
        { id: "forest", name: "Forest", capacity: 1, cost: 0, resolvePoints: 1 },
        { id: "mine", name: "Mine", capacity: 2, cost: 0, resolvePoints: 2 },
      ],
    });
    expect(canPlaceWorker(state, 0, "forest")).toBe(true);
    const first = applyWorkerPlacementIntent(state, 0, "place:forest");
    expect(first).not.toBeNull();
    expect(first!.state.placements).toHaveLength(1);
    expect(canPlaceWorker(first!.state, 0, "forest")).toBe(false);
    expect(canPlaceWorker(first!.state, 1, "forest")).toBe(false);
    const second = applyWorkerPlacementIntent(first!.state, 1, "place:mine");
    expect(second).not.toBeNull();
    const third = applyWorkerPlacementIntent(second!.state, 0, "place:mine");
    expect(third).not.toBeNull();
    // Mine is full (capacity 2); further mine placement is illegal.
    expect(canPlaceWorker(third!.state, 1, "mine")).toBe(false);
    expect(applyWorkerPlacementIntent(third!.state, 1, "place:mine")).toBeNull();
  });

  it("resolves after all workers are placed and picks a winner", () => {
    let state = createWorkerPlacementState({
      playerCount: 2,
      workersPerSeat: 1,
      startingCoins: 0,
      regions: [
        { id: "spot-a", name: "Spot A", capacity: 2, cost: 0, resolvePoints: 1 },
        { id: "spot-b", name: "Spot B", capacity: 2, cost: 0, resolvePoints: 3 },
      ],
    });
    state = applyWorkerPlacementIntent(state, 0, "place:spot-b")!.state;
    state = applyWorkerPlacementIntent(state, 1, "place:spot-a")!.state;
    expect(state.phase).toBe("resolved");
    expect(state.winnerSeat).toBe(0);
    expect(workerPlacementScores(state)).toEqual([3, 1]);
  });

  it("rejects wrong-seat placement; bot always places on a free region", () => {
    const state = createWorkerPlacementState({
      playerCount: 2,
      workersPerSeat: 2,
      startingCoins: 0,
      regions: deriveWorkerPlacementRegions("worker placement on resource spots"),
    });
    expect(applyWorkerPlacementIntent(state, 1, "place:resource-spot-a")).toBeNull();
    const botId = pickWorkerPlacementBotActionId(state);
    expect(botId).toMatch(/^place:/);
    const applied = applyWorkerPlacementIntent(state, 0, botId!);
    expect(applied?.state.placements).toHaveLength(1);
  });

  it("derives workers per seat from corpus when stated", () => {
    expect(deriveWorkersPerSeat("Each player has 3 workers on the board.", 3)).toBe(3);
    expect(deriveWorkersPerSeat("每人 4 个工人。", 2)).toBe(4);
  });
});
