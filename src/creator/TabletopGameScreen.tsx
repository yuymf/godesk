/**
 * step3 · 通用「木框全屏」对局外壳（RenderSpec.chrome = "wood"）。
 *
 * 复用汐屿（HexSettlementBoard）的 tidewell-game-screen 外观：木纹顶栏 + 左侧玩家栏 +
 * 中央内嵌 3D 舞台 + 右侧回合卡 / 纪事 + 底部木托盘。不含任何汐屿专属插画或文案：
 * 玩家徽章用座位色蜡封，托盘内容由调用方（各 Kernel 棋盘组件）给出。懒加载（CSS 同 chunk）。
 */
import { useState, type CSSProperties, type ReactNode } from "react";
import { PARCHMENT_GRAIN_URL, WOOD_GRAIN_URL } from "./tidewell-hud-assets";
import "./tidewell-game-screen.css";

export type TabletopScreenSeat = {
  seat: number;
  name: string;
  subtitle: string;
  stat: string;
  color: string;
  isActive: boolean;
  isYou: boolean;
  isAi: boolean;
  badge?: string | null;
  /** step3 R2：肖像图（RenderSpec.hud.portraits）；缺省为座位色蜡封。 */
  portrait?: string | null;
};

export type TabletopScreenTile = { key: string; label: string; value: string | number; color?: string; glyph?: string; art?: string | null };
export type TabletopScreenAction = { key: string; label: string; detail?: string; enabled: boolean; onClick: () => void; art?: string | null };

export type TabletopGameScreenProps = {
  locale: "zh" | "en";
  boardLabel: string;
  title: string;
  statusLine: string;
  homeHref: string;
  replayUrl?: string;
  hudLabel: string;
  playersTitle: string;
  seats: readonly TabletopScreenSeat[];
  viewerSeat: number | null;
  onClaimSeat?: (seat: number) => void;
  awards?: ReadonlyArray<{ label: string; value: string }>;
  stage: ReactNode;
  turnTitle: string;
  turnBlurb: string;
  turnDetail?: string;
  primary?: { label: string; disabled: boolean; onClick: () => void } | null;
  idleLine: string;
  chronicle: readonly string[];
  dockLabel: string;
  tiles: readonly TabletopScreenTile[];
  actionsLabel: string;
  actions: readonly TabletopScreenAction[];
  emptyActions: string;
};

const COPY = {
  zh: { home: "返回我的游戏", menu: "菜单", seat: "你的席位", pick: "选择空席位", ai: " · 电脑", replay: "只读回放", log: "纪事", feedback: "试玩反馈", chronicle: "纪事", chat: "闲谈", coach: "教练", none: "暂无" },
  en: { home: "Back to my games", menu: "Menu", seat: "Your seat", pick: "Pick a seat", ai: " · AI", replay: "Replay", log: "Log", feedback: "Feedback", chronicle: "Chronicle", chat: "Chat", coach: "Coach", none: "None yet" },
} as const;

