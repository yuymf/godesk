import {
  createNetworkRouteKernelConfig,
  networkRouteAdapter,
  parseNetworkRouteConfig,
  playerConnectsTerminals,
  type NetworkRouteGenre,
} from "../runtime/adapters/network-route";
import type { PlayState } from "../runtime/play-kernel";
import type { RoomLocale } from "./room-presentation";

export type NetworkRouteBoardState = {
  cities: Array<{ id: string; name: string; x: number; y: number }>;
  edges: Array<{ id: string; from: string; to: string }>;
  claims: Record<string, number | null>;
  terminalFrom: string;
  terminalTo: string;
  lastClaim: { edgeId: string; playerId: number } | null;
  routeCounts: [number, number];
};

const COPY = {
  zh: {
    board: "线路网络盘",
    hud: "对局状态",
    active: "当前行动",
    seat: "座位",
    routes: "已铺路线",
    lastClaim: "最近占领",
    noLast: "尚无行动",
    gameOver: "对局结束",
    winner: "获胜者",
    tied: "平局",
    yourTurn: "轮到你铺线",
    waiting: "等待对方",
    claim: "可占领",
    terminals: "枢纽",
    goal: "连通进度",
    linked: "已连通",
    unlinked: "未连通",
    connectHint: "先连通南北枢纽获胜",
  },
  en: {
    board: "Route network board",
    hud: "Match status",
    active: "Active seat",
    seat: "Seat",
    routes: "Routes claimed",
    lastClaim: "Last claim",
    noLast: "No moves yet",
    gameOver: "Game over",
    winner: "Winner",
    tied: "Tie",
    yourTurn: "Your turn to claim",
    waiting: "Waiting for opponent",
    claim: "Legal claim",
    terminals: "Hubs",
    goal: "Link progress",
    linked: "linked",
    unlinked: "open",
    connectHint: "Connect the terminal hubs to win",
  },
} as const;

const SEAT_COLOR = ["#2563eb", "#ea580c"] as const;

function toGenre(board: NetworkRouteBoardState): NetworkRouteGenre {
  return {
    cities: board.cities.map((city) => ({ ...city })),
    edges: board.edges.map((edge) => ({ ...edge })),
    claims: { ...board.claims },
    terminalFrom: board.terminalFrom,
    terminalTo: board.terminalTo,
    lastClaim: board.lastClaim ? { ...board.lastClaim } : null,
    routeCounts: [...board.routeCounts] as [number, number],
  };
}

export function playStateFromNetworkRouteSession(
  board: NetworkRouteBoardState,
  activeSeat: number,
  status: "active" | "complete",
  winnerSeat: number | null = null,
): PlayState<NetworkRouteGenre> {
  return {
    seed: 0,
    sequence: 0,
    phase: status === "complete" ? "ended" : "play",
    activePlayerId: activeSeat,
    playerCount: 2,
    status,
    winnerId: winnerSeat,
    events: [],
    genre: toGenre(board),
  };
}

export function listNetworkRouteLegalActionsForSession(input: {
  networkRoute: NetworkRouteBoardState;
  activeSeat: number;
  status: "active" | "complete";
  playerId: number;
}) {
  const config = createNetworkRouteKernelConfig();
  const parsed = parseNetworkRouteConfig(config.adapter);
  if (!parsed) return [];
  const state = playStateFromNetworkRouteSession(
    input.networkRoute,
    input.activeSeat,
    input.status,
  );
  return networkRouteAdapter.listLegalActions(state, input.playerId, parsed);
}

function cityById(
  cities: NetworkRouteBoardState["cities"],
  id: string,
) {
  return cities.find((city) => city.id === id);
}

