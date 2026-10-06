import { describe, expect, it } from "vitest";
import { mapTabletopToScene, resolveTabletopPick, type TabletopScene } from "../render3d/mappers/tabletop";
import { applyHarborIntent, createHarborVoyageState, pickHarborBotActionId } from "../runtime/harbor-voyage";
import {
  createOthelloKernelConfig,
  othelloAdapter,
  othelloToSessionFields,
  pickOthelloBotAction,
} from "../runtime/adapters/othello";
import {
  createNetworkRouteKernelConfig,
  networkRouteAdapter,
  networkRouteToSessionFields,
  pickNetworkRouteBotAction,
} from "../runtime/adapters/network-route";
import { applyAction, createInitialState, listLegalActions } from "../runtime/play-kernel";
import {
  applyWorkerPlacementIntent,
  createWorkerPlacementState,
  pickWorkerPlacementBotActionId,
} from "../runtime/worker-placement";
import { defaultRenderSpec } from "./render-spec";
import { fallbackTabletopRender, layoutForStage } from "./tabletop-stage-layout";
import type { TabletopStageProps } from "./TabletopStage";

/**
 * G3D-14 成功标准「每个 Kernel 打完 1 局」：每一步都经通用 mapper 生成 3D 场景，
 * 落子 / 占线 / 放置类动作必须能从 3D 拾取表里找到对应节点（同一拾取管线），
 * 掷骰 / 领航 / 停着这类全局动作走 DOM 动作盘，直接施加。
 */
const onAct = () => {};

function pickTargetFor(scene: TabletopScene, action: { type: string; payload?: Record<string, unknown> }): string | null {
  const wanted = JSON.stringify({ type: action.type, ...(action.payload ? { payload: action.payload } : {}) });
  for (const node of scene.model.nodes) {
    const resolved = resolveTabletopPick(scene, { nodeId: node.id });
    if (resolved && JSON.stringify(resolved) === wanted) return node.id;
  }
  if (scene.grid && action.type === "place") {
    const row = Number(action.payload?.row);
    const col = Number(action.payload?.col);
    const point: [number, number, number] = [scene.grid.x0 + (col + 0.5) * scene.grid.cell, 0.24, scene.grid.z0 + (row + 0.5) * scene.grid.cell];
    const resolved = resolveTabletopPick(scene, { nodeId: "board", point });
    if (resolved && JSON.stringify(resolved) === wanted) return "board";
  }
  return null;
}

function sceneFor(props: Pick<TabletopStageProps, "kernel" | "state" | "legal">) {
  const render = defaultRenderSpec(props.kernel, "table") ?? fallbackTabletopRender(props.kernel);
  const scene = mapTabletopToScene(layoutForStage({ ...props, onAct }), render as never);
  // 每一步场景都合法：id 唯一、材质都已登记。
  const ids = scene.model.nodes.map((node) => node.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const node of scene.model.nodes) if (node.material) expect(scene.materials[node.material]).toBeDefined();
  return scene;
}

describe("G3D-14 tabletop: one full game per Kernel through the 3D pick table", () => {
  it("disc-flipping-v1", () => {
    const config = createOthelloKernelConfig();
    let state = createInitialState(othelloAdapter, config, 7);
    let picked = 0;
    for (let ply = 0; ply < 200 && state.status === "active"; ply += 1) {
      const legal = listLegalActions(othelloAdapter, state, state.activePlayerId, config);
      const action = pickOthelloBotAction(state, config, 7, state.sequence + 1)!;
      const scene = sceneFor({ kernel: "disc-flipping-v1", state: othelloToSessionFields(state).othello, legal });
      if (action.type === "place") {
        expect(pickTargetFor(scene, action), `ply ${ply}`).not.toBeNull();
        picked += 1;
      }
      const result = applyAction(othelloAdapter, state, action, config);
      expect(result.ok).toBe(true);
      state = result.state;
    }
    expect(state.status).toBe("complete");
    expect(picked).toBeGreaterThan(20);
  });

  it("network-route-v1", () => {
    const config = createNetworkRouteKernelConfig();
    let state = createInitialState(networkRouteAdapter, config, 11);
    let picked = 0;
    for (let ply = 0; ply < 200 && state.status === "active"; ply += 1) {
      const legal = listLegalActions(networkRouteAdapter, state, state.activePlayerId, config);
      const action = pickNetworkRouteBotAction(state, config, 11, state.sequence + 1)!;
      const edgeIds = legal.filter((entry) => entry.type === "claim").map((entry) => String(entry.payload?.edgeId));
      const scene = sceneFor({ kernel: "network-route-v1", state: networkRouteToSessionFields(state).networkRoute, legal: edgeIds });
      if (action.type === "claim") {
        expect(pickTargetFor(scene, action), `ply ${ply}`).toMatch(/^(link|hint):/);
        picked += 1;
      }
      const result = applyAction(networkRouteAdapter, state, action, config);
      expect(result.ok).toBe(true);
      state = result.state;
    }
    expect(state.status).toBe("complete");
    expect(picked).toBeGreaterThan(2);
  });

  it("worker-placement-v1", () => {
    let state = createWorkerPlacementState({
      playerCount: 2,
      workersPerSeat: 3,
      startingCoins: 4,
      regions: [
        { id: "forest", name: "森林", capacity: 3, cost: 0, resolvePoints: 1 },
        { id: "market", name: "市集", capacity: 1, cost: 1, resolvePoints: 3 },
        { id: "quarry", name: "采石场", capacity: 2, cost: 0, resolvePoints: 2 },
      ],
    });
    let picked = 0;
    for (let ply = 0; ply < 50 && state.phase !== "resolved"; ply += 1) {
      const actionId = pickWorkerPlacementBotActionId(state)!;
      const scene = sceneFor({ kernel: "worker-placement-v1", state });
      expect(pickTargetFor(scene, { type: actionId }), `ply ${ply}`).not.toBeNull();
      picked += 1;
      state = applyWorkerPlacementIntent(state, state.activeSeat, actionId)!.state;
    }
    expect(state.phase).toBe("resolved");
    expect(picked).toBe(6);
    // 终局：6 个工人棋子都在桌面上。
    expect(sceneFor({ kernel: "worker-placement-v1", state }).model.nodes.filter((node) => node.mesh === "pawn")).toHaveLength(6);
  });

  it("harbor-voyage-v1", () => {
    let state = createHarborVoyageState(3);
    let picked = 0;
    let global = 0;
    for (let step = 0; step < 200 && state.phase !== "resolved"; step += 1) {
      const actionId = pickHarborBotActionId(state)!;
      const scene = sceneFor({ kernel: "harbor-voyage-v1", state });
      const seat = actionId.startsWith("place:") ? state.activeSeat : 0;
      if (actionId.startsWith("place:")) {
        expect(pickTargetFor(scene, { type: actionId }), `step ${step} ${actionId}`).not.toBeNull();
        picked += 1;
      } else {
        global += 1;
      }
      const next = applyHarborIntent(state, seat, actionId, 13, step + 1);
      expect(next, `step ${step} ${actionId}`).not.toBeNull();
      state = next!.state;
    }
    expect(state.phase).toBe("resolved");
    expect(picked).toBeGreaterThan(8);
    expect(global).toBeGreaterThan(0);
  });
});
