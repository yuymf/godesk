export type PlayerId = "you" | "bot-lime" | "bot-coral";
export type ShipId = "tea" | "silk" | "spice";
export type ZoneId = "harbor" | "shipyard" | "pirates";
export type TargetId = ShipId | ZoneId;
export type Phase = "placement" | "sailing" | "resolved";

export interface Player {
  id: PlayerId;
  name: string;
  color: string;
  cash: number;
  workers: number;
}

export interface Ship {
  id: ShipId;
  name: string;
  color: string;
  position: number;
  reward: number;
}

export interface Placement {
  id: string;
  playerId: PlayerId;
  targetId: TargetId;
  cost: number;
}

export interface LogEntry {
  id: string;
  message: string;
  tone: "neutral" | "good" | "warning";
}

export interface GameState {
  phase: Phase;
  activePlayer: PlayerId;
  players: Player[];
  ships: Ship[];
  placements: Placement[];
  sailingRound: number;
  log: LogEntry[];
  results: Record<ShipId, "harbor" | "shipyard" | "pirates"> | null;
}

export type GameAction =
  | {
      id: string;
      type: "place";
      playerId: PlayerId;
      targetId: TargetId;
    }
  | {
      id: string;
      type: "roll";
      playerId: PlayerId;
      values: [number, number, number];
    };

export const TARGETS: Record<
  TargetId,
  { name: string; capacity: number; baseCost: number; note: string }
> = {
  tea: {
    name: "茶叶船",
    capacity: 3,
    baseCost: 2,
    note: "进港时平分 18 银币",
  },
  silk: {
    name: "丝绸船",
    capacity: 3,
    baseCost: 2,
    note: "进港时平分 24 银币",
  },
  spice: {
    name: "香料船",
    capacity: 3,
    baseCost: 2,
    note: "进港时平分 30 银币",
  },
  harbor: {
    name: "港口",
    capacity: 2,
    baseCost: 4,
    note: "至少一艘进港，获得 9 银币",
  },
  shipyard: {
    name: "船厂",
    capacity: 2,
    baseCost: 3,
    note: "至少一艘未抵达，获得 8 银币",
  },
  pirates: {
    name: "海盗湾",
    capacity: 2,
    baseCost: 5,
    note: "船停在 13 格时瓜分货值",
  },
};

const PLAYER_ORDER: PlayerId[] = ["you", "bot-lime", "bot-coral"];

export function createInitialState(): GameState {
  return {
    phase: "placement",
    activePlayer: "you",
    players: [
      { id: "you", name: "你", color: "#f6c35b", cash: 30, workers: 3 },
      {
        id: "bot-lime",
        name: "青柠商会",
        color: "#91c788",
        cash: 30,
        workers: 3,
      },
      {
        id: "bot-coral",
        name: "珊瑚商会",
        color: "#e97b67",
        cash: 30,
        workers: 3,
      },
    ],
    ships: [
      { id: "tea", name: "茶叶船", color: "#65a891", position: 0, reward: 18 },
      { id: "silk", name: "丝绸船", color: "#dc7563", position: 1, reward: 24 },
      { id: "spice", name: "香料船", color: "#d7a43b", position: 2, reward: 30 },
    ],
    placements: [],
    sailingRound: 0,
    log: [
      {
        id: "welcome",
        message: "航次已创建。每家商会依次派出 3 名伙计。",
        tone: "neutral",
      },
    ],
    results: null,
  };
}

export function targetCost(state: GameState, targetId: TargetId): number {
  const occupied = state.placements.filter(
    (placement) => placement.targetId === targetId,
  ).length;
  return TARGETS[targetId].baseCost + occupied;
}

export function canPlace(
  state: GameState,
  playerId: PlayerId,
  targetId: TargetId,
): boolean {
  if (state.phase !== "placement" || state.activePlayer !== playerId) return false;
  const player = state.players.find((item) => item.id === playerId);
  if (!player || player.workers < 1) return false;
  const occupied = state.placements.filter(
    (placement) => placement.targetId === targetId,
  ).length;
  return (
    occupied < TARGETS[targetId].capacity && player.cash >= targetCost(state, targetId)
  );
}

function nextPlayer(state: GameState, current: PlayerId): PlayerId {
  const currentIndex = PLAYER_ORDER.indexOf(current);
  for (let offset = 1; offset <= PLAYER_ORDER.length; offset += 1) {
    const candidate = PLAYER_ORDER[(currentIndex + offset) % PLAYER_ORDER.length];
    const player = state.players.find((item) => item.id === candidate);
    if (player && player.workers > 0) return candidate;
  }
  return current;
}

