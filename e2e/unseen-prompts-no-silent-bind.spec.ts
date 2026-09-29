import { expect, test } from "@playwright/test";
import { UNSEEN_PROMPTS } from "./helpers/sol-max-baseline";

/**
 * Sol max PR10 — unseen / off-corpus prompts must not silent-bind Catan or Othello boards.
 * Deeper generation assertions live in worker/gamespec.test.ts + kernel-capabilities.test.ts.
 */
test.describe("PR10 unseen prompts: no silent Catan/Othello bind", () => {
  for (const prompt of UNSEEN_PROMPTS) {
    test(`studio after「${prompt.slice(0, 12)}…」never mounts hex/disc boards`, async ({
      page,
    }) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/chatgpt-plugin/new");
      await page.getByRole("textbox", { name: "描述你的游戏想法" }).fill(prompt);
      await page.getByRole("button", { name: "生成可玩版本" }).click();
      await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 90_000 });

      // Either pending plan (incl. 这局还做不到) or auto-playable — never Catan/Othello board chrome.
      await expect(
        page.getByRole("heading", { name: /先看这一局怎么玩|这一局的玩法|现在就开玩/ }),
      ).toBeVisible({ timeout: 90_000 });

      await expect(page.getByRole("region", { name: "黑白棋盘" })).toHaveCount(0);
      await expect(page.getByRole("region", { name: "卡坦六角岛" })).toHaveCount(0);
      await expect(page.locator('[data-lobby-mark="catan"]')).toHaveCount(0);
      await expect(page.locator('[data-lobby-mark="othello"]')).toHaveCount(0);

      const projectId = new URL(page.url()).pathname.split("/").at(-1)!;
      const rule = await (await page.request.get(`/api/projects/${projectId}?view=rule-system`)).json();
      const kernelType = rule.runtimeSupport?.kernel?.type ?? null;
      expect(kernelType).not.toBe("hex-settlement-v1");
      expect(kernelType).not.toBe("disc-flipping-v1");
      expect(rule.generation?.requestedMechanics ?? []).not.toContain("hex-settlement");
      expect(rule.generation?.requestedMechanics ?? []).not.toContain("disc-flipping");

      const planRes = await page.request.get(`/api/projects/${projectId}?view=generation-plan`);
      if (planRes.ok()) {
        const { generationPlan } = await planRes.json();
        const op = generationPlan?.proposedRuntime?.op ?? null;
        expect(op).not.toBe("configure_hex_settlement");
        expect(op).not.toBe("configure_disc_flipping");
      }
    });
  }
});
