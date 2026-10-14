import { describe, expect, it } from "vitest";
import { defaultRenderSpec } from "../../creator/render-spec";
import { encodeCardFace, encodePlaqueFace, parseFaceSchema } from "./tabletop-face-schema";
import { gemEngineLayout } from "./tabletop-kernels";
import { mapTabletopToScene, type TabletopRenderInput } from "./tabletop";

describe("T037 card face readable schema", () => {
  it("encodes/parses card schema without debug T1+0|green form", () => {
    const tag = encodeCardFace({
      tier: 1,
      prestige: 0,
      reward: "green",
      cost: { white: 1, blue: 1, red: 1 },
    });
    expect(tag).toMatch(/^face\|card\|/);
    expect(tag).not.toMatch(/T1\+0\|green/);
    const parsed = parseFaceSchema(tag);
    expect(parsed).toEqual({
      kind: "card",
      tier: 1,
      prestige: 0,
      reward: "green",
      cost: { white: 1, blue: 1, red: 1 },
      title: undefined,
    });
  });

  it("market cards use face schema; no floating debug nameplates", () => {
    const layout = gemEngineLayout({
      bank: { white: 1, blue: 0, green: 0, red: 0, black: 0, gold: 0 },
      market: [[{ id: "c", discount: "blue", prestige: 2, cost: { white: 2, red: 1 } }], [], []],
      nobles: [{ id: "n1", name: "白蓝勋爵", prestige: 3, requirements: { white: 3, blue: 3 } }],
      seats: [{ gems: { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 }, prestige: 0, cards: [], reserved: [] }],
    });
    const card = layout.pieces.find((p) => p.id.startsWith("market:"));
    expect(card?.label).toMatch(/^face\|card\|/);
    expect(card?.label).not.toMatch(/T1\+2\|blue/);
    const noble = layout.pieces.find((p) => p.objectKind === "plaque");
    expect(noble?.label).toMatch(/^face\|plaque\|/);
    expect(noble?.label).toContain("n:白蓝勋爵");
    expect(noble?.label).not.toMatch(/^n1$/);

    const scene = mapTabletopToScene(layout, defaultRenderSpec("gem-engine-v1", "table") as TabletopRenderInput);
    expect(scene.model.nodes.some((n) => n.kind === "label" && String(n.tag ?? "").includes("T1+"))).toBe(false);
    expect(scene.model.nodes.some((n) => n.kind === "label" && String(n.tag ?? "").startsWith("face|"))).toBe(false);
    const cardNode = scene.model.nodes.find((n) => n.mesh === "card" && n.kind === "piece");
    expect(String(cardNode?.tag ?? "")).toMatch(/^face\|card\|/);
  });

  it("plaque encoder carries requirement dots payload", () => {
    const tag = encodePlaqueFace({ title: "绿红女爵", prestige: 3, requirements: { green: 3, red: 3 } });
    const parsed = parseFaceSchema(tag);
    expect(parsed?.kind).toBe("plaque");
    if (parsed?.kind === "plaque") {
      expect(parsed.title).toBe("绿红女爵");
      expect(parsed.requirements).toEqual({ green: 3, red: 3 });
    }
  });
});
