import { expect, test, type Page } from "@playwright/test";

const MOCK_SEARCH = {
  query: "trees",
  types: ["model"],
  results: [
    {
      id: "polyhaven:tree_small_02",
      provider: "polyhaven",
      nativeId: "tree_small_02",
      title: "Tree Small 02",
      type: "model",
      tags: ["tree"],
      url: "https://polyhaven.com/a/tree_small_02",
      thumbnailUrl: "https://cdn.polyhaven.com/asset_img/thumbs/tree_small_02.png?width=256",
      author: "Rico Cilliers",
      license: {
        name: "CC0",
        url: "https://creativecommons.org/publicdomain/zero/1.0/",
        commercialUse: true,
        attributionRequired: false,
      },
      price: { free: true },
      downloadable: true,
      score: 1,
    },
    {
      id: "fab:sci-fi-crate",
      provider: "fab",
      nativeId: "sci-fi-crate",
      title: "Sci-Fi Crate",
      type: "model",
      tags: ["crate"],
      url: "https://www.fab.com/listings/sci-fi-crate",
      author: "Fab listing",
      license: { name: "per listing", attributionRequired: true },
      price: { free: true },
      downloadable: false,
      score: 0.2,
    },
  ],
  providers: [
    { provider: "polyhaven", name: "Poly Haven", status: "ok", count: 1, tookMs: 12 },
    { provider: "fab", name: "Fab", status: "link", count: 0, tookMs: 0, searchUrl: "https://www.fab.com/search?q=trees" },
  ],
};

async function mockAssetServer(page: Page) {
  const sidecarLive = await fetch("http://127.0.0.1:8787/health")
    .then((response) => response.ok)
    .catch(() => false);
  if (!sidecarLive) {
    await page.route("**/api/asset-search**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SEARCH),
      });
    });
  }
  await page.route("**/api/asset-download**", async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "model/gltf-binary",
        "content-disposition": 'attachment; filename="tree.glb"',
      },
      body: Buffer.from("glTF"),
    });
  });
  return sidecarLive;
}

test("Studio 资产搜索 renders licences and writes LICENSES.md on 加入项目", async ({ page }) => {
  const sidecarLive = await mockAssetServer(page);
  const created = await page.request.post("/api/projects", {
    data: { name: "汐屿资产搜索" },
  });
  expect(created.ok()).toBe(true);
  const { project } = await created.json();
  await page.goto(`/chatgpt-plugin/studio/${project.id}`);
  await page.getByRole("navigation", { name: "游戏导航" }).getByRole("link", { name: "资产搜索" }).click();
  const panel = page.locator("#asset-search");
  await expect(panel.getByRole("heading", { name: "资产搜索" })).toBeVisible();
  await expect(panel.getByText("http://127.0.0.1:8787")).toBeVisible();
  await panel.getByRole("textbox", { name: "搜索模型、材质或 HDRI" }).fill("trees");
  if (!sidecarLive) {
    await panel.getByRole("checkbox", { name: "可直接下载" }).uncheck();
    await panel.getByRole("checkbox", { name: "优先免费直链源" }).uncheck();
  }
  await panel.getByRole("button", { name: "搜索" }).click();
  await expect(panel.getByText(/许可证：/)).toBeVisible({ timeout: 30_000 });
  if (!sidecarLive) {
    await expect(panel.getByText("仅外链")).toBeVisible();
    await expect(panel.getByText("需署名")).toBeVisible();
  }
  await panel.getByRole("button", { name: "加入项目" }).first().click();
  await expect(panel.getByText(/已加入项目/)).toBeVisible({ timeout: 30_000 });
  const imported = await (await page.request.get(
    `/api/projects/${project.id}?view=imported-assets`,
  )).json();
  expect(imported.licensesMarkdown).toMatch(/CC0-1\.0/);
  expect(imported.licensesMarkdown).toMatch(/资产 id/);
  expect(imported.assets.length).toBeGreaterThan(0);
});
