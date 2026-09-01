export type HandPlayState = {
  playerCount: number;
  deck: number[];
  hands: number[][];
  playArea: Array<{ seat: number; card: number }>;
  lastPlay: { seat: number; card: number } | null;
};

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
