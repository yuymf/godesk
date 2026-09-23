import { describe, expect, it } from "vitest";
import { HOBBYIST_STARTERS } from "../creator/hobbyist-starters";
import {
  applyHiddenRoleIntent,
  createHiddenRoleState,
  defaultHiddenRoles,
  deriveHiddenRoles,
  hiddenRoleActiveSeat,
  isMultiActHiddenRoleCorpus,
  scopeHiddenRoleState,
} from "./hidden-role";

describe("hidden-role-v1", () => {
  it("keeps other seats' roles hidden until resolution", () => {
    const state = createHiddenRoleState(3, defaultHiddenRoles(3), 7);
    const scoped = scopeHiddenRoleState(state, 0);
    expect(scoped.roles[0].roleId).toBe(state.roles[0].roleId);
    expect(scoped.roles[1].roleId).toBe("hidden");
    expect(scoped.roles[2].name).toBe("未揭示");
  });

  it("requires speech then accusations before a winner", () => {
    let state = createHiddenRoleState(2, defaultHiddenRoles(2), 3);
    expect(hiddenRoleActiveSeat(state)).toBe(0);
    const first = applyHiddenRoleIntent(state, 0, "speak", { text: "我觉得2号在躲。" });
    expect(first).not.toBeNull();
    state = first!.state;
    const second = applyHiddenRoleIntent(state, 1, "speak", { text: "我觉得1号太急。" });
    state = second!.state;
    expect(state.phase).toBe("accuse");
    const accuse0 = applyHiddenRoleIntent(state, 0, "accuse", { targetSeat: 1 });
    state = accuse0!.state;
    const accuse1 = applyHiddenRoleIntent(state, 1, "accuse", { targetSeat: 0 });
    state = accuse1!.state;
    expect(state.phase).toBe("resolved");
    expect(state.winnerAlignment).toMatch(/culprit|town/);
    expect(scopeHiddenRoleState(state, 0).roles[1].roleId).not.toBe("hidden");
  });
});

describe("hidden-role source roles (W4-06)", () => {
  it("derives three custom role names and camps from the brief", () => {
    const brief =
      "三位玩家找出凶手。身份牌：毒蛇（凶手阵营）、医师（好人）、守卫（好人）。先轮流公开发言，再互相指控。被指控最多的人被揭晓。";
    const roles = deriveHiddenRoles(brief, 3);
    expect(roles).toHaveLength(3);
    expect(roles.map((role) => role.name)).toEqual(["毒蛇", "医师", "守卫"]);
    expect(roles.filter((role) => role.alignment === "culprit")).toHaveLength(1);
    expect(roles.find((role) => role.name === "毒蛇")?.alignment).toBe("culprit");
    expect(roles.find((role) => role.name === "医师")?.alignment).toBe("town");
    expect(roles.every((role) => /^[a-z0-9-]{1,40}$/.test(role.id))).toBe(true);
  });

  it("keeps 凶手/侦探/平民 when the hobbyist starter names those cards", () => {
    const starter =
      HOBBYIST_STARTERS.find((item) => item.id === "script")?.text ?? "";
    expect(isMultiActHiddenRoleCorpus(starter)).toBe(false);
    const roles = deriveHiddenRoles(starter, 3);
    expect(roles.map((role) => role.name)).toEqual(["凶手", "侦探", "平民"]);
    expect(roles.map((role) => role.alignment)).toEqual([
      "culprit",
      "town",
      "town",
    ]);
  });

  it("falls back to defaultHiddenRoles when the brief omits named roles", () => {
    const brief =
      "三人剧本杀。每人秘密拿到身份牌。先轮流公开发言，再互相指控。被指控最多的人被揭晓。";
    expect(deriveHiddenRoles(brief, 3)).toEqual(defaultHiddenRoles(3));
  });

  it("detects multi-act / clue-board scripts that the one-shot loop cannot host", () => {
    expect(
      isMultiActHiddenRoleCorpus(
        "三幕剧本杀。第一幕搜证，第二幕讨论，第三幕投票。桌上有线索板。",
      ),
    ).toBe(true);
    expect(
      isMultiActHiddenRoleCorpus(
        "Players discuss for two rounds, then consult the clue board before accusing.",
      ),
    ).toBe(true);
    expect(
      isMultiActHiddenRoleCorpus(
        "三位玩家在别墅里找出凶手。先发言再指控。",
      ),
    ).toBe(false);
  });
});
