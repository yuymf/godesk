/**
 * gem-engine-v1 — minimal gem-token / development-card / noble prestige engine
 * on the public play-kernel (T010). Generic; not an IP special-case.
 *
 * Subset: 2 seats, take 3-diverse or 2-same gems, buy visible tier cards with
 * permanent discounts, auto-visit nobles, first to prestige target wins.
 * Reserve hand / gold-as-wild payment beyond bank gold / 3–4 seats unsupported.
 */
import {
  applyAction,
  createInitialState,
  createSeededRng,
  type LegalAction,
  type PlayAction,
  type PlayKernelAdapter,
  type PlayKernelConfig,
  type PlayPhaseId,
  type PlayState,
  type PlayerId,
} from "../play-kernel";

export const GEM_ENGINE_KERNEL_TYPE = "gem-engine-v1" as const;

export const GEM_COLORS = ["white", "blue", "green", "red", "black"] as const;
export type GemColor = (typeof GEM_COLORS)[number];
export type GemToken = GemColor | "gold";

export type GemCardDef = {
  id: string;
  tier: 1 | 2 | 3;
  cost: Partial<Record<GemColor, number>>;
  prestige: number;
  discount: GemColor;
};

export type GemNobleDef = {
  id: string;
  name: string;
  requirements: Partial<Record<GemColor, number>>;
  prestige: number;
};

export type GemEngineContent = {
  cards: GemCardDef[];
  nobles: GemNobleDef[];
  prestigeToWin: number;
  bankPerBasic: number;
  bankGold: number;
};

type GemEngineConfig = {
  playerCount: number;
  content: GemEngineContent;
};

export type GemSeatState = {
  gems: Record<GemToken, number>;
  discounts: Record<GemColor, number>;
  prestige: number;
  cards: GemCardDef[];
  nobles: GemNobleDef[];
};

export type GemEngineGenre = {
  bank: Record<GemToken, number>;
  market: [GemCardDef[], GemCardDef[], GemCardDef[]];
  decks: [GemCardDef[], GemCardDef[], GemCardDef[]];
  nobles: GemNobleDef[];
  seats: [GemSeatState, GemSeatState];
  lastEvent: string | null;
};

/** Generic gem-engine / jewel-workshop cues (not brand-specific). */
export const GEM_ENGINE_CUES =
  /宝石(?:代币|引擎)?|发展牌|永久折扣|贵族|声望\s*\d*|gem\s*engine|prestige\s*(?:points?|target)|development\s*cards?|noble(?:s)?\b/i;

export function ideaRequestsGemEngine(idea: string): boolean {
  return GEM_ENGINE_CUES.test(idea);
}

function emptyGems(): Record<GemToken, number> {
  return { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 };
}

function emptyDiscounts(): Record<GemColor, number> {
  return { white: 0, blue: 0, green: 0, red: 0, black: 0 };
}

function cloneSeat(seat: GemSeatState): GemSeatState {
  return {
    gems: { ...seat.gems },
    discounts: { ...seat.discounts },
    prestige: seat.prestige,
    cards: [...seat.cards],
    nobles: [...seat.nobles],
  };
}

function cloneGenre(genre: GemEngineGenre): GemEngineGenre {
  return {
    bank: { ...genre.bank },
    market: [
      genre.market[0].map((c) => ({ ...c, cost: { ...c.cost } })),
      genre.market[1].map((c) => ({ ...c, cost: { ...c.cost } })),
      genre.market[2].map((c) => ({ ...c, cost: { ...c.cost } })),
    ],
    decks: [
      [...genre.decks[0]],
      [...genre.decks[1]],
      [...genre.decks[2]],
    ],
    nobles: [...genre.nobles],
    seats: [cloneSeat(genre.seats[0]), cloneSeat(genre.seats[1])],
    lastEvent: genre.lastEvent,
  };
}

