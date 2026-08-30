export const INSTALL_PATH = "/chatgpt-plugin";
export const PUBLIC_HOME_PATH = "/chatgpt-plugin/new";

export function logicalPathname(pathname: string) {
  const raw = pathname.replace(/\/+$/, "") || "/";
  if (raw === INSTALL_PATH) return INSTALL_PATH;
  if (raw === PUBLIC_HOME_PATH) return "/";
  if (raw.startsWith(`${INSTALL_PATH}/`)) return raw.slice(INSTALL_PATH.length);
  return raw;
}

export function isPublicMount(pathname: string) {
  const raw = pathname.replace(/\/+$/, "") || "/";
  return raw === INSTALL_PATH || raw.startsWith(`${INSTALL_PATH}/`);
}

export function mountHref(path: string, currentPathname: string) {
  if (!path.startsWith("/")) return path;
  if (path === INSTALL_PATH || path.startsWith(`${INSTALL_PATH}/`)) return path;
  if (!isPublicMount(currentPathname)) return path;
  return path === "/" ? PUBLIC_HOME_PATH : `${INSTALL_PATH}${path}`;
}

export function workerMountPath(pathname: string) {
  const logical = logicalPathname(pathname);
  if (
    logical === "/login" ||
    logical === "/oauth/callback" ||
    logical === "/mcp" ||
    logical.startsWith("/api/") ||
    logical.startsWith("/try/")
  ) {
    return logical;
  }
  return pathname;
}
