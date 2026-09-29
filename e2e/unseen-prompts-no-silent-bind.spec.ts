import { expect, test } from "@playwright/test";
import {
  CARD_AREA_PROMPT,
  NETWORK_PROMPT,
  OTHER_UNSEEN_PROMPTS,
  UNSEEN_PROMPTS,
} from "./helpers/sol-max-baseline";

/**
 * Sol max PR10–PR12 — unseen / off-corpus prompts must not silent-bind Catan or Othello.
 * PR11: 线路网络 may now bind network-route-v1 (still never Catan/Othello).
 * PR12: 卡牌区域控制 may now bind hand-play-v1 (still never hex/disc/network).
 */
test.describe("PR10/PR11/PR12 unseen prompts: no silent Catan/Othello bind", () => {
  test("线路网络 binds network-route (never Catan/Othello boards)", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/chatgpt-plugin/new");
    await page.getByRole("textbox", { name: "描述你的游戏想法" }).fill(NETWORK_PROMPT);
    await page.getByRole("button", { name: "生成可玩版本" }).click();
    await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 90_000 });

    await expect(
      page.getByRole("heading", { name: /先看这一局怎么玩|这一局的玩法|现在就开玩/ }),
    ).toBeVisible({ timeout: 90_000 });

    await expect(page.getByRole("region", { name: "黑白棋盘" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "卡坦六角岛" })).toHaveCount(0);
    await expect(page.locator('[data-lobby-mark="catan"]')).toHaveCount(0);
    await expect(page.locator('[data-lobby-mark="othello"]')).toHaveCount(0);

    const projectId = new URL(page.url()).pathname.split("/").at(-1)!;
    const rule = await (await page.request.get(`/api/projects/${projectId}?view=rule-system`)).json();
    expect(rule.runtimeSupport?.kernel?.type ?? null).not.toBe("hex-settlement-v1");
    expect(rule.runtimeSupport?.kernel?.type ?? null).not.toBe("disc-flipping-v1");
    expect(rule.generation?.requestedMechanics ?? []).not.toContain("hex-settlement");
    expect(rule.generation?.requestedMechanics ?? []).not.toContain("disc-flipping");
    expect(rule.generation?.requestedMechanics ?? []).toContain("route-network");

    const planRes = await page.request.get(`/api/projects/${projectId}?view=generation-plan`);
    if (planRes.ok()) {
      const { generationPlan } = await planRes.json();
      const op = generationPlan?.proposedRuntime?.op ?? null;
      expect(op).not.toBe("configure_hex_settlement");
      expect(op).not.toBe("configure_disc_flipping");
      // Pending plan should propose network configure; after auto-approve kernel is executable.
      if (op) expect(op).toBe("configure_network_route");
    }
  });

  test("卡牌区域控制 binds hand-play (never hex/disc/network)", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/chatgpt-plugin/new");
    await page.getByRole("textbox", { name: "描述你的游戏想法" }).fill(CARD_AREA_PROMPT);
    await page.getByRole("button", { name: "生成可玩版本" }).click();
    await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 90_000 });

    await expect(
      page.getByRole("heading", { name: /先看这一局怎么玩|这一局的玩法|现在就开玩/ }),
    ).toBeVisible({ timeout: 90_000 });

    await expect(page.getByRole("region", { name: "黑白棋盘" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "卡坦六角岛" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "线路网络盘" })).toHaveCount(0);
    await expect(page.locator('[data-lobby-mark="catan"]')).toHaveCount(0);
    await expect(page.locator('[data-lobby-mark="othello"]')).toHaveCount(0);
    await expect(page.locator('[data-lobby-mark="network"]')).toHaveCount(0);

    const projectId = new URL(page.url()).pathname.split("/").at(-1)!;
    const rule = await (await page.request.get(`/api/projects/${projectId}?view=rule-system`)).json();
    const kernelType = rule.runtimeSupport?.kernel?.type ?? null;
    expect(kernelType).not.toBe("hex-settlement-v1");
    expect(kernelType).not.toBe("disc-flipping-v1");
    expect(kernelType).not.toBe("network-route-v1");
    expect(rule.generation?.requestedMechanics ?? []).toContain("hand-play");
    expect(rule.generation?.requestedMechanics ?? []).not.toContain("hex-settlement");
    expect(rule.generation?.requestedMechanics ?? []).not.toContain("disc-flipping");
    expect(rule.generation?.requestedMechanics ?? []).not.toContain("route-network");

    const planRes = await page.request.get(`/api/projects/${projectId}?view=generation-plan`);
    if (planRes.ok()) {
      const { generationPlan } = await planRes.json();
      const op = generationPlan?.proposedRuntime?.op ?? null;
      expect(op).not.toBe("configure_hex_settlement");
      expect(op).not.toBe("configure_disc_flipping");
      expect(op).not.toBe("configure_network_route");
      if (op) expect(op).toBe("configure_hand_play");
    }
  });

  for (const prompt of OTHER_UNSEEN_PROMPTS) {
    test(`studio after「${prompt.slice(0, 12)}…」never mounts hex/disc/network boards`, async ({
      page,
    }) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/chatgpt-plugin/new");
      await page.getByRole("textbox", { name: "描述你的游戏想法" }).fill(prompt);
      await page.getByRole("button", { name: "生成可玩版本" }).click();
      await page.waitForURL(/\/chatgpt-plugin\/studio\//, { timeout: 90_000 });

      await expect(
        page.getByRole("heading", { name: /先看这一局怎么玩|这一局的玩法|现在就开玩/ }),
      ).toBeVisible({ timeout: 90_000 });

      await expect(page.getByRole("region", { name: "黑白棋盘" })).toHaveCount(0);
      await expect(page.getByRole("region", { name: "卡坦六角岛" })).toHaveCount(0);
      await expect(page.getByRole("region", { name: "线路网络盘" })).toHaveCount(0);
      await expect(page.locator('[data-lobby-mark="catan"]')).toHaveCount(0);
      await expect(page.locator('[data-lobby-mark="othello"]')).toHaveCount(0);
      await expect(page.locator('[data-lobby-mark="network"]')).toHaveCount(0);

      const projectId = new URL(page.url()).pathname.split("/").at(-1)!;
      const rule = await (await page.request.get(`/api/projects/${projectId}?view=rule-system`)).json();
      const kernelType = rule.runtimeSupport?.kernel?.type ?? null;
      expect(kernelType).not.toBe("hex-settlement-v1");
      expect(kernelType).not.toBe("disc-flipping-v1");
      expect(kernelType).not.toBe("network-route-v1");
      expect(rule.generation?.requestedMechanics ?? []).not.toContain("hex-settlement");
      expect(rule.generation?.requestedMechanics ?? []).not.toContain("disc-flipping");
      expect(rule.generation?.requestedMechanics ?? []).not.toContain("route-network");

      const planRes = await page.request.get(`/api/projects/${projectId}?view=generation-plan`);
      if (planRes.ok()) {
        const { generationPlan } = await planRes.json();
        const op = generationPlan?.proposedRuntime?.op ?? null;
        expect(op).not.toBe("configure_hex_settlement");
        expect(op).not.toBe("configure_disc_flipping");
        expect(op).not.toBe("configure_network_route");
      }
    });
  }

  // Keep the original UNSEEN_PROMPTS export exercised for import stability.
  test("helper exports still list three unseen prompts", () => {
    expect(UNSEEN_PROMPTS).toHaveLength(3);
  });
});
