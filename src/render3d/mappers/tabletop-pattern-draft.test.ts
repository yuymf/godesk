import { describe, expect, it } from "vitest";
import { defaultRenderSpec } from "../../creator/render-spec";
import { mapTabletopToScene, type TabletopRenderInput } from "./tabletop";
import { patternDraftLayout } from "./tabletop-kernels";
import { layoutForStage } from "../../creator/tabletop-stage-layout";

const renderFor = () => defaultRenderSpec("pattern-draft-v1", "table") as TabletopRenderInput;

function emptyWall() {
  return Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => null as string | null));
}

function samplePatternState() {
  return {
    factories: [
      ["blue", "yellow", "red", "black"],
      ["white", "blue", "blue", "red"],
      ["yellow", "yellow", "black", "white"],
    ],
    center: ["red", "blue"],
    markerInCenter: true,
    round: 1,
    seats: [
      {
        lines: [
          { color: "blue", tiles: ["blue"], capacity: 1 },
          { color: null, tiles: [], capacity: 2 },
          { color: "red", tiles: ["red", "red"], capacity: 3 },
          { color: null, tiles: [], capacity: 4 },
          { color: null, tiles: [], capacity: 5 },
        ],
        wall: emptyWall(),
        floor: ["white"],
        hasMarker: false,
        score: 4,
      },
      {
        lines: [
          { color: null, tiles: [], capacity: 1 },
          { color: null, tiles: [], capacity: 2 },
          { color: null, tiles: [], capacity: 3 },
          { color: null, tiles: [], capacity: 4 },
          { color: null, tiles: [], capacity: 5 },
        ],
        wall: emptyWall(),
        floor: [],
        hasMarker: true,
        score: 1,
      },
      {
        lines: [
          { color: null, tiles: [], capacity: 1 },
          { color: null, tiles: [], capacity: 2 },
          { color: null, tiles: [], capacity: 3 },
          { color: null, tiles: [], capacity: 4 },
          { color: null, tiles: [], capacity: 5 },
        ],
        wall: emptyWall(),
        floor: [],
        hasMarker: false,
        score: 0,
      },
      {
        lines: [
          { color: null, tiles: [], capacity: 1 },
          { color: null, tiles: [], capacity: 2 },
          { color: null, tiles: [], capacity: 3 },
          { color: null, tiles: [], capacity: 4 },
          { color: null, tiles: [], capacity: 5 },
        ],
        wall: emptyWall(),
        floor: [],
        hasMarker: false,
        score: 2,
      },
    ],
  };
}

describe("T027 pattern-draft tabletop layout", () => {
  it("emits factories / center / seat lines / wall / floor pieces", () => {
    const layout = patternDraftLayout(samplePatternState());
    expect(layout.kernelType).toBe("pattern-draft-v1");
    expect(layout.board.width).toBeGreaterThan(4);
    expect(layout.pieces.length).toBeGreaterThan(20);
    expect(layout.pieces.some((p) => p.id.startsWith("factory:"))).toBe(true);
    expect(layout.pieces.some((p) => p.id.startsWith("center:"))).toBe(true);
    expect(layout.pieces.some((p) => p.id.startsWith("seat:0:line:"))).toBe(true);
    expect(layout.pieces.some((p) => p.id.startsWith("seat:0:wall:"))).toBe(true);
    expect(layout.pieces.some((p) => p.id.startsWith("seat:3:"))).toBe(true);
    expect(layout.hints.some((h) => h.action.type === "draft")).toBe(true);
  });

  it("maps through shared TabletopStage layout + scene pipeline", () => {
    const layout = layoutForStage({
      kernel: "pattern-draft-v1",
      state: samplePatternState(),
      legal: undefined,
      onAct: undefined,
    });
    expect(layout.kernelType).toBe("pattern-draft-v1");
    const scene = mapTabletopToScene(layout, renderFor());
    expect(scene.model.nodes.some((n) => n.kind === "piece")).toBe(true);
  });
});
