import { CreatorWorkspace } from "./creator/CreatorWorkspace";
import { InstallGuide } from "./install/InstallGuide";

export default function App() {
  if (window.location.pathname === "/chatgpt-plugin") return <InstallGuide />;
  return <CreatorWorkspace />;
}
