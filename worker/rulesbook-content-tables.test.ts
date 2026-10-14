import { describe, expect, it } from "vitest";
import { resolveAutoBattlerContent } from "../src/runtime/adapters/auto-battler-content";
import { extractMarkdownTables, parseRulesBookContentTables } from "./rulesbook-content-tables";

/** Minimal rules book shaped like H01 (inline — worker pool cannot read docs/). */
const ASH_BOOK = `
# 灰烬佣兵团
奇幻佣兵自走棋（非潮汐、非赛博机甲）。商店买棋上阵自动打架。熔岩灰烬风格。
初始生命 30。初始金币 10。

| id 建议 | 名称 | 费 | 攻 | 血 | 羁绊 |
| --- | --- | --- | --- | --- | --- |
| miner | 矿工 | 1 | 45 | 650 | 岩石 |
| shield | 盾卫 | 1 | 40 | 720 | 岩石 |
| embermage | 火法 | 2 | 70 | 480 | 岩浆 |
| ranger | 游侠 | 2 | 62 | 450 | 暗影 |
| ashrunner | 灰烬跑者 | 2 | 65 | 520 | 岩浆、暗影 |
| forge | 锻锤 | 2 | 55 | 560 | 岩石、岩浆 |
| shadowblade | 影刃 | 3 | 78 | 500 | 暗影 |
| magma_priest | 熔祭司 | 3 | 50 | 620 | 岩浆 |
| basalt | 玄武卫 | 3 | 42 | 920 | 岩石 |
| cinderlord | 烬领主 | 4 | 80 | 780 | 岩浆、暗影 |

| id | 名称 | 档位 | 效果种类 | 数值（按档） |
| --- | --- | --- | --- | --- |
| magma | 岩浆 | 2 / 4 | shield_start（开战护盾） | 20 / 45 |
| rock | 岩石 | 2 / 4 | reflect（反伤比例） | 0 / 0.1 |
| shadow | 暗影 | 2 / 3 | extra_hit（额外打击） | 0.5 / 0.5 |
`;

describe("extractMarkdownTables", () => {
  it("finds pipe tables", () => {
    const tables = extractMarkdownTables("| A | B |\n| --- | --- |\n| 1 | 2 |\n");
    expect(tables).toHaveLength(1);
    expect(tables[0]!.headers).toEqual(["A", "B"]);
    expect(tables[0]!.rows).toEqual([["1", "2"]]);
  });
  it("returns empty for no tables", () => {
    expect(extractMarkdownTables("做一款两人自走棋，商店买棋上阵")).toEqual([]);
  });
});

describe("parseRulesBookContentTables", () => {
  it("happy path: ash-like rules book → units + traits", () => {
    const r = parseRulesBookContentTables(ASH_BOOK);
    expect(r.found).toBe(true);
    expect(r.patch?.units?.map((u) => u.name)).toEqual([
      "矿工", "盾卫", "火法", "游侠", "灰烬跑者", "锻锤", "影刃", "熔祭司", "玄武卫", "烬领主",
    ]);
    expect(r.patch?.traits?.map((t) => t.label)).toEqual(["岩浆", "岩石", "暗影"]);
    expect(r.patch?.traits?.map((t) => t.id)).toEqual(["magma", "rock", "shadow"]);
    const miner = r.patch!.units!.find((u) => u.name === "矿工")!;
    expect(miner).toMatchObject({ cost: 1, atk: 45, hp: 650, traits: ["rock"] });
    const magma = r.patch!.traits!.find((t) => t.id === "magma")!;
    expect(magma.tiers).toEqual([2, 4]);
    expect(magma.effect).toMatchObject({ kind: "shield_start", values: [20, 45] });
    const merged = {
      units: r.patch!.units!,
      traits: r.patch!.traits!,
      stars: { star2: true, star3: false, mult2: 1.8, mult3: 3.2 },
    };
    expect(resolveAutoBattlerContent(merged)).not.toBeNull();
    expect(r.ideaWithoutTables).not.toMatch(/\| miner \|/);
    expect(r.patch!.units!.some((u) => u.name === "钻头机兵")).toBe(false);
  });

  it("unknown column is listed in unsupported, not silent", () => {
    const idea = `
| 名称 | 费 | 攻 | 血 | 羁绊 | 稀有度 |
| --- | --- | --- | --- | --- | --- |
| 矿工 | 1 | 45 | 650 | 岩石 | 普通 |
| 盾卫 | 1 | 40 | 720 | 岩石 | 普通 |

| 名称 | 档位 | 效果种类 | 数值 |
| --- | --- | --- | --- |
| 岩石 | 2 / 4 | reflect（反伤） | 0 / 0.1 |
`;
    const r = parseRulesBookContentTables(idea);
    expect(r.found).toBe(true);
    expect(r.unsupported.some((u) => u.includes("稀有度"))).toBe(true);
    expect(r.patch?.units?.[0]?.name).toBe("矿工");
  });


  it("kv setup table maps 初始生命/金币", () => {
    const idea = `
| 项 | 值 |
| --- | --- |
| 初始生命 | 30 |
| 初始金币 | 10 |
| 棋盘 | 7 列 × 2 行 |

| 名称 | 费 | 攻 | 血 | 羁绊 |
| --- | --- | --- | --- | --- |
| 矿工 | 1 | 45 | 650 | 岩石 |
| 盾卫 | 1 | 40 | 720 | 岩石 |

| 名称 | 档位 | 效果种类 | 数值 |
| --- | --- | --- | --- |
| 岩石 | 2 / 4 | reflect | 0 / 0.1 |
`;
    const r = parseRulesBookContentTables(idea);
    expect(r.tuning).toMatchObject({ startHp: 30, startGold: 10, boardCols: 7, boardRows: 2 });
    expect(r.patch?.units?.map((u) => u.name)).toEqual(["矿工", "盾卫"]);
  });

  it("empty / no tables → found false", () => {
    const r = parseRulesBookContentTables("做一款两人自走棋，商店买棋上阵自动打架");
    expect(r.found).toBe(false);
    expect(r.patch).toBeUndefined();
  });

  it("empty table body does not invent units", () => {
    const r = parseRulesBookContentTables("| 名称 | 费 | 攻 | 血 |\n| --- | --- | --- | --- |\n");
    expect(r.found).toBe(false);
  });
});
