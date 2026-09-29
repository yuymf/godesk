import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HandPlayBoard } from "./HandPlayBoard";

describe("HandPlayBoard", () => {
  it("renders stable HUD aria regions for hand-play cards surface", () => {
    const html = renderToStaticMarkup(
      createElement(HandPlayBoard, {
        activeSeat: 0,
        viewerSeat: 0,
        status: "active",
        scores: [3, 0],
        winnerSeat: null,
        locale: "zh",
        handPlay: {
          playerCount: 2,
          deckRemaining: 12,
          hands: [[5, 2], [0, 0]],
          playArea: [{ seat: 0, card: 4 }],
          lastPlay: { seat: 0, card: 4 },
        },
      }),
    );
    expect(html).toContain('aria-label="手牌与出牌区"');
    expect(html).toContain('aria-label="对局状态"');
    expect(html).toContain('aria-label="分数"');
    expect(html).toContain('aria-label="牌库剩余"');
    expect(html).toContain('aria-label="出牌区"');
    expect(html).toContain('aria-label="你的手牌"');
    expect(html).toContain("轮到你出牌");
    expect(html).toContain("座位 0 打出 4");
    expect(html).toContain("牌库剩余 12");
    expect(html).toContain("座位 0 · 3");
    // Not a spatial board cue
    expect(html).not.toContain("role=\"grid\"");
  });
});
