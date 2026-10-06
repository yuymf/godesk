/**
 * G3D-14 · 棋盘组件持有的公开状态 → 通用桌面布局（纯函数，不依赖 three / React，可单测）。
 */
import type { TabletopLayout, TabletopRenderInput } from "../render3d/mappers/tabletop";
import {
  discFlippingLayout,
  harborVoyageLayout,
  networkRouteLayout,
  workerPlacementLayout,
  type DiscFlippingTabletopInput,
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
  const seat = (base: string) => ({ base, roughness: 0.45, metalness: 0, clearcoat: 0.3, pattern: "none" as const });
  const colors = kernel === "disc-flipping-v1" ? ["#1d1d1f", "#f4efe6", SEAT_COLORS[2], SEAT_COLORS[3]] : SEAT_COLORS;
  return {
    camera: { ...SCENE_TOKENS.camera, pan: false },
    lighting: SCENE_TOKENS.lighting,
    water: { enabled: kernel === "harbor-voyage-v1", shallow: "#4aa8a8", deep: "#0e3a55" },
    materials: {
      ...Object.fromEntries(colors.map((base, index) => [`seat${index}`, seat(base)])),
      table: { base: "#8b5a2b", roughness: 0.82, metalness: 0, pattern: "grain" },
      piece: { base: "#f4efe6", roughness: 0.45, metalness: 0, pattern: "none" },
      board: { base: kernel === "disc-flipping-v1" ? "#1f6b4a" : "#b9a77d", roughness: 0.8, metalness: 0, pattern: "cloth" },
    },
    bindings: [{ objectKind: "cell", mesh: "tile-square", material: "board", scale: 1 }],
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
  }
}
