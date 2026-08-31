import { describe, expect, it } from "vitest";
import {
  applyHiddenRoleIntent,
  createHiddenRoleState,
  defaultHiddenRoles,
  hiddenRoleActiveSeat,
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
