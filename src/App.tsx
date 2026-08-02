import { CreatorWorkspace } from "./creator/CreatorWorkspace";
import { InstallGuide } from "./install/InstallGuide";

export function normalizeAppPathname(pathname: string) {
  return pathname.replace(/\/+$/, "") || "/";
}

export default function App() {
  if (normalizeAppPathname(window.location.pathname) === "/chatgpt-plugin") {
    return <InstallGuide />;
  }
  return <CreatorWorkspace />;
}
