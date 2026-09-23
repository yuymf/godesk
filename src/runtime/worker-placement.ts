/** Source-parameterized worker-placement kernel (honest subset; not harbor-as-universal). */

export type WorkerPlacementRegion = {
  id: string;
  name: string;
  capacity: number;
  /** Flat cost deducted from the seat's coin pool when placing (0 = free). */
  cost: number;
  /** Points awarded to the placer at resolve. */
  resolvePoints: number;
  tag?: string;
};

export type WorkerPlacementPlayer = {
  seat: number;
  name: string;
  color: string;
  workers: number;
  coins: number;
  score: number;
};

export type WorkerPlacementRecord = {
  id: string;
  seat: number;
  regionId: string;
  cost: number;
};

export type WorkerPlacementPhase = "placement" | "resolved";

export type WorkerPlacementState = {
  phase: WorkerPlacementPhase;
  activeSeat: number;
  players: WorkerPlacementPlayer[];
  regions: WorkerPlacementRegion[];
  placements: WorkerPlacementRecord[];
  /** Optional early-end score; when unset, resolve after all workers are placed. */
  victoryTarget: number | null;
  log: string[];
  winnerSeat: number | null;
};

export type WorkerPlacementConfig = {
  playerCount: number;
  workersPerSeat: number;
  startingCoins: number;
  regions: WorkerPlacementRegion[];
  victoryTarget?: number | null;
};

const PLAYER_NAMES_ZH = ["甲席", "乙席", "丙席", "丁席", "戊席", "己席"];
const PLAYER_NAMES_EN = ["Seat A", "Seat B", "Seat C", "Seat D", "Seat E", "Seat F"];
const PLAYER_COLORS = ["#d6a637", "#568264", "#b84b39", "#286a8a", "#8c4d32", "#6d675b"];

export function isHarborLikeCorpus(corpus: string): boolean {
  return /harbor voyage|港口航线|港口十三|琥珀货|钴蓝绸|雪松木|东栈桥|中栈桥|西栈桥|干坞|私掠|领航|港务保险|\bpunts?\b|harbor board|harbor table/i.test(
    corpus,
  );
}

function slugifyRegionId(name: string, index: number): string {
  const ascii = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  if (ascii.length >= 2) return ascii;
  return `region-${index + 1}`;
}

