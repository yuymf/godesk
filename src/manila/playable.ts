import { goods } from "./project";

export type ManilaPlayerId = "you" | "bot-green" | "bot-red";
export type LoadedGoodId = "nutmeg" | "silk" | "ginseng";
export type ManilaTargetId =
  | LoadedGoodId
  | "port-a"
  | "port-b"
  | "port-c"
  | "yard-a"
  | "yard-b"
  | "yard-c"
  | "pirates"
  | "pilot-small"
  | "pilot-large"
  | "insurance";
export type ManilaPhase = "placement" | "movement" | "pilot" | "resolved";

export type ManilaPlayer = {
  id: ManilaPlayerId;
  name: string;
  color: string;
  cash: number;
  workers: number;
};

export type ManilaPunt = {
  goodId: LoadedGoodId;
  name: string;
  color: string;
  die: number;
  position: number;
  value: number;
  result?: "port" | "shipyard" | "pirates";
};

export type ManilaPlacement = {
  id: string;
  playerId: ManilaPlayerId;
  targetId: ManilaTargetId;
  cost: number;
};

export type ManilaGameState = {
  phase: ManilaPhase;
  placementRound: number;
  movementRound: number;
  activePlayer: ManilaPlayerId;
  players: ManilaPlayer[];
  punts: ManilaPunt[];
  placements: ManilaPlacement[];
  lastRoll: Partial<Record<LoadedGoodId, number>>;
  boardedPirates: Partial<Record<LoadedGoodId, ManilaPlayerId[]>>;
  log: string[];
  winnerId?: ManilaPlayerId;
};

export const PLAYER_ORDER: ManilaPlayerId[] = ["you", "bot-green", "bot-red"];

export const targetGroups: {
  title: string;
  page: number;
  targets: {
    id: ManilaTargetId;
    name: string;
    capacity: number;
    costs: number[];
    payout: string;
  }[];
}[] = [
  {
    title: "平底船",
    page: 4,
    targets: [
      { id: "nutmeg", name: "肉豆蔻", capacity: 3, costs: [2, 3, 4], payout: "进港平分 24" },
      { id: "silk", name: "丝绸", capacity: 3, costs: [2, 3, 4], payout: "进港平分 18" },
      { id: "ginseng", name: "人参", capacity: 3, costs: [1, 2, 3], payout: "进港平分 12" },
    ],
  },
  {
    title: "港口",
    page: 4,
    targets: [
      { id: "port-a", name: "港口 A", capacity: 1, costs: [4], payout: "至少 1 艘进港：6" },
      { id: "port-b", name: "港口 B", capacity: 1, costs: [3], payout: "至少 2 艘进港：8" },
      { id: "port-c", name: "港口 C", capacity: 1, costs: [2], payout: "3 艘进港：15" },
    ],
  },
  {
    title: "船厂",
    page: 4,
    targets: [
      { id: "yard-a", name: "船厂 A", capacity: 1, costs: [4], payout: "至少 1 艘受损：6" },
      { id: "yard-b", name: "船厂 B", capacity: 1, costs: [3], payout: "至少 2 艘受损：8" },
      { id: "yard-c", name: "船厂 C", capacity: 1, costs: [2], payout: "3 艘受损：15" },
    ],
  },
  {
    title: "特殊行动",
    page: 4,
    targets: [
      { id: "pirates", name: "海盗", capacity: 2, costs: [5, 5], payout: "第 2 轮登船 / 第 3 轮劫掠" },
      { id: "pilot-small", name: "小领航员", capacity: 1, costs: [2], payout: "末次移动前调整 1 格" },
      { id: "pilot-large", name: "大领航员", capacity: 1, costs: [5], payout: "末次移动前调整 2 格" },
      { id: "insurance", name: "保险代理", capacity: 1, costs: [0], payout: "立即 +10；每艘受损赔 6" },
    ],
  },
];

const targetById = new Map(
  targetGroups.flatMap((group) => group.targets).map((target) => [target.id, target]),
);

export function createPlayableState(): ManilaGameState {
  const selectedGoods = goods.filter((good) =>
    ["nutmeg", "silk", "ginseng"].includes(good.id),
  );
  return {
    phase: "placement",
    placementRound: 1,
    movementRound: 0,
    activePlayer: "you",
    players: [
      { id: "you", name: "你 · 港务长", color: "#d6a637", cash: 30, workers: 4 },
      { id: "bot-green", name: "翡翠商会", color: "#568264", cash: 30, workers: 4 },
      { id: "bot-red", name: "赤帆商会", color: "#b84b39", cash: 30, workers: 4 },
    ],
    punts: selectedGoods.map((good, index) => ({
      goodId: good.id as LoadedGoodId,
      name: good.name,
      color: good.color,
      die: good.die,
      position: [4, 3, 2][index],
      value: [24, 18, 12][index],
    })),
    placements: [],
    lastRoll: {},
    boardedPirates: {},
    log: ["港务长已选择肉豆蔻、丝绸、人参；起航位置为 4、3、2。"],
  };
}

