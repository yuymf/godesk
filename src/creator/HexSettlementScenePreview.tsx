import { lazy, Suspense } from "react";
import type { HexSettlementBoardState } from "./hex-settlement-session";

const LazySceneHost = lazy(async () => {
  const mod = await import("../render3d");
  return { default: mod.SceneHost };
});

/**
 * Non-interactive 3D hex island for PlayablePreview / ReplayView (G3D-18).
 * Passes through importedModels so /play and /replay show project-imported GLBs (#160 follow-ups).
 */
export function HexSettlementScenePreview({
  hexIsland,
  ariaLabel = "汐屿六角岛",
  importedModels,
}: {
  hexIsland: HexSettlementBoardState;
  ariaLabel?: string;
  importedModels?: ReadonlyArray<{ id: string; url: string; title?: string }>;
}) {
  return (
    <div
      aria-label={ariaLabel}
      className="hex-island-board hex-settlement-preview"
      role="region"
    >
      <div className="g3d-stage">
        <Suspense fallback={<div aria-busy="true">加载 3D 桌面…</div>}>
          <LazySceneHost
            ariaLabel={ariaLabel}
            className="room-g3d-scene-host"
            hexSettlement={hexIsland}
            importedModels={importedModels}
            interactive={false}
          />
        </Suspense>
      </div>
    </div>
  );
}
