import {
  catanAdapter,
  catanBoardGraph,
  createCatanKernelConfig,
  parseCatanConfig,
  publicVictoryPoints,
  type CatanGenre,
  type CatanPlayer,
  type CatanPort,
  type CatanTile,
  type DevCardKind,
  type Resource,
  type ResourceBank,
  type Terrain,
} from "../runtime/adapters/catan";
import type { LegalAction, PlayState } from "../runtime/play-kernel";
import { CATAN_TERRAIN_FILL } from "./catan-thumbnail";
import type { RoomLocale } from "./room-presentation";

export type CatanBoardState = {
  phase: string;
  playerCount: number;
  victoryPointsToWin: number;
  tiles: CatanTile[];
  robberHex: string;
  ports: CatanPort[];
  players: CatanPlayer[];
  setupStep: number;
  pendingRoadVertex: string | null;
  lastDice: [number, number] | null;
  discardQueue: number[];
  discardRemaining: number;
  devDeck: DevCardKind[];
  longestRoadOwner: number | null;
  largestArmyOwner: number | null;
  freeRoadsRemaining: number;
  lastAction: string | null;
  turnPlayer: number;
};

const SEAT_COLORS = ["#c0392b", "#2980b9", "#27ae60", "#f39c12"] as const;

const RESOURCE_LABEL = {
  zh: {
    wood: "木",
    brick: "砖",
    sheep: "羊",
    wheat: "麦",
    ore: "矿",
  },
  en: {
    wood: "Wood",
    brick: "Brick",
    sheep: "Sheep",
    wheat: "Wheat",
    ore: "Ore",
  },
} as const;

const COPY = {
  zh: {
    board: "卡坦六角岛",
    hud: "对局状态",
    active: "当前行动",
    seat: "座位",
    phase: "阶段",
    dice: "骰子",
    noDice: "尚未掷骰",
    resources: "你的资源",
    vp: "胜利点",
    robber: "强盗",
    longestRoad: "最长道路",
    largestArmy: "最大军队",
    none: "无",
    lastAction: "最近行动",
    noLast: "尚无行动",
    gameOver: "对局结束",
    winner: "获胜者",
    yourTurn: "轮到你行动",
    waiting: "等待对方",
    roll: "掷骰",
    endTurn: "结束回合",
    buyDev: "购买发展卡",
    playKnight: "打出骑士",
    playRoadBuilding: "打出道路建设",
    discard: "弃牌",
    bankTrade: "银行贸易",
    playerTrade: "玩家贸易",
    placeSettlement: "放置定居点",
    placeCity: "升级城市",
    placeRoad: "放置道路",
    moveRobber: "移动强盗",
    legalTile: "可放置强盗的地块",
    tile: "地块",
    actions: "可用行动",
  },
  en: {
    board: "Catan hex island",
    hud: "Match status",
    active: "Active seat",
    seat: "Seat",
    phase: "Phase",
    dice: "Dice",
    noDice: "No roll yet",
    resources: "Your resources",
    vp: "VP",
    robber: "Robber",
    longestRoad: "Longest road",
    largestArmy: "Largest army",
    none: "None",
    lastAction: "Last action",
    noLast: "No moves yet",
    gameOver: "Game over",
    winner: "Winner",
    yourTurn: "Your turn",
    waiting: "Waiting",
    roll: "Roll dice",
    endTurn: "End turn",
    buyDev: "Buy development card",
    playKnight: "Play knight",
    playRoadBuilding: "Play road building",
    discard: "Discard",
    bankTrade: "Bank trade",
    playerTrade: "Player trade",
    placeSettlement: "Place settlement",
    placeCity: "Upgrade city",
    placeRoad: "Place road",
    moveRobber: "Move robber",
    legalTile: "Legal robber tile",
    tile: "Tile",
    actions: "Available actions",
  },
} as const;

const EMPTY_BANK = (): ResourceBank => ({
  wood: 0,
  brick: 0,
  sheep: 0,
  wheat: 0,
  ore: 0,
});