export default function TabletopGameScreen(props: TabletopGameScreenProps) {
  const copy = COPY[props.locale];
  const [logOpen, setLogOpen] = useState(false);
  const [tab, setTab] = useState<"chronicle" | "chat" | "coach">("chronicle");
  return (
    <div
      aria-label={props.boardLabel}
      className="tidewell-game-screen tabletop-game-screen"
      role="region"
      style={{
        ["--tw-tex-wood" as string]: WOOD_GRAIN_URL ? `url("${WOOD_GRAIN_URL}")` : "none",
        ["--tw-tex-parchment" as string]: PARCHMENT_GRAIN_URL ? `url("${PARCHMENT_GRAIN_URL}")` : "none",
      } as CSSProperties}
    >
      <header className="tidewell-topbar">
        <div className="tidewell-topbar-brand">
          <a aria-label={copy.home} className="tidewell-home-btn tidewell-wood-icon" href={props.homeHref} title={copy.home}>←</a>
          <span aria-hidden="true" className="tidewell-wax-dot" />
          <strong className="tidewell-brand-name">{props.boardLabel}</strong>
        </div>
        <div className="tidewell-topbar-center">
          <span className="tidewell-island-name">{props.title}</span>
          <p className="tidewell-topbar-status">{props.statusLine}</p>
        </div>
        <div className="tidewell-topbar-actions">
          {props.replayUrl ? (
            <a aria-label={copy.replay} className="tidewell-wood-icon tidewell-replay-link" href={props.replayUrl} title={copy.replay}>▷</a>
          ) : null}
          <button className="tidewell-wood-icon tidewell-log-chip" onClick={() => setLogOpen((v) => !v)} title={copy.log} type="button">≡</button>
          <details className="tidewell-menu">
            <summary className="tidewell-wood-icon" title={copy.menu}>⚙</summary>
            <div className="tidewell-menu-panel">
              {props.onClaimSeat ? (
                <label className="tidewell-seat-select">
                  <span>{copy.seat}</span>
                  <select
                    aria-label={copy.seat}
                    onChange={(event) => {
                      const next = Number(event.currentTarget.value);
                      if (event.currentTarget.value !== "" && Number.isInteger(next)) props.onClaimSeat?.(next);
                      const details = event.currentTarget.closest("details");
                      if (details instanceof HTMLDetailsElement) details.open = false;
                    }}
                    value={props.viewerSeat ?? ""}
                  >
                    <option value="">{copy.pick}</option>
                    {props.seats.map((seat) => (
                      <option disabled={seat.isAi && seat.seat !== props.viewerSeat} key={seat.seat} value={seat.seat}>
                        {seat.name}{seat.isAi ? copy.ai : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button
                className="tidewell-chip-btn"
                onClick={() => {
                  const drawer = document.getElementById("room-feedback-drawer");
                  if (drawer instanceof HTMLDetailsElement) drawer.open = true;
                }}
                type="button"
              >
                {copy.feedback}
              </button>
              {props.replayUrl ? <a className="tidewell-chip-btn" href={props.replayUrl}>{copy.replay}</a> : null}
            </div>
          </details>
        </div>
      </header>

      <div className="tidewell-game-body">
        <aside aria-label={props.hudLabel} className="tidewell-players" role="region">
          <h2 className="tidewell-panel-title">{props.playersTitle}</h2>
          <ul className="tidewell-player-list">
            {props.seats.map((seat) => (
              <li
                className={`tidewell-player-card${seat.isActive ? " is-active" : ""}${seat.isYou ? " is-you" : ""}`}
                key={seat.seat}
                style={{ "--seat-color": seat.color } as CSSProperties}
              >
                {seat.portrait ? (
                  <div className="tidewell-player-avatar tidewell-medallion tabletop-portrait" aria-hidden="true">
                    <img alt="" decoding="async" src={seat.portrait} />
                    <span className="tabletop-portrait-pip">{seat.seat + 1}</span>
                  </div>
                ) : (
                  <div className="tidewell-player-avatar tidewell-medallion tabletop-seal" aria-hidden="true">
                    <span className="tabletop-seal-mark">{seat.seat + 1}</span>
                  </div>
                )}
                <div className="tidewell-player-meta">
                  <b>{seat.name}</b>
                  <span className="tidewell-house-name">{seat.subtitle}</span>
                  <span className="tidewell-player-vp">{seat.stat}</span>
                </div>
                {seat.badge ? <span className="tidewell-turn-badge">{seat.badge}</span> : null}
              </li>
            ))}
          </ul>
          {props.awards?.length ? (
            <dl className="hex-island-hud-awards">
              {props.awards.map((award) => (
                <div key={award.label}>
                  <dt>{award.label}</dt>
                  <dd>{award.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </aside>

        <div className="tidewell-stage-wrap">{props.stage}</div>

        <aside className={`tidewell-turn-column${logOpen ? " is-open" : ""}`} data-log-open={logOpen ? "1" : "0"}>
          <section aria-label={props.turnTitle} className="tidewell-turn-panel tidewell-turn-card">
            <div className="tidewell-turn-card-head">
              <h2 className="tidewell-panel-title">{props.turnTitle}</h2>
            </div>
            <p className="tidewell-turn-blurb">{props.turnBlurb}</p>
            {props.turnDetail ? <p className="hex-island-hud-dice">{props.turnDetail}</p> : null}
            {props.primary ? (
              <button className="tidewell-primary-cta" disabled={props.primary.disabled} onClick={props.primary.onClick} type="button">
                {props.primary.label}
              </button>
            ) : (
              <p className="tidewell-turn-idle">{props.idleLine}</p>
            )}
          </section>
          <section aria-label={copy.chronicle} className="tidewell-log-panel">
            <div className="tidewell-log-tabs" role="tablist">
              {([["chronicle", copy.chronicle], ["chat", copy.chat], ["coach", copy.coach]] as const).map(([id, label]) => (
                <button aria-selected={tab === id} className={tab === id ? "is-active" : ""} key={id} onClick={() => setTab(id)} role="tab" type="button">
                  {label}
                </button>
              ))}
            </div>
            <div className="tidewell-log-body" role="tabpanel">
              {tab === "chronicle" && props.chronicle.length ? (
                <ol className="tidewell-chronicle">
                  {props.chronicle.map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}
                </ol>
              ) : (
                <p className="tidewell-log-empty">{tab === "chronicle" ? copy.none : tab === "chat" ? copy.chat : copy.coach}</p>
              )}
            </div>
          </section>
        </aside>
      </div>

      <footer aria-label={props.dockLabel} className="tidewell-dock">
        <div className="tidewell-hand">
          {props.tiles.map((tile) => (
            <div className="tidewell-resource-tile tabletop-tile" key={tile.key} style={{ "--seat-color": tile.color ?? "#8a6a14" } as CSSProperties}>
              {tile.art ? (
                <div className="tidewell-resource-art tabletop-tile-art has-art" aria-hidden="true">
                  <img alt="" decoding="async" src={tile.art} />
                  {tile.glyph ? <span className="tabletop-tile-glyph">{tile.glyph}</span> : null}
                </div>
              ) : (
                <div className="tidewell-resource-art is-fallback tabletop-tile-art" aria-hidden="true">
                  <span>{tile.glyph ?? "◆"}</span>
                </div>
              )}
              <span className="tidewell-resource-name">{tile.label}</span>
              <b className="tidewell-resource-count">{tile.value}</b>
            </div>
          ))}
        </div>
        <div className="tidewell-dev-slot">
          <span className="hex-island-kicker">{props.actionsLabel}</span>
          <strong>{props.actions.filter((action) => action.enabled).length}</strong>
        </div>
        <div className="tidewell-build-row tabletop-action-row" role="group" aria-label={props.actionsLabel}>
          {props.actions.length ? props.actions.map((action) => (
            <button
              className={`tidewell-build-btn${action.enabled ? "" : " is-disabled"}${action.art ? " tabletop-card" : ""}`}
              disabled={!action.enabled}
              key={action.key}
              onClick={action.onClick}
              title={action.detail ? `${action.label} · ${action.detail}` : action.label}
              type="button"
            >
              {action.art ? <img alt="" aria-hidden="true" className="tabletop-card-art" decoding="async" src={action.art} /> : null}
              <span className="tidewell-build-label">{action.label}</span>
              {action.detail ? <span className="tidewell-build-cost">{action.detail}</span> : null}
            </button>
          )) : <p className="tidewell-turn-idle tabletop-action-empty">{props.emptyActions}</p>}
        </div>
      </footer>
    </div>
  );
}
