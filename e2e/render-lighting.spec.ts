import { expect, test } from "@playwright/test";

/**
 * G3D-07：光照 / PBR / 软阴影 / 色调映射按档位生效。
 * 每档断言 AgX、阴影贴图尺寸（2048 / 1024 / 512）与 KTX2 PBR 套件流式替换（512 / 512 / 256），
 * 且贴图与 Basis 转码器请求全部成功。
 */
const CATAN_PROMPT = "做一款可以与电脑对战的卡坦岛基础版";
const EXPECTED = {
  high: { shadow: "2048", pbr: "512" },
  medium: { shadow: "1024", pbr: "512" },
  low: { shadow: "512", pbr: "256" },
} as const;

test("卡坦 3D: lighting, soft shadows and KTX2 PBR per quality tier", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/chatgpt-plugin/new");
  await page.getByRole("textbox", { name: "描述你的游戏想法" }).fill(CATAN_PROMPT);
  await page.getByRole("button", { name: "生成可玩版本" }).click();
  await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 90_000 });
  await page.getByRole("button", { name: "确认玩法并开始试玩" }).click();
  await expect(page.getByRole("heading", { name: "现在就开玩" })).toBeVisible({ timeout: 90_000 });
  const projectId = new URL(page.url()).pathname.split("/").at(-1)!;
  const { builds } = await (await page.request.get(`/api/projects/${projectId}?view=builds`)).json();
  const buildId = builds.at(-1).id as string;

  for (const tier of ["high", "medium", "low"] as const) {
    const textureResponses: { url: string; status: number }[] = [];
    const onResponse = (response: { url(): string; status(): number }) => {
      if (/\.ktx2$|basis_transcoder/.test(response.url())) {
        textureResponses.push({ url: new URL(response.url()).pathname, status: response.status() });
      }
    };
    page.on("response", onResponse);
    await page.goto(`/chatgpt-plugin/play/${encodeURIComponent(buildId)}?tier=${tier}`);
    const host = page.getByTestId("g3d-scene-host");
    await expect(host).toHaveAttribute("data-tier", tier, { timeout: 30_000 });
    await expect(host).toHaveAttribute("data-tone-mapping", "agx");
    await expect(host).toHaveAttribute("data-shadow-map-size", EXPECTED[tier].shadow);
    await expect(host).toHaveAttribute("data-pbr", EXPECTED[tier].pbr, { timeout: 60_000 });
    page.off("response", onResponse);
    expect(textureResponses.filter((entry) => entry.status >= 400), `${tier} texture requests`).toEqual([]);
    expect(textureResponses.some((entry) => /basis_transcoder.*\.wasm$/.test(entry.url)), `${tier} basis wasm`).toBe(true);
    expect(textureResponses.filter((entry) => entry.url.endsWith(".ktx2")).length, `${tier} ktx2 count`).toBeGreaterThanOrEqual(9);
  }
});
