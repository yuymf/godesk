/**
 * Tide Arena / 潮阵 — room stage for auto-battler-v1: full-bleed 3D tabletop
 * (lazy) with a DOM overlay HUD (top bar, synergies, combat log, shop + sell zone).
 */
import { DEFAULT_AUTO_BATTLER_CONTENT, resolveAutoBattlerContent, unitShape, type AutoBattlerContentPatch } from "../runtime/adapters/auto-battler-content";
import { setTideArenaUnitAppearance } from "../render3d/tide-arena/appearance";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { SessionState } from "./project-contract";
import {
  START_HP,
  REFRESH_COST,
  BUY_XP_COST,
  MAX_LEVEL,
  xpToNext,
  boardCap,
  traitTable,
  traitCounts,
  unitDef,
  type Piece,
  type TraitId,
} from "../runtime/adapters/auto-battler";
import type { FloaterEvent } from "../render3d/tide-arena/floaters";
import type { CSSProperties } from "react";
import { DEFAULT_THEME_ID, resolveAutoBattlerTheme, THEME_PRESETS, type AutoBattlerThemePatch } from "../runtime/adapters/auto-battler-theme";
import type { UnitModelSource } from "../render3d/tide-arena/unit-models";
import { buildTimeline, hpAt, type Timeline } from "../render3d/tide-arena/timeline";
import { TIER_COLORS, UNIT_COLORS } from "../render3d/tide-arena/palette";

const LazyTideArenaScene3D = lazy(() => import("./TideArenaScene3D"));

type TideArenaState = NonNullable<SessionState["autoBattler"]>;

/** Resolve frame stays up this long after the replay ends (or is skipped). */
const RESOLVE_HOLD_MS = 3000;
const FLOATER_WINDOW_MS = 1400;

const OWN_NAME = "汐屿·我方";
const ENEMY_NAME = "珊瑚港·对手";

/** SVG silhouettes aligned to SPEC / mockup unit shapes. */
const UNIT_SILHOUETTE: Record<string, string> = {
  crab: '<ellipse cx="28" cy="34" rx="18" ry="11"/><circle cx="10" cy="22" r="6"/><circle cx="46" cy="22" r="6"/>',
  conch: '<ellipse cx="26" cy="32" rx="14" ry="12"/><path d="M34 20 L48 12 L44 28Z"/>',
  blade: '<path d="M28 6 L36 40 L28 50 L20 40Z"/>',
  archer: '<path d="M6 30 Q28 8 50 30 Q28 44 6 30Z"/>',
  rider: '<path d="M8 36 L28 12 L48 36 Z"/><rect x="24" y="8" width="8" height="16"/>',
  anemone: '<rect x="24" y="28" width="8" height="18"/><circle cx="28" cy="22" r="12"/>',
  witch: '<path d="M28 6 L42 48 H14Z"/><circle cx="28" cy="12" r="5"/>',
  priest: '<path d="M28 4 L40 50 H16Z"/><line x1="42" y1="10" x2="42" y2="48" stroke-width="3"/>',
  turtle: '<ellipse cx="28" cy="30" rx="18" ry="14"/><circle cx="28" cy="18" r="6"/>',
  whale: '<rect x="8" y="14" width="40" height="34" rx="10"/>',
  lantern: '<rect x="25" y="10" width="6" height="28"/><rect x="18" y="8" width="20" height="16" rx="3"/>',
  spirit: '<circle cx="28" cy="28" r="16"/><circle cx="28" cy="28" r="22" fill="none" stroke-width="3"/>',
};

const TRAIT_GLYPH_FALLBACK = ["#1F8A8A", "#C0703C", "#8A6BBE", "#5A8FC9", "#B5546A", "#6F8F3A", "#8C7A3E", "#4F6D8F"];
const TRAIT_GLYPH_BG: Record<TraitId, string> = {
  tide: "#1F8A8A",
  shell: "#C0703C",
  coral: "#8A6BBE",
  voyager: "#5A8FC9",
};

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

function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path d="M7 10V7a5 5 0 0 1 10 0v3" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <rect x="4.5" y="10" width="15" height="11" rx="2.5" fill="currentColor" />
    </svg>
  );
}

function CoinIcon({ size = 14 }: { size?: number }) {
  return <i className="ta-coin" style={{ width: size, height: size }} aria-hidden />;
}

function HpTicks({ hp, max, tone }: { hp: number; max: number; tone: "own" | "enemy" }) {
  const pct = Math.max(0, Math.min(100, (hp / max) * 100));
  return (
    <span className={`ta-hpbar is-${tone}`} aria-label={tone === "own" ? "我方生命" : "对手生命"}>
      <b className="ta-pl-name">{tone === "own" ? OWN_NAME : ENEMY_NAME}</b>
      <span className="ta-hp-track">
        <i style={{ width: `${pct}%` }} />
        <span className="ta-hp-ticks" aria-hidden>
          {Array.from({ length: max }, (_, i) => (
            <em key={i} />
          ))}
        </span>
      </span>
      <em className="ta-hp-num">
        {hp}/{max}
      </em>
    </span>
  );
}

