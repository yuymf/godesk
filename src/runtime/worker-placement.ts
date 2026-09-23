/** Source-parameterized worker-placement kernel (honest subset; not harbor-as-universal). */

export type WorkerPlacementRegion = {
  id: string;
  name: string;
  capacity: number;
  /** Flat cost deducted from the seat's coin pool when placing (0 = free). */
  cost: number;
  /** Points awarded to the placer at resolve (score mode only). */
  resolvePoints: number;
  tag?: string;
  /** Economy subset: wood gained immediately when placing here. */
  yieldWood?: number;
  /** Economy subset: wood spent to gain 1 building when placing here. */
  convertWoodToBuilding?: number;
};

export type WorkerPlacementPlayer = {
  seat: number;
  name: string;
  color: string;
  workers: number;
  coins: number;
  score: number;
  wood: number;
  buildings: number;
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
  /** Optional early-end score; when unset in score mode, resolve after all workers are placed. */
  victoryTarget: number | null;
  /** Economy mode: first to this many buildings wins (null = score / resolvePoints mode). */
  victoryBuildings: number | null;
  log: string[];
  winnerSeat: number | null;
};

export type WorkerPlacementConfig = {
  playerCount: number;
  workersPerSeat: number;
  startingCoins: number;
  regions: WorkerPlacementRegion[];
  victoryTarget?: number | null;
  victoryBuildings?: number | null;
};

const PLAYER_NAMES_ZH = ["甲席", "乙席", "丙席", "丁席", "戊席", "己席"];
const PLAYER_NAMES_EN = ["Seat A", "Seat B", "Seat C", "Seat D", "Seat E", "Seat F"];
const PLAYER_COLORS = ["#d6a637", "#568264", "#b84b39", "#286a8a", "#8c4d32", "#6d675b"];

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
  two: 2,
  three: 3,
  four: 4,
  five: 5,
};

function parseCorpusNumber(token: string | undefined): number {
  if (!token) return Number.NaN;
  if (RULE_NUMBER[token] != null) return RULE_NUMBER[token];
  const n = Number(token);
  return Number.isInteger(n) ? n : Number.NaN;
}

export function isHarborLikeCorpus(corpus: string): boolean {
  return /harbor voyage|港口航线|港口十三|琥珀货|钴蓝绸|雪松木|东栈桥|中栈桥|西栈桥|干坞|私掠|领航|港务保险|\bpunts?\b|harbor board|harbor table/i.test(
    corpus,
  );
}

/** True when the source claims resource conversion and/or build-N-buildings victory. */
export function isEconomyPlacementCorpus(corpus: string): boolean {
  if (isHarborLikeCorpus(corpus)) return false;
  const hasConvert =
    /(木材|wood).{0,80}(建筑|building|工坊|workshop)|(工坊|workshop).{0,48}(木材|wood|换成|换|convert|成建筑)|(资源区).{0,24}(木材|wood)/i.test(
      corpus,
    );
  const hasBuildingVictory =
    /建成\s*[0-9一二两三四五六七八九十]+\s*座|先建成|(?:first to (?:finish |build )?)(?:[0-9]+|two|three|four|five)\s*buildings?/i.test(
      corpus,
    );
  const hasPlacementCue =
    /工人|worker|放置|placement|资源区|工坊|workshop|building|建筑/i.test(corpus);
  return (hasConvert || hasBuildingVictory) && hasPlacementCue;
}

export function kernelHasPlacementEconomy(kernel: {
  victoryBuildings?: number | null;
  regions: Array<{ yieldWood?: number; convertWoodToBuilding?: number }>;
}): boolean {
  const target =
    kernel.victoryBuildings != null &&
    Number.isInteger(kernel.victoryBuildings) &&
    kernel.victoryBuildings > 0;
  const hasYield = kernel.regions.some((region) => (region.yieldWood ?? 0) > 0);
  const hasConvert = kernel.regions.some(
    (region) => (region.convertWoodToBuilding ?? 0) > 0,
  );
  return Boolean(target && hasYield && hasConvert);
}

