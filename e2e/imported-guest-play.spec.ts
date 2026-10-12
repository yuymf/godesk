import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Server } from "node:http";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { startMockAssetServer } from "./helpers/mock-asset-server";

/**
 * #160 follow-up: share-link guests + /play preview must load imported GLBs.
 * Screenshots only when GODESK_EVIDENCE_DIR is set (never committed).
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
  await page.screenshot({ path: join(EVIDENCE_DIR, name), fullPage: true });
}

test.describe("imported models: share guest + /play", () => {
  let mock: Server | null = null;

  test.beforeAll(async () => {
    const port = Number(process.env.GODESK_E2E_ASSET_SERVER_PORT ?? 8787);
    const live = await fetch(`http://127.0.0.1:${port}/health`).then((r) => r.ok).catch(() => false);
    if (!live) mock = await startMockAssetServer(port);
  });

  test.afterAll(async () => {
    await new Promise<void>((resolve) => (mock ? mock.close(() => resolve()) : resolve()));
  });

  test("guest room share and /play both render imported GLB", async ({ page, browser }) => {
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
    const session = new URL(sessions.at(-1).sessionUrl as string);
    const share = session.searchParams.get("share");
    expect(share).toBeTruthy();
    const roomUrl = `${session.pathname}${session.search}&tier=high`;

    const pulled = await mcpCall(page.request, "pull_project_asset", {
      projectId,
      prompt: PULL_SENTENCE,
      idempotencyKey: `e2e-guest-pull-${Date.now()}`,
    });
    expect(pulled.isError, JSON.stringify(pulled.content)).toBeFalsy();
    const assetId = pulled.structuredContent!.asset.id as string;

    // Guest perspective (fresh context, no creator cookies): share link only.
    const guest = await browser.newContext();
    const guestPage = await guest.newPage();
    await guestPage.setViewportSize({ width: 1440, height: 900 });

    const guestList = await guestPage.request.get(
      `/api/projects/${projectId}?view=imported-assets&share=${encodeURIComponent(share!)}`,
    );
    expect(guestList.ok(), await guestList.text()).toBeTruthy();
    const guestBlob = await guestPage.request.get(
      `/api/projects/${projectId}?view=imported-blob&assetId=${encodeURIComponent(assetId)}&share=${encodeURIComponent(share!)}`,
    );
    expect(guestBlob.ok(), await guestBlob.text()).toBeTruthy();
    expect((await guestBlob.body()).subarray(0, 4).toString("latin1")).toBe("glTF");

    // Forged share must not fall through to local-creator on 127.0.0.1.
    const forged = await guestPage.request.get(
      `/api/projects/${projectId}?view=imported-assets&share=not-a-valid-token`,
    );
    expect(forged.status()).toBe(401);

    await guestPage.goto(roomUrl);
    const guestHost = guestPage.getByTestId("g3d-scene-host");
    await expect(guestHost).toHaveAttribute("data-tier", "high", { timeout: 30_000 });
    // BEFORE evidence: if the old bug regresses, data-imported-models stays unset.
    await guestPage.waitForTimeout(1_500);
    await shot(guestPage, "guest-room-before-or-loading.png");
    await expect(guestHost).toHaveAttribute("data-imported-models", "1", { timeout: 60_000 });
    await guestPage.waitForTimeout(2_000);
    await shot(guestPage, "guest-room-after.png");

    const { builds } = await (await page.request.get(`/api/projects/${projectId}?view=builds`)).json();
    const build = builds.at(-1) as { id: string; playableUrl: string };
    const playUrl = new URL(build.playableUrl);
    // Ensure share is present for guest /play
    if (!playUrl.searchParams.get("share")) playUrl.searchParams.set("share", share!);
    playUrl.searchParams.set("tier", "high");

    await guestPage.goto(`${playUrl.pathname}${playUrl.search}`);
    const playHost = guestPage.getByTestId("g3d-scene-host");
    await expect(playHost).toBeVisible({ timeout: 30_000 });
    await guestPage.waitForTimeout(1_500);
    await shot(guestPage, "guest-play-before-or-loading.png");
    await expect(playHost).toHaveAttribute("data-imported-models", "1", { timeout: 60_000 });
    await guestPage.waitForTimeout(2_000);
    await shot(guestPage, "guest-play-after.png");

    await guest.close();
  });
});