/** Deterministic mini catalog — enough for a short cold-start game. */
export function defaultGemEngineContent(
  overrides?: Partial<GemEngineContent>,
): GemEngineContent {
  const cards: GemCardDef[] = [
    // Tier 1 — cheap
    { id: "t1_w1", tier: 1, cost: { blue: 1, green: 1, red: 1 }, prestige: 0, discount: "white" },
    { id: "t1_b1", tier: 1, cost: { white: 1, green: 1, black: 1 }, prestige: 0, discount: "blue" },
    { id: "t1_g1", tier: 1, cost: { white: 1, blue: 1, red: 1 }, prestige: 0, discount: "green" },
    { id: "t1_r1", tier: 1, cost: { blue: 1, green: 1, black: 1 }, prestige: 0, discount: "red" },
    { id: "t1_k1", tier: 1, cost: { white: 1, green: 1, red: 1 }, prestige: 0, discount: "black" },
    { id: "t1_w2", tier: 1, cost: { blue: 2, black: 1 }, prestige: 1, discount: "white" },
    { id: "t1_b2", tier: 1, cost: { white: 2, red: 1 }, prestige: 1, discount: "blue" },
    { id: "t1_g2", tier: 1, cost: { red: 2, black: 1 }, prestige: 1, discount: "green" },
    { id: "t1_r2", tier: 1, cost: { green: 2, white: 1 }, prestige: 1, discount: "red" },
    { id: "t1_k2", tier: 1, cost: { black: 2, blue: 1 }, prestige: 1, discount: "black" },
    { id: "t1_w3", tier: 1, cost: { green: 3 }, prestige: 0, discount: "white" },
    { id: "t1_b3", tier: 1, cost: { red: 3 }, prestige: 0, discount: "blue" },
    // Tier 2
    { id: "t2_w1", tier: 2, cost: { green: 2, red: 2, black: 1 }, prestige: 2, discount: "white" },
    { id: "t2_b1", tier: 2, cost: { white: 2, red: 2, black: 1 }, prestige: 2, discount: "blue" },
    { id: "t2_g1", tier: 2, cost: { white: 2, blue: 2, red: 1 }, prestige: 2, discount: "green" },
    { id: "t2_r1", tier: 2, cost: { white: 2, blue: 1, black: 2 }, prestige: 2, discount: "red" },
    { id: "t2_k1", tier: 2, cost: { blue: 2, green: 2, white: 1 }, prestige: 2, discount: "black" },
    { id: "t2_w2", tier: 2, cost: { blue: 3, green: 2 }, prestige: 3, discount: "white" },
    { id: "t2_b2", tier: 2, cost: { red: 3, black: 2 }, prestige: 3, discount: "blue" },
    { id: "t2_g2", tier: 2, cost: { white: 3, red: 2 }, prestige: 3, discount: "green" },
    // Tier 3
    { id: "t3_w1", tier: 3, cost: { blue: 3, green: 3, red: 3 }, prestige: 4, discount: "white" },
    { id: "t3_b1", tier: 3, cost: { white: 3, green: 3, black: 3 }, prestige: 4, discount: "blue" },
    { id: "t3_g1", tier: 3, cost: { white: 3, red: 3, black: 3 }, prestige: 4, discount: "green" },
    { id: "t3_r1", tier: 3, cost: { blue: 3, green: 3, black: 3 }, prestige: 4, discount: "red" },
    { id: "t3_k1", tier: 3, cost: { white: 3, blue: 3, green: 3 }, prestige: 4, discount: "black" },
    { id: "t3_w2", tier: 3, cost: { black: 5, red: 3 }, prestige: 5, discount: "white" },
  ];
  const nobles: GemNobleDef[] = [
    { id: "noble_wb", name: "白蓝勋爵", requirements: { white: 3, blue: 3 }, prestige: 3 },
    { id: "noble_gr", name: "绿红女爵", requirements: { green: 3, red: 3 }, prestige: 3 },
    { id: "noble_kb", name: "黑蓝侯爵", requirements: { black: 3, blue: 3 }, prestige: 3 },
  ];
  return {
    cards: overrides?.cards ?? cards,
    nobles: overrides?.nobles ?? nobles,
    prestigeToWin: overrides?.prestigeToWin ?? 15,
    bankPerBasic: overrides?.bankPerBasic ?? 4,
    bankGold: overrides?.bankGold ?? 5,
  };
}

