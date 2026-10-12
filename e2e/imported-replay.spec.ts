import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Server } from "node:http";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { startMockAssetServer } from "./helpers/mock-asset-server";

/**
 * #160 follow-up: guest /replay must load imported GLBs (mirror PlayablePreview wiring).
 * Screenshots only when GODESK_EVIDENCE_DIR is set (never committed). Full chrome only.
 */
const HEX_ISLAND_PROMPT = "做一款可以与电脑对战的汐屿六角岛资源建造游戏";
const PULL_SENTENCE = "给汐屿的桌边加一个 CC0 木桶";
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
  return (await parse(call)).result as { isError?: boolean; structuredContent?: Record<string, any>; content?: unknown };
}

async function shot(page: Page, name: string) {
  if (!EVIDENCE_DIR) return;
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  // Full chrome (forbid board-only crop).
  await page.screenshot({ path: join(EVIDENCE_DIR, name), fullPage: true });
}

test.describe("imported models: guest /replay", () => {
  let mock: Server | null = null;

  test.beforeAll(async () => {
    const port = Number(process.env.GODESK_E2E_ASSET_SERVER_PORT ?? 8787);
    const live = await fetch(`http://127.0.0.1:${port}/health`).then((r) => r.ok).catch(() => false);
    if (!live) mock = await startMockAssetServer(port);
  });

  test.afterAll(async () => {
    await new Promise<void>((resolve) => (mock ? mock.close(() => resolve()) : resolve()));
  });

  test("guest /replay renders imported GLB (data-imported-models)", async ({ page, browser }) => {
    test.setTimeout(300_000);
    if (EVIDENCE_DIR) mkdirSync(EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/chatgpt-plugin/new");
    await page.getByRole("textbox", { name: "描述你的游戏想法" }).fill(HEX_ISLAND_PROMPT);
    await page.getByRole("button", { name: "生成可玩版本" }).click();
    await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 90_000 });
    await page.getByRole("button", { name: "确认玩法并开始试玩" }).click();
    await expect(page.getByRole("heading", { name: "现在就开玩" })).toBeVisible({ timeout: 90_000 });
    const projectId = new URL(page.url()).pathname.split("/").at(-1)!;
    const { sessions } = await (await page.request.get(`/api/projects/${projectId}?view=sessions`)).json();
    const session = sessions.at(-1) as { sessionUrl: string; replayUrl: string; replayId: string };
    const sessionUrl = new URL(session.sessionUrl);
    const share = sessionUrl.searchParams.get("share");
    expect(share).toBeTruthy();
    expect(session.replayUrl).toBeTruthy();

    const pulled = await mcpCall(page.request, "pull_project_asset", {
      projectId,
      prompt: PULL_SENTENCE,
      idempotencyKey: `e2e-replay-pull-${Date.now()}`,
    });
    expect(pulled.isError, JSON.stringify(pulled.content)).toBeFalsy();

    const replayUrl = new URL(session.replayUrl);
    if (!replayUrl.searchParams.get("share")) replayUrl.searchParams.set("share", share!);
    replayUrl.searchParams.set("tier", "high");

    const guest = await browser.newContext();
    const guestPage = await guest.newPage();
    await guestPage.setViewportSize({ width: 1440, height: 900 });

    // Guest can list imported assets with share= (ACL from #164).
    const guestList = await guestPage.request.get(
      `/api/projects/${projectId}?view=imported-assets&share=${encodeURIComponent(share!)}`,
    );
    expect(guestList.ok(), await guestList.text()).toBeTruthy();

    await guestPage.goto(`${replayUrl.pathname}${replayUrl.search}`);
    await expect(guestPage.locator("main.replay-view")).toBeVisible({ timeout: 30_000 });
    const host = guestPage.getByTestId("g3d-scene-host");
    await expect(host).toBeVisible({ timeout: 30_000 });
    await guestPage.waitForTimeout(1_500);
    await shot(guestPage, "guest-replay-before-or-loading.png");
    await expect(host).toHaveAttribute("data-imported-models", "1", { timeout: 60_000 });
    await guestPage.waitForTimeout(2_000);
    await shot(guestPage, "guest-replay-after.png");

    await guest.close();
  });
});
