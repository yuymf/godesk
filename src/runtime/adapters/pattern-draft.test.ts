import { describe, expect, it } from "vitest";
import { applyAction, createInitialState, listLegalActions } from "../play-kernel";
import { KERNEL_CAPABILITIES, MECHANIC_CAPABILITIES, inferRequestedMechanics } from "../../creator/kernel-capabilities";
import {
  applyEndGameBonuses,
  autoPlayPatternDraftGame,
  createPatternDraftKernelConfig,
  defaultPatternDraftContent,
  patternDraftAdapter,
  wallColorAt,
  wallColumnForColor,
} from "./pattern-draft";
import { isPatternDraftCorpus } from "../pattern-draft";
import { readFileSync } from "node:fs";

const config = createPatternDraftKernelConfig();

describe("pattern-draft-v1 (T013)", () => {
  it("registers capabilities", () => {
    expect(KERNEL_CAPABILITIES["pattern-draft-v1"]).toEqual([
      "factory-draft",
      "pattern-line-placement",
      "wall-tiling-score",
      "floor-penalty",
    ]);
    expect(MECHANIC_CAPABILITIES["pattern-draft"]).toEqual(
      KERNEL_CAPABILITIES["pattern-draft-v1"],
    );
  });

  it("starts with filled factories and empty center marker", () => {
    const state = createInitialState(patternDraftAdapter, config, 7);
    expect(state.phase).toBe("draft");
    expect(state.genre.factories).toHaveLength(5);
    expect(state.genre.factories.every((f) => f.length === 4)).toBe(true);
    expect(state.genre.markerInCenter).toBe(true);
    expect(state.genre.center).toEqual([]);
  });

  it("wall pattern is a rotating color grid", () => {
    expect(wallColorAt(0, 0)).toBe("blue");
    expect(wallColumnForColor(0, "blue")).toBe(0);
    expect(wallColumnForColor(1, wallColorAt(1, 2))).toBe(2);
  });

  it("draft from factory places on a line and pushes rest to center", () => {
    let state = createInitialState(patternDraftAdapter, config, 3);
    const legal = listLegalActions(patternDraftAdapter, state, 0, config);
    const factoryPlay = legal.find(
      (a) => a.type === "draft" && a.payload?.source === "factory" && a.payload?.line === 0,
    );
    expect(factoryPlay).toBeTruthy();
    const result = applyAction(
      patternDraftAdapter,
      state,
      {
        type: "draft",
        playerId: 0,
        payload: { ...factoryPlay!.payload },
      },
      config,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    state = result.state;
    expect(state.activePlayerId).toBe(1);
    const line0 = state.genre.seats[0].lines[0];
    expect(line0.tiles.length).toBeGreaterThan(0);
  });

  it("H04 INPUT is pattern-draft corpus and mechanics", () => {
    const idea = readFileSync("docs/hardness/suites/H04-azul/INPUT.md", "utf8");
    expect(isPatternDraftCorpus(idea)).toBe(true);
    expect(inferRequestedMechanics(idea)).toContain("pattern-draft");
  });

  it("auto-play completes without illegal actions", () => {
    const { state, actions } = autoPlayPatternDraftGame(42);
    expect(actions.length).toBeGreaterThan(10);
    expect(state.status).toBe("complete");
  });
});


describe("pattern-draft-v1 end bonuses (T018)", () => {
  const bonuses = defaultPatternDraftContent().endBonuses;

  it("scores complete rows (+2 each)", () => {
    const seat = {
      lines: [] as never[],
      wall: Array.from({ length: 5 }, (_, r) =>
        Array.from({ length: 5 }, (_, c) =>
          r === 0 ? wallColorAt(0, c) : null,
        ),
      ),
      floor: [] as never[],
      hasMarker: false,
      score: 0,
    };
    const added = applyEndGameBonuses(seat, bonuses);
    expect(added).toBe(2);
    expect(seat.score).toBe(2);
  });

  it("scores complete columns (+7 each)", () => {
    const seat = {
      lines: [] as never[],
      wall: Array.from({ length: 5 }, (_, r) =>
        Array.from({ length: 5 }, (_, c) => (c === 1 ? wallColorAt(r, 1) : null)),
      ),
      floor: [] as never[],
      hasMarker: false,
      score: 0,
    };
    const added = applyEndGameBonuses(seat, bonuses);
    expect(added).toBe(7);
    expect(seat.score).toBe(7);
  });

  it("scores complete color sets (+10 each)", () => {
    const color = "red" as const;
    const wall = Array.from({ length: 5 }, () =>
      Array.from({ length: 5 }, () => null as ReturnType<typeof wallColorAt> | null),
    );
    for (let row = 0; row < 5; row += 1) {
      const col = wallColumnForColor(row, color);
      wall[row]![col] = color;
    }
    const seat = {
      lines: [] as never[],
      wall,
      floor: [] as never[],
      hasMarker: false,
      score: 0,
    };
    const added = applyEndGameBonuses(seat, bonuses);
    expect(added).toBe(10);
    expect(seat.score).toBe(10);
  });
});
