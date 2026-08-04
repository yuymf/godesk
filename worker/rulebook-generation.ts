import type { BoundImage, GameDefinition } from "../src/creator/project-contract";

function cleanLines(text: string) {
  return text
    .split(/\r?\n|(?<=[.!?。！？])\s+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 12 && line.length <= 360);
}

function unique(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function inferredNumber(text: string, patterns: RegExp[], fallback: number) {
  for (const pattern of patterns) {
    const value = Number(text.match(pattern)?.[1]);
    if (Number.isInteger(value)) return value;
  }
  return fallback;
}

export function materializeRulebookDefinition(input: {
  name: string;
  description: string;
  sourceText: string;
  sourceId: string;
  image?: BoundImage;
  playerCount?: number;
  durationMinutes?: number;
}): Pick<GameDefinition, "name" | "pitch" | "playerCount" | "durationMinutes" | "rules" | "components" | "setup" | "actions" | "board" | "phases" | "scenarios" | "presentation"> {
  const corpus = `${input.description}\n${input.sourceText}`;
  const lines = unique(cleanLines(input.sourceText));
  const playerCount = input.playerCount ?? Math.min(20, Math.max(1,
    inferredNumber(corpus, [/(\d+)\s*(?:-|–|to)\s*\d+\s*players?/i, /(?:for|with)\s+(\d+)\s+players?/i, /(\d+)\s+players?/i, /(\d+)\s*名?玩家/], 2),
  ));
  const durationMinutes = input.durationMinutes ?? Math.min(720, Math.max(5,
    inferredNumber(corpus, [/(\d+)\s*(?:minutes?|mins?)/i, /(\d+)\s*分钟/], 45),
  ));
  const ruleLines = lines
    .filter((line) => !/^(contents?|credits?|copyright|page\s+\d+)/i.test(line))
    .slice(0, 18);
  const setup = lines
    .filter((line) => /\b(set ?up|prepare|before (?:the )?game|place|shuffle|deal)\b|准备|设置|洗牌|放置/i.test(line))
    .slice(0, 6);
  const actionLines = lines
    .filter((line) => /\b(may|must|can|choose|take|place|move|draw|play|bid|buy|sell|roll)\b|可以|必须|选择|移动|抽取|出牌|竞价/i.test(line))
    .slice(0, 6);
  const componentLines = lines
    .filter((line) => /\b\d+[^.\n]{0,40}\b(?:cards?|tokens?|tiles?|cubes?|markers?|dice|boards?|pawns?|coins?)\b|\d+\s*(?:张牌|枚标记|个棋子|颗骰子)/i.test(line))
    .slice(0, 8);
  const headings = lines
    .filter((line) => line.length <= 80 && /\b(round|phase|turn|auction|voyage|setup|scoring|game end)\b|回合|阶段|结算|游戏结束/i.test(line))
    .slice(0, 6);
  const anchored = { sourceId: input.sourceId, provenance: "source-anchored" as const, confidence: 0.72 };

  return {
    name: input.name.trim().slice(0, 120),
    pitch: input.description.trim().slice(0, 2_000),
    playerCount,
    durationMinutes,
    rules: ruleLines.map((text, index) => ({ id: `source-rule-${index + 1}`, text, ...anchored })),
    components: componentLines.map((line, index) => ({
      id: `source-component-${index + 1}`,
      name: line.slice(0, 120),
      quantity: Number(line.match(/\d+/)?.[0]) || 1,
      ...(input.image ? { image: input.image } : {}),
      ...anchored,
    })),
    setup: setup.length ? setup : ruleLines.slice(0, 3),
    actions: actionLines.map((line, index) => ({
      id: `source-action-${index + 1}`,
      label: line.split(/[.:。]/, 1)[0].slice(0, 80),
      description: line,
      ...anchored,
    })),
    board: {
      layout: "source-derived-table",
      zones: headings.slice(0, 4).map((heading, index) => ({
        id: `source-zone-${index + 1}`,
        name: heading.slice(0, 80),
        description: "规则文档中识别出的桌面区域或流程区。",
        ...(input.image ? { image: input.image } : {}),
      })),
    },
    phases: headings.map((heading, index) => ({ id: `source-phase-${index + 1}`, name: heading.slice(0, 80) })),
    scenarios: [],
    presentation: {
      theme: "rulebook-studio",
      ...(input.image ? { image: input.image } : {}),
      visuals: input.image
        ? [{
            provenance: "extracted",
            label: "规则书提取图像",
          }]
        : [{
            provenance: "generated",
            label: "排版与程序化卡牌及桌面",
          }],
    },
  };
}
