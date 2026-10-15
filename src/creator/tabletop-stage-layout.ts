/**
 * G3D-14 · 棋盘组件持有的公开状态 → 通用桌面布局（纯函数，不依赖 three / React，可单测）。
 */
import type { TabletopLayout, TabletopRenderInput } from "../render3d/mappers/tabletop";
import {
  discFlippingLayout,
  gemEngineLayout,
  patternDraftLayout,
  auctionBiddingLayout,
  harborVoyageLayout,
  networkRouteLayout,
  workerPlacementLayout,
  type DiscFlippingTabletopInput,
  type GemEngineTabletopInput,
  type PatternDraftTabletopInput,
  type AuctionBiddingTabletopInput,
  type NetworkRouteTabletopInput,
} from "../render3d/mappers/tabletop-kernels";
import { SCENE_TOKENS, SEAT_COLORS } from "../render3d/tokens";
import { canPlaceHarborWorker, HARBOR_TARGET_GROUPS, type HarborTargetId, type HarborVoyageState } from "../runtime/harbor-voyage";
import { canPlaceWorker, type WorkerPlacementState } from "../runtime/worker-placement";
import type { TabletopStageProps } from "./TabletopStage";

const HARBOR_TARGETS = HARBOR_TARGET_GROUPS.flatMap((group) => group.targets);

/**
 * build 缺 presentation.render 时（G3D-12 之前的旧 build）的最小兜底：tokens 灯光 + 座位色 + 内置图元回退。
 * 刻意不引用 render-spec 的 defaultRenderSpec：render-spec 模块在首页 index chunk 内，
 * 从懒加载 chunk 引用会把整段 Kernel 默认值留在首页包里（约 +1.1 KB gzip）。
 */
export function fallbackTabletopRender(kernel: TabletopStageProps["kernel"]): TabletopRenderInput {
  const seat = (base: string) => ({ base, roughness: 0.48, metalness: 0.05, clearcoat: 0.28, pattern: "none" as const });
  const colors = kernel === "disc-flipping-v1" ? ["#1d1d1f", "#f4efe6", SEAT_COLORS[2], SEAT_COLORS[3]] : SEAT_COLORS;
  const desk = kernel === "gem-engine-v1" || kernel === "pattern-draft-v1" || kernel === "auction-bidding-v1";
  const boardBase = kernel === "disc-flipping-v1" ? "#1f6b4a" : desk ? "#1a8a45" : "#b9a77d"; // T044 desk green felt
  return {
    camera: { ...SCENE_TOKENS.camera, ...(desk ? { fovDeg: 30, distance: 12.5 } : {}), pan: false },
    lighting: SCENE_TOKENS.lighting,
    water: { enabled: kernel === "harbor-voyage-v1", shallow: "#4aa8a8", deep: "#0e3a55" },
    materials: {
      ...Object.fromEntries(colors.map((base, index) => [`seat${index}`, seat(base)])),
      table: { base: "#a87338", roughness: 0.74, metalness: 0.06, pattern: "grain" }, // T110
      piece: { base: "#f7f1e6", roughness: desk ? 0.42 : 0.58, metalness: desk ? 0.08 : 0, clearcoat: desk ? 0.35 : 0.12, pattern: "none" },
      card: { base: "#f3e7d3", roughness: 0.72, metalness: 0, clearcoat: 0.08, pattern: "none" },
      resource: { base: "#e8d9b8", roughness: 0.48, metalness: 0.12, clearcoat: 0.28, pattern: "none" },
      token: { base: "#c4b5fd", roughness: 0.4, metalness: 0.15, clearcoat: 0.4, pattern: "none" },
      board: { base: boardBase, roughness: desk ? 0.99 : 0.8, metalness: 0, pattern: "cloth", ...(desk ? { brush: 0.55 } : {}) },
    },
    bindings: desk
      ? [
          { objectKind: "region", mesh: "tile-square", material: "board", scale: 1 },
          { objectKind: "cell", mesh: "tile-square", material: "board", scale: 1 },
          { objectKind: "card", mesh: "card", material: "card", scale: 1 },
          { objectKind: "disc", mesh: "disc", material: "piece", scale: 0.9 },
          { objectKind: "tile", mesh: "glazed-tile", material: "piece", scale: 1 },
          { objectKind: "resource", mesh: "gem-chip", material: "resource", scale: 0.9 },
          { objectKind: "token", mesh: "disc", material: "token", scale: 0.75 },
          { objectKind: "plaque", mesh: "plaque", material: "piece", scale: 1 },
          { objectKind: "lot", mesh: "framed-art", material: "card", scale: 1.15 },
          { objectKind: "building", mesh: "house", material: "piece", scale: 0.9 },
          { objectKind: "worker", mesh: "meeple", material: "piece", scale: 0.95 },
        ]
      : [{ objectKind: "cell", mesh: "tile-square", material: "board", scale: 1 }],
  };
}

/** 棋盘组件持有的公开状态 → 通用桌面布局（交互时才带合法目标）。 */
export function layoutForStage({ kernel, state, legal, onAct }: Pick<TabletopStageProps, "kernel" | "state" | "legal" | "onAct">): TabletopLayout {
  const interactive = Boolean(onAct);
  switch (kernel) {
    case "disc-flipping-v1":
      return discFlippingLayout(
        state as DiscFlippingTabletopInput,
        interactive ? (legal ?? []) as Array<{ type: string; payload?: Record<string, unknown> | null }> : [],
      );
    case "network-route-v1":
      return networkRouteLayout(state as NetworkRouteTabletopInput, new Set(interactive ? (legal ?? []) as string[] : []));
    case "worker-placement-v1": {
      const board = state as WorkerPlacementState;
      const open = interactive && board.phase !== "resolved"
        ? board.regions.filter((region) => canPlaceWorker(board, board.activeSeat, region.id)).map((region) => region.id)
        : [];
      return workerPlacementLayout(board, new Set(open));
    }
    case "harbor-voyage-v1": {
      const voyage = state as HarborVoyageState;
      const open = interactive && voyage.phase === "placement"
        ? HARBOR_TARGETS.filter((target) => canPlaceHarborWorker(voyage, voyage.activeSeat, target.id as HarborTargetId)).map((target) => target.id)
        : [];
      return harborVoyageLayout({
        punts: voyage.punts.map((punt) => ({
          cargoId: punt.cargoId,
          position: punt.result === "port" ? 14 : punt.position,
          color: punt.color,
        })),
        placements: voyage.placements,
        targets: HARBOR_TARGETS,
      }, new Set(open));
    }
    case "gem-engine-v1":
      return gemEngineLayout(
        state as GemEngineTabletopInput,
        interactive
          ? (legal ?? []) as Array<{ type: string; payload?: Record<string, unknown> | null }>
          : undefined,
      );
    case "pattern-draft-v1":
      return patternDraftLayout(
        state as PatternDraftTabletopInput,
        interactive
          ? (legal ?? []) as Array<{ type: string; payload?: Record<string, unknown> | null }>
          : undefined,
      );
    case "auction-bidding-v1":
      return auctionBiddingLayout(state as AuctionBiddingTabletopInput);
  }
}