export function parseGemEngineConfig(
  adapter: PlayKernelConfig["adapter"] | Record<string, unknown> | undefined,
): GemEngineConfig | null {
  if (!adapter || typeof adapter !== "object") return null;
  const playerCount = Number((adapter as { playerCount?: unknown }).playerCount);
  if (playerCount !== 2) return null;
  const raw = (adapter as { content?: unknown }).content;
  const content = defaultGemEngineContent(
    raw && typeof raw === "object" ? (raw as Partial<GemEngineContent>) : undefined,
  );
  if (!content.cards.length || content.prestigeToWin < 1) return null;
  return { playerCount: 2, content };
}


export function bindGemEngineFromRuntimeKernel(input: {
  playerCount: number;
  content?: Partial<GemEngineContent> | null;
}): PlayKernelConfig {
  return createGemEngineKernelConfig({
    content: input.content ?? undefined,
  });
}

export function createGemEngineKernelConfig(
  overrides?: Partial<{ content: Partial<GemEngineContent> }>,
): PlayKernelConfig {
  const content = defaultGemEngineContent(overrides?.content);
  return {
    kernelType: GEM_ENGINE_KERNEL_TYPE,
    playerCount: 2,
    phases: [
      { id: "main", name: "Main" },
      { id: "ended", name: "Ended" },
    ],
    adapter: {
      playerCount: 2,
      content,
    },
  };
}

