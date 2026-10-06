import { devices, expect, test, type Browser, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { shareHrefFromStudio } from "./helpers/sol-max-baseline";

/**
 * G3D-15 part 2：「做一款两人翻转棋」→ 3D Room，三轮 MCP `configure_render`
 * （水面色 / 太阳高度角 / 棋子材质）每轮重编译、开新局，3D 桌面逐轮可见变化。
 * 数据层（逐轮 render 变化 + GameSpec 校验）由 worker/configure-render.test.ts 覆盖；
 * 这里断言的是同一组 patch 真的进了 Room 的 3D 舞台：DOM 上的生效值 + 截图像素差。
 * 设 GODESK_E2E_EVIDENCE_DIR 时额外落盘桌面 + iPhone 12 Pro 截图（不入库）。
 */
const IDEA = "做一款两人翻转棋";
const evidenceDir = process.env.GODESK_E2E_EVIDENCE_DIR;

type Stats = { meanAbsDiff: number; corner: [number, number, number]; tinted: number };

async function stageShot(page: Page) {
  const stage = page.getByTestId("tabletop-stage").first();
  await expect(stage.locator("canvas")).toHaveCount(1, { timeout: 60_000 });
  await page.waitForFunction(() => {
    const host = document.querySelector('[data-testid="tabletop-stage"] [data-testid="g3d-scene-host"]');
    const pbr = host?.getAttribute("data-pbr");
    return Boolean(host?.getAttribute("data-scene-nodes")) && pbr !== "pending";
  }, null, { timeout: 60_000 });
  // 等棋子落位动效与阴影贴图稳定（SwiftShader 软渲染）。
  await page.waitForTimeout(1_800);
  await stage.scrollIntoViewIfNeeded();
  return stage.screenshot({ animations: "disabled" });
}

/** 在页面里解码 PNG：整图平均绝对差、桌面区域平均色、"染色"棋子像素数。 */
async function imageStats(page: Page, current: Buffer, previous: Buffer | null): Promise<Stats> {
  return page.evaluate(async ({ cur, prev }) => {
    async function pixels(b64: string) {
      const image = new Image();
      image.src = `data:image/png;base64,${b64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(image, 0, 0);
      return ctx.getImageData(0, 0, image.width, image.height);
    }
    const a = await pixels(cur);
    let meanAbsDiff = 0;
    if (prev) {
      const b = await pixels(prev);
      const n = Math.min(a.data.length, b.data.length);
      let sum = 0;
      for (let i = 0; i < n; i += 4) {
        sum += Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]);
      }
      meanAbsDiff = sum / (3 * (n / 4));
    }
    // 桌面采样区：舞台左侧中下（盘面之外、背景之下），即木桌 / 水面平面。
    const corner: [number, number, number] = [0, 0, 0];
    const x0 = Math.floor(a.width * 0.02);
    const x1 = Math.max(x0 + 8, Math.floor(a.width * 0.12));
    const y0 = Math.floor(a.height * 0.55);
    const y1 = Math.max(y0 + 8, Math.floor(a.height * 0.9));
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const i = (y * a.width + x) * 4;
        corner[0] += a.data[i];
        corner[1] += a.data[i + 1];
        corner[2] += a.data[i + 2];
      }
    }
    const count = (x1 - x0) * (y1 - y0);
    let tinted = 0;
    for (let i = 0; i < a.data.length; i += 4) {
      const [r, g, bl] = [a.data[i], a.data[i + 1], a.data[i + 2]];
      // 暖色高饱和像素（酒红 / 金棋子）：红通道最大且比最小通道高 60 以上。
      // 黑白棋子、绿呢盘面、水面平面、米色背景都不满足；本测试只在第 0 轮（木桌）之后比较。
      if (r >= g && r >= bl && r - Math.min(g, bl) > 60) tinted += 1;
    }
    return { meanAbsDiff, corner: corner.map((v) => Math.round(v / count)) as [number, number, number], tinted };
  }, { cur: current.toString("base64"), prev: previous ? previous.toString("base64") : null });
}

async function callMcp(page: Page, id: number, name: string, args: Record<string, unknown>) {
  const response = await page.request.post("/mcp", {
    headers: { accept: "application/json, text/event-stream", "content-type": "application/json" },
    data: { jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } },
  });
  expect(response.status()).toBe(200);
  const text = await response.text();
  const line = (response.headers()["content-type"] ?? "").includes("application/json")
    ? text
    : text.split("\n").find((entry) => entry.startsWith("data: "))?.slice("data: ".length);
  expect(line, text).toBeTruthy();
  const payload = JSON.parse(line!) as { result: { isError?: boolean; content: unknown[]; structuredContent?: Record<string, unknown> } };
  expect(payload.result.isError, JSON.stringify(payload.result.content)).not.toBe(true);
  return payload.result.structuredContent!;
}

async function projectVersion(page: Page, projectId: string) {
  return (await (await page.request.get(`/api/projects/${projectId}`)).json()).version as number;
}

/** 与 Studio「改完即开一局」同一条路：compile-build → 新 Shared Session。 */
async function compileAndOpen(page: Page, projectId: string, key: string) {
  const queued = await (await page.request.post(`/api/projects/${projectId}/jobs`, {
    data: { kind: "compile-build", expectedVersion: await projectVersion(page, projectId), idempotencyKey: `${key}-compile` },
  })).json();
  let job = queued;
  await expect.poll(async () => {
    job = await (await page.request.get(`/api/jobs/${queued.id}`)).json();
    return job.status;
  }, { timeout: 30_000 }).toMatch(/succeeded|failed/);
  expect(job.status, job.error).toBe("succeeded");
  const build = job.result.build;
  const session = await (await page.request.post(`/api/builds/${build.id}/sessions`, {
    data: { seed: 42, idempotencyKey: `${key}-session` },
  })).json();
  expect(session.sessionUrl).toBeTruthy();
  return { build, sessionUrl: new URL(session.sessionUrl, page.url()).href };
}

async function mobileEvidence(browser: Browser, url: string, name: string) {
  if (!evidenceDir) return;
  const context = await browser.newContext({ ...devices["iPhone 12 Pro"] });
  try {
    const mobile = await context.newPage();
    await mobile.goto(url);
    const shot = await stageShot(mobile);
    await writeFile(`${evidenceDir}/${name}-iphone12pro-390x844.png`, shot);
    await mobile.screenshot({ path: `${evidenceDir}/${name}-iphone12pro-390x844-page.png` });
    // 先离开 Room 让会话 WebSocket 正常关闭，再关 context（本地 wrangler dev 对突断连接不稳）。
    await mobile.goto("about:blank");
  } finally {
    await context.close();
  }
}

test("NL「做一款两人翻转棋」→ 3D Room：三轮 configure_render 逐轮在 3D 桌面上可见", async ({ page, browser }) => {
  test.setTimeout(300_000);
  if (evidenceDir) await mkdir(evidenceDir, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/chatgpt-plugin/new");
  await page.getByRole("textbox", { name: "描述你的游戏想法" }).fill(IDEA);
  await page.getByRole("button", { name: "生成可玩版本" }).click();
  await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 90_000 });
  await expect(page.getByRole("heading", { name: "先看这一局怎么玩" })).toBeVisible({ timeout: 30_000 });
  const projectId = new URL(page.url()).pathname.split("/").at(-1)!;
  await page.getByRole("button", { name: "确认玩法并开始试玩" }).click();
  await expect(page.getByRole("heading", { name: "现在就开玩" })).toBeVisible({ timeout: 90_000 });
  const rule = await (await page.request.get(`/api/projects/${projectId}?view=rule-system`)).json();
  expect(rule.runtimeSupport).toMatchObject({ status: "executable", kernel: { type: "disc-flipping-v1" } });
  expect(rule.presentation.render.water.enabled).toBe(false);

  // 第 0 轮：Studio 自己开的那一局（真实 UI 路径）。
  const baseUrl = await shareHrefFromStudio(page);
  await page.goto(baseUrl);
  await page.waitForURL(/\/chatgpt-plugin\/room\//, { timeout: 15_000 });
  const board = page.getByRole("region", { name: "黑白棋盘" });
  await expect(board).toBeVisible();
  const scene = board.locator(".tabletop-scene");
  await expect(scene).toHaveAttribute("data-render-water", "off");
  await expect(scene).toHaveAttribute("data-render-sun-elevation", String(rule.presentation.render.lighting.sun.elevationDeg));
  let previous = await stageShot(page);
  const base = await imageStats(page, previous, null);
  // 木桌：红通道高于蓝通道。
  expect(base.corner[0]).toBeGreaterThan(base.corner[2]);
  if (evidenceDir) {
    await writeFile(`${evidenceDir}/round-0-base-desktop-1440x900.png`, previous);
    await mobileEvidence(browser, baseUrl, "round-0-base");
  }

  const rounds: Array<{
    name: string;
    patch: Record<string, unknown>;
    attr: [string, string];
    /** 整图平均绝对差下限：棋子只占舞台约 1%，材质轮的整图差天然很小，靠染色像素数判定。 */
    minDiff: number;
    check: (stats: Stats, prior: Stats) => void;
  }> = [
    {
      name: "round-1-water",
      patch: { water: { enabled: true, shallow: "#3fa7c9" } },
      attr: ["data-render-water", "#3fa7c9"],
      minDiff: 10,
      // 桌面变成浅水色平面：蓝通道压过红通道。
      check: (stats) => expect(stats.corner[2]).toBeGreaterThan(stats.corner[0] + 30),
    },
    {
      name: "round-2-sun",
      patch: { lighting: { sun: { elevationDeg: 18 } } },
      attr: ["data-render-sun-elevation", "18"],
      minDiff: 3,
      // 低太阳：受光变暗、影子拉长 —— 桌面区域整体变暗。
      check: (stats, prior) => expect(stats.corner[0] + stats.corner[1] + stats.corner[2]).toBeLessThan(prior.corner[0] + prior.corner[1] + prior.corner[2]),
    },
    {
      name: "round-3-piece-material",
      patch: { materials: {
        seat0: { base: "#7a1f2b", roughness: 0.25, metalness: 0.35 },
        seat1: { base: "#e8c35a", roughness: 0.25, metalness: 0.35 },
      } },
      attr: ["data-render-seat0", "#7a1f2b/0.25/0.35"],
      minDiff: 0.1,
      // 黑白棋子换成酒红 / 金：染色棋子像素显著增加。
      check: (stats, prior) => expect(stats.tinted).toBeGreaterThan(prior.tinted + 800),
    },
  ];

  let prior = base;
  for (const [index, round] of rounds.entries()) {
    const result = await callMcp(page, 500 + index, "apply_project_patch", {
      projectId,
      expectedVersion: await projectVersion(page, projectId),
      idempotencyKey: `g3d15-room-${projectId}-${index}`,
      operations: [{ op: "configure_render", patch: round.patch }],
    });
    expect((result.ruleSystem as { presentation?: { render?: unknown } }).presentation?.render).toBeTruthy();
    const { build, sessionUrl } = await compileAndOpen(page, projectId, `g3d15-room-${projectId}-${index}`);
    expect(build.ruleSystem.presentation.render).toEqual(
      (await (await page.request.get(`/api/projects/${projectId}?view=rule-system`)).json()).presentation.render,
    );
    await page.goto(sessionUrl);
    await page.waitForURL(/\/room\//, { timeout: 15_000 });
    await expect(page.getByRole("region", { name: "黑白棋盘" }).locator(".tabletop-scene")).toHaveAttribute(round.attr[0], round.attr[1]);
    const shot = await stageShot(page);
    const stats = await imageStats(page, shot, previous);
    if (evidenceDir) {
      await writeFile(`${evidenceDir}/${round.name}-desktop-1440x900.png`, shot);
      await writeFile(`${evidenceDir}/${round.name}-stats.json`, JSON.stringify(stats, null, 2));
    }
    expect(stats.meanAbsDiff, `${round.name} 与上一轮截图几乎相同`).toBeGreaterThan(round.minDiff);
    round.check(stats, prior);
    await mobileEvidence(browser, sessionUrl, round.name);
    previous = shot;
    prior = stats;
  }
});