function ShopPortrait({ unitId, name, color }: { unitId: string; name: string; color: string }) {
  const sil = UNIT_SILHOUETTE[unitId];
  if (!sil) {
    return (
      <span className="ta-portrait" style={{ background: color }}>
        {name.slice(0, 1)}
      </span>
    );
  }
  return (
    <span className="ta-art" style={{ background: `linear-gradient(160deg, ${color}33, ${color}55)` }}>
      <svg viewBox="0 0 56 56" fill={color} stroke={color} aria-hidden dangerouslySetInnerHTML={{ __html: sil }} />
    </span>
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
  content: contentPatch,
  theme: themePatch,
  importedModels,
}: {
  /** Visual theme data (preset + overrides) from the build's runtime config. */
  theme?: AutoBattlerThemePatch;
  /** Imported GLBs available to bind via unit.modelRef. */
  importedModels?: readonly UnitModelSource[];
  /** Kernel content data (units / traits / star rules) from the build's runtime config. */
  content?: AutoBattlerContentPatch;
  arena: TideArenaState;
  activeSeat: number;
  enabled: boolean;
  busy?: boolean;
  readOnly?: boolean;
  status: "active" | "complete";
  viewerSeat: number | null;
  onAct?: (actionId: string, payload?: Record<string, unknown>) => void;
}) {
  const themeKey = JSON.stringify(themePatch ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const theme = useMemo(() => resolveAutoBattlerTheme(themePatch) ?? THEME_PRESETS[DEFAULT_THEME_ID]!, [themeKey]);
  const content = useMemo(() => resolveAutoBattlerContent(contentPatch) ?? DEFAULT_AUTO_BATTLER_CONTENT, [contentPatch]);
  const traitsById = useMemo(() => traitTable(content), [content]);
  const TRAITS = content.traits.map((t) => t.id);
  const glyphBg = (trait: TraitId) => TRAIT_GLYPH_BG[trait] ?? TRAIT_GLYPH_FALLBACK[Math.max(0, TRAITS.indexOf(trait)) % TRAIT_GLYPH_FALLBACK.length];
  useMemo(() => setTideArenaUnitAppearance(content.units.map((u) => ({ id: u.id, cost: u.cost, proceduralPreset: unitShape(u), ...(u.modelRef ? { modelRef: u.modelRef } : {}) }))), [content]);
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
  const [replay, setReplay] = useState<{ tl: Timeline; ms: number; done: boolean } | null>(null);
  const [speed, setSpeed] = useState(1);
  const [skipToken, setSkipToken] = useState(0);
  useEffect(() => {
    if (key && key !== seenKey.current) {
      const units = new Map<string, { unitId: string; name: string }>();
      for (const seat of arena.seats) for (const p of seat.board as Array<Piece | null>) if (p) units.set(p.uid, { unitId: p.unitId, name: unitDef(p.unitId, content)?.name ?? p.unitId });
      setReplay({ tl: buildTimeline(arena.combatLog as Array<Record<string, unknown>>, (uid) => units.get(uid)), ms: 0, done: false });
      setSpeed(1);
    }
    seenKey.current = key;
  }, [key]);
  useEffect(() => {
    if (!replay?.done || hold) return;
    const t = setTimeout(() => setReplay(null), RESOLVE_HOLD_MS);
    return () => clearTimeout(t);
  }, [replay?.done, hold]);
  const inCombat = replay !== null && status === "active";
  const onReplayTime = (ms: number, done: boolean) => setReplay((r) => (r ? { ...r, ms, done: r.done || done } : r));

  // Prep timer: display-only from authoritative prepEndsAt (worker/kernel).
  const prepEndsAt = typeof (arena as { prepEndsAt?: number }).prepEndsAt === "number"
    ? (arena as { prepEndsAt: number }).prepEndsAt
    : 0;
  const [prepLeft, setPrepLeft] = useState(0);
  useEffect(() => {
    if (inCombat || status !== "active" || arena.phase === "ended" || !prepEndsAt) {
      setPrepLeft(0);
      return;
    }
    const tick = () => setPrepLeft(Math.max(0, Math.ceil((prepEndsAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [prepEndsAt, arena.phase, arena.round, inCombat, status]);

  const live = useMemo(() => {
    if (!replay) return null;
    const { tl, ms } = replay;
    const floaters: FloaterEvent[] = [];
    for (const e of tl.events) {
      if (e.kind === "strike" && e.hitT <= ms && (replay.done ? e.hitT >= tl.durationMs - 3000 : ms - e.hitT < FLOATER_WINDOW_MS)) {
        floaters.push({ uid: e.targetUid, amount: e.damage, kind: "damage" });
      }
      if (e.kind === "heal" && e.t <= ms && (replay.done ? e.t >= tl.durationMs - 3000 : ms - e.t < FLOATER_WINDOW_MS)) {
        floaters.push({ uid: e.uid, amount: e.amount, kind: "heal" });
      }
    }
    return { floaters, hp: hpAt(tl, ms), lines: tl.lines.filter((l) => l.t <= ms) };
  }, [replay]);

  const canAct = enabled && !busy && !readOnly && status === "active" && viewerSeat === activeSeat && !me.ready;
  const dragEnabled = canAct && !inCombat && arena.phase !== "ended";
  const [drag, setDrag] = useState({ dragging: false, overSell: false });

  const counts = traitCounts(ownBoard, content);
  const phase = status === "complete" || arena.phase === "ended" ? "终局" : inCombat ? "战斗" : "备战";
  const step = arena.phase === "shop" ? "商店" : arena.phase === "place" ? "布阵" : "";
  const cta = arena.phase === "shop" ? { id: "ready_shop", label: "准备完毕" } : { id: "ready_place", label: "锁定阵容" };
  const safe = mobile ? { top: 120, bottom: 176, left: 0, right: 0 } : { top: 72, bottom: 172, left: 200, right: 200 };

  const level = me.level ?? 1;
  const xp = me.xp ?? 0;
  const need = xpToNext(level);
  const onBoard = ownBoard.reduce((n, p) => n + (p ? 1 : 0), 0);
  const full = onBoard >= boardCap(level);
  const timerLabel = inCombat ? (live?.lines.at(-1)?.stamp ?? "0:00") : formatClock(prepLeft);

  const act = (id: string, payload?: Record<string, unknown>) => onAct?.(id, payload);

  return (
    <section
      aria-label="潮阵对局"
      ref={stageRef}
      className={`tide-arena-stage${mobile ? " is-mobile" : ""}`}
      data-theme={theme.id}
      style={{ "--ta-teal": theme.ui.accent, "--ta-coral": theme.ui.enemy, background: theme.background } as CSSProperties}
      data-phase={arena.phase}
      data-combat={inCombat ? "1" : "0"}
      data-replay={replay ? (replay.done ? "done" : "playing") : "none"}
    >
      <Suspense fallback={<div className="ta-scene ta-scene-loading">棋盘加载中…</div>}>
        <LazyTideArenaScene3D
          ownBoard={ownBoard}
          ownBench={ownBench}
          enemyBoard={enemyBoard}
          hp={replay?.tl.finalHp}
          liveHp={live?.hp}
          floaters={live?.floaters}
          replay={replay && !replay.done ? replay.tl : null}
          replaySpeed={speed}
          skipToken={skipToken}
          onReplayTime={onReplayTime}
          dragEnabled={dragEnabled}
          boardFull={full}
          mobile={mobile}
          safe={safe}
          onAction={(type, payload) => act(type, payload)}
          onDrag={setDrag}
          theme={theme}
          importedModels={importedModels}
        />
      </Suspense>

      <header className="ta-topbar">
        <span className="ta-brand">潮阵</span>
        <span className="ta-round">第 {arena.round} 回合</span>
        <span className={`ta-pill is-${phase === "战斗" ? "combat" : phase === "终局" ? "end" : "prep"}`}>
          {phase}
          {phase === "备战" && step ? ` · ${step}` : ""}
        </span>
        <span className={`ta-timer${inCombat ? " is-combat" : ""}`} aria-label="计时">
          {timerLabel}
        </span>
        <span className="ta-turn" aria-live="polite">
          {status === "complete" ? "对局结束" : me.ready ? "已准备，等待对手" : `座位 ${activeSeat} 行动`}
        </span>
        <div className="ta-players">
          <HpTicks hp={me.hp} max={arena.tuning?.startHp ?? START_HP} tone="own" />
          <HpTicks hp={them.hp} max={arena.tuning?.startHp ?? START_HP} tone="enemy" />
        </div>
      </header>

      <aside className="ta-traits" aria-label="我方羁绊">
        {!mobile ? <h3>羁绊</h3> : null}
        {TRAITS.map((trait) => {
          const syn = traitsById[trait]!;
          const n = counts[trait] ?? 0;
          const activeTier = [...syn.tiers].filter((t) => n >= t);
          const current = activeTier[activeTier.length - 1];
          const next = syn.tiers.find((t) => t > n) ?? syn.tiers[syn.tiers.length - 1]!;
          return (
            <div key={trait} className={`ta-trait${n >= syn.min ? " is-active" : ""}`}>
              <span className="ta-glyph" style={{ background: n >= syn.min ? glyphBg(trait) : undefined }}>
                {syn.glyph}
              </span>
              <div className="ta-trait-body">
                {!mobile ? <span className="ta-trait-name">{syn.label}</span> : null}
                {!mobile ? (
                  <span className="ta-trait-steps" aria-label={`${syn.label}档位`}>
                    {syn.tiers.map((t, i) => (
                      <span key={t} className={current === t || (current === undefined && false) ? "is-on" : n >= t ? "is-on" : ""}>
                        {i > 0 ? " / " : ""}
                        {t}
                      </span>
                    ))}
                  </span>
                ) : null}
              </div>
              <span className="ta-trait-count">
                <b>{n}</b>/{next}
              </span>
            </div>
          );
        })}
      </aside>

      {inCombat ? (
        <div className="ta-replay" role="group" aria-label="战斗回放">
          <span className="ta-replay-clock">{live?.lines.at(-1)?.stamp ?? "0:00"}</span>
          {[1, 2].map((s) => (
            <button key={s} type="button" className={`ta-chip${speed === s ? " is-on" : ""}`} aria-pressed={speed === s} disabled={replay?.done} onClick={() => setSpeed(s)}>
              {s}x
            </button>
          ))}
          <button type="button" className="ta-chip" disabled={replay?.done} onClick={() => setSkipToken((n) => n + 1)}>
            跳过
          </button>
        </div>
      ) : null}

      {inCombat && !mobile ? (
        <aside className="ta-log" aria-label="战斗日志">
          <h3>战斗日志</h3>
          <ol>
            {(live?.lines ?? []).slice(-9).map((line) => (
              <li key={`${line.t}:${line.text}`} className={`is-${line.kind}`} data-value={line.value ?? undefined}>
                <time>{line.stamp}</time> {line.text}
              </li>
            ))}
          </ol>
        </aside>
      ) : null}

      <footer className={`ta-shop${inCombat ? " is-locked" : ""}`} aria-label="商店">
        <div className="ta-shop-side">
          <span className="ta-gold" aria-label="金币">
            <CoinIcon size={18} />
            {me.gold}
          </span>
          <div className="ta-lvlw" aria-label="等级与经验">
            <div className="ta-lvl">
              <span>等级 {level}</span>
              <span className="ta-lvl-xp">
                {xp}/{need}
              </span>
              <span className="ta-lvl-cost">升级 {BUY_XP_COST}</span>
            </div>
            <div className="ta-xp" aria-hidden>
              <i style={{ width: `${Math.min(100, (xp / Math.max(1, need)) * 100)}%` }} />
            </div>
          </div>
          <button
            type="button"
            className="ta-btn"
            disabled={!canAct || inCombat || arena.phase !== "shop" || me.gold < REFRESH_COST}
            onClick={() => act("refresh")}
          >
            <span>刷新</span>
            <small>
              <CoinIcon size={12} />
              {REFRESH_COST}
            </small>
          </button>
          <button
            type="button"
            className="ta-btn is-cta"
            disabled={!canAct || inCombat || arena.phase !== "shop" || level >= MAX_LEVEL || me.gold < BUY_XP_COST}
            onClick={() => act("buy_xp")}
          >
            <span>升级</span>
            <small>
              <CoinIcon size={12} />
              {BUY_XP_COST}
            </small>
          </button>
          <button type="button" className="ta-btn is-ready" disabled={!canAct || inCombat} onClick={() => act(cta.id)}>
            {cta.label}
          </button>
        </div>
        <div className="ta-cards">
          {me.shop.map((unitId, shopIndex) => {
            const def = unitId ? unitDef(unitId, content) : undefined;
            if (!def) return <div key={shopIndex} className="ta-card is-empty" aria-hidden />;
            const color = UNIT_COLORS[def.id] ?? UNIT_COLORS[unitShape(def)] ?? "#9AA0A6";
            return (
              <button
                key={shopIndex}
                type="button"
                className="ta-card tide-arena-card"
                style={{ ["--tier" as string]: TIER_COLORS[def.cost] }}
                disabled={!canAct || inCombat || arena.phase !== "shop" || me.gold < def.cost}
                onClick={() => act("buy", { shopIndex })}
              >
                <ShopPortrait unitId={unitShape(def)} name={def.name} color={color} />
                <span className="ta-meta">
                  <span className="ta-card-row">
                    <strong>{def.name}</strong>
                    <span className="ta-cost">
                      <CoinIcon size={14} />
                      {def.cost}
                    </span>
                  </span>
                  <span className="ta-card-traits">
                    {def.traits.map((t) => (
                      <span key={t} className="ta-chip-trait">
                        {traitsById[t]?.label ?? t}
                      </span>
                    ))}
                  </span>
                </span>
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
