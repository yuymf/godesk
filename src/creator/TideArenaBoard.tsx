/**
 * Tide Arena / 潮阵 — room stage for auto-battler-v1: full-bleed 3D tabletop
 * (lazy) with a DOM overlay HUD (top bar, synergies, combat log, shop + sell zone).
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { SessionState } from "./project-contract";
import {
  START_HP,
  REFRESH_COST,
  TRAIT_SYNERGIES,
  traitCounts,
  unitDef,
  type Piece,
  type TraitId,
} from "../runtime/adapters/auto-battler";
import { combatDigest } from "../render3d/tide-arena/floaters";
import { TIER_COLORS, UNIT_COLORS } from "../render3d/tide-arena/palette";

const LazyTideArenaScene3D = lazy(() => import("./TideArenaScene3D"));

type TideArenaState = NonNullable<SessionState["autoBattler"]>;

const COMBAT_VIEW_MS = 7000;
const TRAITS = Object.keys(TRAIT_SYNERGIES) as TraitId[];

function useWidth(ref: React.RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(1440);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => setWidth(el.clientWidth || 1440);
    apply();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(apply);
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [ref]);
  return width;
}

function combatKey(arena: TideArenaState): string | null {
  const start = arena.combatLog.find((e) => (e as { kind?: string }).kind === "combat_start") as { round?: number } | undefined;
  return start ? `${start.round}:${arena.combatLog.length}` : null;
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path d="M7 10V7a5 5 0 0 1 10 0v3" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <rect x="4.5" y="10" width="15" height="11" rx="2.5" fill="currentColor" />
    </svg>
  );
}

export function TideArenaBoard({
  arena,
  activeSeat,
  enabled,
  busy = false,
  readOnly = false,
  status,
  viewerSeat,
  onAct,
}: {
  arena: TideArenaState;
  activeSeat: number;
  enabled: boolean;
  busy?: boolean;
  readOnly?: boolean;
  status: "active" | "complete";
  viewerSeat: number | null;
  onAct?: (actionId: string, payload?: Record<string, unknown>) => void;
}) {
  const stageRef = useRef<HTMLElement | null>(null);
  const width = useWidth(stageRef);
  const mobile = width < 700;
  const seatIdx = viewerSeat === 1 ? 1 : 0;
  const me = arena.seats[seatIdx]!;
  const them = arena.seats[seatIdx === 0 ? 1 : 0]!;
  const ownBoard = me.board as Array<Piece | null>;
  const ownBench = me.bench as Array<Piece | null>;
  const enemyBoard = them.board as Array<Piece | null>;

  // Combat resolves instantly in the kernel; the client holds a timed combat still.
  const key = combatKey(arena);
  const seenKey = useRef(key);
  const hold = typeof location !== "undefined" && new URLSearchParams(location.search).get("tideHold") === "combat";
  const [combatUntil, setCombatUntil] = useState(0);
  useEffect(() => {
    if (key && key !== seenKey.current) setCombatUntil(Date.now() + COMBAT_VIEW_MS);
    seenKey.current = key;
  }, [key]);
  useEffect(() => {
    if (!combatUntil || hold) return;
    const t = setTimeout(() => setCombatUntil(0), Math.max(0, combatUntil - Date.now()));
    return () => clearTimeout(t);
  }, [combatUntil, hold]);
  const inCombat = combatUntil > 0 && status === "active";

  const digest = useMemo(
    () => (inCombat ? combatDigest(arena.combatLog as Array<Record<string, unknown>>) : null),
    [inCombat, arena.combatLog],
  );

  const canAct = enabled && !busy && !readOnly && status === "active" && viewerSeat === activeSeat && !me.ready;
  const dragEnabled = canAct && !inCombat && arena.phase !== "ended";
  const [drag, setDrag] = useState({ dragging: false, overSell: false });

  const counts = traitCounts(ownBoard);
  const names = new Map<string, string>();
  for (const p of [...ownBoard, ...enemyBoard]) if (p) names.set(p.uid, unitDef(p.unitId)?.name ?? p.unitId);

  const phase = status === "complete" || arena.phase === "ended" ? "终局" : inCombat ? "战斗" : "备战";
  const step = arena.phase === "shop" ? "商店" : arena.phase === "place" ? "布阵" : "";
  const cta = arena.phase === "shop" ? { id: "ready_shop", label: "准备完毕" } : { id: "ready_place", label: "锁定阵容" };
  const safe = mobile ? { top: 120, bottom: 176, left: 0, right: 0 } : { top: 72, bottom: 176, left: 210, right: 210 };

  const act = (id: string, payload?: Record<string, unknown>) => onAct?.(id, payload);

  return (
    <section
      aria-label="潮阵对局"
      ref={stageRef}
      className={`tide-arena-stage${mobile ? " is-mobile" : ""}`}
      data-phase={arena.phase}
      data-combat={inCombat ? "1" : "0"}
    >
      <Suspense fallback={<div className="ta-scene ta-scene-loading">棋盘加载中…</div>}>
        <LazyTideArenaScene3D
          ownBoard={ownBoard}
          ownBench={ownBench}
          enemyBoard={enemyBoard}
          hp={digest?.hp}
          floaters={digest?.floaters}
          dragEnabled={dragEnabled}
          mobile={mobile}
          safe={safe}
          onAction={(type, payload) => act(type, payload)}
          onDrag={setDrag}
        />
      </Suspense>

      <header className="ta-topbar">
        <span className="ta-brand">潮阵</span>
        <span className="ta-round">第 {arena.round} 回合</span>
        <span className={`ta-pill is-${phase === "战斗" ? "combat" : phase === "终局" ? "end" : "prep"}`}>
          {phase}
          {phase === "备战" && step ? ` · ${step}` : ""}
        </span>
        <span className="ta-turn" aria-live="polite">
          {status === "complete" ? "对局结束" : me.ready ? "已准备，等待对手" : `座位 ${activeSeat} 行动`}
        </span>
        <span className="ta-hpbar is-own" aria-label="我方生命">
          <b>我方</b>
          <span><i style={{ width: `${(me.hp / START_HP) * 100}%` }} /></span>
          <em>{me.hp}</em>
        </span>
        <span className="ta-hpbar is-enemy" aria-label="对手生命">
          <b>对手</b>
          <span><i style={{ width: `${(them.hp / START_HP) * 100}%` }} /></span>
          <em>{them.hp}</em>
        </span>
      </header>

      <aside className="ta-traits" aria-label="我方羁绊">
        {!mobile ? <h3>羁绊</h3> : null}
        {TRAITS.map((trait) => {
          const syn = TRAIT_SYNERGIES[trait];
          const n = counts[trait] ?? 0;
          const next = syn.tiers.find((t) => t > n) ?? syn.tiers[syn.tiers.length - 1]!;
          return (
            <div key={trait} className={`ta-trait${n >= syn.min ? " is-active" : ""}`}>
              <span className="ta-glyph">{syn.glyph}</span>
              {!mobile ? <span className="ta-trait-name">{syn.label}</span> : null}
              <span className="ta-trait-count">{n}/{next}</span>
            </div>
          );
        })}
      </aside>

      {inCombat && !mobile ? (
        <aside className="ta-log" aria-label="战斗日志">
          <h3>战斗日志</h3>
          <ol>
            {(arena.combatLog as Array<Record<string, unknown>>)
              .filter((e) => e.kind === "strike" || e.kind === "unit_down" || e.kind === "combat_end")
              .slice(-9)
              .map((e, i) => (
                <li key={i} className={`is-${String(e.kind)}`}>
                  {e.kind === "strike"
                    ? `${names.get(String(e.attackerUid)) ?? "?"} → ${names.get(String(e.targetUid)) ?? "?"} −${e.damage}`
                    : e.kind === "unit_down"
                      ? `${names.get(String(e.uid)) ?? "?"} 倒下`
                      : e.winnerSeat === null
                        ? "平局"
                        : `座位 ${e.winnerSeat} 胜 · 伤害 ${e.damageToLoser}`}
                </li>
              ))}
          </ol>
        </aside>
      ) : null}

      <footer className={`ta-shop${inCombat ? " is-locked" : ""}`} aria-label="商店">
        <div className="ta-shop-side">
          <span className="ta-gold" aria-label="金币"><i />{me.gold}</span>
          <button type="button" className="ta-btn" disabled={!canAct || inCombat || arena.phase !== "shop" || me.gold < REFRESH_COST} onClick={() => act("refresh")}>
            刷新 {REFRESH_COST}
          </button>
          <button type="button" className="ta-btn is-cta" disabled={!canAct || inCombat} onClick={() => act(cta.id)}>
            {cta.label}
          </button>
        </div>
        <div className="ta-cards">
          {me.shop.map((unitId, shopIndex) => {
            const def = unitId ? unitDef(unitId) : undefined;
            if (!def) return <div key={shopIndex} className="ta-card is-empty" aria-hidden />;
            return (
              <button
                key={shopIndex}
                type="button"
                className="ta-card tide-arena-card"
                style={{ ["--tier" as string]: TIER_COLORS[def.cost] }}
                disabled={!canAct || inCombat || arena.phase !== "shop" || me.gold < def.cost}
                onClick={() => act("buy", { shopIndex })}
              >
                <span className="ta-portrait" style={{ background: UNIT_COLORS[def.id] }}>{def.name.slice(0, 1)}</span>
                <strong>{def.name}</strong>
                <span className="ta-card-traits">{def.traits.map((t) => TRAIT_SYNERGIES[t].glyph).join(" ")}</span>
                <span className="ta-cost">{def.cost}</span>
              </button>
            );
          })}
        </div>
        {!mobile ? (
          <div className={`ta-sell${drag.dragging ? " is-armed" : ""}${drag.overSell ? " is-hot" : ""}`} data-tide-sell>
            {drag.dragging ? "松手出售" : "拖到此处出售"}
          </div>
        ) : null}
        {inCombat ? (
          <div className="ta-shop-lock" role="status">
            <LockIcon />
            <span>战斗中</span>
          </div>
        ) : null}
      </footer>

      {status === "complete" ? (
        <div className="ta-banner" role="status">
          对局结束 · {me.hp > them.hp ? "我方获胜" : me.hp < them.hp ? "对手获胜" : "平局"}
        </div>
      ) : null}
    </section>
  );
}