function toGenre(catan: CatanBoardState): CatanGenre {
  return {
    playerCount: catan.playerCount,
    victoryPointsToWin: catan.victoryPointsToWin,
    tiles: catan.tiles.map((tile) => ({ ...tile })),
    robberHex: catan.robberHex,
    ports: catan.ports.map((port) => ({
      ...port,
      vertices: [...port.vertices],
    })),
    players: catan.players.map((player) => ({
      resources: { ...EMPTY_BANK(), ...player.resources },
      settlements: [...player.settlements],
      cities: [...player.cities],
      roads: [...player.roads],
      devCards: [...player.devCards] as DevCardKind[],
      knightsPlayed: player.knightsPlayed,
      vpCards: player.vpCards,
      newDevCards: [...player.newDevCards] as DevCardKind[],
    })),
    setupStep: catan.setupStep,
    pendingRoadVertex: catan.pendingRoadVertex,
    lastDice: catan.lastDice ? ([...catan.lastDice] as [number, number]) : null,
    discardQueue: [...catan.discardQueue],
    discardRemaining: catan.discardRemaining,
    devDeck: [...catan.devDeck] as DevCardKind[],
    longestRoadOwner: catan.longestRoadOwner,
    largestArmyOwner: catan.largestArmyOwner,
    freeRoadsRemaining: catan.freeRoadsRemaining,
    lastAction: catan.lastAction,
    turnPlayer: catan.turnPlayer,
  };
}

/** Rebuild a minimal PlayState so client-side listLegalActions matches the adapter. */
function playStateFromCatanSession(
  catan: CatanBoardState,
  activeSeat: number,
  status: "active" | "complete",
  winnerSeat: number | null = null,
): PlayState<CatanGenre> {
  return {
    seed: 0,
    sequence: 0,
    phase: status === "complete" ? "ended" : catan.phase,
    activePlayerId: activeSeat,
    playerCount: catan.playerCount,
    status,
    winnerId: winnerSeat,
    events: [],
    genre: toGenre(catan),
  };
}

export function listCatanLegalActionsForSession(input: {
  catan: CatanBoardState;
  activeSeat: number;
  status: "active" | "complete";
  playerId: number;
}) {
  const config = createCatanKernelConfig({
    playerCount: input.catan.playerCount,
    victoryPointsToWin: input.catan.victoryPointsToWin,
  });
  const parsed = parseCatanConfig(config.adapter);
  if (!parsed) return [];
  const state = playStateFromCatanSession(
    input.catan,
    input.activeSeat,
    input.status,
  );
  return catanAdapter.listLegalActions(state, input.playerId, parsed);
}

