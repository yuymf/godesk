import { describe, expect, it } from "vitest";
import {
  SEAT_CAPACITY,
  clampSeatCount,
  gemBankPerBasicForSeats,
  nextSeatId,
  parseSeatCountFromIdea,
  patternFactoryCountForSeats,
  resolveSeatCount,
  winnerByHighestScore,
} from "./seat-capacity";

describe("seat-capacity (T019)", () => {
  it("parses ideal ranges preferring upper bound", () => {
    expect(parseSeatCountFromIdea("人数：2–4", SEAT_CAPACITY["gem-engine-v1"])).toBe(4);
    expect(parseSeatCountFromIdea("3-4 理想", SEAT_CAPACITY["pattern-draft-v1"])).toBe(4);
    expect(parseSeatCountFromIdea("2人内核", SEAT_CAPACITY["gem-engine-v1"])).toBe(2);
  });

  it("clamps and resolves with participants fallback", () => {
    expect(clampSeatCount(9, SEAT_CAPACITY["gem-engine-v1"])).toBe(4);
    expect(
      resolveSeatCount({
        idea: "无人数",
        capacity: SEAT_CAPACITY["hex-settlement-v1"],
        participantsMax: 4,
        participantsDefault: 2,
      }),
    ).toBe(4);
  });

  it("nextSeat and winner helpers", () => {
    expect(nextSeatId(1, 3)).toBe(2);
    expect(nextSeatId(2, 3)).toBe(0);
    expect(winnerByHighestScore([1, 5, 5])).toBeNull();
    expect(winnerByHighestScore([1, 9, 3])).toBe(1);
  });

  it("scales bank/factories", () => {
    expect(gemBankPerBasicForSeats(4)).toBe(7);
    expect(patternFactoryCountForSeats(3)).toBe(7);
  });
});

describe("seat-capacity against hardness INPUT", () => {
  it("parses H01/H03/H04 ideal ranges to upper bound", async () => {
    const { readFileSync } = await import("node:fs");
    const h03 = readFileSync("docs/hardness/suites/H03-splendor/INPUT.md", "utf8");
    const h04 = readFileSync("docs/hardness/suites/H04-azul/INPUT.md", "utf8");
    const h01 = readFileSync("docs/hardness/suites/H01-catan/INPUT.md", "utf8");
    expect(parseSeatCountFromIdea(h03, SEAT_CAPACITY["gem-engine-v1"])).toBe(4);
    expect(parseSeatCountFromIdea(h04, SEAT_CAPACITY["pattern-draft-v1"])).toBe(4);
    expect(parseSeatCountFromIdea(h01, SEAT_CAPACITY["hex-settlement-v1"])).toBe(4);
  });
});
