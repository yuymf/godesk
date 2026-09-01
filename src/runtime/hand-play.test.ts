import { describe, expect, it } from "vitest";
import {
  applyHandPlayIntent,
  createHandPlayState,
  handPlayExhausted,
  scopeHandPlayState,
} from "./hand-play";

describe("hand-play-v1", () => {
  it("deals hidden hands and scores the played card", () => {
    const state = createHandPlayState({
      playerCount: 2,
      cardValues: [1, 2, 3],
      copiesPerValue: 2,
      handSize: 2,
      seed: 4,
    });
    expect(state.hands).toHaveLength(2);
    expect(state.hands[0]).toHaveLength(2);
    expect(state.deck.length).toBe(2);
    const scoped = scopeHandPlayState(state, 0);
    expect(scoped.deck).toEqual([]);
    expect(scoped.hands[0]).toEqual(state.hands[0]);
    expect(scoped.hands[1]).toEqual(state.hands[1].map(() => 0));

    const played = applyHandPlayIntent(state, 0, { cardIndex: 0 });
    expect(played).not.toBeNull();
    expect(played!.points).toBe(state.hands[0][0]);
    expect(played!.state.playArea).toEqual([{
      seat: 0,
      card: state.hands[0][0],
    }]);
    expect(played!.state.hands[0]).toHaveLength(2);
  });

  it("ends when the deck and hands are empty", () => {
    const state = createHandPlayState({
      playerCount: 1,
      cardValues: [1],
      copiesPerValue: 1,
      handSize: 1,
      seed: 1,
    });
    const played = applyHandPlayIntent(state, 0, { cardIndex: 0 });
    expect(played).not.toBeNull();
    expect(handPlayExhausted(played!.state)).toBe(true);
  });
});
