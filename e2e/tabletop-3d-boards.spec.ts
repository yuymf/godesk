import { expect, test, type Page } from "@playwright/test";
import { NETWORK_PROMPT, OTHELLO_PROMPT, generateApproveAndPlayable, shareHrefFromStudio } from "./helpers/sol-max-baseline";

/**
 * G3D-14：通用 3D 桌面（平台默认底座）——四个空间 Kernel 的 Room 都挂 3D 舞台，
 * 合法动作经 3D 拾取管线发出（与 DOM 动作盘同一 actionId / payload）。
 */

async function expectTabletop(page: Page, kernel: string) {
  const stage = page.getByTestId("tabletop-stage");
  await expect(stage).toHaveAttribute("data-kernel", kernel);
  await expect(stage.locator("canvas")).toHaveCount(1, { timeout: 30_000 });
  const host = stage.getByTestId("g3d-scene-host");
  await expect.poll(async () => Number(await host.getAttribute("data-scene-nodes")), { timeout: 30_000 }).toBeGreaterThan(3);
  return { stage, host };
}

/**
 * 把桌面世界坐标投影到 canvas 像素（与 SceneHost 的 RenderSpec 机位一致：
 * 极角取 min/max 中点、距离按包围半径 / 7.5 缩放且窄屏时拉远到水平放得下、看向原点）。
 */
