/** Public-safe harbor voyage kernel (scoreboard-friendly single voyage). */

export type HarborCargoId = "amber" | "cobalt" | "cedar";
export type HarborTargetId =
  | HarborCargoId
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
export type HarborPhase = "placement" | "movement" | "pilot" | "resolved";

export type HarborPlayer = {
  seat: number;
  name: string;
  color: string;
  cash: number;
  workers: number;
};

export type HarborPunt = {
  cargoId: HarborCargoId;
  name: string;
  color: string;
  die: number;
  position: number;
  value: number;
  result?: "port" | "shipyard" | "pirates";
};

export type HarborPlacement = {
  id: string;
  seat: number;
  targetId: HarborTargetId;
  cost: number;
};

export type HarborVoyageState = {
  phase: HarborPhase;
  placementRound: number;
  movementRound: number;
  activeSeat: number;
  players: HarborPlayer[];
  punts: HarborPunt[];
  placements: HarborPlacement[];
  lastRoll: Partial<Record<HarborCargoId, number>>;
  boardedPirates: Partial<Record<HarborCargoId, number[]>>;
  log: string[];
  winnerSeat: number | null;
};

export const HARBOR_CARGO: Array<{
  id: HarborCargoId;
  name: string;
  color: string;
  die: number;
  value: number;
  start: number;
}> = [
  { id: "amber", name: "琥珀货", color: "#8c4d32", die: 4, value: 24, start: 4 },
  { id: "cobalt", name: "钴蓝绸", color: "#286a8a", die: 3, value: 18, start: 3 },
  { id: "cedar", name: "雪松木", color: "#d6a637", die: 2, value: 12, start: 2 },
];

export const HARBOR_TARGET_GROUPS: {
  title: string;
  targets: {
    id: HarborTargetId;
    name: string;
    capacity: number;
    costs: number[];
    payout: string;
  }[];
}[] = [
  {
    title: "货船",
    targets: [
      { id: "amber", name: "琥珀货", capacity: 3, costs: [2, 3, 4], payout: "进港平分 24" },
      { id: "cobalt", name: "钴蓝绸", capacity: 3, costs: [2, 3, 4], payout: "进港平分 18" },
      { id: "cedar", name: "雪松木", capacity: 3, costs: [1, 2, 3], payout: "进港平分 12" },
    ],
  },
  {
    title: "港口",
    targets: [
      { id: "port-a", name: "东栈桥", capacity: 1, costs: [4], payout: "至少 1 艘进港：6" },
      { id: "port-b", name: "中栈桥", capacity: 1, costs: [3], payout: "至少 2 艘进港：8" },
      { id: "port-c", name: "西栈桥", capacity: 1, costs: [2], payout: "3 艘进港：15" },
    ],
  },
  {
    title: "船厂",
    targets: [
      { id: "yard-a", name: "干坞甲", capacity: 1, costs: [4], payout: "至少 1 艘进坞：6" },
      { id: "yard-b", name: "干坞乙", capacity: 1, costs: [3], payout: "至少 2 艘进坞：8" },
      { id: "yard-c", name: "干坞丙", capacity: 1, costs: [2], payout: "3 艘进坞：15" },
    ],
  },
  {
    title: "特殊行动",
    targets: [
      { id: "pirates", name: "私掠队", capacity: 2, costs: [5, 5], payout: "第 2 轮登船 / 第 3 轮截获" },
      { id: "pilot-small", name: "小领航", capacity: 1, costs: [2], payout: "末次移动前调整 1 格" },
      { id: "pilot-large", name: "大领航", capacity: 1, costs: [5], payout: "末次移动前调整 2 格" },
      { id: "insurance", name: "港务保险", capacity: 1, costs: [0], payout: "立即 +10；每艘进坞赔 6" },
    ],
  },
];

const targetById = new Map(
  HARBOR_TARGET_GROUPS.flatMap((group) => group.targets).map((target) => [
    target.id,
    target,
  ]),
);

const PLAYER_NAMES = ["港务商会", "翡翠商会", "赤帆商会"];
const PLAYER_COLORS = ["#d6a637", "#568264", "#b84b39"];