export function targetCost(state: ManilaGameState, targetId: ManilaTargetId) {
  const target = targetById.get(targetId)!;
  const occupied = state.placements.filter((placement) => placement.targetId === targetId).length;
  return target.costs[Math.min(occupied, target.costs.length - 1)];
}

export function canPlaceWorker(
  state: ManilaGameState,
  playerId: ManilaPlayerId,
  targetId: ManilaTargetId,
) {
  if (state.phase !== "placement" || state.activePlayer !== playerId) return false;
  const player = state.players.find((item) => item.id === playerId);
  const target = targetById.get(targetId);
  if (!player || !target || player.workers < 1) return false;
  const occupied = state.placements.filter((placement) => placement.targetId === targetId).length;
  return occupied < target.capacity && player.cash >= targetCost(state, targetId);
}

export function placeWorker(
  state: ManilaGameState,
  playerId: ManilaPlayerId,
  targetId: ManilaTargetId,
): ManilaGameState {
  if (!canPlaceWorker(state, playerId, targetId)) return state;
  const cost = targetCost(state, targetId);
  const target = targetById.get(targetId)!;
  const placement: ManilaPlacement = {
    id: `${state.placements.length + 1}-${playerId}-${targetId}`,
    playerId,
    targetId,
    cost,
  };
  const players = state.players.map((player) =>
    player.id === playerId
      ? {
          ...player,
          cash: player.cash - cost + (targetId === "insurance" ? 10 : 0),
          workers: player.workers - 1,
        }
      : player,
  );
  const playerName = state.players.find((player) => player.id === playerId)!.name;
  const currentIndex = PLAYER_ORDER.indexOf(playerId);
  const isRoundEnd = currentIndex === PLAYER_ORDER.length - 1;
  let phase: ManilaPhase = "placement";
  let placementRound = state.placementRound;
  let activePlayer: ManilaPlayerId = PLAYER_ORDER[(currentIndex + 1) % PLAYER_ORDER.length];
  if (isRoundEnd) {
    if (state.placementRound === 2 || state.placementRound === 3) {
      phase = "movement";
      activePlayer = "you";
    } else if (state.placementRound === 4) {
      phase = "pilot";
      activePlayer = "you";
    } else {
      placementRound += 1;
      activePlayer = "you";
    }
  }
  return {
    ...state,
    phase,
    placementRound,
    activePlayer,
    players,
    placements: [...state.placements, placement],
    log: [
      ...state.log,
      `${playerName}${targetId === "insurance" ? "成为保险代理并领取 10 比索" : `花费 ${cost}，派伙计前往${target.name}`}。`,
    ],
  };
}

function botTarget(state: ManilaGameState, playerId: ManilaPlayerId): ManilaTargetId {
  const priorities: ManilaTargetId[] =
    playerId === "bot-green"
      ? ["silk", "port-a", "pilot-small", "yard-b", "ginseng", "pirates"]
      : ["nutmeg", "pirates", "yard-a", "insurance", "port-b", "ginseng"];
  return (
    priorities.find((targetId) => canPlaceWorker(state, playerId, targetId)) ??
    targetGroups.flatMap((group) => group.targets).find((target) =>
      canPlaceWorker(state, playerId, target.id),
    )!.id
  );
}

export function playBots(state: ManilaGameState): ManilaGameState {
  let next = state;
  while (next.phase === "placement" && next.activePlayer !== "you") {
    next = placeWorker(next, next.activePlayer, botTarget(next, next.activePlayer));
  }
  return next;
}

export function rollPunts(
  state: ManilaGameState,
  values: Record<LoadedGoodId, number>,
): ManilaGameState {
  if (state.phase !== "movement") return state;
  if (
    state.punts.some(
      (punt) => values[punt.goodId] < 1 || values[punt.goodId] > punt.die,
    )
  ) return state;
  const movementRound = state.movementRound + 1;
  const punts = state.punts.map((punt) => ({
    ...punt,
    position: punt.position > 13 ? punt.position : punt.position + values[punt.goodId],
  }));
  let boardedPirates = state.boardedPirates;
  const pirateOwners = state.placements
    .filter((placement) => placement.targetId === "pirates")
    .map((placement) => placement.playerId);
  const logs = [
    ...state.log,
    `第 ${movementRound} 次移动：${punts.map((punt) => `${punt.name} +${values[punt.goodId]}`).join("，")}。`,
  ];
  if (movementRound === 2 && pirateOwners.length > 0) {
    const target = punts.find((punt) => punt.position === 13);
    if (target) {
      boardedPirates = { ...boardedPirates, [target.goodId]: pirateOwners.slice(0, 2) };
      logs.push(`海盗登上恰停 13 的${target.name}船。`);
    }
  }
  if (movementRound < 3) {
    return {
      ...state,
      phase: "placement",
      placementRound: state.placementRound + 1,
      movementRound,
      activePlayer: "you",
      punts,
      lastRoll: values,
      boardedPirates,
      log: logs,
    };
  }
  return settleVoyage({
    ...state,
    movementRound,
    punts,
    lastRoll: values,
    boardedPirates,
    log: logs,
  });
}