async function projectToCanvas(page: Page, world: [number, number, number], camera: { fovDeg: number; distance: number; minPolarDeg: number; maxPolarDeg: number }, radius: number) {
  const box = await page.getByTestId("tabletop-stage").locator("canvas").boundingBox();
  if (!box) throw new Error("tabletop canvas has no box");
  const polar = (((camera.minPolarDeg + camera.maxPolarDeg) / 2) * Math.PI) / 180;
  const halfH = Math.atan(Math.tan((camera.fovDeg * Math.PI) / 360) * (box.width / box.height));
  const distance = Math.max(camera.distance * Math.min(Math.max(radius / 7.5, 0.5), 1.6), (radius * 0.92) / Math.tan(halfH));
  const eye = [0, distance * Math.cos(polar), distance * Math.sin(polar)];
  const len = Math.hypot(eye[0]!, eye[1]!, eye[2]!);
  const forward = eye.map((value) => -value / len) as [number, number, number];
  // right = forward × up(0,1,0)
  const right: [number, number, number] = [-forward[2], 0, forward[0]];
  const rightLen = Math.hypot(...right);
  right[0] /= rightLen;
  right[2] /= rightLen;
  // up' = right × forward
  const up: [number, number, number] = [
    right[1] * forward[2] - right[2] * forward[1],
    right[2] * forward[0] - right[0] * forward[2],
    right[0] * forward[1] - right[1] * forward[0],
  ];
  const v = world.map((value, index) => value - eye[index]!) as [number, number, number];
  const dot = (a: number[], b: number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
  const depth = dot(v, forward);
  const tan = Math.tan(((camera.fovDeg / 2) * Math.PI) / 180);
  const aspect = box.width / box.height;
  const ndcX = dot(v, right) / (depth * tan * aspect);
  const ndcY = dot(v, up) / (depth * tan);
  return { x: box.x + ((ndcX + 1) / 2) * box.width, y: box.y + ((1 - ndcY) / 2) * box.height };
}

test.describe("G3D-14 generic 3D tabletop", () => {
  test("黑白棋: 3D 舞台 + 在 3D 盘面上点击合法格落子", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await generateApproveAndPlayable(page, OTHELLO_PROMPT);
    await page.goto(await shareHrefFromStudio(page));
    const board = page.getByRole("region", { name: "黑白棋盘" });
    await expect(board).toBeVisible();
    await page.getByLabel("你的席位").selectOption("0");
    await expect(board.getByRole("region", { name: "对局状态" })).toContainText("轮到你落子");
    const { stage, host } = await expectTabletop(page, "disc-flipping-v1");
    // 开局 4 子 + 4 个合法提示环 + 桌面 / 底板 / 网格线。
    await expect.poll(async () => Number(await host.getAttribute("data-scene-nodes"))).toBe(11);
    await stage.scrollIntoViewIfNeeded();

    const legal = board.getByRole("gridcell", { name: /可落子/ }).first();
    const label = (await legal.getAttribute("aria-label")) ?? "";
    const match = /(\d+)\D+(\d+)/.exec(label);
    expect(match, `legal cell label: ${label}`).toBeTruthy();
    const row = Number(match![1]) - 1;
    const col = Number(match![2]) - 1;
    // 8×8 盘：格宽 1，底板顶面 y = 0.24；包围半径 = hypot(8.5, 8.5) / 2 + 0.6。
    const point = await projectToCanvas(
      page,
      [-4 + col + 0.5, 0.24, -4 + row + 0.5],
      { fovDeg: 35, distance: 16, minPolarDeg: 25, maxPolarDeg: 70 },
      Math.hypot(8.5, 8.5) / 2 + 0.6,
    );
    await page.mouse.click(point.x, point.y);
    await expect(board.getByRole("region", { name: "对局状态" })).toContainText("最近落子", { timeout: 15_000 });
    await expect(board.getByLabel("子数")).toContainText(/黑\s*[3-9]/);
    await expect(page.locator(".action-log")).toContainText(/place/);
  });

  test("轻桌游（工人放置）: 在 3D 区域格上点击放置工人", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/chatgpt-plugin/new");
    await page.getByRole("button", { name: "轻桌游" }).click();
    await page.getByRole("button", { name: "生成可玩版本" }).click();
    await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 90_000 });
    await page.getByRole("button", { name: "确认玩法并开始试玩" }).click();
    await expect(page.getByRole("heading", { name: "现在就开玩" })).toBeVisible({ timeout: 90_000 });
    await page.goto(await shareHrefFromStudio(page));
    const board = page.locator(".worker-placement-board");
    await expect(board).toBeVisible();
    await page.getByLabel("你的席位").selectOption("0");
    await expect(page.getByRole("button", { name: "放置到资源区" })).toBeEnabled();
    const { stage, host } = await expectTabletop(page, "worker-placement-v1");
    const before = Number(await host.getAttribute("data-scene-nodes"));
    await stage.scrollIntoViewIfNeeded();
    // 3 个区域 → 2 列 × 2 行：格宽 4、格深 2.4；第一个区域（资源区）中心 (-2, 0.34, -1.2)。
    const point = await projectToCanvas(
      page,
      [-2, 0.34, -1.2],
      { fovDeg: 35, distance: 16, minPolarDeg: 25, maxPolarDeg: 70 },
      Math.hypot(8.8, 6.6) / 2 + 0.6,
    );
    await page.mouse.click(point.x, point.y);
    await expect(page.locator(".action-log")).toContainText(/place:region-\d+/, { timeout: 15_000 });
    await expect(board).toContainText("派工人前往资源区");
    // 工人棋子出现在 3D 桌面上（节点数变化）。
    await expect.poll(async () => Number(await host.getAttribute("data-scene-nodes"))).not.toBe(before);
  });

  test("线路网络: 3D 舞台显示站点与线路", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await generateApproveAndPlayable(page, NETWORK_PROMPT);
    await page.goto(await shareHrefFromStudio(page));
    await expect(page.getByRole("region", { name: "线路网络盘" })).toBeVisible();
    await expectTabletop(page, "network-route-v1");
  });

  test("港口十三号: 3D 舞台（水面桌 + 航道货船）", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/chatgpt-plugin/new");
    await page.getByText("先玩一局现成的").click();
    await page.locator("article").filter({ hasText: "港口十三号" }).getByRole("button", { name: "先玩这一局" }).click();
    await page.waitForURL(/\/chatgpt-plugin\/room\//, { timeout: 90_000 });
    await expect(page.getByTestId("harbor-voyage-board")).toBeVisible();
    await expectTabletop(page, "harbor-voyage-v1");
  });
});
