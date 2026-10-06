/**
 * G3D-14 · 通用 3D 桌面舞台（平台默认底座）的静态外壳。
 * 只做懒加载 + 固定高度占位（防 CLS）；状态提取、mapper、three、网格工厂都在懒加载 chunk 里，
 * 这里刻意保持最小（壳在首页 index chunk 内，首页预算只剩约 3 KB）。
 */
import { lazy, Suspense } from "react";
import type { RenderSpec } from "./render-spec";

export type TabletopKernelType =
  | "disc-flipping-v1"
  | "network-route-v1"
  | "worker-placement-v1"
  | "harbor-voyage-v1";

export type TabletopStageProps = {
  kernel: TabletopKernelType;
  /** Kernel 公开状态（各棋盘组件已持有的 state 对象，原样传入）。 */
  state: unknown;
  /** 合法目标：翻转棋为 LegalAction 列表；线路为 edgeId；工人 / 港口缺省时由懒加载 chunk 按规则计算。 */
  legal?: readonly unknown[];
  render?: RenderSpec;
  /** 缺省（undefined）时只读：3D 拾取不发动作。 */
  onAct?: (actionId: string, payload?: Record<string, unknown>) => void;
};

const LazyTabletopScene3D = lazy(() => import("./TabletopScene3D"));

export function TabletopStage(props: TabletopStageProps) {
  return (
    <div className="g3d-stage tabletop-stage" data-kernel={props.kernel} data-testid="tabletop-stage">
      <Suspense fallback={null}>
        <LazyTabletopScene3D {...props} />
      </Suspense>
    </div>
  );
}
