import { defineConfig, devices } from "@playwright/test";

const nodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
if (!Number.isFinite(nodeMajor) || nodeMajor < 22) {
  throw new Error(
    `GoDesk Playwright e2e needs Node.js >= 22 (Wrangler). Current: ${process.versions.node}. ` +
      `On the cloud computer: export PATH="/home/box/.local/node22/bin:$PATH" (see docs/NIGHTLY-E2E.md).`,
  );
}

const port = 8799;
const origin = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  timeout: 120_000,
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
    command:
      "(test -f .dev.vars || cp .dev.vars.example .dev.vars) && pnpm build && pnpm exec wrangler dev --local --ip 127.0.0.1 --port 8799 --persist-to .wrangler/e2e",
    url: origin,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
