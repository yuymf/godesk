import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Server } from "node:http";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { startMockAssetServer } from "./helpers/mock-asset-server";

/**
 * GoDesk ② CC0 GLB chain: one plugin (MCP) sentence pulls a CC0 model from the
 * 3d-asset-server sidecar, it lands as a GLB in the project with an auto-written
 * assets/LICENSES.md row, and the Room renders it on the table.
 * Box: real sidecar on :8787 (Poly Haven). CI: in-test mock sidecar on :8787
 * (GODESK_E2E_ASSET_SERVER_PORT + ASSET_SERVER_URL in .dev.vars to force the mock locally).
 * Screenshots go to GODESK_EVIDENCE_DIR only when set (never committed).
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

test.describe("GoDesk ② CC0 GLB asset chain", () => {
  let mock: Server | null = null;

  test.beforeAll(async () => {
    const port = Number(process.env.GODESK_E2E_ASSET_SERVER_PORT ?? 8787);
    const live = await fetch(`http://127.0.0.1:${port}/health`).then((r) => r.ok).catch(() => false);
    if (!live) mock = await startMockAssetServer(port);
  });

  test.afterAll(async () => {
    await new Promise<void>((resolve) => (mock ? mock.close(() => resolve()) : resolve()));
  });

  test("one sentence pulls a CC0 GLB, writes LICENSES.md and renders it in the Room", async ({ page }) => {
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
    session.searchParams.set("tier", "high");
    const roomUrl = `${session.pathname}${session.search}`;

    const host = page.getByTestId("g3d-scene-host");
    await page.goto(roomUrl);
    await expect(host).toHaveAttribute("data-tier", "high", { timeout: 30_000 });
    await expect(host).not.toHaveAttribute("data-imported-models", /.*/);
    await page.waitForTimeout(2_500);
    if (EVIDENCE_DIR) await page.screenshot({ path: join(EVIDENCE_DIR, "before.png") });

    const pulled = await mcpCall(page.request, "pull_project_asset", {
      projectId,
      prompt: PULL_SENTENCE,
      idempotencyKey: `e2e-pull-${Date.now()}`,
    });
    expect(pulled.isError, JSON.stringify(pulled.content)).toBeFalsy();
    const out = pulled.structuredContent!;
    console.log("[asset-pull] ", JSON.stringify({ query: out.query, asset: out.asset }));
    expect(out.asset.licenseSpdx).toBe("CC0-1.0");
    expect(out.asset.path).toMatch(/^assets\/imported\/.+\.glb$/);
    expect(out.licensesMarkdown).toContain("CC0-1.0");
    expect(out.licensesMarkdown).toContain(out.asset.path);

    const imported = await (await page.request.get(`/api/projects/${projectId}?view=imported-assets`)).json();
    expect(imported.licensesMarkdown).toContain(out.asset.path);
    const project = await (await page.request.get(`/api/projects/${projectId}?view=sources`)).json();
    expect(JSON.stringify(project)).toContain("assets/LICENSES.md");
    const blob = await page.request.get(
      `/api/projects/${projectId}?view=imported-blob&assetId=${encodeURIComponent(out.asset.id)}`,
    );
    expect(blob.ok()).toBe(true);
    expect((await blob.body()).subarray(0, 4).toString("latin1")).toBe("glTF");

    await page.goto(roomUrl);
    await expect(host).toHaveAttribute("data-tier", "high", { timeout: 30_000 });
    await expect(host).toHaveAttribute("data-imported-models", "1", { timeout: 60_000 });
    await page.waitForTimeout(2_500);
    if (EVIDENCE_DIR) await page.screenshot({ path: join(EVIDENCE_DIR, "after.png") });
  });
});
