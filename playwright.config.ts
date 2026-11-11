import { execFileSync } from "node:child_process";
import { defineConfig, devices } from "@playwright/test";
import { DEFAULT_CONFIG_TEST_IGNORE } from "./playwright.spec-ownership";

const nodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
if (!Number.isFinite(nodeMajor) || nodeMajor < 22) {
  throw new Error(
    `GoDesk Playwright e2e needs Node.js >= 22 (Wrangler). Current: ${process.versions.node}. ` +
      `Install or switch to Node.js >= 22 (Wrangler / e2e requirement).`,
  );
}

/**
 * PORT ISOLATION — do not regress this back to a hard-coded 8799.
 *
 * The webServer below runs `pnpm build` and then serves `./dist` off disk. When
 * two Playwright processes shared one port, the later one silently adopted the
 * first one's server (`reuseExistingServer: true`) and executed against a build
 * that another process was concurrently rewriting. A page already past
 * `waitHarnessReady()` could then lose its runtime state mid-spec, which showed
 * up as a ~1-in-10 false red in e2e/harness-determinism.spec.ts.
 *
 * `scripts/pick-e2e-port.mjs` keeps the familiar 8799 for a lone run and slides
 * to 8801/8803/... when the slot is taken, so concurrent runs get their own
 * server instead of quietly colliding.
 *
 * DISCIPLINE: prefer serial runs in one checkout. Separate ports stop the
 * server collision, but concurrent runs still share one `./dist`, so a
 * concurrent `pnpm build` can swap assets underneath the other run. Use a
 * separate checkout (`git worktree`) for genuinely parallel work.
 */
// Playwright's TS loader runs this config through a TTY-attached transform that
// injects ANSI colour codes into a child's stdout (observed: "\u001b[33m8811\u001b[39m"),
// which turns `Number(...)` into NaN and makes every `page.goto("/...")` fail
// with "Cannot navigate to invalid URL". FORCE_COLOR=0 keeps the picker's
// output plain.
//
// Resolve the port ONCE and hand it to every process: the config is re-evaluated
// in the main process AND in each worker. Re-probing per process would be wrong,
// because the main process's server already occupies the port by the time a
// worker evaluates the config — the worker would then pick the next free slot
// and `baseURL` would point at a port nobody serves. `GODESK_E2E_RESOLVED_PORT`
// is inherited by workers through the environment.
function resolvePort(): number {
  const inherited = process.env.GODESK_E2E_RESOLVED_PORT;
  if (inherited) {
    const port = Number(inherited);
    if (Number.isInteger(port) && port > 0 && port <= 65535) return port;
  }
  const rawPort = execFileSync(process.execPath, ["scripts/pick-e2e-port.mjs"], {
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
  });
  const port = Number(rawPort.replace(/\u001b\[[0-9;]*m/g, "").trim());
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`[playwright-config] could not resolve an e2e port; got ${JSON.stringify(rawPort)}`);
  }
  // Sticky for this process, and inherited by workers we spawn.
  process.env.GODESK_E2E_RESOLVED_PORT = String(port);
  return port;
}

const port = resolvePort();
const origin = `http://127.0.0.1:${port}`;
const explicitPort = Boolean(process.env.GODESK_E2E_PORT);

export default defineConfig({
  testDir: "./e2e",
  // SPEC OWNERSHIP — do not drop this, or the default suite goes red.
  //
  // `e2e/visual-regression-gate.spec.ts` runs on its own port (8823) via
  // `playwright.pixelgate.config.ts` and asserts `ownership.portMatches === true`.
  // Collected by THIS config it would run on 8799 (or the auto-picked port), so that
  // self-proof fails and `pnpm test:e2e` turns red — a whole-suite false red caused
  // by a port mismatch, not by a product regression. The list lives in
  // `playwright.spec-ownership.ts` (single source of truth) and is proven by
  // `scripts/ci-config-guards.test.mjs` (`playwright test --list` must not contain it).
  testIgnore: DEFAULT_CONFIG_TEST_IGNORE,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  timeout: 120_000,
  // `@slow` specs (full games vs the Room AI seat) run only with GODESK_E2E_SLOW=1.
  ...(process.env.GODESK_E2E_SLOW ? {} : { grepInvert: /@slow/ }),
  expect: { timeout: 15_000 },
  use: {
    baseURL: origin,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Restart wrapper: wrangler/workerd sometimes dies mid-suite (empty ✘ [ERROR]);
    // without it every later spec becomes ERR_CONNECTION_REFUSED.
    command: `bash scripts/e2e-webserver.sh`,
    url: origin,
    // Only adopt an already-listening server when the caller PINNED the port on
    // purpose (fast local iteration against a warm build). With an auto-picked
    // port, a listener belongs to somebody else's run — adopting it would test
    // their build, so start our own and let a real bind clash fail loudly.
    reuseExistingServer: !process.env.CI && explicitPort,
    timeout: 180_000,
    env: { GODESK_E2E_PORT: String(port), GODESK_E2E_RESOLVED_PORT: String(port) },
  },
});