function shuffleInPlace<T>(items: T[], rng: { at: (i: number) => number }, salt: number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.at(salt + i) % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function refillMarket(genre: GemEngineGenre, tierIndex: number) {
  while (genre.market[tierIndex]!.length < 4 && genre.decks[tierIndex]!.length) {
    genre.market[tierIndex]!.push(genre.decks[tierIndex]!.shift()!);
  }
}

function totalGems(gems: Record<GemToken, number>): number {
  return GEM_COLORS.reduce((n, c) => n + gems[c], 0) + gems.gold;
}

function canAfford(seat: GemSeatState, card: GemCardDef): boolean {
  let goldNeed = 0;
  for (const color of GEM_COLORS) {
    const need = card.cost[color] ?? 0;
    const have = seat.gems[color] + seat.discounts[color];
    if (have < need) goldNeed += need - have;
  }
  return goldNeed <= seat.gems.gold;
}

function payForCard(genre: GemEngineGenre, seatId: PlayerId, card: GemCardDef) {
  const seat = genre.seats[seatId]!;
  for (const color of GEM_COLORS) {
    const need = card.cost[color] ?? 0;
    const fromDiscount = Math.min(need, seat.discounts[color]);
    let remain = need - fromDiscount;
    const fromGems = Math.min(remain, seat.gems[color]);
    seat.gems[color] -= fromGems;
    genre.bank[color] += fromGems;
    remain -= fromGems;
    if (remain > 0) {
      seat.gems.gold -= remain;
      genre.bank.gold += remain;
    }
  }
}

function tryVisitNobles(genre: GemEngineGenre, seatId: PlayerId) {
  const seat = genre.seats[seatId]!;
  const remaining: GemNobleDef[] = [];
  for (const noble of genre.nobles) {
    const ok = GEM_COLORS.every(
      (c) => seat.discounts[c] >= (noble.requirements[c] ?? 0),
    );
    if (ok) {
      seat.nobles.push(noble);
      seat.prestige += noble.prestige;
      genre.lastEvent = `seat${seatId}_noble_${noble.id}`;
    } else {
      remaining.push(noble);
    }
  }
  genre.nobles = remaining;
}

function afterTurn(
  genre: GemEngineGenre,
  seatId: PlayerId,
  prestigeToWin: number,
): {
  genre: GemEngineGenre;
  phase: PlayPhaseId;
  activePlayerId: PlayerId;
  status: "active" | "complete";
  winnerId: number | null;
} {
  tryVisitNobles(genre, seatId);
  if (genre.seats[seatId]!.prestige >= prestigeToWin) {
    return {
      genre,
      phase: "ended",
      activePlayerId: seatId,
      status: "complete",
      winnerId: seatId,
    };
  }
  const next = ((seatId + 1) % 2) as PlayerId;
  return {
    genre,
    phase: "main",
    activePlayerId: next,
    status: "active",
    winnerId: null,
  };
}

export const gemEngineAdapter: PlayKernelAdapter<GemEngineGenre, GemEngineConfig> = {
  kernelType: GEM_ENGINE_KERNEL_TYPE,
  parseConfig: parseGemEngineConfig,
  createGenreState(config, seed) {
    const rng = createSeededRng(seed);
    const byTier: [GemCardDef[], GemCardDef[], GemCardDef[]] = [[], [], []];
    for (const card of config.content.cards) {
      byTier[card.tier - 1]!.push({ ...card, cost: { ...card.cost } });
    }
    const decks: [GemCardDef[], GemCardDef[], GemCardDef[]] = [
      shuffleInPlace(byTier[0], rng, 11),
      shuffleInPlace(byTier[1], rng, 29),
      shuffleInPlace(byTier[2], rng, 47),
    ];
    const market: [GemCardDef[], GemCardDef[], GemCardDef[]] = [[], [], []];
    const genre: GemEngineGenre = {
      bank: {
        white: config.content.bankPerBasic,
        blue: config.content.bankPerBasic,
        green: config.content.bankPerBasic,
        red: config.content.bankPerBasic,
        black: config.content.bankPerBasic,
        gold: config.content.bankGold,
      },
      market,
      decks,
      nobles: shuffleInPlace(config.content.nobles, rng, 67).slice(0, 3),
      seats: [
        { gems: emptyGems(), discounts: emptyDiscounts(), prestige: 0, cards: [], nobles: [] },
        { gems: emptyGems(), discounts: emptyDiscounts(), prestige: 0, cards: [], nobles: [] },
      ],
      lastEvent: null,
    };
    refillMarket(genre, 0);
    refillMarket(genre, 1);
    refillMarket(genre, 2);
    return genre;
  },
  initialPhase() {
    return "main";
  },
  listLegalActions(state, playerId) {
    if (state.status !== "active" || state.activePlayerId !== playerId) return [];
    const actions: LegalAction[] = [];
    const genre = state.genre;
    const seat = genre.seats[playerId]!;
    for (let i = 0; i < GEM_COLORS.length; i++) {
      for (let j = i + 1; j < GEM_COLORS.length; j++) {
        for (let k = j + 1; k < GEM_COLORS.length; k++) {
          const colors = [GEM_COLORS[i]!, GEM_COLORS[j]!, GEM_COLORS[k]!];
          if (colors.every((c) => genre.bank[c] > 0) && totalGems(seat.gems) + 3 <= 10) {
            actions.push({
              type: "take_diverse",
              label: `拿 ${colors.join("/")}`,
              payload: { colors },
            });
          }
        }
      }
    }
    for (const color of GEM_COLORS) {
      if (genre.bank[color] >= 4 && totalGems(seat.gems) + 2 <= 10) {
        actions.push({
          type: "take_pair",
          label: `拿两枚${color}`,
          payload: { color },
        });
      }
    }
    for (let tier = 0; tier < 3; tier++) {
      genre.market[tier]!.forEach((card, index) => {
        if (canAfford(seat, card)) {
          actions.push({
            type: "buy",
            label: `买 T${card.tier} ${card.discount}+${card.prestige}`,
            payload: { tier: tier + 1, index },
          });
        }
      });
    }
    return actions;
  },
  reduce(state, action, config) {
    if (state.status !== "active" || action.playerId !== state.activePlayerId) return null;
    const prestigeToWin = config.content.prestigeToWin;
    const genre = cloneGenre(state.genre);
    const seat = genre.seats[action.playerId]!;

    if (action.type === "take_diverse") {
      const colors = action.payload?.colors;
      if (!Array.isArray(colors) || colors.length !== 3) return null;
      if (new Set(colors).size !== 3) return null;
      for (const c of colors) {
        if (!GEM_COLORS.includes(c as GemColor) || genre.bank[c as GemColor] < 1) return null;
      }
      if (totalGems(seat.gems) + 3 > 10) return null;
      for (const c of colors as GemColor[]) {
        genre.bank[c] -= 1;
        seat.gems[c] += 1;
      }
      genre.lastEvent = `seat${action.playerId}_take_diverse`;
      return afterTurn(genre, action.playerId, prestigeToWin);
    }

    if (action.type === "take_pair") {
      const color = action.payload?.color as GemColor | undefined;
      if (!color || !GEM_COLORS.includes(color) || genre.bank[color] < 4) return null;
      if (totalGems(seat.gems) + 2 > 10) return null;
      genre.bank[color] -= 2;
      seat.gems[color] += 2;
      genre.lastEvent = `seat${action.playerId}_take_pair_${color}`;
      return afterTurn(genre, action.playerId, prestigeToWin);
    }

    if (action.type === "buy") {
      const tier = Number(action.payload?.tier);
      const index = Number(action.payload?.index);
      if (![1, 2, 3].includes(tier) || !Number.isInteger(index) || index < 0) return null;
      const tierIndex = tier - 1;
      const card = genre.market[tierIndex]![index];
      if (!card || !canAfford(seat, card)) return null;
      payForCard(genre, action.playerId, card);
      genre.market[tierIndex]!.splice(index, 1);
      seat.cards.push(card);
      seat.discounts[card.discount] += 1;
      seat.prestige += card.prestige;
      refillMarket(genre, tierIndex);
      genre.lastEvent = `seat${action.playerId}_buy_${card.id}`;
      return afterTurn(genre, action.playerId, prestigeToWin);
    }

    return null;
  },
};

export function gemEngineToSessionFields(state: PlayState<GemEngineGenre>) {
  return {
    turn: state.sequence,
    activeSeat: state.activePlayerId,
    scores: [
      state.genre.seats[0].prestige,
      state.genre.seats[1].prestige,
    ],
    status: state.status,
    winnerSeat: state.winnerId,
    gemEngine: {
      ...cloneGenre(state.genre),
      phase: state.phase,
    },
  };
}

export function playActionFromGemEngineIntent(
  seat: number,
  actionId: string,
  payload?: Record<string, unknown>,
): PlayAction {
  return {
    type: actionId,
    playerId: seat,
    ...(payload ? { payload } : {}),
  };
}

export function pickGemEngineBotAction(
  state: PlayState<GemEngineGenre>,
  seed: number,
  config?: PlayKernelConfig,
): PlayAction {
  const parsed = config
    ? parseGemEngineConfig(config.adapter)
    : parseGemEngineConfig({ playerCount: 2, content: defaultGemEngineContent() });
  const legal = parsed
    ? gemEngineAdapter.listLegalActions(state, state.activePlayerId, parsed)
    : [];
  const rng = createSeededRng(seed);
  if (!legal.length) {
    // Should not happen often; fall back to take whatever bank allows.
    return { type: "take_diverse", playerId: state.activePlayerId, payload: { colors: ["white", "blue", "green"] } };
  }
  const buys = legal.filter((a) => a.type === "buy");
  if (buys.length && rng.at(state.sequence + 2) % 3 !== 0) {
    const choice = buys[rng.at(state.sequence + 5) % buys.length]!;
    return {
      type: choice.type,
      playerId: state.activePlayerId,
      ...(choice.payload ? { payload: { ...choice.payload } } : {}),
    };
  }
  const choice = legal[rng.at(state.sequence + 7) % legal.length]!;
  return {
    type: choice.type,
    playerId: state.activePlayerId,
    ...(choice.payload ? { payload: { ...choice.payload } } : {}),
  };
}

export function autoPlayGemEngineGame(
  seed: number,
  config: PlayKernelConfig = createGemEngineKernelConfig(),
) {
  let state = createInitialState(gemEngineAdapter, config, seed);
  const actions: PlayAction[] = [];
  while (state.status === "active" && actions.length < 200) {
    const action = pickGemEngineBotAction(state, seed, config);
    const result = applyAction(gemEngineAdapter, state, action, config);
    if (!result.ok) {
      throw new Error(`gem_engine_auto_play_illegal:${result.reason}`);
    }
    actions.push(action);
    state = result.state;
  }
  return { state, actions };
}

export function gemEngineUnsupportedNotes(): string[] {
  return [
    "gem-engine-v1 subset: 2 seats, take 3-diverse / 2-same gems, buy visible tier cards with permanent discounts + auto nobles, prestige win; reserve hand / 3–4 seats / complex gold overflow UI unsupported.",
  ];
}
