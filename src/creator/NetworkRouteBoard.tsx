import {
  createNetworkRouteKernelConfig,
  networkRouteAdapter,
  parseNetworkRouteConfig,
  playerConnectsTerminals,
  type NetworkRouteGenre,
} from "../runtime/adapters/network-route";
import type { PlayState } from "../runtime/play-kernel";
import type { RoomLocale } from "./room-presentation";
import type { RenderSpec } from "./render-spec";
import { TabletopStage } from "./TabletopStage";
import { lazy, Suspense } from "react";

/** step3：RenderSpec.chrome = "wood" 时的木框全屏外壳（懒加载，含 tidewell-game-screen.css）。 */
import { actionCardArt, seatPortrait } from "./tabletop-hud-art";
const LazyTabletopGameScreen = lazy(() => import("./TabletopGameScreen"));

export type NetworkRouteBoardState = {
  cities: Array<{ id: string; name: string; x: number; y: number }>;
  edges: Array<{ id: string; from: string; to: string }>;
  claims: Record<string, number | null>;
  terminalFrom: string;
  terminalTo: string;
  lastClaim: { edgeId: string; playerId: number } | null;
  routeCounts: [number, number];
  freight?: NetworkRouteGenre["freight"];
  tickets?: NetworkRouteGenre["tickets"];
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
    funds: "资金",
    reputation: "信誉",
    market: "货运市场",
    hand: "我的合约",
    ships: "船队",
    accept: "接合约",
    freightHint: "接合约 → 铺线连通起终点 → 交付赚信誉；先到目标信誉获胜",
    ticketsHint: "抽车厢牌 / 认领彩色路线 / 抽车票；按长度表计分，车票通加分未通扣分",
    tickets: "车票",
    trains: "车厢牌",
    trainsLeft: "剩余车厢",
    routePts: "路线分",
    drawTrains: "抽车厢",
    drawTickets: "抽车票",
    winRep: "目标信誉",
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
    funds: "Funds",
    reputation: "Reputation",
    market: "Cargo market",
    hand: "My contracts",
    ships: "Fleet",
    accept: "Accept",
    freightHint: "Accept a contract, claim a path, deliver for reputation",
    ticketsHint: "Draw trains / claim colored routes / draw tickets; length table + ticket ±",
    tickets: "Tickets",
    trains: "Train cards",
    trainsLeft: "Trains left",
    routePts: "Route pts",
    drawTrains: "Draw trains",
    drawTickets: "Draw tickets",
    winRep: "Rep to win",
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
    freight: board.freight ?? null,
    tickets: board.tickets ?? null,
  };
}

