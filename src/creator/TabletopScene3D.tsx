/**
 * G3D-14 · 通用 3D 桌面（懒加载 chunk）：空间 Kernel 公开状态 → TabletopLayout → SceneModel，
 * 交给 SceneHost 渲染；拾取经 mapper 的动作表发出与 DOM 动作按钮相同的 actionId / payload。
 */
import { useMemo } from "react";
import { SceneHost, type SceneAdapter } from "../render3d/SceneHost";
import { mapTabletopToScene, resolveTabletopPick, type TabletopRenderInput } from "../render3d/mappers/tabletop";
import { createTabletopObject, updateTabletopObject } from "../render3d/tabletop-objects";
import { fallbackTabletopRender, layoutForStage } from "./tabletop-stage-layout";
import type { TabletopStageProps } from "./TabletopStage";

export default function TabletopScene3D({ kernel, state, legal, render, onAct }: TabletopStageProps) {
  const renderKey = render ? JSON.stringify(render) : "";
  const resolvedRender = useMemo(
    () => (render as TabletopRenderInput | undefined) ?? fallbackTabletopRender(kernel),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [renderKey, kernel],
  );
  const interactive = Boolean(onAct);
  const scene = useMemo(
    () => mapTabletopToScene(layoutForStage({ kernel, state, legal, onAct }), resolvedRender),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kernel, JSON.stringify(state), JSON.stringify(legal ?? null), interactive, resolvedRender],
  );
  const adapter = useMemo<SceneAdapter>(() => ({
    model: scene.model,
    create: (node, ctx) => createTabletopObject(node, { ...ctx, materials: scene.materials }),
    update: (object, node, ctx) => updateTabletopObject(object, node, { ...ctx, materials: scene.materials }),
    resolvePick: (target) => resolveTabletopPick(scene, target),
    bounds: scene.bounds,
    layoutKey: scene.layoutKey,
    camera: scene.camera,
  }), [scene]);
  return (
    <SceneHost
      ariaLabel="3D 桌面"
      interactive={interactive}
      lighting={resolvedRender.lighting}
      onPick={(action) => onAct?.(action.type, action.payload)}
      scene={adapter}
    />
  );
}
