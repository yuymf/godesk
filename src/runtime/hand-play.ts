export type HandPlayState = {
  playerCount: number;
  deck: number[];
  hands: number[][];
  playArea: Array<{ seat: number; card: number }>;
  lastPlay: { seat: number; card: number } | null;
};

/** Source-parameterized play-to-score hand deck (honest subset; not trick/shed/suit). */
export type HandPlayDeckConfig = {
  cardValues: number[];
  copiesPerValue: number;
  handSize: number;
  victoryTarget: number;
};

/** Defaults match hobbyist 聚会卡牌 when the source omits numbers. */
export const DEFAULT_HAND_PLAY_DECK: HandPlayDeckConfig = {
  cardValues: [1, 2, 3, 4, 5],
  copiesPerValue: 4,
  handSize: 3,
  victoryTarget: 12,
};

const RULE_NUMBER: Record<string, number> = {
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
  十: 10,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

const NUMBER_TOKEN = "[0-9一二两三四五六七八九十]+|one|two|three|four|five|six|seven|eight|nine|ten";

function parseCorpusNumber(token: string | undefined): number {
  if (!token) return Number.NaN;
  const lower = token.toLowerCase();
  if (RULE_NUMBER[lower] != null) return RULE_NUMBER[lower];
  const tenIndex = lower.indexOf("十");
  if (tenIndex >= 0) {
    const tens = tenIndex === 0 ? 1 : RULE_NUMBER[lower[tenIndex - 1]];
    const onesPart = lower.slice(tenIndex + 1);
    const ones = onesPart ? RULE_NUMBER[onesPart] : 0;
    if (Number.isInteger(tens) && Number.isInteger(ones)) return tens * 10 + ones;
  }
  const n = Number(token);
  return Number.isInteger(n) ? n : Number.NaN;
}

function firstCorpusNumber(corpus: string, patterns: RegExp[]): number {
  for (const pattern of patterns) {
    const n = parseCorpusNumber(corpus.match(pattern)?.[1]);
    if (Number.isInteger(n)) return n;
  }
  return Number.NaN;
}

/**
 * True when the source claims a non-score hand loop (trick / shed / suit / effect).
 * Play-to-score must not silently substitute for these until a faithful subset exists.
 */
export function isNonScoreHandLoopCorpus(corpus: string): boolean {
  const trick =
    /吃墩|夺墩|跟牌|必须跟|主牌|王牌|trump|trick[- ]tak|wins? the trick|follow(?:ing)? suit/i.test(
      corpus,
    );
  const shed =
    /先出完(?:所有)?手牌|出完手牌|打光手牌|shed(?:ding)?|empty(?:ing)? (?:your )?hand|跑得快|斗地主|\bUNO\b|先出完[^。.!?\n]{0,12}获胜/i.test(
      corpus,
    );
  const suitOrEffect =
    /花色相同|同花色|按花色|suit(?:s)? must match|特殊效果牌|牌的?效果|组合(?:成套|牌)|meld|set collection|成套收集/i.test(
      corpus,
    );
  return trick || shed || suitOrEffect;
}

/** Derive deck/hand/victory from corpus; fall back to 聚会卡牌 defaults. */
export function deriveHandPlayDeck(corpus: string): HandPlayDeckConfig {
  const numberToken = NUMBER_TOKEN;
  const valueRange = corpus.match(
    new RegExp(
      `(?:点数|values?)\\s*(${numberToken})\\s*(?:到|至|[-–—]|to)\\s*(${numberToken})`,
      "i",
    ),
  );
  const firstValue = parseCorpusNumber(valueRange?.[1]?.toLowerCase());
  const lastValue = parseCorpusNumber(valueRange?.[2]?.toLowerCase());
  const copiesPerValue = firstCorpusNumber(corpus, [
    new RegExp(`每个点数各?\\s*(${numberToken})\\s*张`, "i"),
    new RegExp(`(?:点数|values?).{0,24}各\\s*(${numberToken})\\s*张`, "i"),
    new RegExp(`各\\s*(${numberToken})\\s*张`, "i"),
    new RegExp(`(${numberToken})\\s+copies\\s+of\\s+each`, "i"),
  ]);
  const handSize = firstCorpusNumber(corpus, [
    new RegExp(`(?:抽|拿)\\s*(${numberToken})\\s*张手牌`, "i"),
    new RegExp(`手牌\\s*(${numberToken})`, "i"),
    new RegExp(`(${numberToken})\\s*张手牌`, "i"),
    new RegExp(`hand(?:\\s*size)?\\s*[:=]?\\s*(${numberToken})`, "i"),
    new RegExp(`deal(?:s|t)?\\s*(${numberToken})\\s*cards?`, "i"),
  ]);
  const victoryTarget = firstCorpusNumber(corpus, [
    new RegExp(`(?:率先|先).{0,30}?(?:达到|获得|到)\\s*(${numberToken})\\s*分?`, "i"),
    new RegExp(`先到\\s*(${numberToken})`, "i"),
    new RegExp(
      `first.{0,30}?(?:reach|score|to)\\s*(${numberToken})\\s*points?`,
      "i",
    ),
  ]);

  const low = Math.min(firstValue, lastValue);
  const high = Math.max(firstValue, lastValue);
  const cardValues =
    Number.isInteger(low) &&
    Number.isInteger(high) &&
    low >= 1 &&
    high <= 100 &&
    high - low + 1 <= 100 &&
    high >= low
      ? Array.from({ length: high - low + 1 }, (_, index) => low + index)
      : DEFAULT_HAND_PLAY_DECK.cardValues;

  const copies =
    Number.isInteger(copiesPerValue) &&
    copiesPerValue >= 1 &&
    copiesPerValue <= 100
      ? copiesPerValue
      : DEFAULT_HAND_PLAY_DECK.copiesPerValue;

  const hands =
    Number.isInteger(handSize) && handSize >= 1 && handSize <= 20
      ? handSize
      : DEFAULT_HAND_PLAY_DECK.handSize;

  const target =
    Number.isInteger(victoryTarget) &&
    victoryTarget >= 1 &&
    victoryTarget <= 1_000
      ? victoryTarget
      : DEFAULT_HAND_PLAY_DECK.victoryTarget;

  return {
    cardValues,
    copiesPerValue: copies,
    handSize: hands,
    victoryTarget: target,
  };
}

function nextRandom(state: number) {
  let value = state | 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return value >>> 0;
}

function shuffledDeck(values: number[], copiesPerValue: number, seed: number) {
  const deck = values.flatMap((value) =>
    Array.from({ length: copiesPerValue }, () => value),
  );
  let random = seed >>> 0 || 1;
  for (let index = deck.length - 1; index > 0; index -= 1) {
    random = nextRandom(random);
    const swapIndex = random % (index + 1);
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }
  return deck;
}

export function createHandPlayState(input: {
  playerCount: number;
  cardValues: number[];
  copiesPerValue: number;
  handSize: number;
  seed?: number;
}): HandPlayState {
  const deck = shuffledDeck(input.cardValues, input.copiesPerValue, input.seed ?? 42);
  const hands = Array.from({ length: input.playerCount }, () => [] as number[]);
  for (let deal = 0; deal < input.handSize; deal += 1) {
    for (let seat = 0; seat < input.playerCount; seat += 1) {
      const card = deck.shift();
      if (card !== undefined) hands[seat].push(card);
    }
  }
  return {
    playerCount: input.playerCount,
    deck,
    hands,
    playArea: [],
    lastPlay: null,
  };
}

export function scopeHandPlayState(
  state: HandPlayState,
  viewerSeat: number | null,
): HandPlayState {
  return {
    ...state,
    deck: [],
    hands: state.hands.map((hand, seat) =>
      seat === viewerSeat ? hand : hand.map(() => 0),
    ),
  };
}

export function applyHandPlayIntent(
  state: HandPlayState,
  seat: number,
  payload?: Record<string, unknown>,
): { state: HandPlayState; points: number } | null {
  const cardIndex = Number(payload?.cardIndex);
  const hand = state.hands[seat];
  if (
    !hand ||
    !Number.isInteger(cardIndex) ||
    cardIndex < 0 ||
    cardIndex >= hand.length
  ) {
    return null;
  }
  const card = hand[cardIndex];
  const nextHands = state.hands.map((cards, index) =>
    index === seat ? cards.filter((_, position) => position !== cardIndex) : [...cards],
  );
  const nextDeck = [...state.deck];
  const drawn = nextDeck.shift();
  if (drawn !== undefined) nextHands[seat].push(drawn);
  return {
    points: card,
    state: {
      ...state,
      deck: nextDeck,
      hands: nextHands,
      playArea: [...state.playArea, { seat, card }],
      lastPlay: { seat, card },
    },
  };
}

export function handPlayExhausted(state: HandPlayState) {
  return state.deck.length === 0 && state.hands.every((hand) => hand.length === 0);
}

export function pickHandPlayBotAction(
  state: HandPlayState,
  seat: number,
): { actionId: string; payload: Record<string, unknown> } | null {
  if (!state.hands[seat]?.length) return null;
  return { actionId: "play", payload: { cardIndex: 0 } };
}