export function createHarborVoyageState(playerCount = 3): HarborVoyageState {
  const seats = Math.max(2, Math.min(3, playerCount));
  return {
    phase: "placement",
    placementRound: 1,
    movementRound: 0,
    activeSeat: 0,
    players: Array.from({ length: seats }, (_, seat) => ({
      seat,
      name: PLAYER_NAMES[seat] ?? `商会 ${seat + 1}`,
      color: PLAYER_COLORS[seat] ?? "#6d675b",
      cash: 30,
      workers: 4,
    })),
    punts: HARBOR_CARGO.map((cargo) => ({
      cargoId: cargo.id,
      name: cargo.name,
      color: cargo.color,
      die: cargo.die,
      position: cargo.start,
      value: cargo.value,
    })),
    placements: [],
    lastRoll: {},
    boardedPirates: {},
    log: [
      `三家商会争夺航线；起航位置为 ${HARBOR_CARGO.map((c) => c.start).join("、")}。`,
    ],
    winnerSeat: null,
  };
}

export function harborTargetCost(state: HarborVoyageState, targetId: HarborTargetId) {
  const target = targetById.get(targetId)!;
  const occupied = state.placements.filter(
    (placement) => placement.targetId === targetId,
  ).length;
  return target.costs[Math.min(occupied, target.costs.length - 1)];
}

export function canPlaceHarborWorker(
  state: HarborVoyageState,
  seat: number,
  targetId: HarborTargetId,
) {
  if (state.phase !== "placement" || state.activeSeat !== seat) return false;
  const player = state.players.find((item) => item.seat === seat);
  const target = targetById.get(targetId);
  if (!player || !target || player.workers < 1) return false;
  const occupied = state.placements.filter(
    (placement) => placement.targetId === targetId,
  ).length;
  return occupied < target.capacity && player.cash >= harborTargetCost(state, targetId);
}

function placeWorker(
  state: HarborVoyageState,
  seat: number,
  targetId: HarborTargetId,
): HarborVoyageState | null {
  if (!canPlaceHarborWorker(state, seat, targetId)) return null;
  const cost = harborTargetCost(state, targetId);
  const target = targetById.get(targetId)!;
  const placement: HarborPlacement = {
    id: `${state.placements.length + 1}-${seat}-${targetId}`,
    seat,
    targetId,
    cost,
  };
  const players = state.players.map((player) =>
    player.seat === seat
      ? {
          ...player,
          cash: player.cash - cost + (targetId === "insurance" ? 10 : 0),
          workers: player.workers - 1,
        }
      : player,
  );
  const playerName = state.players.find((player) => player.seat === seat)!.name;
  const seatCount = state.players.length;
  const isRoundEnd = seat === seatCount - 1;
  let phase: HarborPhase = "placement";
  let placementRound = state.placementRound;
  let activeSeat = (seat + 1) % seatCount;
  if (isRoundEnd) {
    if (state.placementRound === 2 || state.placementRound === 3) {
      phase = "movement";
      activeSeat = 0;
    } else if (state.placementRound === 4) {
      phase = "pilot";
      activeSeat = 0;
    } else {
      placementRound += 1;
      activeSeat = 0;
    }
  }
  return {
    ...state,
    phase,
    placementRound,
    activeSeat,
    players,
    placements: [...state.placements, placement],
    log: [
      ...state.log,
      targetId === "insurance"
        ? `${playerName}成为港务保险并领取 10 信用。`
        : `${playerName}花费 ${cost}，派伙计前往${target.name}。`,
    ],
  };
}

function botTarget(state: HarborVoyageState, seat: number): HarborTargetId {
  const priorities: HarborTargetId[] =
    seat === 1
      ? ["cobalt", "port-a", "pilot-small", "yard-b", "cedar", "pirates"]
      : ["amber", "pirates", "yard-a", "insurance", "port-b", "cedar"];
  return (
    priorities.find((targetId) => canPlaceHarborWorker(state, seat, targetId)) ??
    HARBOR_TARGET_GROUPS.flatMap((group) => group.targets).find((target) =>
      canPlaceHarborWorker(state, seat, target.id),
    )!.id
  );
}

export function pickHarborBotActionId(state: HarborVoyageState): string | null {
  if (state.phase === "placement") {
    return `place:${botTarget(state, state.activeSeat)}`;
  }
  if (state.phase === "movement") return "roll";
  if (state.phase === "pilot") {
    const hasPilot = state.placements.some(
      (placement) =>
        placement.seat === 0 &&
        (placement.targetId === "pilot-small" ||
          placement.targetId === "pilot-large"),
    );
    return hasPilot ? "pilot:cedar:1" : "pilot:skip";
  }
  return null;
}