function parseVertex(id: string): { x: number; y: number } | null {
  const [xs, ys] = id.split(":");
  const x = Number(xs);
  const y = Number(ys);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function hexCenter(q: number, r: number, size = 100): { x: number; y: number } {
  return {
    x: size * (1.5 * q),
    y: size * ((Math.sqrt(3) / 2) * q + Math.sqrt(3) * r),
  };
}

function edgeMidpoint(edgeId: string): { x: number; y: number } | null {
  const [a, b] = edgeId.split("|");
  const pa = parseVertex(a);
  const pb = parseVertex(b);
  if (!pa || !pb) return null;
  return { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
}

function ownerOfVertex(
  players: CatanPlayer[],
  vertexId: string,
): { seat: number; kind: "settlement" | "city" } | null {
  for (let seat = 0; seat < players.length; seat += 1) {
    if (players[seat].cities.includes(vertexId)) {
      return { seat, kind: "city" };
    }
    if (players[seat].settlements.includes(vertexId)) {
      return { seat, kind: "settlement" };
    }
  }
  return null;
}

function ownerOfRoad(players: CatanPlayer[], edgeId: string): number | null {
  for (let seat = 0; seat < players.length; seat += 1) {
    if (players[seat].roads.includes(edgeId)) return seat;
  }
  return null;
}

function actionKey(action: LegalAction): string {
  return `${action.type}:${JSON.stringify(action.payload ?? null)}`;
}

function phaseLabel(phase: string, locale: RoomLocale): string {
  const map: Record<string, { zh: string; en: string }> = {
    setup: { zh: "初始放置", en: "Setup" },
    roll: { zh: "掷骰", en: "Roll" },
    discard: { zh: "弃牌", en: "Discard" },
    robber: { zh: "移动强盗", en: "Robber" },
    main: { zh: "建造/贸易", en: "Build / trade" },
    ended: { zh: "结束", en: "Ended" },
  };
  return map[phase]?.[locale] ?? phase;
}

export function CatanBoard({
  catan,
  activeSeat,
  viewerSeat,
  status,
  enabled,
  readOnly = false,
  locale = "zh",
  winnerSeat = null,
  busy = false,
  onAct,
}: {
  catan: CatanBoardState;
  activeSeat: number;
  viewerSeat: number | null;
  status: "active" | "complete";
  enabled: boolean;
  readOnly?: boolean;
  locale?: RoomLocale;
  winnerSeat?: number | null;
  busy?: boolean;
  onAct?: (actionId: string, payload?: Record<string, unknown>) => void;
}) {
  const copy = COPY[locale];
  const resourceLabel = RESOURCE_LABEL[locale];
  const interactive =
    !readOnly && enabled && status === "active" && Boolean(onAct) && !busy;
  const legalPlayer =
    interactive && viewerSeat !== null ? viewerSeat : activeSeat;
  const legalActions =
    status === "active"
      ? listCatanLegalActionsForSession({
          catan,
          activeSeat,
          status,
          playerId: legalPlayer,
        })
      : [];
  const showLegal =
    interactive && viewerSeat !== null && viewerSeat === activeSeat;

  const legalSettlements = new Set(
    legalActions
      .filter((action) => action.type === "place_settlement")
      .map((action) => String(action.payload?.vertexId ?? "")),
  );
  const legalCities = new Set(
    legalActions
      .filter((action) => action.type === "place_city")
      .map((action) => String(action.payload?.vertexId ?? "")),
  );
  const legalRoads = new Map(
    legalActions
      .filter((action) => action.type === "place_road")
      .map((action) => [
        String(action.payload?.edgeId ?? ""),
        action.payload ?? {},
      ]),
  );
  const legalRobberHexes = new Set(
    legalActions
      .filter((action) => action.type === "move_robber")
      .map((action) => String(action.payload?.hex ?? "")),
  );

  const hudActions = showLegal
    ? legalActions.filter(
        (action) =>
          action.type === "roll_dice" ||
          action.type === "end_turn" ||
          action.type === "buy_dev" ||
          action.type === "play_knight" ||
          action.type === "play_road_building" ||
          action.type === "discard" ||
          action.type === "bank_trade" ||
          action.type === "player_trade",
      )
    : [];

  const graph = catanBoardGraph();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const id of graph.vertexIds) {
    const point = parseVertex(id);
    if (!point) continue;
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  const pad = 48;
  const vbX = minX - pad;
  const vbY = minY - pad;
  const vbW = maxX - minX + pad * 2;
  const vbH = maxY - minY + pad * 2;

  const toPct = (x: number, y: number) => ({
    left: `${((x - vbX) / vbW) * 100}%`,
    top: `${((y - vbY) / vbH) * 100}%`,
  });

  const vpScores = catan.players.map((_, seat) =>
    publicVictoryPoints(toGenre(catan), seat),
  );

  const viewerResources =
    viewerSeat !== null && catan.players[viewerSeat]
      ? catan.players[viewerSeat].resources
      : null;

  const statusLine =
    status === "complete"
      ? `${copy.gameOver} · ${copy.winner} ${copy.seat} ${winnerSeat}`
      : viewerSeat !== null && viewerSeat === activeSeat
        ? copy.yourTurn
        : `${copy.waiting} · ${copy.seat} ${activeSeat}`;

  const diceLine = catan.lastDice
    ? `${copy.dice} ${catan.lastDice[0]}+${catan.lastDice[1]}=${catan.lastDice[0] + catan.lastDice[1]}`
    : copy.noDice;

  const labelForHudAction = (action: LegalAction): string => {
    switch (action.type) {
      case "roll_dice":
        return copy.roll;
      case "end_turn":
        return copy.endTurn;
      case "buy_dev":
        return copy.buyDev;
      case "play_knight":
        return copy.playKnight;
      case "play_road_building":
        return copy.playRoadBuilding;
      case "discard": {
        const resource = String(action.payload?.resource ?? "") as Resource;
        return `${copy.discard} ${resourceLabel[resource] ?? resource}`;
      }
      case "bank_trade": {
        const give = String(action.payload?.give ?? "") as Resource;
        const take = String(action.payload?.take ?? "") as Resource;
        const ratio = Number(action.payload?.ratio ?? 4);
        return `${copy.bankTrade} ${ratio}${resourceLabel[give] ?? give}→${resourceLabel[take] ?? take}`;
      }
      case "player_trade": {
        const give = String(action.payload?.give ?? "") as Resource;
        const take = String(action.payload?.take ?? "") as Resource;
        const withSeat = action.payload?.withSeat;
        return `${copy.playerTrade} 1${resourceLabel[give] ?? give}↔P${withSeat} ${resourceLabel[take] ?? take}`;
      }
      default:
        return action.label;
    }
  };

  return (
    <div
      aria-label={copy.board}
      className="catan-board"
      data-status={status}
      role="region"
    >
      <section aria-label={copy.hud} className="catan-hud">
        <div className="catan-hud-status">
          <span className="catan-kicker">{copy.active}</span>
          <strong>
            {copy.seat} {activeSeat} · {copy.phase} {phaseLabel(catan.phase, locale)}
          </strong>
          <p>{statusLine}</p>
          <p className="catan-hud-dice">{diceLine}</p>
        </div>
        <div className="catan-hud-scores" aria-label={copy.vp}>
          {vpScores.map((vp, seat) => (
            <div
              className={`catan-score${seat === activeSeat ? " is-active" : ""}`}
              key={`vp-${seat}`}
            >
              <span
                aria-hidden="true"
                className="catan-seat-swatch"
                style={{ background: SEAT_COLORS[seat % SEAT_COLORS.length] }}
              />
              <b>
                {copy.seat} {seat} · {vp} {copy.vp}
              </b>
            </div>
          ))}
        </div>
        {viewerResources && (
          <div aria-label={copy.resources} className="catan-hud-resources">
            <span className="catan-kicker">{copy.resources}</span>
            <ul>
              {(Object.keys(resourceLabel) as Resource[]).map((resource) => (
                <li key={resource}>
                  <span>{resourceLabel[resource]}</span>
                  <b>{viewerResources[resource] ?? 0}</b>
                </li>
              ))}
            </ul>
          </div>
        )}
        <dl className="catan-hud-awards">
          <div>
            <dt>{copy.robber}</dt>
            <dd>{catan.robberHex}</dd>
          </div>
          <div>
            <dt>{copy.longestRoad}</dt>
            <dd>
              {catan.longestRoadOwner === null
                ? copy.none
                : `${copy.seat} ${catan.longestRoadOwner}`}
            </dd>
          </div>
          <div>
            <dt>{copy.largestArmy}</dt>
            <dd>
              {catan.largestArmyOwner === null
                ? copy.none
                : `${copy.seat} ${catan.largestArmyOwner}`}
            </dd>
          </div>
          <div>
            <dt>{copy.lastAction}</dt>
            <dd>{catan.lastAction ?? copy.noLast}</dd>
          </div>
        </dl>
      </section>

      <div className="catan-stage catan-stage-frame">
        <svg
          aria-label={copy.board}
          className="catan-svg"
          role="img"
          viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        >
          <rect
            fill="#2f6f7e"
            height={vbH}
            rx={36}
            width={vbW}
            x={vbX}
            y={vbY}
          />
          {catan.tiles.map((tile) => {
            const key = `${tile.q},${tile.r}`;
            const verts = graph.hexVertices[key] ?? [];
            const points = verts
              .map((id) => {
                const point = parseVertex(id);
                return point ? `${point.x},${point.y}` : "";
              })
              .filter(Boolean)
              .join(" ");
            const center = hexCenter(tile.q, tile.r);
            const isRobber = key === catan.robberHex;
            const legal = showLegal && legalRobberHexes.has(key);
            return (
              <g key={key}>
                <polygon
                  className={legal ? "catan-hex is-legal" : "catan-hex"}
                  fill={CATAN_TERRAIN_FILL[tile.terrain as Terrain] ?? "#888"}
                  points={points}
                  stroke="#1f4f5c"
                  strokeWidth={6}
                />
                {tile.number !== null && (
                  <g>
                    <circle
                      cx={center.x}
                      cy={center.y}
                      fill="#f5f0e4"
                      r={22}
                      stroke="#333"
                      strokeWidth={3}
                    />
                    <text
                      fill={
                        tile.number === 6 || tile.number === 8 ? "#b33" : "#222"
                      }
                      fontFamily="system-ui,sans-serif"
                      fontSize={28}
                      fontWeight={700}
                      textAnchor="middle"
                      x={center.x}
                      y={center.y + 10}
                    >
                      {tile.number}
                    </text>
                  </g>
                )}
                {isRobber && (
                  <circle
                    cx={center.x}
                    cy={center.y + (tile.number !== null ? 36 : 0)}
                    fill="#111"
                    r={16}
                    stroke="#eee"
                    strokeWidth={3}
                  />
                )}
              </g>
            );
          })}
          {graph.edgeIds.map((edgeId) => {
            const ends = graph.edgeVertices[edgeId];
            if (!ends) return null;
            const a = parseVertex(ends[0]);
            const b = parseVertex(ends[1]);
            if (!a || !b) return null;
            const owner = ownerOfRoad(catan.players, edgeId);
            if (owner === null) return null;
            return (
              <line
                key={`road-${edgeId}`}
                stroke={SEAT_COLORS[owner % SEAT_COLORS.length]}
                strokeLinecap="round"
                strokeWidth={14}
                x1={a.x}
                x2={b.x}
                y1={a.y}
                y2={b.y}
              />
            );
          })}
          {graph.vertexIds.map((vertexId) => {
            const owner = ownerOfVertex(catan.players, vertexId);
            if (!owner) return null;
            const point = parseVertex(vertexId);
            if (!point) return null;
            const color = SEAT_COLORS[owner.seat % SEAT_COLORS.length];
            if (owner.kind === "city") {
              return (
                <rect
                  fill={color}
                  height={36}
                  key={`city-${vertexId}`}
                  rx={4}
                  stroke="#111"
                  strokeWidth={3}
                  width={36}
                  x={point.x - 18}
                  y={point.y - 18}
                />
              );
            }
            return (
              <circle
                cx={point.x}
                cy={point.y}
                fill={color}
                key={`settle-${vertexId}`}
                r={16}
                stroke="#111"
                strokeWidth={3}
              />
            );
          })}
        </svg>

        {showLegal &&
          [...legalRobberHexes].map((hex) => {
            const [qs, rs] = hex.split(",");
            const center = hexCenter(Number(qs), Number(rs));
            const style = toPct(center.x, center.y);
            return (
              <button
                aria-label={`${copy.moveRobber} · ${hex}`}
                className="catan-hit catan-hit-hex is-legal"
                disabled={busy}
                key={`robber-${hex}`}
                onClick={() => onAct?.("move_robber", { hex })}
                style={style}
                type="button"
              />
            );
          })}

        {showLegal &&
          [...legalRoads.entries()].map(([edgeId, payload]) => {
            const mid = edgeMidpoint(edgeId);
            if (!mid) return null;
            const style = toPct(mid.x, mid.y);
            return (
              <button
                aria-label={`${copy.placeRoad} · ${edgeId}`}
                className="catan-hit catan-hit-edge is-legal"
                disabled={busy}
                key={`road-hit-${edgeId}`}
                onClick={() =>
                  onAct?.("place_road", payload as Record<string, unknown>)
                }
                style={style}
                type="button"
              />
            );
          })}

        {graph.vertexIds.map((vertexId) => {
          const settleLegal = showLegal && legalSettlements.has(vertexId);
          const cityLegal = showLegal && legalCities.has(vertexId);
          if (!settleLegal && !cityLegal) return null;
          const point = parseVertex(vertexId);
          if (!point) return null;
          const style = toPct(point.x, point.y);
          if (cityLegal) {
            return (
              <button
                aria-label={`${copy.placeCity} · ${vertexId}`}
                className="catan-hit catan-hit-vertex is-legal is-city"
                disabled={busy}
                key={`city-hit-${vertexId}`}
                onClick={() => onAct?.("place_city", { vertexId })}
                style={style}
                type="button"
              />
            );
          }
          return (
            <button
              aria-label={`${copy.placeSettlement} · ${vertexId}`}
              className="catan-hit catan-hit-vertex is-legal"
              disabled={busy}
              key={`settle-hit-${vertexId}`}
              onClick={() => onAct?.("place_settlement", { vertexId })}
              style={style}
              type="button"
            />
          );
        })}
      </div>

      {hudActions.length > 0 && (
        <div aria-label={copy.actions} className="catan-action-row">
          {hudActions.map((action) => (
            <button
              aria-label={labelForHudAction(action)}
              className="catan-action"
              disabled={busy}
              key={actionKey(action)}
              onClick={() =>
                onAct?.(
                  action.type,
                  action.payload
                    ? ({ ...action.payload } as Record<string, unknown>)
                    : undefined,
                )
              }
              type="button"
            >
              {labelForHudAction(action)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
