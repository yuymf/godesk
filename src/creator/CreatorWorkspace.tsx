import { lazy, Suspense } from "react";
import { logicalPathname } from "../public-mount";
import { CreatorHome } from "./CreatorHome";
import { PlayablePreview } from "./PlayablePreview";
import { ReplayView } from "./ReplayView";
import { RoomView } from "./RoomView";
import { GameLobby } from "./GameLobby";
import { CreatorSettings } from "./CreatorSettings";

// Keep ProjectStudio off the homepage graph. Sync-importing it (plus the
// asset-search fetch helpers it used to pull through project-api) pushed
// Lighthouse homepage TBT over the 200 ms error budget.
const ProjectStudio = lazy(async () => {
  const mod = await import("./ProjectStudio");
  return { default: mod.ProjectStudio };
});

function StudioRouteFallback() {
  return (
    <main className="creator-studio" id="main" aria-busy="true">
      <p>正在打开工作室…</p>
    </main>
  );
}

export function CreatorWorkspace() {
  const pathname = logicalPathname(window.location.pathname);
  if (pathname === "/games") return <GameLobby />;
  if (pathname === "/settings") return <CreatorSettings />;
  const studioMatch = pathname.match(/^\/studio\/([^/]+)$/);
  if (studioMatch) {
    return (
      <Suspense fallback={<StudioRouteFallback />}>
        <ProjectStudio projectId={decodeURIComponent(studioMatch[1])} />
      </Suspense>
    );
  }
  const playMatch = pathname.match(/^\/play\/([^/]+)$/);
  if (playMatch) {
    return <PlayablePreview buildId={decodeURIComponent(playMatch[1])} />;
  }
  const roomMatch = pathname.match(/^\/room\/([^/]+)$/);
  if (roomMatch) {
    return <RoomView sessionId={decodeURIComponent(roomMatch[1])} />;
  }
  const replayMatch = pathname.match(/^\/replay\/([^/]+)$/);
  if (replayMatch) {
    return <ReplayView replayId={decodeURIComponent(replayMatch[1])} />;
  }
  return <CreatorHome />;
}