export function deriveVictoryBuildings(corpus: string): number {
  const patterns = [
    /建成\s*([0-9一二两三四五六七八九十]+)\s*座/,
    /先建成\s*([0-9一二两三四五六七八九十]+)/,
    /first to (?:finish |build )?([0-9]+|two|three|four|five)\s*buildings?/i,
    /(?:win by building|buildings? to win).{0,12}([0-9]+|two|three|four|five)/i,
  ];
  for (const pattern of patterns) {
    const n = parseCorpusNumber(corpus.match(pattern)?.[1]);
    if (Number.isInteger(n) && n >= 1 && n <= 20) return n;
  }
  return 2;
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
  const economy = isEconomyPlacementCorpus(corpus);
  const named: string[] = [];
  const seen = new Set<string>();
  const pushName = (raw: string) => {
    const name = raw.trim().replace(/[.,;:!?。，；：！？]+$/g, "");
    if (name.length < 2 || name.length > 24) return;
    // Reject prose fragments accidentally captured after 格子/位置.
    if (/不能|别人|玩家|工人|获胜|胜利|换成|给木|占住/.test(name)) return;
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
    /(?:放到|放置到|放置于|派往|前往)\s*[「"']?([\u4e00-\u9fffA-Za-z0-9、/或与和]{2,40})[」"']?/g,
  )) {
    for (const part of match[1].split(/[、,/或与和]+/)) {
      pushName(part);
    }
  }
  for (const match of corpus.matchAll(
    /(?:regions?|spots?|spaces?|areas?|zones?)\s*[:：]\s*([A-Za-z\u4e00-\u9fff0-9、,/，\s-]{4,80})/gi,
  )) {
    for (const part of match[1].split(/[、,/，]+/)) {
      pushName(part);
    }
  }
  for (const match of corpus.matchAll(
    /((?:资源区|工坊|工房|建筑区|建筑场|公共区)(?:[、,/或与和]+(?:资源区|工坊|工房|建筑区|建筑场|公共区))*)/g,
  )) {
    for (const part of match[1].split(/[、,/或与和]+/)) {
      pushName(part);
    }
  }

  const isZh = /[\u4e00-\u9fff]/.test(corpus);
  const hasBuilding = /build(?:ing)?s?|建筑|完工|建造/i.test(corpus);
  let base: string[];
  if (named.length >= 2) {
    base = named.slice(0, 6);
  } else if (economy) {
    base = isZh
      ? ["资源区甲", "资源区乙", "工坊"]
      : ["Resource Spot A", "Resource Spot B", "Workshop"];
  } else if (isZh) {
    base = hasBuilding
      ? ["资源区甲", "资源区乙", "资源区丙", "建筑场"]
      : ["资源区甲", "资源区乙", "资源区丙", "公共区"];
  } else {
    base = hasBuilding
      ? ["Resource Spot A", "Resource Spot B", "Resource Spot C", "Building Yard"]
      : ["Resource Spot A", "Resource Spot B", "Resource Spot C", "Commons"];
  }

  // Economy honesty: always keep at least one yield and one convert region.
  if (economy) {
    const hasWorkshop = base.some((name) =>
      /workshop|工坊|工房|convert|兑换|建筑区/i.test(name),
    );
    const hasResource = base.some((name) =>
      /resource|spot|资源|forest|mine|wood|woods/i.test(name),
    );
    if (!hasWorkshop) {
      base = [...base.slice(0, 5), isZh ? "工坊" : "Workshop"];
    }
    if (!hasResource) {
      base = [isZh ? "资源区甲" : "Resource Spot A", ...base].slice(0, 6);
    }
  }

  return base.map((name, index) => {
    if (economy) {
      const workshop =
        /workshop|工坊|工房|convert|兑换/i.test(name) ||
        (/建筑区|building(?!\s*yard)/i.test(name) && !/资源|resource/i.test(name));
      if (workshop) {
        return {
          id: slugifyRegionId(name, index),
          name,
          capacity: 3,
          cost: 0,
          resolvePoints: 0,
          tag: "workshop",
          convertWoodToBuilding: 1,
        };
      }
      return {
        id: slugifyRegionId(name, index),
        name,
        capacity: 2,
        cost: 0,
        resolvePoints: 0,
        tag: "resource",
        yieldWood: 1,
      };
    }
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
    const n = parseCorpusNumber(match[1]);
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
  const victoryBuildings =
    config.victoryBuildings != null &&
    Number.isInteger(config.victoryBuildings) &&
    config.victoryBuildings > 0
      ? config.victoryBuildings
      : null;
  const victoryTarget =
    victoryBuildings == null &&
    config.victoryTarget != null &&
    Number.isInteger(config.victoryTarget) &&
    config.victoryTarget > 0
      ? config.victoryTarget
      : null;
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
      wood: 0,
      buildings: 0,
    })),
    regions,
    placements: [],
    victoryTarget,
    victoryBuildings,
    log: [
      locale === "en"
        ? victoryBuildings != null
          ? `Workers are ready. Gather wood, convert at the workshop, and build ${victoryBuildings} buildings to win.`
          : `Workers are ready. Place on named regions until every worker is committed.`
        : victoryBuildings != null
          ? `伙计已就位。在资源区取木材，在工坊换成建筑；先建成 ${victoryBuildings} 座者获胜。`
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
  if (player.coins < region.cost) return false;
  const convertCost = region.convertWoodToBuilding ?? 0;
  if (convertCost > 0 && player.wood < convertCost) return false;
  return true;
}

