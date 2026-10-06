interface Env {
  /** 3d-asset-server sidecar. Default http://127.0.0.1:8787 via wrangler.jsonc; override in .dev.vars. */
  ASSET_SERVER_URL?: string;
}
