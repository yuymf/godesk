import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
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

describe("UI-density-fill · P4 hand / build-group / seat-rail", () => {
  it("hand schema from content entities ≥ resource kind count", () => {
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

  it("kills single-slot 棋子×N — terminal-disc-count yields multi-slot piece ledger", () => {
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

  it("build group shell exposes actions with cost pips + disabled when no legal runtime", () => {
    const group = buildDensityBuildGroup({
      ruleSystemActions: [
        { id: "place", label: "落子", description: "在合法格落子" },
        { id: "pass", label: "跳过", description: "无合法落子时跳过" },
      ],
      runtimeActions: [],
      isMyTurn: true,
      busy: false,
      locale: "zh",
    });
    expect(group.length).toBeGreaterThanOrEqual(2);
    expect(group.every((a) => a.enabled === false)).toBe(true);

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

  it("seat badges are capability-driven — never hardcode kernel names", () => {
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
      presentationFloor: { status: "passed", reason: "ok", visuals: [{ provenance: "kit", label: "density hud" }] },
      score: 4,
      handCount: 4,
      pieceCount: 4,
      locale: "zh",
    });
    expect(badges.some((b) => b.kind === "capability" || b.key === "pieces")).toBe(true);
    expect(badges.some((b) => b.kind === "score")).toBe(true);

    const src = readFileSync("src/creator/room-density-fill.ts", "utf8");
    expect(src).not.toContain("suite ===");
    expect(src).not.toMatch(/\.tidewell-game-body/);
    // capability ids ok; kernel *name* branches for badge rendering forbidden
    expect(src).not.toMatch(/kernelType\s*===\s*["']disc-flipping/);
    expect(src).not.toMatch(/kernel\.type\s*===\s*["']disc-flipping/);
    expect(src).not.toMatch(/kernelType\s*===\s*["']hex-settlement/);
  });

  it("RoomView mounts density-fill markers and drops single-slot 棋子 branch", () => {
    const src = readFileSync("src/creator/RoomView.tsx", "utf8");
    expect(src).toContain("UI-density-fill");
    expect(src).toContain("buildDensityHandSlots");
    expect(src).toContain("buildDensityBuildGroup");
    expect(src).toContain("buildDensitySeatBadges");
    expect(src).toContain('data-ui-hand-from-content="1"');
    expect(src).toContain('data-ui-build-group="1"');
    expect(src).toContain('data-ui-seat-badges="1"');
    expect(src).toContain('data-ui-cost-pips="1"');
    expect(src).not.toMatch(/label:\s*locale === "zh"\s*\?\s*"棋子"\s*:\s*"Discs"/);
    expect(src).not.toMatch(/suite === ["']H0/);
    expect(src).not.toContain("Tide Arena");
  });

  it("CSS keeps board-owns opt-out only — no tidewell density hide; ships badge + cost pip chrome", () => {
    const css = readFileSync("src/creator/surface.css", "utf8");
    expect(css).toContain("UI-density-fill");
    expect(css).toMatch(/\.room-hud-seat-badge/);
    expect(css).toMatch(/\.room-hud-cost-pip/);
    expect(css).toMatch(/\.room-hud-build-group/);
    expect(css).toMatch(/\[data-board-owns-hud=["']1["']\]/);
    expect(css).toMatch(
      /\.room-view:has\(\[data-board-owns-hud=["']1["']\]\)\s*>\s*\.room-playable-shell\.room-density-hud/,
    );
    expect(css).not.toMatch(
      /\.tidewell-game-body[\s\S]{0,120}room-density-hud[\s\S]{0,80}display:\s*none/,
    );
    expect(css).not.toMatch(
      /room-density-hud[\s\S]{0,120}\.tidewell-game-body[\s\S]{0,80}display:\s*none/,
    );
    expect(css).not.toContain("Board-owned tidewell density");

    const tokens = readFileSync("src/creator/design-tokens.css", "utf8");
    expect(tokens).toContain("UI-density-fill");
    expect(tokens).toContain("--hud-cost-pip:");
  });

  it("extends P0–P3 action-drawer / share-seat / settlecoast / theme-pack floors", () => {
    for (const file of [
      "src/creator/room-action-drawer-ui-p0.test.ts",
      "src/creator/room-share-seat-ui-p1.test.ts",
      "src/creator/room-settlecoast-hud-ui-p2.test.ts",
      "src/creator/room-theme-packs-ui-p3.test.ts",
    ]) {
      expect(readFileSync(file, "utf8").length).toBeGreaterThan(100);
    }
    const p2 = readFileSync("src/creator/room-settlecoast-hud-ui-p2.test.ts", "utf8");
    expect(p2).toContain("room-hud-action-group");
    expect(p2).toContain('data-board-owns-hud="1"');
  });
});
