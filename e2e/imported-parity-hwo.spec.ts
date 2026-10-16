import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Server } from "node:http";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { startMockAssetServer } from "./helpers/mock-asset-server";
import { OTHELLO_PROMPT, generateApproveAndPlayable } from "./helpers/sol-max-baseline";

/**
 * Harbor / Worker / Othello importedModels parity (#160 follow-up after #164/#165).
 * Guest room + /play + /replay. Screenshots only when GODESK_EVIDENCE_DIR set.
 * Full chrome only (forbid board-only crop).
 */
const PULL = "给桌边加一个 CC0 木桶";
const EVIDENCE_DIR = process.env.GODESK_EVIDENCE_DIR;

async function mcpCall(request: APIRequestContext, name: string, args: Record<string, unknown>) {
  const headers: Record<string, string> = {
    accept: "application/json, text/event-stream",
    "content-type": "application/json",
  };
  const parse = async (response: Awaited<ReturnType<APIRequestContext["post"]>>) => {
    const text = await response.text();
    if ((response.headers()["content-type"] ?? "").includes("application/json")) return JSON.parse(text);
    const events = text.split("\n").filter((line) => line.startsWith("data: "));
    return JSON.parse(events.at(-1)!.slice("data: ".length));
  };
  const init = await request.post("/mcp", {
    headers,
    data: {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "godesk-e2e", version: "1" } },
    },
  });
  expect(init.ok()).toBe(true);
  const sessionId = init.headers()["mcp-session-id"];
  if (sessionId) headers["mcp-session-id"] = sessionId;
  await request.post("/mcp", { headers, data: { jsonrpc: "2.0", method: "notifications/initialized" } });
  const call = await request.post("/mcp", {
    headers,
    data: { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } },
    timeout: 90_000,
  });
  expect(call.ok()).toBe(true);
  return (await parse(call)).result as { isError?: boolean; structuredContent?: Record<string, any> };
}

async function shot(page: Page, name: string) {
  if (!EVIDENCE_DIR) return;
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  await page.screenshot({ path: join(EVIDENCE_DIR, name), fullPage: true });
}

async function pullAsset(page: Page, projectId: string, label: string) {
  const pulled = await mcpCall(page.request, "pull_project_asset", {
    projectId,
    prompt: PULL,
    idempotencyKey: `e2e-parity-${label}-${Date.now()}`,
  });
  expect(pulled.isError, JSON.stringify(pulled)).toBeFalsy();
}

async function assertGuestImported(browser: any, pathWithSearch: string, shotName: string) {
  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await guestPage.setViewportSize({ width: 1440, height: 900 });
  const url = new URL(pathWithSearch, "http://127.0.0.1");
  if (!url.searchParams.get("tier")) url.searchParams.set("tier", "high");
  await guestPage.goto(`${url.pathname}${url.search}`);
  const host = guestPage.getByTestId("g3d-scene-host");
  await expect(host).toBeVisible({ timeout: 60_000 });
  await guestPage.waitForTimeout(1_500);
  await shot(guestPage, `${shotName}-loading.png`);
  await expect(host).toHaveAttribute("data-imported-models", "1", { timeout: 60_000 });
  await guestPage.waitForTimeout(2_000);
  await shot(guestPage, `${shotName}.png`);
  await guest.close();
}

