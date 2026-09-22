// Public share HTML goes through wrangler ASSETS (`./dist`). Seed a minimal
// SPA shell when dist is missing so worker tests do not 404 without `pnpm build`.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const index = "dist/index.html";
if (!existsSync(index)) {
  mkdirSync("dist", { recursive: true });
  writeFileSync(index, "<!doctype html><title>godesk</title>\n");
}
