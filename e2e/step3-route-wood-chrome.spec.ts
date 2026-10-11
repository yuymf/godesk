import { expect, test, type Page } from "@playwright/test";

/**
 * step3 同品质验收链路：插件 MCP 从规则书做一款铁路铺线游戏（network-route-v1）→
 * configure_render（正交 φ54/az12/fill 0.945 + 木框外壳 + 景物 + 铁轨 / 车站网格）→
 * compile → create_shared_session(aiSeats:[1]) → Room 里是汐屿同款木框全屏、正交 3D、电脑会应手。
 */
const RULES = [
  "《铁脉》规则书（原创，2 人）",
  "桌面是一张线路图，6 座城市：北港、西岭、东湾、河谷、矿山、南站。",
  "两名玩家轮流铺设路线：选择一段尚未被占领的路线占领它。",
  "第一位用自己铺设的路线连接北港与南站的玩家获胜。这是一款连接城市、claim routes 的 route network 游戏。",
].join("\n");

async function mcp(page: Page, id: number, name: string, args: Record<string, unknown>) {
  const response = await page.request.post("/mcp", {
    headers: { accept: "application/json, text/event-stream", "content-type": "application/json" },
    data: { jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } },
  });
  expect(response.status()).toBe(200);
  const text = await response.text();
  const line = (response.headers()["content-type"] ?? "").includes("application/json")
    ? text
    : text.split("\n").find((entry) => entry.startsWith("data: "))?.slice("data: ".length);
  const payload = JSON.parse(line!) as { result: { isError?: boolean; content: unknown[]; structuredContent?: Record<string, any> } };
  expect(payload.result.isError, JSON.stringify(payload.result.content)).not.toBe(true);
  return payload.result.structuredContent!;
}

async function waitJob(page: Page, id: number, jobId: string) {
  let job: Record<string, any> = {};
  await expect.poll(async () => {
    job = await mcp(page, id, "track_job", { jobId });
    return job.status;
  }, { timeout: 60_000 }).toMatch(/succeeded|failed/);
  expect(job.status, JSON.stringify(job.error ?? null)).toBe("succeeded");
  return job;
}

test("step3: plugin chain → rail game in Tidewell-quality wood chrome + ortho camera + AI seat", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/chatgpt-plugin/new");
  const { project } = await mcp(page, 1, "create_project", { name: "铁脉 e2e" });
  const gen = await mcp(page, 2, "submit_job", {
    kind: "generate-rule-system", projectId: project.id, expectedVersion: project.version,
    idea: "两人铺设路线、连接城市的铁路线路网络桌游", sourceContent: RULES, sourceName: "铁脉规则书", sourceKind: "rulebook",
    idempotencyKey: `step3-gen-${project.id}`,
  });
  await waitJob(page, 3, gen.id);
  const plan = (await mcp(page, 4, "read_project", { projectId: project.id, view: "generation-plan" })).data.generationPlan;
  expect(plan.proposedRuntime.op).toBe("configure_network_route");
  let version = (await mcp(page, 5, "read_project", { projectId: project.id })).data.version;
  await mcp(page, 6, "apply_project_patch", { projectId: project.id, expectedVersion: version, idempotencyKey: `step3-approve-${project.id}`, operations: [{ op: "approve_generation_plan", planId: plan.id }] });
  version = (await mcp(page, 7, "read_project", { projectId: project.id })).data.version;
  await mcp(page, 8, "apply_project_patch", {
    projectId: project.id, expectedVersion: version, idempotencyKey: `step3-render-${project.id}`,
    operations: [{ op: "configure_render", patch: {
      camera: { projection: "orthographic", polarDeg: 54, azimuthDeg: 12, fill: 0.945 },
      chrome: "wood",
      decor: { trees: 30, rocks: 8, seed: 3 },
      surround: { kind: "sea", shore: 0.9, coast: "natural", seed: 5 },
      hud: { portraits: "travelers", cardArt: "landscape" },
      materials: { map: { base: "#8fb865", roughness: 0.95, metalness: 0, pattern: "grass" } },
      bindings: [
        { objectKind: "station", mesh: "station", material: "ink", scale: 1.25 },
        { objectKind: "route", mesh: "rail-track", material: "ink", scale: 2.2 },
        { objectKind: "claim", mesh: "rail-track", material: "ink", scale: 1.1 },
      ],
    } }],
  });
  version = (await mcp(page, 9, "read_project", { projectId: project.id })).data.version;
  const compile = await mcp(page, 10, "submit_job", { kind: "compile-build", projectId: project.id, expectedVersion: version, idempotencyKey: `step3-compile-${project.id}` });
  const built = await waitJob(page, 11, compile.id);
  const session = await mcp(page, 12, "create_shared_session", { buildId: built.result.build.id, seed: 7, idempotencyKey: `step3-session-${project.id}`, aiSeats: [1] });
  expect(session.sessionUrl).toContain("share=");

  // R3：插件链 pull_project_asset（CC0 GLB）。无 sidecar 时跳过，有则断言 Room 挂上导入模型。
  let pulled = 0;
  for (const [i, prompt] of [
    "add a fern plant",
    "add a barrel",
  ].entries()) {
    try {
      const res = await page.request.post("/mcp", {
        headers: { accept: "application/json, text/event-stream", "content-type": "application/json" },
        data: { jsonrpc: "2.0", id: 20 + i, method: "tools/call", params: { name: "pull_project_asset", arguments: { projectId: project.id, prompt, idempotencyKey: `step3-pull-${i}-${project.id}` } } },
      });
      const text = await res.text();
      const line = (res.headers()["content-type"] ?? "").includes("application/json") ? text : text.split("\n").find((e) => e.startsWith("data: "))?.slice(6);
      const payload = JSON.parse(line!);
      if (!payload.result?.isError) pulled += 1;
    } catch { /* sidecar optional in CI */ }
  }

  await page.goto(`${session.sessionUrl}&judge=1`);
  await expect(page.locator(".tabletop-game-screen")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("main.room-view-tidewell-immersive")).toBeVisible();
  await expect(page.locator(".room-invitation")).toHaveCount(0);
  const host = page.getByTestId("g3d-scene-host").first();
  await expect(host).toHaveAttribute("data-tabletop-camera", "ortho:54:12:0.945", { timeout: 60_000 });
  // R2：盘外潮水 shader（岸台当海岸）+ 座位肖像 + 插画行动卡。
  await expect(host).toHaveAttribute("data-water", "on", { timeout: 60_000 });
  if (pulled > 0) {
    await expect(host).toHaveAttribute("data-imported-models", String(pulled), { timeout: 90_000 });
  }
  await expect(page.locator(".tabletop-portrait img")).toHaveCount(2);
  await expect.poll(async () => page.locator(".tabletop-action-row .tabletop-card-art").count()).toBeGreaterThan(0);

  const menu = page.locator("details.tidewell-menu");
  await menu.locator("summary").click();
  await page.getByLabel("你的席位").selectOption("0");
  await menu.locator("summary").click();
  const claim = page.locator(".tabletop-action-row button:not([disabled])");
  await expect.poll(async () => claim.count(), { timeout: 30_000 }).toBeGreaterThan(0);
  await claim.first().click();
  await expect(page.locator(".tidewell-chronicle")).toContainText("座位 1", { timeout: 30_000 });
  await expect.poll(async () => claim.count(), { timeout: 30_000 }).toBeGreaterThan(0);
  await page.goto("about:blank");
});