function settleScore(state: WorkerPlacementState): WorkerPlacementState {
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
  const tied = ranked.length > 1 && ranked[1] && ranked[1].score === top.score;
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

function settleBuildings(state: WorkerPlacementState): WorkerPlacementState {
  const players = state.players.map((player) => ({
    ...player,
    score: player.buildings,
  }));
  const ranked = [...players].sort(
    (a, b) => b.buildings - a.buildings || a.seat - b.seat,
  );
  const top = ranked[0];
  const tied =
    ranked.length > 1 && ranked[1] && ranked[1].buildings === top.buildings;
  return {
    ...state,
    phase: "resolved",
    players,
    activeSeat: tied ? state.activeSeat : top.seat,
    winnerSeat: tied ? null : top.seat,
    log: [
      ...state.log,
      tied
        ? `结算完成：建筑 ${top.buildings} 座平分，无唯一胜者。`
        : `结算完成：${top.name}建成 ${top.buildings} 座建筑领先。`,
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
  const yieldWood = Math.max(0, region.yieldWood ?? 0);
  const convertCost = Math.max(0, region.convertWoodToBuilding ?? 0);
  const economy = state.victoryBuildings != null;

  const players = state.players.map((player) => {
    if (player.seat !== seat) return player;
    let wood = player.wood + yieldWood;
    let buildings = player.buildings;
    if (convertCost > 0) {
      wood -= convertCost;
      buildings += 1;
    }
    const scoreBump =
      !economy && state.victoryTarget != null ? region.resolvePoints : 0;
    return {
      ...player,
      workers: player.workers - 1,
      coins: player.coins - region.cost,
      wood,
      buildings,
      score: economy ? buildings : player.score + scoreBump,
    };
  });

  const playerName = state.players.find((player) => player.seat === seat)!.name;
  const placer = players.find((player) => player.seat === seat)!;
  const log = [...state.log];
  log.push(
    region.cost > 0
      ? `${playerName}花费 ${region.cost}，派工人前往${region.name}。`
      : `${playerName}派工人前往${region.name}。`,
  );
  if (yieldWood > 0 && convertCost === 0) {
    log.push(`${playerName}获得木材 ${yieldWood}（现有 ${placer.wood}）。`);
  }
  if (convertCost > 0) {
    log.push(
      `${playerName}花费木材 ${convertCost}，建成 1 座建筑（现有 ${placer.buildings}）。`,
    );
  }

  const nextBase: WorkerPlacementState = {
    ...state,
    players,
    placements: [...state.placements, placement],
    log,
  };

  if (economy && placer.buildings >= state.victoryBuildings!) {
    return {
      ...nextBase,
      phase: "resolved",
      activeSeat: seat,
      winnerSeat: seat,
      log: [
        ...nextBase.log,
        `${playerName}率先建成 ${state.victoryBuildings} 座建筑。`,
      ],
    };
  }

  if (!economy && state.victoryTarget != null) {
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
    return economy ? settleBuildings(nextBase) : settleScore(nextBase);
  }

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
  const before = state.players.find((player) => player.seat === seat);
  const next = placeWorker(state, seat, parsed.regionId);
  if (!next) return null;
  const after = next.players.find((player) => player.seat === seat);
  const region = state.regions.find((item) => item.id === parsed.regionId);
  const points =
    state.victoryBuildings != null
      ? Math.max(0, (after?.buildings ?? 0) - (before?.buildings ?? 0))
      : state.victoryTarget != null
        ? region?.resolvePoints ?? 0
        : 0;
  return {
    state: next,
    canonicalActionId: actionId,
    points,
  };
}

export function pickWorkerPlacementBotActionId(
  state: WorkerPlacementState,
): string | null {
  if (state.phase !== "placement") return null;
  const seat = state.activeSeat;
  if (state.victoryBuildings != null) {
    const convert = state.regions.find(
      (region) =>
        (region.convertWoodToBuilding ?? 0) > 0 &&
        canPlaceWorker(state, seat, region.id),
    );
    if (convert) return `place:${convert.id}`;
    const yieldSpot = state.regions.find(
      (region) =>
        (region.yieldWood ?? 0) > 0 && canPlaceWorker(state, seat, region.id),
    );
    if (yieldSpot) return `place:${yieldSpot.id}`;
  }
  const preferred = [...state.regions].sort(
    (a, b) => b.resolvePoints - a.resolvePoints || a.capacity - b.capacity,
  );
  const target =
    preferred.find((region) => canPlaceWorker(state, seat, region.id)) ??
    state.regions.find((region) => canPlaceWorker(state, seat, region.id));
  return target ? `place:${target.id}` : null;
}

export function workerPlacementScores(state: WorkerPlacementState) {
  if (state.victoryBuildings != null) {
    return state.players.map((player) => player.buildings);
  }
  return state.players.map((player) => player.score);
}

export function workerPlacementInstruction(state: WorkerPlacementState) {
  if (state.phase === "placement") {
    const active = state.players.find((player) => player.seat === state.activeSeat);
    if (state.victoryBuildings != null) {
      return `${active?.name ?? `座位 ${state.activeSeat}`}：放置工人取木材，或在工坊用木材换成建筑（先建成 ${state.victoryBuildings} 座获胜）。`;
    }
    return `${active?.name ?? `座位 ${state.activeSeat}`}：选择一个仍有空位的区域放置工人。`;
  }
  if (state.winnerSeat == null) {
    return "对局结束：平分，无唯一胜者。";
  }
  const winner = state.players.find((player) => player.seat === state.winnerSeat);
  if (state.victoryBuildings != null) {
    return `${winner?.name ?? "玩家"}建成 ${winner?.buildings ?? 0} 座建筑，结束本局。`;
  }
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
