import { CreatorWorkspace } from "./creator/CreatorWorkspace";
import { InstallGuide } from "./install/InstallGuide";
import { INSTALL_PATH, logicalPathname } from "./public-mount";

export function normalizeAppPathname(pathname: string) {
  return logicalPathname(pathname);
}

export default function App() {
  if (normalizeAppPathname(window.location.pathname) === INSTALL_PATH) {
    return <InstallGuide />;
  }
  return <CreatorWorkspace />;
}
