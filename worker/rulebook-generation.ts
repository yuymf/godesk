import type {
  BoundImage,
  GenerationPlan,
  RuleSystem,
} from "../src/creator/project-contract";
import { inferSourceGenre } from "../src/runtime/genre";
import { defaultHiddenRoles } from "../src/runtime/hidden-role";

function cleanLines(text: string) {
  return text
    .split(/\r?\n|(?<=[.!?。！？])\s*/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) =>
      line.length <= 360 &&
      (line.length >= 12 ||
        /^(?:[•·-]\s*)?(?:(?:take|reserve|purchase|draw|bid|buy|sell|roll|pass|trade|collect|build|claim|select)\b|扩展|加入|选择|移动|抽取|出牌|竞价|购买|保留|收集)/i.test(line))
    );
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

function isBoilerplate(line: string) {
  return [
    /^(?:marc|paul)\s+\w+/i,
    /^(?:play for free|use this unique code|to learn how to play|don['’]t want to read|watch this|join our community|discover the best|need help|distributed by)/i,
    /(?:exclusive rewards|qr code|youtube|www\.|https?:\/\/)/i,
    /(?:all rights reserved|copyright|©)/i,
  ].some((pattern) => pattern.test(line));
}

const chineseDigits: Record<string, number> = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
};

function parseRuleNumber(value: string | undefined) {
  if (!value) return Number.NaN;
  const numeric = Number(value);
  if (Number.isInteger(numeric)) return numeric;
  const tenIndex = value.indexOf("十");
  if (tenIndex >= 0) {
    const tens = tenIndex === 0
      ? 1
      : chineseDigits[value[tenIndex - 1]];
    const ones = value.slice(tenIndex + 1)
      ? chineseDigits[value.slice(tenIndex + 1)]
      : 0;
    if (Number.isInteger(tens) && Number.isInteger(ones)) {
      return tens * 10 + ones;
    }
  }
  return chineseDigits[value];
}

export function inferredNumber(
  text: string,
  patterns: RegExp[],
  defaultValue: number,
) {
  for (const pattern of patterns) {
    const value = parseRuleNumber(text.match(pattern)?.[1]);
    if (Number.isInteger(value)) return value;
  }
  return defaultValue;
}

export function inferredParticipantRange(text: string, defaultValue = 2) {
  const numberToken = "[0-9一二两三四五六七八九十]+";
  const range = text.match(
    new RegExp(
      `(${numberToken})\\s*(?:[-–—－]|to|至|到)\\s*(${numberToken})\\s*(?:players?|人|(?:位|名)[\\u4e00-\\u9fff]{1,12})`,
      "i",
    ),
  );
  const minValue = parseRuleNumber(range?.[1]);
  const maxValue = parseRuleNumber(range?.[2]);
  if (Number.isInteger(minValue) && Number.isInteger(maxValue)) {
    const min = Math.max(1, Math.min(20, Math.min(minValue, maxValue)));
    const max = Math.max(min, Math.min(20, Math.max(minValue, maxValue)));
    return { min, max, default: min };
  }

  const single = inferredNumber(
    text,
    [
      new RegExp(`(${numberToken})\\s*players?`, "i"),
      new RegExp(`(${numberToken})\\s*(?:位|名)?玩家`, "i"),
      new RegExp(`(${numberToken})\\s*(?:位|名)\\s*[\\u4e00-\\u9fff]{1,12}`, "i"),
      new RegExp(`(${numberToken})\\s*个\\s*人`),
    ],
    defaultValue,
  );
  const value = Math.min(20, Math.max(1, single));
  return { min: value, max: value, default: value };
}

export function isSharedGoalDescription(text: string) {
  return /合作|协作|共同完成|共同目标|共同推进|共享目标|一起|cooperative|co-operatively|collaborative|co-op|work together|together|shared goal|shared progress/i.test(
    text,
  );
}

export function isTurnTakingDescription(text: string) {
  return /轮流|轮流行动|每回合|回合制|take turns?|turn[- ]based|alternate turns?|on (?:your|their) turn/i.test(
    text,
  );
}

export function inferredTakeAwayRule(text: string): {
  initialPool: number;
  takes: number[];
} | null {
  const numberToken = "[0-9一二两三四五六七八九十]+|one|two|three|four|five|six|seven|eight|nine";
  const actionClause = text.match(
    /(?:每(?:一)?回合|轮到[^。.!?\n]{0,20}|on (?:each|your|their) turn|each turn)[^。.!?\n]{0,80}?(?:拿走?|取走?|移除|take|remove)[^。.!?\n]{0,80}/i,
  )?.[0];
  if (!actionClause) return null;
  const takes = unique(
    [...actionClause.matchAll(new RegExp(`(${numberToken})`, "gi"))]
      .map((match) => parseRuleNumber(match[1].toLowerCase()))
      .filter((value) => Number.isInteger(value) && value > 0 && value <= 100)
      .map(String),
  ).map(Number).sort((a, b) => a - b);
  const poolCandidates = [
    ...text.matchAll(
      new RegExp(
        `(${numberToken})\\s*(?:枚|个|颗)?\\s*(?:石子|石头|棋子|标记|火柴|stones?|tokens?|matches?|counters?)`,
        "gi",
      ),
    ),
  ].map((match) => parseRuleNumber(match[1].toLowerCase()));
  const initialPool = Math.max(...poolCandidates.filter(Number.isInteger));
  const lastTakenWins = /(?:拿|取|移除|得到)[^。.!?\n]{0,20}最后(?:一)?(?:枚|个|颗)?[^。.!?\n]{0,20}(?:获胜|胜利)|(?:take|remove|get)[^.!?\n]{0,20}(?:the )?last[^.!?\n]{0,20}wins?/i.test(
    text,
  );
  if (
    !lastTakenWins ||
    !Number.isInteger(initialPool) ||
    initialPool < 2 ||
    initialPool > 1_000 ||
    takes.length < 1 ||
    initialPool <= Math.max(...takes)
  ) {
    return null;
  }
  return { initialPool, takes };
}

export function inferredRollAndMoveRule(text: string): {
  dieSides: number;
  targetPosition: number;
} | null {
  const numberToken = "[0-9一二两三四五六七八九十]+|one|two|three|four|five|six|seven|eight|nine";
  const dieSides = inferredNumber(
    text,
    [
      new RegExp(`(${numberToken})\\s*面\\s*骰子`, "i"),
      new RegExp(`(${numberToken})[- ]?sided\\s+(?:die|dice)`, "i"),
    ],
    Number.NaN,
  );
  const targetPosition = inferredNumber(
    text,
    [
      new RegExp(`(?:率先|先).{0,30}?(?:到达|抵达).{0,12}?(${numberToken})\\s*格`, "i"),
      new RegExp(`(?:first).{0,30}?(?:reach|arrive).{0,12}?(${numberToken})\\s*(?:spaces?|squares?)`, "i"),
    ],
    Number.NaN,
  );
  const rolls = /掷骰|掷[^。.!?\n]{0,12}骰子|投掷[^。.!?\n]{0,12}骰子|roll[^.!?\n]{0,20}(?:die|dice)/i.test(text);
  const moves = /前进|移动[^。.!?\n]{0,12}(?:格|步)|move[^.!?\n]{0,20}(?:spaces?|squares?)/i.test(text);
  const takesTurns = isTurnTakingDescription(text);
  if (
    !rolls ||
    !moves ||
    !takesTurns ||
    !Number.isInteger(dieSides) ||
    dieSides < 2 ||
    dieSides > 100 ||
    !Number.isInteger(targetPosition) ||
    targetPosition < 2 ||
    targetPosition > 1_000
  ) {
    return null;
  }
  return { dieSides, targetPosition };
}

export function inferredDrawAndScoreRule(text: string): {
  cardValues: number[];
  copiesPerValue: number;
  victoryTarget: number;
} | null {
  const numberToken = "[0-9一二两三四五六七八九十]+|one|two|three|four|five|six|seven|eight|nine";
  const valueRange = text.match(new RegExp(
    `(?:点数|values?)\\s*(${numberToken})\\s*(?:到|至|[-–—]|to)\\s*(${numberToken})`,
    "i",
  ));
  const firstValue = parseRuleNumber(valueRange?.[1]?.toLowerCase());
  const lastValue = parseRuleNumber(valueRange?.[2]?.toLowerCase());
  const copiesPerValue = inferredNumber(text, [
    new RegExp(`每个点数各?\\s*(${numberToken})\\s*张`, "i"),
    new RegExp(`(${numberToken})\\s+copies\\s+of\\s+each`, "i"),
  ], Number.NaN);
  const victoryTarget = inferredNumber(text, [
    new RegExp(`(?:率先|先).{0,30}?(?:达到|获得).{0,12}?(${numberToken})\\s*分`, "i"),
    new RegExp(`first.{0,30}?(?:reach|score).{0,12}?(${numberToken})\\s*points?`, "i"),
  ], Number.NaN);
  const drawsTopCard = /(?:牌库顶|牌堆顶)[^。.!?\n]{0,18}?(?:抽|拿)[^。.!?\n]{0,8}一张|draw[^.!?\n]{0,20}(?:top card|card from (?:the )?top)/i.test(text);
  const shuffled = /洗牌|洗牌后|shuffled?/i.test(text);
  const scoresDraw = /(?:抽到|抽取|抽出的?)[^。.!?\n]{0,20}?(?:点数|数值)[^。.!?\n]{0,20}?(?:加入|加到|增加)[^。.!?\n]{0,16}?(?:总分|分数)|add[^.!?\n]{0,30}(?:drawn|card)[^.!?\n]{0,20}(?:value|number)[^.!?\n]{0,20}(?:score|total)/i.test(text);
  const exhaustionWins = /牌库用完[^。.!?\n]{0,40}总分最高[^。.!?\n]{0,12}获胜|deck[^.!?\n]{0,25}(?:empty|exhausted|runs out)[^.!?\n]{0,40}(?:highest|most)[^.!?\n]{0,20}(?:score|points?)[^.!?\n]{0,12}wins?/i.test(text);
  const low = Math.min(firstValue, lastValue);
  const high = Math.max(firstValue, lastValue);
  if (
    !isTurnTakingDescription(text) ||
    !drawsTopCard ||
    !shuffled ||
    !scoresDraw ||
    !exhaustionWins ||
    !Number.isInteger(low) ||
    low < 1 ||
    high > 100 ||
    high - low + 1 > 100 ||
    !Number.isInteger(copiesPerValue) ||
    copiesPerValue < 1 ||
    copiesPerValue > 100 ||
    (high - low + 1) * copiesPerValue > 1_000 ||
    !Number.isInteger(victoryTarget) ||
    victoryTarget < 1 ||
    victoryTarget > 1_000
  ) return null;
  return {
    cardValues: Array.from({ length: high - low + 1 }, (_, index) => low + index),
    copiesPerValue,
    victoryTarget,
  };
}

export function inferredPushYourLuckRule(text: string): {
  dieSides: number;
  bustFace: number;
  victoryTarget: number;
} | null {
  const numberToken = "[0-9一二两三四五六七八九十]+|one|two|three|four|five|six|seven|eight|nine";
  const dieSides = inferredNumber(text, [
    new RegExp(`(${numberToken})\\s*面\\s*骰子`, "i"),
    new RegExp(`(${numberToken})[- ]?sided\\s+(?:die|dice)`, "i"),
  ], Number.NaN);
  const bustFace = inferredNumber(text, [
    new RegExp(`掷出\\s*(${numberToken})[^。.!?\\n]{0,30}?(?:清零|失去)[^。.!?\\n]{0,20}?(?:换人|结束回合)`, "i"),
    new RegExp(`roll(?:ing)?\\s+(?:a\\s+)?(${numberToken})[^.!?\\n]{0,35}?(?:lose|clear|forfeit)[^.!?\\n]{0,30}?(?:turn|unbanked)`, "i"),
  ], Number.NaN);
  const victoryTarget = inferredNumber(text, [
    new RegExp(`(?:率先|先).{0,30}?(?:达到|获得).{0,12}?(${numberToken})\\s*分`, "i"),
    new RegExp(`first.{0,30}?(?:reach|score).{0,12}?(${numberToken})\\s*points?`, "i"),
  ], Number.NaN);
  const accumulates = /(?:点数|结果)[^。.!?\n]{0,20}?(?:加入|加到|增加)[^。.!?\n]{0,16}?(?:未存分|本回合)|add[^.!?\n]{0,25}(?:roll|result)[^.!?\n]{0,25}(?:turn total|unbanked)/i.test(text);
  const canContinueOrBank = /(?:继续掷|继续投)[^。.!?\n]{0,16}(?:或|还是)[^。.!?\n]{0,16}(?:收手|存分)|(?:收手|存分)[^。.!?\n]{0,16}(?:或|还是)[^。.!?\n]{0,16}(?:继续掷|继续投)|(?:roll again|continue rolling)[^.!?\n]{0,25}(?:or|instead)[^.!?\n]{0,20}(?:bank|hold)/i.test(text);
  const banks = /(?:收手|存分)[^。.!?\n]{0,30}?(?:未存分|本回合)[^。.!?\n]{0,20}?(?:加入|加到)[^。.!?\n]{0,16}?(?:总分|分数)|bank[^.!?\n]{0,25}(?:turn total|unbanked)[^.!?\n]{0,25}(?:score|total)/i.test(text);
  if (
    !isTurnTakingDescription(text) ||
    !accumulates ||
    !canContinueOrBank ||
    !banks ||
    !Number.isInteger(dieSides) ||
    dieSides < 2 ||
    dieSides > 100 ||
    !Number.isInteger(bustFace) ||
    bustFace < 1 ||
    bustFace > dieSides ||
    !Number.isInteger(victoryTarget) ||
    victoryTarget < 1 ||
    victoryTarget > 1_000
  ) return null;
  return { dieSides, bustFace, victoryTarget };
}

export function inferredSharedGoalTarget(text: string) {
  const numberToken = "[0-9一二两三四五六七八九十]+";
  return inferredNumber(
    text,
    [
      new RegExp(
        `(?:累计|共享|共同|共计|progress|goal|target).{0,30}?(?:达到|到|完成|reach|complete)?\\s*(${numberToken})\\s*(?:points?|分|点|进度)`,
        "i",
      ),
      new RegExp(
        `(?:达到|到|完成|reach|complete).{0,18}?(${numberToken})\\s*(?:points?|分|点|进度)`,
        "i",
      ),
    ],
    Number.NaN,
  );
}

function actionLabel(line: string) {
  const chineseScore = line.match(
    /(?:玩家\s*)?(?:也\s*)?(?:可以|可|能够|能)\s*(.+?)(?:获得|得|推进|增加|贡献)\s*[0-9一二两三四五六七八九十]+\s*(?:分|点|进度)/,
  );
  if (chineseScore?.[1]) {
    return chineseScore[1].trim().replace(/行动$/, "").slice(0, 80);
  }
  const scoredAction = line.match(
    /^(.+?)(?:获得|得|推进|增加|贡献)\s*[0-9一二两三四五六七八九十]+\s*(?:分|点|进度)[。.]?$/,
  );
  if (scoredAction?.[1]) {
    return scoredAction[1].trim().replace(/行动$/, "").slice(0, 80);
  }
  const scoredEnglish = line.match(
    /^(?:players?\s+)?(?:(?:can|may|could|choose to)\s+)?(.+?)\s+(?:for|to gain|earn|get)\s*[0-9]+\s*points?/i,
  );
  if (scoredEnglish?.[1]) return scoredEnglish[1].trim().slice(0, 80);
  const match = line.match(
    /(?:^|[•·]\s*)((?:take|reserve|purchase|draw|bid|buy|sell|roll|pass|trade|collect|build|claim|select)\b.*?)(?=\s+(?:if|this|to|you|when|then|there)\b|[.!?]|$)/i,
  );
  return (match?.[1] ?? line.split(/[.:。]/, 1)[0]).trim().slice(0, 80);
}

function splitChineseActionChoices(line: string) {
  const choices = line.match(
    /(?:^|[。！？])[^。！？]*?(?:可以|可|能够|能)\s*(.+?)(?:[。！？]|$)/,
  )?.[1]
    ?.split(/[、，,；;]|\s*(?:或|或者)\s*/g)
    .map((choice) => choice.replace(/^(?:也\s*)?(?:可以|可|能够|能)\s*/, "").trim())
    .filter((choice) => choice.length >= 2) ?? [];
  return choices.length >= 2 ? choices : [line];
}

function expandScoredActions(lines: string[]) {
  const scoredActions = lines.flatMap((line) => {
    const chineseMatches = [...line.matchAll(
      /(?:^|[，,；;]\s*)(?:每(?:次)?\s*)?(?:(?:玩家\s*)?(?:也\s*)?(?:可以|可|能够|能)\s*)?([^，,；;。！？]+?)\s*(?:[，,]\s*)?((?:获得|得|推进|增加|贡献))\s*([0-9一二两三四五六七八九十]+)\s*(分|点|进度)/g,
    )].map((match) => `${match[1].trim()}${match[2]} ${match[3]} ${match[4]}`);
    const englishMatches = [...line.matchAll(
      /(?:^|\bor\b|[,;])\s*(?:[^,;.!?]*\bplayers?\b\s+)?(?:can|may|could|choose to)?\s*([^,;.!?]+?(?:for|to gain|earn|get)\s*[0-9]+\s*points?)/gi,
    )].map((match) => match[1].trim());
    return [...chineseMatches, ...englishMatches];
  });
  if (scoredActions.length >= 2) return scoredActions;
  const choiceLines = lines.filter((line) => /(?:可以|可|能够|能)\s*/.test(line));
  const expandedChoices = choiceLines.flatMap(splitChineseActionChoices);
  return expandedChoices.length >= 2 ? expandedChoices : lines;
}

function genreEntities(
  genre: ReturnType<typeof inferSourceGenre>,
  playerCount: number,
  sourceId: string,
  image?: BoundImage,
) {
  const anchored = { sourceId, provenance: "source-anchored" as const, confidence: 0.72 };
  if (genre === "hidden-role") {
    return [
      {
        id: "entity-role-card",
        name: "身份牌",
        kind: "card" as const,
        quantity: playerCount,
        ...(image ? { image } : {}),
        ...anchored,
      },
      {
        id: "entity-transcript",
        name: "发言记录",
        kind: "object" as const,
        quantity: 1,
        ...anchored,
      },
    ];
  }
  if (genre === "hand-play") {
    return [
      {
        id: "entity-hand",
        name: "手牌",
        kind: "card" as const,
        quantity: playerCount * 3,
        ...(image ? { image } : {}),
        ...anchored,
      },
      {
        id: "entity-deck",
        name: "牌库",
        kind: "card" as const,
        quantity: 20,
        ...anchored,
      },
      {
        id: "entity-play-area",
        name: "出牌区",
        kind: "object" as const,
        quantity: 1,
        ...anchored,
      },
    ];
  }
  if (genre === "conversation") {
    return [{
      id: "entity-transcript",
      name: "发言记录",
      kind: "object" as const,
      quantity: 1,
      ...anchored,
    }];
  }
  return [];
}

function inferPlaySurface(corpus: string) {
  const genre = inferSourceGenre(corpus);
  if (genre === "hidden-role") {
    return { kind: "conversation" as const, layout: "accusation-table" };
  }
  if (genre === "hand-play") {
    return { kind: "cards" as const, layout: "hand-and-play-area" };
  }
  if (genre === "placement") {
    return { kind: "table" as const, layout: "worker-placement" };
  }
  if (genre === "conversation") {
    return { kind: "conversation" as const, layout: "prompt-and-response" };
  }
  if (/\b(conversation|speak|tell|ask|debate|story|idea|prompt)\b|讨论|发言|故事|创意|口述/i.test(corpus)) {
    return { kind: "conversation" as const, layout: "prompt-and-response" };
  }
  if (/\b(board|table|token|marker|dice|tile|pawn|stones?|matches?)\b|棋盘|桌面|标记|骰子|板块|石子|石头|火柴/i.test(corpus)) {
    return { kind: "table" as const, layout: "source-derived-table" };
  }
  if (/\b(cards?|deck|hand)\b|卡牌|手牌|牌库/i.test(corpus)) {
    return { kind: "cards" as const, layout: "card-layout" };
  }
  if (/\b(scene|spatial|roleplay)\b|场景|空间|角色扮演/i.test(corpus)) {
    return { kind: "scene" as const, layout: "shared-scene" };
  }
  return { kind: "screen" as const, layout: "shared-game-state" };
}

export function materializeRuleSystem(input: {
  name: string;
  description: string;
  sourceText: string;
  sourceId: string;
  image?: BoundImage;
  playerCount?: number;
  durationMinutes?: number;
}): Pick<RuleSystem, "name" | "pitch" | "participants" | "durationMinutes" | "rules" | "constraints" | "entities" | "setup" | "actions" | "playSurface" | "stages" | "outcomes" | "presentation"> {
  const authoredText = input.sourceText.trim() || input.description.trim();
  const corpus = `${input.description}\n${authoredText}`;
  const genre = inferSourceGenre(`${input.name}\n${corpus}`);
  const lines = unique(cleanLines(authoredText)).filter((line) => !isBoilerplate(line));
  const takeAwayRule = inferredTakeAwayRule(corpus);
  const rollAndMoveRule = inferredRollAndMoveRule(corpus);
  const drawAndScoreRule = inferredDrawAndScoreRule(corpus);
  const pushYourLuckRule = inferredPushYourLuckRule(corpus);
  const numberToken = "[0-9一二两三四五六七八九十]+";
  const participants = input.playerCount === undefined
    ? inferredParticipantRange(corpus)
    : { min: input.playerCount, max: input.playerCount, default: input.playerCount };
  const durationMinutes = input.durationMinutes ?? Math.min(720, Math.max(5,
    inferredNumber(corpus, [/(\d+)\s*(?:minutes?|mins?)/i, /(\d+)\s*分钟/], 45),
  ));
  const ruleLines = lines
    .filter((line) => !/^(contents?|credits?|copyright|page\s+\d+)/i.test(line))
    .slice(0, 18);
  const setup = lines
    .filter((line) => /\b(set ?up|prepare|before (?:the )?game|place|shuffle|deal)\b|准备|设置|洗牌|放置/i.test(line))
    .slice(0, 6);
  const constraintLines = lines
    .filter((line) => /\b(must|cannot|can't|may not|only|limit|required|at least|at most|no more than|constraint)\b|必须|不得|不能|只能|上限|至少|至多|约束/i.test(line))
    .slice(0, 12);
  const explicitActionLines = lines
    .filter((line) => /(?:^|[•·]\s*)(?:take|reserve|purchase|draw|bid|buy|sell|roll|pass|trade|collect|build|claim|select)\b|^(?:可以|选择|移动|抽取|出牌|竞价|购买|保留|收集|扩展|加入)/i.test(line));
  const actionLines = expandScoredActions(explicitActionLines.length >= 2
    ? explicitActionLines
    : lines.filter((line) => /\b(may|can|choose|take|place|move|draw|play|bid|buy|sell|roll)\b|可以|选择|移动|抽取|出牌|竞价|购买|保留|收集|扩展|加入|轮流|(?:获得|得|推进|增加|贡献)\s*[0-9一二两三四五六七八九十]+\s*(?:分|点|进度)/i.test(line)),
  );
  const componentLines = lines
    .filter((line) => /\b\d+[^.\n]{0,40}\b(?:cards?|tokens?|tiles?|cubes?|markers?|dice|boards?|pawns?|coins?|stones?|matches?)\b|\d+\s*(?:张牌|枚标记|个棋子|颗骰子|枚石子|根火柴)/i.test(line))
    .slice(0, 8);
  const headings = lines
    .filter((line) => line.length <= 80 && /\b(round|phase|turn|auction|voyage|setup|scoring|game end)\b|回合|阶段|结算|游戏结束/i.test(line))
    .slice(0, 6);
  const outcomeLines = lines
    .filter((line) => /\b(winner|wins?|victory|game end|ends? when|goal)\b|获胜|胜利|结束条件|目标|揭晓|率先达到/i.test(line))
    .slice(0, 4);
  const surface = inferPlaySurface(`${input.name}\n${corpus}`);
  const anchored = { sourceId: input.sourceId, provenance: "source-anchored" as const, confidence: 0.72 };
  const ownedEntities = genreEntities(genre, participants.default, input.sourceId, input.image);
  const extractedEntities = componentLines.map((line, index) => ({
    id: `source-entity-${index + 1}`,
    name: line.slice(0, 120),
    kind: /cards?|张牌/i.test(line)
      ? "card" as const
      : /tokens?|markers?|pawns?|stones?|matches?|枚标记|个棋子|枚石子|根火柴/i.test(line)
        ? "token" as const
        : "object" as const,
    quantity: Number(line.match(/\d+/)?.[0]) || 1,
    ...(input.image ? { image: input.image } : {}),
    ...anchored,
  }));
  const entities = [
    ...ownedEntities,
    ...extractedEntities.filter((entity) =>
      !ownedEntities.some((owned) => owned.name === entity.name),
    ),
  ];

  return {
    name: input.name.trim().slice(0, 120),
    pitch: input.description.trim().slice(0, 2_000),
    participants: {
      ...participants,
      roles: genre === "hidden-role"
        ? defaultHiddenRoles(participants.default).map((role) => ({
            id: role.id,
            name: role.name,
            description: role.alignment === "culprit" ? "隐藏的凶手。" : "找出凶手。",
          }))
        : [],
    },
    durationMinutes,
    rules: ruleLines.map((text, index) => ({ id: `source-rule-${index + 1}`, text, ...anchored })),
    constraints: constraintLines.map((text, index) => ({
      id: `source-constraint-${index + 1}`,
      text,
      ...anchored,
    })),
    entities,
    setup: setup.length ? setup : ruleLines.slice(0, 3),
    actions: genre === "hidden-role"
      ? [
          {
            id: "speak",
            label: /[\u4e00-\u9fff]/.test(corpus) ? "发言" : "Speak",
            description: /[\u4e00-\u9fff]/.test(corpus)
              ? "公开说一句对本局的判断，写入发言记录。"
              : "Speak one public judgment into the transcript.",
            ...anchored,
          },
          {
            id: "accuse",
            label: /[\u4e00-\u9fff]/.test(corpus) ? "指控" : "Accuse",
            description: /[\u4e00-\u9fff]/.test(corpus)
              ? "指控一名其他玩家。被指控最多的人被揭晓。"
              : "Accuse another player. The most accused seat is revealed.",
            ...anchored,
          },
        ]
      : genre === "hand-play"
      ? [{
          id: "play",
          label: /[\u4e00-\u9fff]/.test(corpus) ? "打出一张手牌" : "Play a card",
          description: /[\u4e00-\u9fff]/.test(corpus)
            ? "从手牌打出一张到出牌区，点数计入分数。"
            : "Play one card from hand into the play area and score its value.",
          ...anchored,
        }]
      : pushYourLuckRule
      ? [
          {
            id: "roll",
            label: /[\u4e00-\u9fff]/.test(corpus) ? "继续掷骰" : "Roll again",
            description: /[\u4e00-\u9fff]/.test(corpus) ? "掷骰；爆点清空本回合未存分并换人，否则累加未存分。" : "Roll; bust loses the unbanked turn score, otherwise add the result.",
            ...anchored,
          },
          {
            id: "bank",
            label: /[\u4e00-\u9fff]/.test(corpus) ? "收手存分" : "Bank score",
            description: /[\u4e00-\u9fff]/.test(corpus) ? "把本回合未存分加入总分并换人。" : "Add the unbanked turn score to your total and end the turn.",
            ...anchored,
          },
        ]
      : drawAndScoreRule
      ? [{
          id: "source-action-1",
          label: /[\u4e00-\u9fff]/.test(corpus) ? "抽牌计分" : "Draw and score",
          description: actionLines[0] ?? authoredText,
          ...anchored,
        }]
      : rollAndMoveRule
      ? [{
          id: "source-action-1",
          label: /[\u4e00-\u9fff]/.test(corpus) ? "掷骰前进" : "Roll and move",
          description: actionLines[0] ?? authoredText,
          ...anchored,
        }]
      : takeAwayRule
      ? takeAwayRule.takes.map((take, index) => ({
          id: `source-action-${index + 1}`,
          label: /[\u4e00-\u9fff]/.test(corpus) ? `拿走 ${take} 枚` : `Take ${take}`,
          description: actionLines[0] ?? authoredText,
          ...anchored,
        }))
      : actionLines.map((line, index) => ({
          id: `source-action-${index + 1}`,
          label: actionLabel(line),
          description: line,
          ...anchored,
        })),
    playSurface: {
      kind: surface.kind,
      layout: surface.layout,
      regions: surface.kind === "table" || surface.kind === "scene"
        ? headings.slice(0, 4).map((heading, index) => ({
        id: `source-zone-${index + 1}`,
        name: heading.slice(0, 80),
        description: "规则来源中识别出的共享区域或流程区。",
        ...(input.image ? { image: input.image } : {}),
          }))
        : [],
    },
    stages: headings.map((heading, index) => ({ id: `source-phase-${index + 1}`, name: heading.slice(0, 80) })),
    outcomes: outcomeLines.map((line, index) => ({
      id: `source-outcome-${index + 1}`,
      name: line.slice(0, 120),
    })),
    presentation: {
      theme: "rulebook-studio",
      ...(input.image ? { image: input.image } : {}),
      visuals: input.image
        ? [{
            provenance: "extracted",
            label: "规则书提取图像",
          }]
        : [{
            provenance: "kit",
            label: "程序化主题 kit",
          }],
    },
  };
}

export function createGenerationPlan(input: {
  id: string;
  projectId: string;
  generationJobId: string;
  ruleSystem: RuleSystem;
  sourceIds: string[];
  createdAt: string;
  proposedRuntime?: GenerationPlan["proposedRuntime"];
}): GenerationPlan {
  const { ruleSystem } = input;
  const genre = inferSourceGenre([
    ruleSystem.name,
    ruleSystem.pitch,
    ...ruleSystem.rules.map((rule) => rule.text),
    ...ruleSystem.actions.map((action) => `${action.label} ${action.description}`),
  ].join("\n"));
  const unsupported = [...ruleSystem.runtimeSupport.unsupported];
  const assumptions = [
    "识别出的规则、行动与结果仍需创作者在同一项目中审阅。",
    "来源锚点决定了可追溯内容；未从来源中识别出的裁判、随机与资源语义不会被隐式补全。",
    `将呈现的 Play Surface 是 ${ruleSystem.playSurface.kind}，必须改变交互，不能只换文案。`,
  ];
  const genreLoop = genre === "hidden-role"
    ? ["秘密发放身份牌", "轮流公开发言", "互相指控", "揭晓并按身份结算"]
    : genre === "hand-play"
    ? ["发给隐藏手牌", "从手牌打出到出牌区", "从牌库补牌", "先到目标分或牌库耗尽"]
    : genre === "conversation"
    ? ["写下可记录的发言", "发言进入对局状态与 Replay", "按行动计分直到目标"]
    : genre === "placement"
    ? ["在共享区域放置工人", "占用格子", "按放置结果结算"]
    : [];
  if (ruleSystem.runtimeSupport.status === "draft" && input.proposedRuntime) {
    assumptions.push(`批准 Generation Plan 后才会把可执行范围配置为 ${input.proposedRuntime.op}；在此之前 Rule System 保持 draft。`);
    unsupported.push("Executable Kernel 仍待创作者批准 Generation Plan。");
  } else if (ruleSystem.runtimeSupport.status === "draft") {
    assumptions.push("当前规则尚未证明可由 GoDesk 的 Executable Kernel 执行，需要在 Studio 中显式配置。");
    unsupported.push("当前 Rule System 尚未配置可执行内核。");
  } else {
    const kernel = ruleSystem.runtimeSupport.kernel.type;
    assumptions.push(`当前可执行范围限定为 ${kernel}；其余来源行为保留为未支持说明。`);
  }
  if (input.proposedRuntime?.op === "configure_hidden_role") {
    assumptions.push("Playability Floor 验收：每人看到自己的身份、发言写入记录、指控改变终局。");
    unsupported.push("不把剧本杀换成计分赛；LLM 不裁定凶手。");
  } else if (input.proposedRuntime?.op === "configure_hand_play") {
    assumptions.push("Playability Floor 验收：手牌区可见、出牌针对具体牌、他人手牌保持隐藏。");
    unsupported.push("不把出牌变成计分按钮。");
  } else if (input.proposedRuntime?.op === "configure_conversation_relay") {
    assumptions.push("Playability Floor 验收：每次行动必须带文本，发言进入 Session State 与 Replay。");
    unsupported.push("不把对话游戏收成无文本的计分按钮。");
  } else if (!input.proposedRuntime && genre !== "generic") {
    assumptions.push("来源体裁还没有可执行内核。Playability Floor 不会放行换皮分享。");
    unsupported.push("诚实缺口：不能用另一种更简单的游戏顶替。");
  }
  if (!ruleSystem.entities.length) {
    assumptions.push("来源中尚未识别到可编辑 Game Entity。");
  }

  return {
    id: input.id,
    projectId: input.projectId,
    generationJobId: input.generationJobId,
    ruleSystemId: ruleSystem.id,
    ruleSystemVersion: ruleSystem.version,
    status: "pending",
    summary: ruleSystem.pitch.trim() || "这次生成没有形成一句话玩法摘要。",
    participants: structuredClone(ruleSystem.participants),
    durationMinutes: ruleSystem.durationMinutes,
    playSurface: structuredClone(ruleSystem.playSurface),
    loop: unique([
      ...ruleSystem.setup,
      ...ruleSystem.stages.map((stage) => stage.name),
      ...genreLoop,
    ]).slice(0, 8),
    actions: ruleSystem.actions.slice(0, 8).map((action) => ({
      label: action.label,
      description: action.description,
    })),
    outcomes: ruleSystem.outcomes.slice(0, 8).map((outcome) => outcome.name),
    assumptions,
    unsupported: unique(unsupported),
    sourceIds: [...new Set(input.sourceIds)].sort(),
    ...(input.proposedRuntime ? { proposedRuntime: input.proposedRuntime } : {}),
    createdAt: input.createdAt,
  };
}
