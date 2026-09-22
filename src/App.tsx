import { CreatorWorkspace } from "./creator/CreatorWorkspace";
import { InstallGuide } from "./install/InstallGuide";
import { INSTALL_PATH, logicalPathname } from "./public-mount";

export default function App() {
  if (logicalPathname(window.location.pathname) === INSTALL_PATH) {
    return <InstallGuide />;
  }
  return <CreatorWorkspace />;
}