function playStateFromNetworkRouteSession(
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
  render,
  title,
  aiSeats = [],
  onClaimSeat,
  replayUrl,
  homeHref = "/games",
  importedModels,
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
  /** G3D-14：build.ruleSystem.presentation.render（缺省用平台默认）。 */
  render?: RenderSpec;
  /** step3（wood chrome）：标题、AI 席位、入座、回放与首页链接。 */
  title?: string;
  aiSeats?: readonly number[];
  onClaimSeat?: (seat: number) => void;
  replayUrl?: string;
  homeHref?: string;
  importedModels?: ReadonlyArray<{ id: string; url: string; title?: string }>;
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

  if (render?.chrome === "wood") {
    const cityName = (id: string) => cityById(networkRoute.cities, id)?.name ?? id;
    const edgeName = (edgeId: string) => {
      const edge = networkRoute.edges.find((entry) => entry.id === edgeId);
      return edge ? `${cityName(edge.from)}—${cityName(edge.to)}` : edgeId;
    };
    const zh = locale === "zh";
    const open = networkRoute.edges.filter((edge) => networkRoute.claims[edge.id] === null || networkRoute.claims[edge.id] === undefined).length;
    const seatName = (seat: number) =>
      seat === viewerSeat ? (zh ? "你" : "You") : aiSeats.includes(seat) ? (zh ? "电脑" : "Computer") : `${copy.seat} ${seat}`;
    const COMPANY = zh ? ["赤轨公司", "青岚铁路"] : ["Crimson Line", "Azure Rail"];
    const color = (seat: number) => render.materials[`seat${seat}`]?.base ?? SEAT_COLOR[seat] ?? "#888";
    const linked = [linked0, linked1];
    const chronicle = [
      statusLine,
      lastLine,
      `${copy.routes} · ${seatName(0)} ${count0} · ${seatName(1)} ${count1}`,
      terminalsLine,
      goalLine,
    ];
    return (
      <Suspense fallback={<div aria-busy="true" className="network-route-board" />}>
        <LazyTabletopGameScreen
          locale={locale}
          boardLabel={copy.board}
          title={title ?? copy.board}
          statusLine={statusLine}
          homeHref={homeHref}
          replayUrl={replayUrl}
          hudLabel={copy.hud}
          playersTitle={zh ? "铁路公司" : "Rail companies"}
          seats={[0, 1].map((seat) => ({
            seat,
            name: seatName(seat),
            subtitle: COMPANY[seat] ?? "",
            stat: `${zh ? "铁轨" : "Track"} ${seat === 0 ? count0 : count1} · ${linked[seat] ? copy.linked : copy.unlinked}`,
            color: color(seat),
            isActive: status === "active" && seat === activeSeat,
            isYou: seat === viewerSeat,
            isAi: aiSeats.includes(seat),
            portrait: seatPortrait(render.hud, seat),
            badge: status === "active" && seat === activeSeat
              ? seat === viewerSeat ? copy.yourTurn : aiSeats.includes(seat) ? (zh ? "电脑思考中" : "Thinking") : copy.waiting
              : status === "complete" && winnerSeat === seat ? copy.winner : null,
          }))}
          viewerSeat={viewerSeat}
          onClaimSeat={onClaimSeat}
          awards={[
            { label: copy.terminals, value: `${fromHub?.name ?? networkRoute.terminalFrom} ↔ ${toHub?.name ?? networkRoute.terminalTo}` },
            { label: zh ? "剩余路线" : "Open routes", value: String(open) },
          ]}
          stage={<TabletopStage kernel="network-route-v1" legal={[...legalEdges]} onAct={showLegal ? onAct : undefined} render={render} state={networkRoute} importedModels={importedModels} />}
          turnTitle={zh ? "本回合" : "This turn"}
          turnBlurb={statusLine}
          turnDetail={networkRoute.tickets ? copy.ticketsHint : networkRoute.freight ? copy.freightHint : copy.connectHint}
          primary={null}
          idleLine={showLegal ? (zh ? "点地图上的虚线路段，或在下方选一段铺设。" : "Tap a dashed route on the map, or pick one below.") : copy.waiting}
          chronicle={chronicle}
          dockLabel={zh ? "你的铁路" : "Your railway"}
          tiles={[
            { key: "mine", label: zh ? "我的铁轨" : "My track", value: viewerSeat === null ? "—" : viewerSeat === 0 ? count0 : count1, color: color(viewerSeat ?? 0), glyph: "轨", art: seatPortrait(render.hud, viewerSeat ?? 0) },
            { key: "rival", label: zh ? "对手铁轨" : "Rival track", value: viewerSeat === null ? "—" : viewerSeat === 0 ? count1 : count0, color: color(viewerSeat === null ? 1 : 1 - viewerSeat), glyph: "敌", art: seatPortrait(render.hud, viewerSeat === null ? 1 : 1 - viewerSeat) },
            { key: "open", label: zh ? "剩余路线" : "Open", value: open, glyph: "路", art: actionCardArt(render.hud, "open-routes") },
            { key: "goal", label: zh ? "连通" : "Linked", value: viewerSeat === null ? "—" : linked[viewerSeat] ? "✓" : "✗", glyph: "枢", art: actionCardArt(render.hud, "terminals") },
            ...(networkRoute.freight
              ? [
                  {
                    key: "rep",
                    label: copy.reputation,
                    value: viewerSeat === null ? "—" : networkRoute.freight.reputation[viewerSeat],
                    glyph: "信",
                    art: actionCardArt(render.hud, "terminals"),
                  },
                  {
                    key: "funds",
                    label: copy.funds,
                    value: viewerSeat === null ? "—" : networkRoute.freight.funds[viewerSeat],
                    glyph: "资",
                    art: actionCardArt(render.hud, "open-routes"),
                  },
                ]
              : []),
            ...(networkRoute.tickets
              ? [
                  {
                    key: "rpts",
                    label: copy.routePts,
                    value: viewerSeat === null ? "—" : networkRoute.tickets.routeScore[viewerSeat],
                    glyph: "分",
                    art: actionCardArt(render.hud, "terminals"),
                  },
                  {
                    key: "tleft",
                    label: copy.trainsLeft,
                    value: viewerSeat === null ? "—" : networkRoute.tickets.trainsLeft[viewerSeat],
                    glyph: "车",
                    art: actionCardArt(render.hud, "open-routes"),
                  },
                ]
              : []),
          ]}
          actionsLabel={zh ? "可铺路线" : "Claimable"}
          actions={[
            ...legalActions
              .filter((a) => a.type === "draw_trains" || a.type === "draw_tickets")
              .map((a) => ({
                key: a.type,
                label: a.type === "draw_trains" ? copy.drawTrains : copy.drawTickets,
                detail: a.label,
                enabled: showLegal,
                onClick: () => onAct?.(a.type, {}),
                art: actionCardArt(render.hud, "open-routes"),
              })),
            ...legalActions
              .filter((a) => a.type === "accept_contract")
              .map((a) => ({
                key: String(a.payload?.instanceId ?? a.label),
                label: a.label,
                detail: copy.accept,
                enabled: showLegal,
                onClick: () =>
                  onAct?.("accept_contract", {
                    instanceId: a.payload?.instanceId,
                  }),
                art: actionCardArt(render.hud, "open-routes"),
              })),
            ...networkRoute.edges
              .filter((edge) => networkRoute.claims[edge.id] === null || networkRoute.claims[edge.id] === undefined)
              .map((edge) => {
                const claimActs = legalActions.filter(
                  (a) => a.type === "claim" && a.payload?.edgeId === edge.id,
                );
                const first = claimActs[0];
                return {
                  key: edge.id,
                  label: edgeName(edge.id),
                  detail: `${copy.claim} · ${edge.from}–${edge.to}`,
                  enabled: showLegal && claimActs.length > 0,
                  onClick: () =>
                    onAct?.("claim", {
                      edgeId: edge.id,
                      ...(first?.payload?.payColor
                        ? { payColor: first.payload.payColor }
                        : {}),
                    }),
                  art: actionCardArt(render.hud, edge.id),
                };
              }),
          ]}
          emptyActions={copy.noLast}
        />
      </Suspense>
    );
  }

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
        {networkRoute.tickets ? (
          <div className="network-route-tickets" aria-label="tickets">
            <p className="network-route-hint">{copy.ticketsHint}</p>
            <p>
              {copy.routePts}: 0={networkRoute.tickets.routeScore[0]} · 1={networkRoute.tickets.routeScore[1]} · {copy.trainsLeft}: 0={networkRoute.tickets.trainsLeft[0]} · 1={networkRoute.tickets.trainsLeft[1]}
            </p>
            {viewerSeat !== null ? (
              <p aria-label={copy.tickets}>
                {copy.tickets}: {(networkRoute.tickets.ticketHand[viewerSeat] ?? []).map((c) => `${c.name}(${c.points})`).join(" · ") || "—"}
              </p>
            ) : null}
            {showLegal ? (
              <div className="network-route-tickets-actions">
                {legalActions
                  .filter((a) => a.type === "draw_trains" || a.type === "draw_tickets")
                  .map((a) => (
                    <button key={a.type} type="button" onClick={() => onAct?.(a.type, {})}>
                      {a.type === "draw_trains" ? copy.drawTrains : copy.drawTickets}
                    </button>
                  ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {networkRoute.freight ? (
          <div className="network-route-freight" aria-label="freight">
            <p className="network-route-hint">{copy.freightHint}</p>
            <p>
              {copy.funds}: 0={networkRoute.freight.funds[0]} · 1={networkRoute.freight.funds[1]} · {copy.reputation}: 0={networkRoute.freight.reputation[0]} · 1={networkRoute.freight.reputation[1]} · {copy.winRep} {networkRoute.freight.winReputation}
            </p>
            <p>
              {copy.ships}: {networkRoute.freight.shipsCatalog.map((s) => s.name).join(" / ")}
            </p>
            <p aria-label={copy.market}>
              {copy.market}: {networkRoute.freight.market.map((c) => c.name).join(" · ") || "—"}
            </p>
            {viewerSeat !== null ? (
              <p aria-label={copy.hand}>
                {copy.hand}: {(networkRoute.freight.hand[viewerSeat] ?? []).map((c) => c.name).join(" · ") || "—"}
              </p>
            ) : null}
            {showLegal ? (
              <div className="network-route-freight-actions">
                {legalActions
                  .filter((a) => a.type === "accept_contract")
                  .map((a) => (
                    <button
                      key={String(a.payload?.instanceId)}
                      type="button"
                      onClick={() =>
                        onAct?.("accept_contract", {
                          instanceId: a.payload?.instanceId,
                        })
                      }
                    >
                      {copy.accept} · {a.label}
                    </button>
                  ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <TabletopStage kernel="network-route-v1" legal={[...legalEdges]} onAct={showLegal ? onAct : undefined} render={render} state={networkRoute} importedModels={importedModels} />

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
