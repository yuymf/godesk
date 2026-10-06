import { expect, test } from "@playwright/test";

// PR5/PR6 closed Othello + Tidewell baseline capability gaps. Remaining e2e below
// covers playable save/reopen and declared-mechanic mismatch refusal.

test("saved validated source reopens, shares and accepts a real action", async ({ page, browser }) => {
  await page.goto("/chatgpt-plugin/new");
  await page.getByRole("textbox", { name: "描述你的游戏想法" }).fill(
    "三位玩家轮流发言扩展同一个点子；每回合必须写一句回应，12 回合后结束。",
  );
  await page.getByRole("button", { name: "生成可玩版本" }).click();
  await page.waitForURL(/\/chatgpt-plugin\/studio\//);
  const saved = page.getByRole("region", { name: "已保存的游戏规则" });
  await expect(saved).toContainText("规则校验通过，已保存。");
  await page.reload();
  await expect(saved).toContainText("规则校验通过，已保存。");
  const link = page.getByRole("link", { name: "独立打开这一局" });
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  const guest = await browser.newContext();
  try {
    const joined = await guest.newPage();
    await joined.goto(new URL(href!, page.url()).href);
    await joined.getByLabel("你的席位").selectOption("0");
    await joined.getByLabel("写下你的发言").fill("保存后的游戏仍然可以继续这个故事。");
    await joined.getByRole("region", { name: "你的行动" }).getByRole("button").first().click();
    await expect(joined.locator(".speech-transcript")).toContainText("保存后的游戏仍然可以继续这个故事。");
  } finally {
    await guest.close();
  }
});

test("declared unsupported mechanics refuse a new version after reopening a playable game", async ({ page }) => {
  await page.goto("/chatgpt-plugin/new");
  await page.getByRole("textbox", { name: "描述你的游戏想法" }).fill(
    "三位玩家轮流发言扩展同一个点子；每回合必须写一句回应，12 回合后结束。",
  );
  await page.getByRole("button", { name: "生成可玩版本" }).click();
  await page.waitForURL(/\/chatgpt-plugin\/studio\//);
  await expect(page.getByRole("link", { name: "独立打开这一局" })).toBeVisible();
  const projectId = new URL(page.url()).pathname.split("/").at(-1)!;
  const project = await (await page.request.get(`/api/projects/${projectId}`)).json();
  const rule = await (await page.request.get(`/api/projects/${projectId}?view=rule-system`)).json();
  // A Plugin can declare mechanics without mentioning a known game title.
  const changed = await page.request.post(`/api/projects/${projectId}/changes`, { data: {
    expectedVersion: project.version, idempotencyKey: "declare-unsupported-mechanics",
    operations: [{ op: "update_rule_system", fields: { generation: {
      ...rule.generation, requestedMechanics: ["disc-flipping"],
    } } }],
  } });
  expect(changed.ok()).toBe(true);
  await page.reload();
  await expect(page.getByRole("region", { name: "已保存的游戏规则" })).toContainText("能力缺口");
  await page.getByRole("button", { name: "生成新版本", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("gamespec_invalid");
  const { builds } = await (await page.request.get(`/api/projects/${projectId}?view=builds`)).json();
  expect(builds).toHaveLength(1);
});
