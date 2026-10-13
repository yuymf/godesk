import { describe, expect, it } from "vitest";
import { KernelTuningRangeError, parseKernelEdits } from "./kernel-tuning-iteration";

const kernel = { type: "auto-battler-v1", playerCount: 2 } as never;
const parse = (prompt: string) => parseKernelEdits(kernel, prompt)!;

describe("kernel content edits: defaults / edit / delete / qualitative", () => {
  it("reports already-default requests as supported, not unsupported", () => {
    const pool = parse("棋子池扩到12种单位");
    expect(pool.unsupportedClauses).toEqual([]);
    expect(pool.notes[0]).toMatch(/已支持：当前单位池就是 12 种/);
    const traits = parse("做4组羁绊，其中一组能给队友治疗");
    expect(traits.unsupportedClauses).toEqual([]);
    expect(traits.notes[0]).toMatch(/带治疗效果/);
    const star = parse("三个相同的棋子自动合成二星，属性变强");
    expect(star.unsupportedClauses).toEqual([]);
    expect(star.notes.join()).toMatch(/×1\.8/);
    expect(() => parse("棋子池扩到20种单位")).toThrow(KernelTuningRangeError);
  });

  it("edits an existing unit (rename, cost, relative atk, shape) and validates ranges", () => {
    const r = parse("把鲸盾改名为巨鲸，费用改成5，攻击提高20，外形改成龟");
    const whale = (r.contentPatch!.units as Array<Record<string, unknown>>).find((u) => u.id === "whale")!;
    expect(whale).toMatchObject({ name: "巨鲸", cost: 5, atk: 75, shape: "turtle" });
    expect(() => parse("把鲸盾费用改成9")).toThrow(/费用只能是/);
    const t = parse("把潮刃的羁绊改成珊瑚咒/远航");
    expect((t.contentPatch!.units as Array<{ id: string; traits: string[] }>).find((u) => u.id === "blade")!.traits).toEqual(["coral", "voyager"]);
  });

  it("deletes units and keeps the minimum roster", () => {
    const r = parse("删掉礁蟹和螺号卫");
    expect((r.contentPatch!.units as unknown[]).length).toBe(10);
    expect(() => parseKernelEdits({ type: "auto-battler-v1", playerCount: 2, content: { units: (r.contentPatch!.units as unknown[]).slice(0, 2) } } as never, "删除潮刃")).toThrow(/至少要保留/);
  });

  it("converts qualitative wording into concrete numbers and reports them", () => {
    const r = parse("坦克更肉，前期节奏快点");
    expect(r.unsupportedClauses).toEqual([]);
    expect(r.changes[0]!.value).toContain("鲸盾 1100→1320");
    expect(r.tuning).toMatchObject({ prepShopSeconds: 30, prepPlaceSeconds: 20, startGold: 13 });
  });
});
