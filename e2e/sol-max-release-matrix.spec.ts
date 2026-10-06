import { expect, test } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Sol max PR10 — release matrix as an automated checklist (PLAN §2).
 *
 * Automatable rows are executed in-process by sibling specs (never fake PASS here):
 * - 一句话生成 / 大厅缩略图品类正确 / 主交互一步 → e2e/dual-genre-boards.spec.ts
 * - share= 交接 (guest context) → e2e/dual-genre-share.spec.ts
* - share= hand-play + network guest → e2e/hand-network-share.spec.ts (PR15)
 * - unseen prompts no silent Tidewell/Othello → unit (kernel-capabilities + gamespec worker)
 *
 * Rows that still need human live proof are explicit test.skip with reason.
 */

const root = join(import.meta.dirname, "..");

test.describe("Sol max release matrix — automatable row index", () => {
  test("sibling specs cover 一句话生成 / 大厅缩略图 / 主交互一步 / share= 交接", () => {
    const boardsPath = join(root, "e2e/dual-genre-boards.spec.ts");
    const sharePath = join(root, "e2e/dual-genre-share.spec.ts");
    const handNetSharePath = join(root, "e2e/hand-network-share.spec.ts");
    expect(existsSync(boardsPath)).toBe(true);
    expect(existsSync(sharePath)).toBe(true);
    expect(existsSync(handNetSharePath)).toBe(true);
    const boards = readFileSync(boardsPath, "utf8");
    const share = readFileSync(sharePath, "utf8");
    const handNet = readFileSync(handNetSharePath, "utf8");

    // 一句话生成 + lobby mark + one legal act (both genres)
    expect(boards).toMatch(/做一款可以与电脑对战的汐屿基础版/);
    expect(boards).toMatch(/做一款可以与电脑对战的黑白棋/);
    expect(boards).toMatch(/data-lobby-mark="tidewell"/);
    expect(boards).toMatch(/data-lobby-mark="othello"/);
    expect(boards).toMatch(/建造渔村|可落子/);

    // share= guest handoff (othello/hexSettlement + hand-play/network)
    expect(share).toMatch(/share=\s*交接|second context|guest/i);
    expect(share).toMatch(/browser\.newContext/);
    expect(share).toMatch(/missing|invalid/);
    expect(handNet).toMatch(/卡牌区域控制|hand-play/);
    expect(handNet).toMatch(/线路网络|network/);
    expect(handNet).toMatch(/browser\.newContext/);
    expect(handNet).toMatch(/data-lobby-mark="card"/);
    expect(handNet).toMatch(/data-lobby-mark="network"/);
  });
});

test.describe("Sol max release matrix — human / live-proof rows (explicit skip)", () => {
  test.skip(
    "规则闭环: 20-seed bots + full human playthrough — adapter unit tests own seeds; live sign-off is human",
    () => {
      // Covered by play-kernel / adapter vitest suites; do not re-fake here.
    },
  );

  test.skip(
    "本地对手: full AI game to terminal — needs live play; out of PR10 Playwright scope",
    () => {
      // AI seat exists in kernels; full-game human observation stays live.
    },
  );

  test.skip(
    "视觉完整度: design sign-off — screenshots/logs stay in PR comment only, never in repo",
    () => {
      // Visual review is human; e2e only checks board region + HUD reachability.
    },
  );

  test.skip(
    "操作稳定性: full generate→终局→重开→刷新 path under device budgets — live matrix",
    () => {
      // Partial coverage via dual-genre boards + share; full path is live.
    },
  );
});
