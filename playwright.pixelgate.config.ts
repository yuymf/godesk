import { defineConfig, devices } from "@playwright/test";

/**
 * G3D-PIXELGATE 专用 Playwright 配置。
 *
 * 为什么单独一份（而不是改 `playwright.config.ts`）：
 *
 *  1. **端口必须独占。** `scripts/e2e-webserver.sh` 第一行就是 `pnpm build`，而共享 config
 *     里 `reuseExistingServer: !process.env.CI` 会在本地静默复用别人已起的 server。
 *     两个进程抢同一端口时，先到的那轮会拿到被换掉的 asset hash / 被掐断的 DO 连接 →
 *     SceneHost 卸载 → `delete window.__godeskHarness` → 像素门拍到"harness 被摘掉、
 *     场景退回墙钟自由跑"的两帧 → diff 必然不为 0 → 人会误判成"像素门不准"并去调阈值。
 *     实测对照：共享 8799 时 9 绿 1 假红；独占端口连跑 10 轮 10/10 全绿。
 *
 *  2. `reuseExistingServer` 在这里**永远是 false**：像素门宁可多花 40s 构建，
 *     也绝不接受"跑在别人构建出来的产物上"。
 *
 *  3. `workers: 1` + serial：像素门是有状态的（冻结时钟 + 共享 .wrangler/e2e 的 DO）。
 *
 * 用法：
 *   pnpm exec playwright test --config playwright.pixelgate.config.ts
 *   GODESK_UPDATE_BASELINE=1 pnpm exec playwright test --config playwright.pixelgate.config.ts -g 基线门
 */

const nodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
if (!Number.isFinite(nodeMajor) || nodeMajor < 22) {
  throw new Error(`GoDesk pixel gate needs Node.js >= 22 (Wrangler). Current: ${process.versions.node}.`);
}

/** 像素门独占端口。可用 GODESK_PIXELGATE_PORT 覆盖，但默认刻意不等于 8799。 */
const port = Number(process.env.GODESK_PIXELGATE_PORT ?? 8823);
const origin = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  // 只跑像素门这一个 spec：别的 spec 有自己的就绪假设，混跑会互相拖慢。
  testMatch: /visual-regression-gate\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 600_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: origin,
    trace: "retain-on-failure",
    // 像素比对要求设备像素比固定，否则不同 DPR 下截图尺寸不同。
    deviceScaleFactor: 1,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], deviceScaleFactor: 1 },
    },
  ],
  webServer: {
    command: `GODESK_E2E_PORT=${port} bash scripts/e2e-webserver.sh`,
    url: origin,
    // 永不复用：像素门必须跑在自己构建的产物上。
    reuseExistingServer: false,
    timeout: 300_000,
    // 让 webServer 的输出在失败时可见（构建错误是常见失败原因）。
    stdout: "pipe",
    stderr: "pipe",
  },
});
