import { describe, expect, it } from "vitest";
import { DEFAULT_AUTO_BATTLER_CONTENT, resolveAutoBattlerContent, unitAppearanceOf } from "../src/runtime/adapters/auto-battler-content";
import { parseAssetAttachClause, resolveUnitHint } from "./auto-battler-assets";
import { parseKernelEdits } from "./kernel-tuning-iteration";

describe("auto-battler asset attach (NL → modelRef / procedural)", () => {
  it("strips 一个/免费 from search queryHint", () => {
    expect(parseAssetAttachClause("给钻头机兵搜一个免费机器人模型挂上")).toMatchObject({
      kind: "search", unitHint: "钻头机兵", queryHint: "机器人",
    });
  });

  it("parses search / imported / procedural clauses", () => {
    expect(parseAssetAttachClause("给螃蟹换螃蟹模型")).toEqual({ kind: "search", unitHint: "螃蟹", queryHint: "螃蟹" });
    expect(parseAssetAttachClause("给巫师挂导入的 GLB")).toMatchObject({ kind: "imported", unitHint: "巫师" });
    expect(parseAssetAttachClause("没有素材时用风格化棋子")).toMatchObject({ kind: "procedural", allFallbacks: true });
  });


  it("parses named imported GLB selection", () => {
    expect(parseAssetAttachClause("用刚导入的 rocky-shore-crab.glb 挂到巫师")).toEqual({
      kind: "imported",
      unitHint: "巫师",
      nameHint: "rocky-shore-crab",
    });
    expect(parseAssetAttachClause("给螃蟹挂导入的 rocky-shore-crab.glb")).toMatchObject({
      kind: "imported",
      unitHint: "螃蟹",
      nameHint: "rocky-shore-crab",
    });
  });

  it("resolves unit hints via aliases without tide-only hardcoding of names in the renderer", () => {
    expect(resolveUnitHint(DEFAULT_AUTO_BATTLER_CONTENT, "螃蟹")?.id).toBe("crab");
    expect(resolveUnitHint(DEFAULT_AUTO_BATTLER_CONTENT, "珊瑚巫")?.id).toBe("witch");
  });

  it("stores modelRef / proceduralPreset on content patches", () => {
    const resolved = resolveAutoBattlerContent({
      units: DEFAULT_AUTO_BATTLER_CONTENT.units.map((u) =>
        u.id === "crab" ? { ...u, modelRef: "polyhaven:Crab_Lowpoly", proceduralPreset: "crab" } : { ...u },
      ),
    });
    expect(resolved?.units.find((u) => u.id === "crab")).toMatchObject({
      modelRef: "polyhaven:Crab_Lowpoly",
      proceduralPreset: "crab",
    });
    expect(unitAppearanceOf(resolved!.units.find((u) => u.id === "crab")!)).toEqual({
      proceduralPreset: "crab",
      modelRef: "polyhaven:Crab_Lowpoly",
    });
  });

  it("maps NL through kernel edits into assetIntents", () => {
    const r = parseKernelEdits({ type: "auto-battler-v1", playerCount: 2 } as never, "给螃蟹换螃蟹模型");
    expect(r?.assetIntents?.[0]).toMatchObject({ kind: "search", unitHint: "螃蟹" });
    expect(r?.changes.some((c) => c.key === "asset")).toBe(true);
  });
});
