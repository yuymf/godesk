import { describe, expect, it } from "vitest";
import { defaultRenderSpec } from "../../creator/render-spec";
import { mapTabletopToScene, type TabletopRenderInput } from "./tabletop";
import { gemEngineLayout } from "./tabletop-kernels";
import { layoutForStage } from "../../creator/tabletop-stage-layout";

const renderFor = () => defaultRenderSpec("gem-engine-v1", "table") as TabletopRenderInput;

function sampleGemState() {
  return {
    bank: { white: 4, blue: 4, green: 4, red: 4, black: 4, gold: 5 },
    market: [
      [
        { id: "t1a", discount: "white", prestige: 0 },
        { id: "t1b", discount: "blue", prestige: 1 },
      ],
      [{ id: "t2a", discount: "green", prestige: 2 }],
      [{ id: "t3a", discount: "red", prestige: 4 }],
    ],
    nobles: [{ id: "n1", name: "白蓝勋爵" }, { id: "n2", name: "绿红女爵" }],
    seats: [
      { gems: { white: 2, blue: 0, green: 1, red: 0, black: 0, gold: 1 }, prestige: 3, cards: [{ id: "c1", discount: "white" }], reserved: [] },
      { gems: { white: 0, blue: 1, green: 0, red: 0, black: 0, gold: 0 }, prestige: 1, cards: [], reserved: [{ id: "r1" }] },
      { gems: { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 }, prestige: 0, cards: [], reserved: [] },
      { gems: { white: 0, blue: 0, green: 0, red: 1, black: 0, gold: 0 }, prestige: 2, cards: [], reserved: [] },
    ],
  };
}

describe("T026 gem-engine tabletop layout", () => {
  it("emits bank / market / noble / seat pieces on a board", () => {
    const layout = gemEngineLayout(sampleGemState());
    expect(layout.kernelType).toBe("gem-engine-v1");
    expect(layout.board.width).toBeGreaterThan(4);
    expect(layout.pieces.length).toBeGreaterThan(10);
    expect(layout.pieces.some((p) => p.id.startsWith("bank:"))).toBe(true);
    expect(layout.pieces.some((p) => p.id.startsWith("market:"))).toBe(true);
    expect(layout.pieces.some((p) => p.id.startsWith("noble:"))).toBe(true);
    expect(layout.pieces.some((p) => p.id.startsWith("seat:0:"))).toBe(true);
    expect(layout.pieces.some((p) => p.id.startsWith("seat:3:"))).toBe(true);
    expect(layout.hints.some((h) => h.action.type === "buy")).toBe(true);
    expect(layout.hints.some((h) => h.action.type === "reserve")).toBe(true);
  });

  it("maps through shared TabletopStage layout + scene pipeline", () => {
    const layout = layoutForStage({
      kernel: "gem-engine-v1",
      state: sampleGemState(),
      legal: undefined,
      onAct: undefined,
    });
    expect(layout.kernelType).toBe("gem-engine-v1");
    const scene = mapTabletopToScene(layout, renderFor());
    expect(scene.model.nodes.some((n) => n.kind === "piece")).toBe(true);
    expect(scene.model.nodes.some((n) => n.kind === "board" || n.kind === "table" || n.id.includes("board") || n.kind === "ground")).toBe(true);
  });
});