function rollPunts(
  state: HarborVoyageState,
  values: Record<HarborCargoId, number>,
): HarborVoyageState | null {
  if (state.phase !== "movement") return null;
  if (
    state.punts.some(
      (punt) => values[punt.cargoId] < 1 || values[punt.cargoId] > punt.die,
    )
  ) {
    return null;
  }
  const movementRound = state.movementRound + 1;
  const punts = state.punts.map((punt) => ({
    ...punt,
    position:
      punt.position > 13 ? punt.position : punt.position + values[punt.cargoId],
  }));
  let boardedPirates = state.boardedPirates;
  const pirateOwners = state.placements
    .filter((placement) => placement.targetId === "pirates")
    .map((placement) => placement.seat);
  const logs = [
    ...state.log,
    `第 ${movementRound} 次航行：${punts
      .map((punt) => `${punt.name} +${values[punt.cargoId]}`)
      .join("，")}。`,
  ];
  if (movementRound === 2 && pirateOwners.length > 0) {
    const target = punts.find((punt) => punt.position === 13);
    if (target) {
      boardedPirates = {
        ...boardedPirates,
        [target.cargoId]: pirateOwners.slice(0, 2),
      };
      logs.push(`私掠队登上恰停 13 的${target.name}船。`);
    }
  }
  if (movementRound < 3) {
    return {
      ...state,
      phase: "placement",
      placementRound: state.placementRound + 1,
      movementRound,
      activeSeat: 0,
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

function usePilot(
  state: HarborVoyageState,
  cargoId: HarborCargoId,
  direction: -1 | 1,
): HarborVoyageState | null {
  if (state.phase !== "pilot") return null;
  const humanPilot = state.placements.find(
    (placement) =>
      placement.seat === 0 &&
      (placement.targetId === "pilot-small" ||
        placement.targetId === "pilot-large"),
  );
  const strength =
    humanPilot?.targetId === "pilot-large" ? 2 : humanPilot ? 1 : 0;
  const punts = state.punts.map((punt) =>
    punt.cargoId === cargoId && punt.position <= 13
      ? {
          ...punt,
          position: Math.max(0, punt.position + direction * strength),
        }
      : punt,
  );
  return {
    ...state,
    phase: "movement",
    activeSeat: 0,
    punts,
    log: [
      ...state.log,
      strength
        ? `领航员将${punts.find((punt) => punt.cargoId === cargoId)!.name}船调整 ${direction * strength} 格。`
        : "无人控制领航员，直接进入最后一次航行。",
    ],
  };
}

function addCash(players: HarborPlayer[], seat: number, amount: number) {
  return players.map((player) =>
    player.seat === seat ? { ...player, cash: player.cash + amount } : player,
  );
}

function settleVoyage(state: HarborVoyageState): HarborVoyageState {
  const pirateOwners = state.placements
    .filter((placement) => placement.targetId === "pirates")
    .map((placement) => placement.seat);
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
      const owners = state.placements.filter(
        (placement) => placement.targetId === punt.cargoId,
      );
      const share = owners.length ? Math.floor(punt.value / owners.length) : 0;
      owners.forEach((placement) => {
        players = addCash(players, placement.seat, share);
      });
      (state.boardedPirates[punt.cargoId] ?? []).forEach((seat) => {
        players = addCash(players, seat, share);
      });
    }
    if (punt.result === "pirates" && pirateOwners.length) {
      const share = Math.floor(punt.value / pirateOwners.length);
      pirateOwners.forEach((seat) => {
        players = addCash(players, seat, share);
      });
    }
  }
  const portCount = punts.filter((punt) => punt.result === "port").length;
  const yardCount = punts.filter((punt) => punt.result === "shipyard").length;
  const outcomeSpaces: [HarborTargetId, number, number][] = [
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
        players = addCash(players, placement.seat, payout);
      });
  });
  const insurer = state.placements.find(
    (placement) => placement.targetId === "insurance",
  );
  if (insurer && yardCount > 0) {
    players = addCash(players, insurer.seat, -6 * yardCount);
  }
  const winner = [...players].sort((a, b) => b.cash - a.cash)[0];
  return {
    ...state,
    phase: "resolved",
    activeSeat: winner.seat,
    punts,
    players,
    winnerSeat: winner.seat,
    log: [
      ...state.log,
      `航次结算：${portCount} 艘进港，${yardCount} 艘进坞，${punts.filter((punt) => punt.result === "pirates").length} 艘被截。`,
      `${winner.name}以 ${winner.cash} 信用成为本航次领先者。`,
    ],
  };
}

function nextRandom(state: number) {
  let value = state | 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return value >>> 0;
}

