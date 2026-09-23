import { describe, expect, it } from "vitest";
import {
  generationPlanAllowsApprove,
  generationPlanShowsUnsupported,
} from "./generation-plan-honesty";
import { REFUSE_NON_SCORE_HAND } from "../runtime/generation-refuse";

const handPlayRuntime = {
  op: "configure_hand_play" as const,
  config: {
    playerCount: 4,
    cardValues: [1, 2, 3, 4, 5],
    copiesPerValue: 4,
    handSize: 3,
    victoryTarget: 12,
    actions: [{ id: "play" as const, label: "打出" }],
    unsupported: [] as string[],
  },
};

describe("generation plan honesty (W5-01)", () => {
  it("shows unsupported on pending refuse (no proposedRuntime)", () => {
    expect(
      generationPlanShowsUnsupported({
        status: "pending",
        unsupported: [REFUSE_NON_SCORE_HAND],
        proposedRuntime: undefined,
      }),
    ).toBe(true);
  });

  it("hides temporary unsupported on pending happy-path (has proposedRuntime)", () => {
    expect(
      generationPlanShowsUnsupported({
        status: "pending",
        unsupported: ["Executable Kernel 仍待创作者批准 Generation Plan。"],
        proposedRuntime: handPlayRuntime,
      }),
    ).toBe(false);
  });

  it("shows unsupported after approve", () => {
    expect(
      generationPlanShowsUnsupported({
        status: "approved",
        unsupported: ["不把出牌变成计分按钮。"],
        proposedRuntime: handPlayRuntime,
      }),
    ).toBe(true);
  });

  it("blocks approve when there is no proposedRuntime (refuse / draft gap)", () => {
    expect(
      generationPlanAllowsApprove({
        status: "pending",
        proposedRuntime: undefined,
      }),
    ).toBe(false);
    expect(
      generationPlanAllowsApprove({
        status: "pending",
        proposedRuntime: handPlayRuntime,
      }),
    ).toBe(true);
    expect(
      generationPlanAllowsApprove({
        status: "approved",
        proposedRuntime: handPlayRuntime,
      }),
    ).toBe(false);
  });
});
