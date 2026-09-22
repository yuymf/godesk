import { logicalPathname } from "../public-mount";
import { CreatorHome } from "./CreatorHome";
import { PlayablePreview } from "./PlayablePreview";
import { ProjectStudio } from "./ProjectStudio";
import { ReplayView } from "./ReplayView";
import { RoomView } from "./RoomView";

export function CreatorWorkspace() {
  const pathname = logicalPathname(window.location.pathname);
  const studioMatch = pathname.match(/^\/studio\/([^/]+)$/);
  if (studioMatch) {
    return <ProjectStudio projectId={decodeURIComponent(studioMatch[1])} />;
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