function placeWorker(
  state: GameState,
  action: Extract<GameAction, { type: "place" }>,
): GameState {
  if (!canPlace(state, action.playerId, action.targetId)) return state;
  const cost = targetCost(state, action.targetId);
  const players = state.players.map((player) =>
    player.id === action.playerId
      ? { ...player, cash: player.cash - cost, workers: player.workers - 1 }
      : player,
  );
  const placements = [
    ...state.placements,
    {
      id: action.id,
      playerId: action.playerId,
      targetId: action.targetId,
      cost,
    },
  ];
  const actor = state.players.find((player) => player.id === action.playerId)!;
  const allPlaced = players.every((player) => player.workers === 0);

  return {
    ...state,
    players,
    placements,
    phase: allPlaced ? "sailing" : "placement",
    activePlayer: allPlaced ? "you" : nextPlayer({ ...state, players }, action.playerId),
    log: [
      ...state.log,
      {
        id: action.id,
        message: `${actor.name}花费 ${cost}，派伙计前往${TARGETS[action.targetId].name}。`,
        tone: "neutral",
      },
      ...(allPlaced
        ? [
            {
              id: `${action.id}-sail`,
              message: "所有伙计就位。船队可以启航。",
              tone: "good" as const,
            },
          ]
        : []),
    ],
  };
}

function resolveVoyage(state: GameState): GameState {
  const results = Object.fromEntries(
    state.ships.map((ship) => [
      ship.id,
      ship.position > 13
        ? "harbor"
        : ship.position === 13
          ? "pirates"
          : "shipyard",
    ]),
  ) as Record<ShipId, "harbor" | "shipyard" | "pirates">;

  const payouts = new Map<PlayerId, number>();
  const addPayout = (playerId: PlayerId, amount: number) =>
    payouts.set(playerId, (payouts.get(playerId) ?? 0) + amount);

  for (const ship of state.ships) {
    if (results[ship.id] !== "harbor") continue;
    const aboard = state.placements.filter((item) => item.targetId === ship.id);
    if (aboard.length === 0) continue;
    const share = Math.floor(ship.reward / aboard.length);
    aboard.forEach((placement) => addPayout(placement.playerId, share));
  }

  const successfulHarbor = Object.values(results).some((result) => result === "harbor");
  const successfulShipyard = Object.values(results).some(
    (result) => result === "shipyard",
  );
  if (successfulHarbor) {
    state.placements
      .filter((item) => item.targetId === "harbor")
      .forEach((item) => addPayout(item.playerId, 9));
  }
  if (successfulShipyard) {
    state.placements
      .filter((item) => item.targetId === "shipyard")
      .forEach((item) => addPayout(item.playerId, 8));
  }

  const plunderedShips = state.ships.filter(
    (ship) => results[ship.id] === "pirates",
  );
  const pirates = state.placements.filter((item) => item.targetId === "pirates");
  if (plunderedShips.length > 0 && pirates.length > 0) {
    const loot = plunderedShips.reduce((sum, ship) => sum + ship.reward, 0);
    const share = Math.floor(loot / pirates.length);
    pirates.forEach((item) => addPayout(item.playerId, share));
  }

  const players = state.players.map((player) => ({
    ...player,
    cash: player.cash + (payouts.get(player.id) ?? 0),
  }));
  const resultMessage = state.ships
    .map((ship) => `${ship.name}${results[ship.id] === "harbor" ? "进港" : results[ship.id] === "pirates" ? "遭劫" : "进船厂"}`)
    .join("，");

  return {
    ...state,
    phase: "resolved",
    players,
    results,
    log: [
      ...state.log,
      {
        id: "resolution",
        message: `本航次结算：${resultMessage}。`,
        tone: "good",
      },
    ],
  };
}

function rollShips(
  state: GameState,
  action: Extract<GameAction, { type: "roll" }>,
): GameState {
  if (
    state.phase !== "sailing" ||
    action.playerId !== "you" ||
    action.values.some((value) => !Number.isInteger(value) || value < 1 || value > 6)
  ) {
    return state;
  }
  const ships = state.ships.map((ship, index) => ({
    ...ship,
    position: ship.position + action.values[index],
  }));
  const sailingRound = state.sailingRound + 1;
  const rolled: GameState = {
    ...state,
    ships,
    sailingRound,
    log: [
      ...state.log,
      {
        id: action.id,
        message: `第 ${sailingRound} 轮航行：茶 ${action.values[0]}、丝 ${action.values[1]}、香 ${action.values[2]}。`,
        tone: "neutral",
      },
    ],
  };
  return sailingRound === 3 ? resolveVoyage(rolled) : rolled;
}

export function applyAction(state: GameState, action: GameAction): GameState {
  return action.type === "place" ? placeWorker(state, action) : rollShips(state, action);
}

export function replayActions(actions: GameAction[]): GameState {
  return actions.reduce(applyAction, createInitialState());
}

export function chooseBotTarget(state: GameState, playerId: PlayerId): TargetId {
  const preference: TargetId[] = [
    state.placements.length % 2 === 0 ? "silk" : "spice",
    "tea",
    "harbor",
    "shipyard",
    "pirates",
    "silk",
    "spice",
  ];
  return preference.find((targetId) => canPlace(state, playerId, targetId)) ?? "tea";
}

export function winner(state: GameState): Player | null {
  if (state.phase !== "resolved") return null;
  return [...state.players].sort((a, b) => b.cash - a.cash)[0];
}