export function usePilot(
  state: ManilaGameState,
  goodId: LoadedGoodId,
  direction: -1 | 1,
): ManilaGameState {
  if (state.phase !== "pilot") return state;
  const humanPilot = state.placements.find(
    (placement) =>
      placement.playerId === "you" &&
      (placement.targetId === "pilot-small" || placement.targetId === "pilot-large"),
  );
  const strength = humanPilot?.targetId === "pilot-large" ? 2 : humanPilot ? 1 : 0;
  const punts = state.punts.map((punt) =>
    punt.goodId === goodId && punt.position <= 13
      ? { ...punt, position: Math.max(0, punt.position + direction * strength) }
      : punt,
  );
  return {
    ...state,
    phase: "movement",
    punts,
    log: [
      ...state.log,
      strength
        ? `你的领航员将${punts.find((punt) => punt.goodId === goodId)!.name}船调整 ${direction * strength} 格。`
        : "无人控制领航员，直接进入最后一次移动。",
    ],
  };
}

function addCash(players: ManilaPlayer[], playerId: ManilaPlayerId, amount: number) {
  return players.map((player) =>
    player.id === playerId ? { ...player, cash: player.cash + amount } : player,
  );
}

function settleVoyage(state: ManilaGameState): ManilaGameState {
  const pirateOwners = state.placements
    .filter((placement) => placement.targetId === "pirates")
    .map((placement) => placement.playerId);
  const punts = state.punts.map((punt) => ({
    ...punt,
    result:
      punt.position > 13
        ? ("port" as const)
        : punt.position === 13 && pirateOwners.length > 0
          ? ("pirates" as const)
          : ("shipyard" as const),
  }));
  let players = state.players;
  for (const punt of punts) {
    if (punt.result === "port") {
      const owners = state.placements.filter((placement) => placement.targetId === punt.goodId);
      const share = owners.length ? Math.floor(punt.value / owners.length) : 0;
      owners.forEach((placement) => {
        players = addCash(players, placement.playerId, share);
      });
      (state.boardedPirates[punt.goodId] ?? []).forEach((playerId) => {
        players = addCash(players, playerId, share);
      });
    }
    if (punt.result === "pirates" && pirateOwners.length) {
      const share = Math.floor(punt.value / pirateOwners.length);
      pirateOwners.forEach((playerId) => {
        players = addCash(players, playerId, share);
      });
    }
  }
  const portCount = punts.filter((punt) => punt.result === "port").length;
  const yardCount = punts.filter((punt) => punt.result === "shipyard").length;
  const outcomeSpaces: [ManilaTargetId, number, number][] = [
    ["port-a", 1, 6],
    ["port-b", 2, 8],
    ["port-c", 3, 15],
    ["yard-a", 1, 6],
    ["yard-b", 2, 8],
    ["yard-c", 3, 15],
  ];
  outcomeSpaces.forEach(([targetId, threshold, payout]) => {
    const count = targetId.startsWith("port") ? portCount : yardCount;
    if (count < threshold) return;
    state.placements
      .filter((placement) => placement.targetId === targetId)
      .forEach((placement) => {
        players = addCash(players, placement.playerId, payout);
      });
  });
  const insurer = state.placements.find((placement) => placement.targetId === "insurance");
  if (insurer && yardCount > 0) {
    players = addCash(players, insurer.playerId, -6 * yardCount);
  }
  const winner = [...players].sort((a, b) => b.cash - a.cash)[0];
  return {
    ...state,
    phase: "resolved",
    punts,
    players,
    winnerId: winner.id,
    log: [
      ...state.log,
      `航次结算：${portCount} 艘进港，${yardCount} 艘进入船厂，${punts.filter((punt) => punt.result === "pirates").length} 艘被劫。`,
      `${winner.name}以 ${winner.cash} 比索成为本航次领先者。`,
    ],
  };
}

export function randomRoll(state: ManilaGameState): Record<LoadedGoodId, number> {
  return Object.fromEntries(
    state.punts.map((punt) => [
      punt.goodId,
      Math.floor(Math.random() * punt.die) + 1,
    ]),
  ) as Record<LoadedGoodId, number>;
}
