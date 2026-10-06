import { expect, test, type Page } from "@playwright/test";

/**
 * G3D-ART-2：点数筹码数字可读。
 * 断言 ① 每个带数字的筹码都有一个数字贴花（scene host `data-number-labels`）；
 * ② 从默认机位看，每个贴花都在视锥内、朝向相机；③ 像素探针：贴花包围盒里有墨色（普通）
 *   或赤陶色（6 / 8）像素 —— 真的画出来了，而不仅是挂在场景里。
 * G3D-ART-3：④ 每个贴花数字都在 2..12，且与渲染输入的棋盘状态逐格一致（`__g3dBoardNumbers`，
 *   独立于 mapper）；整盘是卡坦标准点数分布（远处「12」曾被看成「17」，见 number-labels.ts）。
 */
const STANDARD_NUMBERS = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];
const PROMPT = "做一款可以与电脑对战的汐屿六角岛资源建造游戏";

type ScreenLabel = { id: string; number: number; hot: boolean; box: [number, number, number, number]; inView: boolean; facing: boolean };

async function openPreview(page: Page) {
  await page.goto("/chatgpt-plugin/new");
  await page.getByRole("textbox", { name: "描述你的游戏想法" }).fill(PROMPT);
  await page.getByRole("button", { name: "生成可玩版本" }).click();
  await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 90_000 });
  await page.getByRole("button", { name: "确认玩法并开始试玩" }).click();
  await expect(page.getByRole("heading", { name: "现在就开玩" })).toBeVisible({ timeout: 90_000 });
  const projectId = new URL(page.url()).pathname.split("/").at(-1)!;
  const { builds } = await (await page.request.get(`/api/projects/${projectId}?view=builds`)).json();
  const buildId = builds.at(-1).id as string;
  await page.goto(`/chatgpt-plugin/play/${encodeURIComponent(buildId)}`);
}

/** 在页面里解码截图 PNG 并统计每个包围盒内的墨色 / 赤陶色像素。 */
async function probe(page: Page, png: Buffer, labels: ScreenLabel[]) {
  return page.evaluate(
    async ({ b64, labels }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      return labels.map((label) => {
        const [x0, y0, x1, y1] = label.box.map((v) => Math.round(v));
        const w = Math.max(1, x1 - x0);
        const h = Math.max(1, y1 - y0);
        const data = ctx.getImageData(x0, y0, w, h).data;
        let ink = 0;
        let terracotta = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
          const lum = 0.3 * r + 0.59 * g + 0.11 * b;
          if (lum < 95 && Math.abs(r - b) < 60) ink += 1;
          if (r > 110 && r - g > 45 && r - b > 55 && lum < 150) terracotta += 1;
        }
        return { id: label.id, number: label.number, hot: label.hot, ink, terracotta, area: w * h };
      });
    },
    { b64: png.toString("base64"), labels },
  );
}

for (const viewport of [
  { name: "desktop 1440x900", size: { width: 1440, height: 900 } },
  { name: "iPhone 12 Pro 390x844", size: { width: 390, height: 844 } },
]) {
  test(`hex number tokens show readable numerals (${viewport.name})`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(viewport.size);
    await openPreview(page);
    const host = page.getByTestId("g3d-scene-host").first();
    await expect(host).toHaveAttribute("data-number-labels", "18", { timeout: 60_000 });
    await host.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1_500);
    const labels = (await page.evaluate(() =>
      (globalThis as { __g3dNumberLabels?: () => unknown }).__g3dNumberLabels?.() ?? [],
    )) as ScreenLabel[];
    expect(labels).toHaveLength(18);
    expect(labels.every((l) => l.inView && l.facing)).toBe(true);
    expect(labels.filter((l) => l.hot).map((l) => l.number).sort()).toEqual([6, 6, 8, 8]);
    for (const l of labels) {
      expect(Number.isInteger(l.number) && l.number >= 2 && l.number <= 12 && l.number !== 7, `token ${l.id} value ${l.number}`).toBe(true);
    }
    expect(labels.map((l) => l.number).sort((a, b) => a - b)).toEqual(STANDARD_NUMBERS);
    const board = (await page.evaluate(() =>
      (globalThis as { __g3dBoardNumbers?: unknown }).__g3dBoardNumbers ?? [],
    )) as { q: number; r: number; number: number }[];
    expect(board).toHaveLength(18);
    const rendered = Object.fromEntries(labels.map((l) => [l.id, l.number]));
    for (const tile of board) {
      expect(rendered[`num:${tile.q},${tile.r}`], `tile ${tile.q},${tile.r}`).toBe(tile.number);
    }
    const shot = await host.screenshot();
    // 截图坐标 = host 内 CSS 像素；贴花盒也是 canvas 内 CSS 像素（canvas 铺满 host）。
    const results = await probe(page, shot, labels);
    for (const r of results) {
      if (r.hot) expect(r.terracotta, `token ${r.id} (${r.number}) terracotta pixels`).toBeGreaterThan(3);
      else expect(r.ink, `token ${r.id} (${r.number}) ink pixels`).toBeGreaterThan(3);
    }
  });
}