test.describe("imported models parity: Harbor / Worker / Othello", () => {
  let mock: Server | null = null;

  test.beforeAll(async () => {
    const port = Number(process.env.GODESK_E2E_ASSET_SERVER_PORT ?? 8787);
    const live = await fetch(`http://127.0.0.1:${port}/health`).then((r) => r.ok).catch(() => false);
    if (!live) mock = await startMockAssetServer(port);
  });

  test.afterAll(async () => {
    await new Promise<void>((resolve) => (mock ? mock.close(() => resolve()) : resolve()));
  });

  test("Harbor: guest room + /play + /replay show imported GLB", async ({ page, browser }) => {
    test.setTimeout(300_000);
    if (EVIDENCE_DIR) mkdirSync(EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/chatgpt-plugin/new");
    // G3D-17 homepage showcase is Tidewell-only; Harbor lives under 更多示例.
    await page.getByTestId("more-examples").click();
    await page.waitForURL(/[?&]examples=all/);
    const harbor = page.locator("article").filter({ hasText: "港口十三号" });
    await expect(harbor).toBeVisible({ timeout: 15_000 });
    await harbor.getByRole("button", { name: "先玩这一局" }).click();
    await page.waitForURL(/\/chatgpt-plugin\/room\//, { timeout: 90_000 });
    await expect(page.getByTestId("harbor-voyage-board")).toBeVisible();

    const sessionId = new URL(page.url()).pathname.split("/").at(-1)!;
    const share = new URL(page.url()).searchParams.get("share")!;
    const session = await (await page.request.get(
      `/api/sessions/${sessionId}?share=${encodeURIComponent(share)}`,
    )).json();
    const projectId = session.projectId as string;
    await pullAsset(page, projectId, "harbor");

    await assertGuestImported(browser, page.url(), "harbor-guest-room-after");

    const { builds } = await (await page.request.get(`/api/projects/${projectId}?view=builds`)).json();
    const build = builds.at(-1) as { playableUrl: string };
    const playUrl = new URL(build.playableUrl);
    if (!playUrl.searchParams.get("share")) playUrl.searchParams.set("share", share);
    await assertGuestImported(browser, `${playUrl.pathname}${playUrl.search}`, "harbor-guest-play-after");

    const replayUrl = new URL(session.replayUrl as string);
    if (!replayUrl.searchParams.get("share")) replayUrl.searchParams.set("share", share);
    await assertGuestImported(browser, `${replayUrl.pathname}${replayUrl.search}`, "harbor-guest-replay-after");
  });

  test("Worker: guest room + /play + /replay show imported GLB", async ({ page, browser }) => {
    test.setTimeout(300_000);
    if (EVIDENCE_DIR) mkdirSync(EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/chatgpt-plugin/new");
    await page.getByRole("button", { name: "轻桌游" }).click();
    await page.getByRole("button", { name: "生成可玩版本" }).click();
    await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 90_000 });
    await page.getByRole("button", { name: "确认玩法并开始试玩" }).click();
    await expect(page.getByRole("heading", { name: "现在就开玩" })).toBeVisible({ timeout: 90_000 });
    const projectId = new URL(page.url()).pathname.split("/").at(-1)!;
    const { sessions } = await (await page.request.get(`/api/projects/${projectId}?view=sessions`)).json();
    const session = sessions.at(-1) as { sessionUrl: string; replayUrl: string };
    const share = new URL(session.sessionUrl).searchParams.get("share")!;
    await pullAsset(page, projectId, "worker");

    await assertGuestImported(browser, session.sessionUrl, "worker-guest-room-after");

    const { builds } = await (await page.request.get(`/api/projects/${projectId}?view=builds`)).json();
    const build = builds.at(-1) as { playableUrl: string };
    const playUrl = new URL(build.playableUrl);
    if (!playUrl.searchParams.get("share")) playUrl.searchParams.set("share", share);
    await assertGuestImported(browser, `${playUrl.pathname}${playUrl.search}`, "worker-guest-play-after");

    const replayUrl = new URL(session.replayUrl);
    if (!replayUrl.searchParams.get("share")) replayUrl.searchParams.set("share", share);
    await assertGuestImported(browser, `${replayUrl.pathname}${replayUrl.search}`, "worker-guest-replay-after");
  });

  test("Othello: guest room + /play + /replay show imported GLB", async ({ page, browser }) => {
    test.setTimeout(300_000);
    if (EVIDENCE_DIR) mkdirSync(EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    const projectId = await generateApproveAndPlayable(page, OTHELLO_PROMPT);
    const { sessions } = await (await page.request.get(`/api/projects/${projectId}?view=sessions`)).json();
    const session = sessions.at(-1) as { sessionUrl: string; replayUrl: string };
    const share = new URL(session.sessionUrl).searchParams.get("share")!;
    await pullAsset(page, projectId, "othello");

    await assertGuestImported(browser, session.sessionUrl, "othello-guest-room-after");

    const { builds } = await (await page.request.get(`/api/projects/${projectId}?view=builds`)).json();
    const build = builds.at(-1) as { playableUrl: string };
    const playUrl = new URL(build.playableUrl);
    if (!playUrl.searchParams.get("share")) playUrl.searchParams.set("share", share);
    await assertGuestImported(browser, `${playUrl.pathname}${playUrl.search}`, "othello-guest-play-after");

    const replayUrl = new URL(session.replayUrl);
    if (!replayUrl.searchParams.get("share")) replayUrl.searchParams.set("share", share);
    await assertGuestImported(browser, `${replayUrl.pathname}${replayUrl.search}`, "othello-guest-replay-after");
  });
});