export function seededHarborRoll(
  state: HarborVoyageState,
  seed: number,
  sequence: number,
): Record<HarborCargoId, number> {
  let random = (seed ^ (sequence * 0x9e3779b9)) >>> 0 || 1;
  const values = {} as Record<HarborCargoId, number>;
  for (const punt of state.punts) {
    random = nextRandom(random);
    values[punt.cargoId] = (random % punt.die) + 1;
  }
  return values;
}

export function parseHarborActionId(actionId: string): {
  kind: "place" | "roll" | "pilot";
  targetId?: HarborTargetId;
  rolls?: Record<HarborCargoId, number>;
  cargoId?: HarborCargoId;
  direction?: -1 | 1;
  skip?: boolean;
} | null {
  if (actionId.startsWith("place:")) {
    const targetId = actionId.slice("place:".length) as HarborTargetId;
    if (!targetById.has(targetId)) return null;
    return { kind: "place", targetId };
  }
  if (actionId === "roll" || actionId.startsWith("roll:")) {
    if (actionId === "roll") return { kind: "roll" };
    const parts = actionId.slice("roll:".length).split(",");
    if (parts.length !== 3) return null;
    const [amber, cobalt, cedar] = parts.map(Number);
    if (![amber, cobalt, cedar].every((value) => Number.isInteger(value))) {
      return null;
    }
    return {
      kind: "roll",
      rolls: { amber, cobalt, cedar },
    };
  }
  if (actionId === "pilot:skip") {
    return { kind: "pilot", skip: true, cargoId: "cedar", direction: 1 };
  }
  const pilotMatch = actionId.match(/^pilot:(amber|cobalt|cedar):(-1|1)$/);
  if (pilotMatch) {
    return {
      kind: "pilot",
      cargoId: pilotMatch[1] as HarborCargoId,
      direction: Number(pilotMatch[2]) as -1 | 1,
    };
  }
  return null;
}

export function applyHarborIntent(
  state: HarborVoyageState,
  seat: number,
  actionId: string,
  seed: number,
  sequence: number,
): { state: HarborVoyageState; canonicalActionId: string; points: number } | null {
  const parsed = parseHarborActionId(actionId);
  if (!parsed) return null;

  if (parsed.kind === "place") {
    if (seat !== state.activeSeat) return null;
    const next = placeWorker(state, seat, parsed.targetId!);
    if (!next) return null;
    return {
      state: next,
      canonicalActionId: actionId,
      points: 0,
    };
  }

  if (parsed.kind === "roll") {
    // Harbor master (seat 0) steers shared sailing / pilot phases.
    if (state.phase !== "movement" || seat !== 0) return null;
    const rolls =
      parsed.rolls ?? seededHarborRoll(state, seed, sequence);
    const next = rollPunts(state, rolls);
    if (!next) return null;
    return {
      state: next,
      canonicalActionId: `roll:${rolls.amber},${rolls.cobalt},${rolls.cedar}`,
      points: 0,
    };
  }

  if (parsed.kind === "pilot") {
    if (state.phase !== "pilot" || seat !== 0) return null;
    const next = usePilot(
      state,
      parsed.cargoId ?? "cedar",
      parsed.direction ?? 1,
    );
    if (!next) return null;
    return {
      state: next,
      canonicalActionId: parsed.skip
        ? "pilot:skip"
        : `pilot:${parsed.cargoId}:${parsed.direction}`,
      points: 0,
    };
  }

  return null;
}

export function harborScores(state: HarborVoyageState) {
  return state.players.map((player) => player.cash);
}

export function harborInstruction(state: HarborVoyageState) {
  if (state.phase === "placement") {
    return `放置第 ${state.placementRound}/4 名伙计：选择一个仍有空位、付得起的位置。`;
  }
  if (state.phase === "movement") {
    return `第 ${state.movementRound + 1}/3 次航行：由港务商会掷三枚货船骰。`;
  }
  if (state.phase === "pilot") {
    const hasPilot = state.placements.some(
      (placement) =>
        placement.seat === 0 &&
        (placement.targetId === "pilot-small" ||
          placement.targetId === "pilot-large"),
    );
    return hasPilot
      ? "领航员行动：选择一艘船并向前或向后调整。"
      : "没有领航员，跳过并进入最后一次航行。";
  }
  const winner = state.players.find((player) => player.seat === state.winnerSeat);
  return `${winner?.name ?? "商会"}以领先信用结束本航次。`;
}
