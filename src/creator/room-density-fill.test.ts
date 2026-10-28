import { describe, expect, it } from "vitest";
import {
  buildDensityBuildGroup,
  buildDensityHandSlots,
  buildDensitySeatBadges,
  densityCapabilities,
  readHandSchemaKinds,
} from "./room-density-fill";
import type { RuleSystem } from "./project-contract";

function baseRule(
  patch: {
    entities?: RuleSystem["entities"];
    actions?: RuleSystem["actions"];
    runtimeSupport?: RuleSystem["runtimeSupport"];
    gameSpec?: RuleSystem["gameSpec"];
  } = {},
): Pick<RuleSystem, "entities" | "runtimeSupport" | "gameSpec" | "actions"> {
  return {
    entities: patch.entities ?? [],
    actions: patch.actions ?? [],
    gameSpec: patch.gameSpec,
    runtimeSupport: patch.runtimeSupport ?? { status: "draft", unsupported: [] },
  };
}

describe("room-density-fill hand / build-group / seat-rail", () => {
  it("hand schema from content entities >= resource kind count", () => {
    const rule = baseRule({
      entities: [
        {
          id: "wood",
          name: "木",
          kind: "resource",
          sourceId: null,
          provenance: "system-generated",
          confidence: 1,
        },
        {
          id: "brick",
          name: "砖",
          kind: "resource",
          sourceId: null,
          provenance: "system-generated",
          confidence: 1,
        },
        {
          id: "sheep",
          name: "羊",
          kind: "resource",
          sourceId: null,
          provenance: "system-generated",
          confidence: 1,
        },
      ],
    });
    const kinds = readHandSchemaKinds(rule);
    expect(kinds.length).toBeGreaterThanOrEqual(3);
    const slots = buildDensityHandSlots({
      ruleSystem: rule,
      live: {
        mySeat: 0,
        scores: [0, 0],
        turn: 1,
        seatCount: 2,
        myResources: { wood: 2, brick: 1, sheep: 0 },
      },
      locale: "zh",
    });
    expect(slots.length).toBeGreaterThanOrEqual(kinds.length);
    expect(slots.map((s) => s.label)).toEqual(expect.arrayContaining(["木", "砖", "羊"]));
  });

  it("terminal-disc-count yields multi-slot piece ledger", () => {
    const rule = baseRule({
      runtimeSupport: {
        status: "executable",
        unsupported: [],
        kernel: {
          type: "disc-flipping-v1",
          playerCount: 2,
          rows: 8,
          cols: 8,
        },
      },
    });
    expect(densityCapabilities(rule)).toContain("terminal-disc-count");
    const slots = buildDensityHandSlots({
      ruleSystem: rule,
      live: {
        mySeat: 0,
        seatPieceCounts: [2, 2],
        scores: [2, 2],
        turn: 1,
        seatCount: 2,
      },
      locale: "zh",
    });
    expect(slots.length).toBeGreaterThanOrEqual(2);
    expect(slots.some((s) => s.label === "棋子")).toBe(false);
    expect(slots.some((s) => s.label === "Discs")).toBe(false);
    expect(slots.filter((s) => s.key.startsWith("pieces-seat-")).length).toBe(2);
  });

  it("build group skips ruleSystem clone when runtime empty; pips when legal", () => {
    const empty = buildDensityBuildGroup({
      ruleSystemActions: [
        { id: "place", label: "放置到资源区", description: "board owns this" },
        { id: "pass", label: "跳过", description: "无合法落子时跳过" },
      ],
      runtimeActions: [],
      isMyTurn: true,
      busy: false,
      locale: "zh",
    });
    expect(empty).toEqual([]);

    const legal = buildDensityBuildGroup({
      ruleSystemActions: [],
      runtimeActions: [
        { id: "claim", label: "Claim", value: 3 },
        { id: "pass", label: "Pass", value: null },
      ],
      isMyTurn: true,
      busy: false,
      locale: "en",
    });
    expect(legal[0]?.enabled).toBe(true);
    expect(legal[0]?.costPips.length).toBeGreaterThan(0);
    expect(legal[0]?.costPips[0]?.amount).toBe(3);
  });

  it("seat badges are capability-driven", () => {
    const caps = densityCapabilities(
      baseRule({
        runtimeSupport: {
          status: "executable",
          unsupported: [],
          kernel: {
            type: "disc-flipping-v1",
            playerCount: 2,
            rows: 8,
            cols: 8,
          },
        },
      }),
    );
    const badges = buildDensitySeatBadges({
      capabilities: caps,
      presentationFloor: {
        status: "passed",
        reason: "ok",
        visuals: [{ provenance: "kit", label: "density hud" }],
      },
      score: 4,
      handCount: 4,
      pieceCount: 4,
      locale: "zh",
    });
    expect(badges.some((b) => b.kind === "capability" || b.key === "pieces")).toBe(true);
    expect(badges.some((b) => b.kind === "score")).toBe(true);
  });
});