export function NetworkRouteBoard({
  networkRoute,
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
  networkRoute: NetworkRouteBoardState;
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
  const interactive =
    !readOnly && enabled && status === "active" && Boolean(onAct) && !busy;
  const legalPlayer =
    interactive && viewerSeat !== null ? viewerSeat : activeSeat;
  const legalActions =
    status === "active"
      ? listNetworkRouteLegalActionsForSession({
          networkRoute,
          activeSeat,
          status,
          playerId: legalPlayer,
        })
      : [];
  const legalEdges = new Set(
    legalActions
      .filter((action) => action.type === "claim")
      .map((action) => String(action.payload?.edgeId ?? ""))
      .filter(Boolean),
  );
  const showLegal =
    interactive && viewerSeat !== null && viewerSeat === activeSeat;

  const [count0, count1] = networkRoute.routeCounts;
  const lastLine = networkRoute.lastClaim
    ? `${copy.lastClaim} · ${networkRoute.lastClaim.edgeId} · ${copy.seat} ${networkRoute.lastClaim.playerId}`
    : copy.noLast;
  const statusLine =
    status === "complete"
      ? winnerSeat === null
        ? `${copy.gameOver} · ${copy.tied}`
        : `${copy.gameOver} · ${copy.winner} ${copy.seat} ${winnerSeat}`
      : viewerSeat !== null && viewerSeat === activeSeat
        ? copy.yourTurn
        : `${copy.waiting} · ${copy.seat} ${activeSeat}`;

  const linked0 = playerConnectsTerminals(
    networkRoute.claims,
    networkRoute.edges,
    0,
    networkRoute.terminalFrom,
    networkRoute.terminalTo,
  );
  const linked1 = playerConnectsTerminals(
    networkRoute.claims,
    networkRoute.edges,
    1,
    networkRoute.terminalFrom,
    networkRoute.terminalTo,
  );
  const fromHub = cityById(networkRoute.cities, networkRoute.terminalFrom);
  const toHub = cityById(networkRoute.cities, networkRoute.terminalTo);
  const terminalsLine = `${copy.terminals}: ${networkRoute.terminalFrom}${
    fromHub ? ` ${fromHub.name}` : ""
  } ↔ ${networkRoute.terminalTo}${toHub ? ` ${toHub.name}` : ""}`;
  const goalLine = `${copy.goal} · ${copy.seat} 0 ${
    linked0 ? copy.linked : copy.unlinked
  } · ${copy.seat} 1 ${linked1 ? copy.linked : copy.unlinked}`;

  const width = 400;
  const height = 360;

  return (
    <div
      aria-label={copy.board}
      className="network-route-board"
      data-status={status}
      role="region"
    >
      <section aria-label={copy.hud} className="network-route-hud">
        <div className="network-route-hud-status">
          <span className="network-route-kicker">{copy.active}</span>
          <strong>
            {copy.seat} {activeSeat}
          </strong>
          <p>{statusLine}</p>
          <p className="network-route-hint">{copy.connectHint}</p>
        </div>
        <div className="network-route-hud-scores" aria-label={copy.routes}>
          <div className="network-route-score">
            <span
              aria-hidden="true"
              className="network-route-swatch"
              style={{ background: SEAT_COLOR[0] }}
            />
            <b>
              {copy.seat} 0 · {count0}
            </b>
          </div>
          <div className="network-route-score">
            <span
              aria-hidden="true"
              className="network-route-swatch"
              style={{ background: SEAT_COLOR[1] }}
            />
            <b>
              {copy.seat} 1 · {count1}
            </b>
          </div>
        </div>
        <p className="network-route-hud-last">{lastLine}</p>
        <p aria-label={copy.terminals} className="network-route-terminals">
          {terminalsLine}
        </p>
        <p aria-label={copy.goal} className="network-route-goal">
          {goalLine}
        </p>
      </section>

      <svg
        aria-label={copy.board}
        className="network-route-svg"
        height={height}
        role="img"
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
      >
        {networkRoute.edges.map((edge) => {
          const from = cityById(networkRoute.cities, edge.from);
          const to = cityById(networkRoute.cities, edge.to);
          if (!from || !to) return null;
          const owner = networkRoute.claims[edge.id];
          const legal = showLegal && legalEdges.has(edge.id);
          const isLast = networkRoute.lastClaim?.edgeId === edge.id;
          const stroke =
            owner === 0 || owner === 1
              ? SEAT_COLOR[owner]
              : legal
                ? "#16a34a"
                : "#94a3b8";
          const clickable = legal && interactive;
          return (
            <g key={edge.id}>
              <line
                stroke={stroke}
                strokeLinecap="round"
                strokeWidth={owner !== null ? 8 : legal ? 6 : 4}
                x1={from.x}
                x2={to.x}
                y1={from.y}
                y2={to.y}
                opacity={owner === null && !legal ? 0.55 : 1}
              />
              {isLast && (
                <line
                  stroke="#fbbf24"
                  strokeDasharray="4 4"
                  strokeLinecap="round"
                  strokeWidth={2}
                  x1={from.x}
                  x2={to.x}
                  y1={from.y}
                  y2={to.y}
                />
              )}
              {clickable && (
                <line
                  aria-label={`${copy.claim} ${edge.from}-${edge.to}`}
                  className="network-route-hit"
                  onClick={() => onAct?.("claim", { edgeId: edge.id })}
                  role="button"
                  stroke="transparent"
                  strokeWidth={18}
                  style={{ cursor: "pointer" }}
                  tabIndex={0}
                  x1={from.x}
                  x2={to.x}
                  y1={from.y}
                  y2={to.y}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onAct?.("claim", { edgeId: edge.id });
                    }
                  }}
                />
              )}
            </g>
          );
        })}
        {networkRoute.cities.map((city) => {
          const terminal =
            city.id === networkRoute.terminalFrom ||
            city.id === networkRoute.terminalTo;
          return (
            <g key={city.id}>
              <circle
                cx={city.x}
                cy={city.y}
                fill={terminal ? "#0f172a" : "#1e293b"}
                r={terminal ? 16 : 12}
                stroke={terminal ? "#fbbf24" : "#cbd5e1"}
                strokeWidth={terminal ? 3 : 2}
              />
              <text
                fill="#f8fafc"
                fontSize={11}
                fontWeight={700}
                textAnchor="middle"
                x={city.x}
                y={city.y + 4}
              >
                {city.id}
              </text>
              <text
                fill="#334155"
                fontSize={10}
                textAnchor="middle"
                x={city.x}
                y={city.y + 28}
              >
                {city.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