/** Pull named spots from the brief; fall back to honest non-harbor defaults. */
export function deriveWorkerPlacementRegions(corpus: string): WorkerPlacementRegion[] {
  const named: string[] = [];
  const seen = new Set<string>();
  const pushName = (raw: string) => {
    const name = raw.trim().replace(/[.,;:!?。，；：！？]+$/g, "");
    if (name.length < 2 || name.length > 24) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    // Never invent harbor cargo IDs from a generic brief.
    if (/琥珀货|钴蓝绸|雪松木|东栈桥|中栈桥|西栈桥|干坞|私掠|领航|港务/.test(name)) {
      return;
    }
    seen.add(key);
    named.push(name);
  };

  for (const match of corpus.matchAll(
    /(?:onto|on|into|at)\s+(?:the\s+)?([A-Z][A-Za-z0-9' -]{1,22})/g,
  )) {
    pushName(match[1]);
  }
  for (const match of corpus.matchAll(
    /(?:放到|放置到|放置于|派往|前往)\s*[「"']?([\u4e00-\u9fffA-Za-z0-9]{2,12})[」"']?/g,
  )) {
    pushName(match[1]);
  }
  for (const match of corpus.matchAll(
    /(?:regions?|spots?|spaces?|areas?|zones?|区域|格子|位置)\s*[:：]?\s*([A-Za-z\u4e00-\u9fff0-9、,/，\s-]{4,80})/gi,
  )) {
    for (const part of match[1].split(/[、,/，]+/)) {
      pushName(part);
    }
  }

  const isZh = /[\u4e00-\u9fff]/.test(corpus);
  const hasBuilding = /build(?:ing)?s?|建筑|完工|建造/i.test(corpus);
  const base =
    named.length >= 2
      ? named.slice(0, 6)
      : isZh
        ? hasBuilding
          ? ["资源区甲", "资源区乙", "资源区丙", "建筑场"]
          : ["资源区甲", "资源区乙", "资源区丙", "公共区"]
        : hasBuilding
          ? ["Resource Spot A", "Resource Spot B", "Resource Spot C", "Building Yard"]
          : ["Resource Spot A", "Resource Spot B", "Resource Spot C", "Commons"];

  return base.map((name, index) => {
    const building =
      /build|yard|建筑|建造/i.test(name) || (hasBuilding && index === base.length - 1);
    return {
      id: slugifyRegionId(name, index),
      name,
      capacity: building ? 3 : 2,
      cost: 0,
      resolvePoints: building ? 2 : 1,
      ...(building ? { tag: "building" } : {}),
    };
  });
}

export function deriveWorkersPerSeat(corpus: string, playerCount: number): number {
  const match = corpus.match(
    /(?:each (?:player|seat) (?:has|gets|receives)|每人|每名玩家|每位玩家)\s*([0-9一二两三四五六七八九十]+)\s*(?:workers?|伙计|工人|职员)/i,
  );
  if (match) {
    const token = match[1];
    const map: Record<string, number> = {
      一: 1,
      二: 2,
      两: 2,
      三: 3,
      四: 4,
      五: 5,
      六: 6,
    };
    const n = map[token] ?? Number(token);
    if (Number.isInteger(n) && n >= 1 && n <= 8) return n;
  }
  // Enough workers for a short place→occupy→resolve loop without inventing a marathon.
  return Math.max(2, Math.min(4, 8 - playerCount));
}

export function createWorkerPlacementState(
  config: WorkerPlacementConfig,
  options?: { locale?: "zh" | "en" },
): WorkerPlacementState {
  const seats = Math.max(2, Math.min(6, config.playerCount));
  const locale = options?.locale ?? "zh";
  const names = locale === "en" ? PLAYER_NAMES_EN : PLAYER_NAMES_ZH;
  const workersPerSeat = Math.max(1, Math.min(8, config.workersPerSeat));
  const startingCoins = Math.max(0, Math.min(100, config.startingCoins));
  const regions = config.regions.map((region) => ({ ...region }));
  return {
    phase: "placement",
    activeSeat: 0,
    players: Array.from({ length: seats }, (_, seat) => ({
      seat,
      name: names[seat] ?? `Seat ${seat + 1}`,
      color: PLAYER_COLORS[seat] ?? "#6d675b",
      workers: workersPerSeat,
      coins: startingCoins,
      score: 0,
    })),
    regions,
    placements: [],
    victoryTarget:
      config.victoryTarget != null &&
      Number.isInteger(config.victoryTarget) &&
      config.victoryTarget > 0
        ? config.victoryTarget
        : null,
    log: [
      locale === "en"
        ? `Workers are ready. Place on named regions until every worker is committed.`
        : `伙计已就位。在具名区域放置，直到所有工人用完后结算。`,
    ],
    winnerSeat: null,
  };
}

export function regionOccupancy(state: WorkerPlacementState, regionId: string) {
  return state.placements.filter((placement) => placement.regionId === regionId).length;
}

export function canPlaceWorker(
  state: WorkerPlacementState,
  seat: number,
  regionId: string,
) {
  if (state.phase !== "placement" || state.activeSeat !== seat) return false;
  const player = state.players.find((item) => item.seat === seat);
  const region = state.regions.find((item) => item.id === regionId);
  if (!player || !region || player.workers < 1) return false;
  if (regionOccupancy(state, regionId) >= region.capacity) return false;
  return player.coins >= region.cost;
}

function settle(state: WorkerPlacementState): WorkerPlacementState {
  const scores = new Map<number, number>();
  for (const player of state.players) scores.set(player.seat, 0);
  for (const placement of state.placements) {
    const region = state.regions.find((item) => item.id === placement.regionId);
    if (!region) continue;
    scores.set(
      placement.seat,
      (scores.get(placement.seat) ?? 0) + region.resolvePoints,
    );
  }
  const players = state.players.map((player) => ({
    ...player,
    score: scores.get(player.seat) ?? 0,
  }));
  const ranked = [...players].sort((a, b) => b.score - a.score || a.seat - b.seat);
  const top = ranked[0];
  const tied =
    ranked.length > 1 && ranked[1] && ranked[1].score === top.score;
  return {
    ...state,
    phase: "resolved",
    players,
    activeSeat: tied ? state.activeSeat : top.seat,
    winnerSeat: tied ? null : top.seat,
    log: [
      ...state.log,
      tied
        ? `结算完成：最高分 ${top.score} 平分，无唯一胜者。`
        : `结算完成：${top.name}以 ${top.score} 分领先。`,
    ],
  };
}

function placeWorker(
  state: WorkerPlacementState,
  seat: number,
  regionId: string,
): WorkerPlacementState | null {
  if (!canPlaceWorker(state, seat, regionId)) return null;
  const region = state.regions.find((item) => item.id === regionId)!;
  const placement: WorkerPlacementRecord = {
    id: `${state.placements.length + 1}-${seat}-${regionId}`,
    seat,
    regionId,
    cost: region.cost,
  };
  const players = state.players.map((player) =>
    player.seat === seat
      ? {
          ...player,
          workers: player.workers - 1,
          coins: player.coins - region.cost,
          score: player.score + (state.victoryTarget != null ? region.resolvePoints : 0),
        }
      : player,
  );
  const playerName = state.players.find((player) => player.seat === seat)!.name;
  const nextPlacements = [...state.placements, placement];
  const nextBase: WorkerPlacementState = {
    ...state,
    players,
    placements: nextPlacements,
    log: [
      ...state.log,
      region.cost > 0
        ? `${playerName}花费 ${region.cost}，派工人前往${region.name}。`
        : `${playerName}派工人前往${region.name}。`,
    ],
  };

  if (state.victoryTarget != null) {
    const placer = players.find((player) => player.seat === seat)!;
    if (placer.score >= state.victoryTarget) {
      return {
        ...nextBase,
        phase: "resolved",
        activeSeat: seat,
        winnerSeat: seat,
        log: [
          ...nextBase.log,
          `${playerName}率先达到 ${state.victoryTarget} 分。`,
        ],
      };
    }
  }

  const workersLeft = players.reduce((sum, player) => sum + player.workers, 0);
  if (workersLeft === 0) {
    return settle(nextBase);
  }

  // Advance to next seat that still has workers (round-robin).
  const seatCount = players.length;
  let nextSeat = (seat + 1) % seatCount;
  for (let step = 0; step < seatCount; step += 1) {
    if (players[nextSeat].workers > 0) break;
    nextSeat = (nextSeat + 1) % seatCount;
  }
  return {
    ...nextBase,
    activeSeat: nextSeat,
  };
}

export function parseWorkerPlacementActionId(actionId: string): {
  kind: "place";
  regionId: string;
} | null {
  if (!actionId.startsWith("place:")) return null;
  const regionId = actionId.slice("place:".length);
  if (!/^[a-z0-9-]{1,40}$/.test(regionId)) return null;
  return { kind: "place", regionId };
}

export function applyWorkerPlacementIntent(
  state: WorkerPlacementState,
  seat: number,
  actionId: string,
): { state: WorkerPlacementState; canonicalActionId: string; points: number } | null {
  const parsed = parseWorkerPlacementActionId(actionId);
  if (!parsed) return null;
  if (seat !== state.activeSeat) return null;
  const next = placeWorker(state, seat, parsed.regionId);
  if (!next) return null;
  const region = state.regions.find((item) => item.id === parsed.regionId);
  return {
    state: next,
    canonicalActionId: actionId,
    points: state.victoryTarget != null ? region?.resolvePoints ?? 0 : 0,
  };
}

export function pickWorkerPlacementBotActionId(
  state: WorkerPlacementState,
): string | null {
  if (state.phase !== "placement") return null;
  const seat = state.activeSeat;
  const preferred = [...state.regions].sort(
    (a, b) => b.resolvePoints - a.resolvePoints || a.capacity - b.capacity,
  );
  const target =
    preferred.find((region) => canPlaceWorker(state, seat, region.id)) ??
    state.regions.find((region) => canPlaceWorker(state, seat, region.id));
  return target ? `place:${target.id}` : null;
}

export function workerPlacementScores(state: WorkerPlacementState) {
  return state.players.map((player) => player.score);
}

export function workerPlacementInstruction(state: WorkerPlacementState) {
  if (state.phase === "placement") {
    const active = state.players.find((player) => player.seat === state.activeSeat);
    return `${active?.name ?? `座位 ${state.activeSeat}`}：选择一个仍有空位的区域放置工人。`;
  }
  if (state.winnerSeat == null) {
    return "对局结束：平分，无唯一胜者。";
  }
  const winner = state.players.find((player) => player.seat === state.winnerSeat);
  return `${winner?.name ?? "玩家"}以 ${winner?.score ?? 0} 分结束本局。`;
}

/** Harbor cargo / berth IDs — used by honesty tests so generic boards never emit them. */
export const HARBOR_FLAVOR_IDS = [
  "amber",
  "cobalt",
  "cedar",
  "port-a",
  "port-b",
  "port-c",
  "yard-a",
  "yard-b",
  "yard-c",
  "pirates",
  "pilot-small",
  "pilot-large",
  "insurance",
] as const;
