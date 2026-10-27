/**
 * Tide Arena / 潮阵 — lazy 3D stage: canvas + DOM overlay (HP bars, star pips,
 * vertically stacked floaters). Exposes `window.__tideArena` for e2e/perf.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { Piece } from "../runtime/adapters/auto-battler";
import { TideArenaScene, type TokenAnchor } from "../render3d/tide-arena/scene";
import { resolveFloaterLift, stackFloaters, type FloaterEvent } from "../render3d/tide-arena/floaters";
import type { ThemeSpec } from "../runtime/adapters/auto-battler-theme";
import type { UnitModelSource } from "../render3d/tide-arena/unit-models";
import { detectEnvFromBrowser, resolveTier } from "../render3d/tiers";
import type { Timeline } from "../render3d/tide-arena/timeline";

type TideArenaSceneProps = {
  ownBoard: Array<Piece | null>;
  ownBench: Array<Piece | null>;
  enemyBoard: Array<Piece | null>;
  hp?: Map<string, number>;
  floaters?: FloaterEvent[];
  /** HP as of the replay clock (HP bars); falls back to `hp`. */
  liveHp?: Map<string, number>;
  replay?: Timeline | null;
  replaySpeed?: number;
  skipToken?: number;
  onReplayTime?: (ms: number, done: boolean) => void;
  dragEnabled: boolean;
  boardFull?: boolean;
  mobile: boolean;
  safe: { top: number; bottom: number; left: number; right: number };
  onAction: (type: string, payload: Record<string, unknown>) => void;
  onDrag: (state: { dragging: boolean; overSell: boolean }) => void;
  /** Resolved visual theme (palette / table / light / camera / unit scale). */
  theme?: ThemeSpec;
  /** Project-imported GLBs (same list SceneHost uses). */
  importedModels?: readonly UnitModelSource[];
};

declare global {
  interface Window {
    __tideArena?: {
      perf: () => { calls: number; triangles: number; peakCalls: number; peakTriangles: number };
      screenOf: TideArenaScene["screenOf"];
      tier: string;
      frameStats: () => { frames: number; meanMs: number; p95Ms: number };
      seekReplay: (ms: number) => boolean;
      firstVfxAt: (preset: string) => number;
      replayMs: () => number;
      dataReplay: () => string | null;
    };
  }
}

export default function TideArenaScene3D(props: TideArenaSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<TideArenaScene | null>(null);
  const cbRef = useRef(props);
  cbRef.current = props;
  const [anchors, setAnchors] = useState<TokenAnchor[]>([]);
  const [labels, setLabels] = useState<{ tide: { x: number; y: number }; bench: { x: number; y: number } } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const tier = resolveTier({ env: detectEnvFromBrowser() });
    const scene = new TideArenaScene(canvas, tier.caps, {
      onAction: (type, payload) => cbRef.current.onAction(type, payload),
      onDrag: (state) => cbRef.current.onDrag(state),
      onAnchors: setAnchors,
      onLabels: setLabels,
      onReplayTime: (ms, done) => cbRef.current.onReplayTime?.(ms, done),
    }, props.theme, props.importedModels ?? []);
    sceneRef.current = scene;
    window.__tideArena = {
      perf: () => scene.perf(),
      screenOf: (slot) => scene.screenOf(slot),
      tier: tier.tier,
      frameStats: () => {
        const s = [...scene.frameSamples].sort((a, b) => a - b);
        const mean = s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0;
        return { frames: s.length, meanMs: mean, p95Ms: s[Math.floor(s.length * 0.95)] ?? 0 };
      },
      seekReplay: (ms) => scene.seekReplay(ms),
      firstVfxAt: (preset) => scene.firstVfxAt(preset),
      replayMs: () => scene.getReplayMs(),
      dataReplay: () => document.querySelector('[data-replay]')?.getAttribute("data-replay") ?? null,
    };
    return () => {
      scene.dispose();
      sceneRef.current = null;
      delete window.__tideArena;
    };
  }, [props.theme, props.importedModels]);

  const safeKey = `${props.safe.top}:${props.safe.bottom}:${props.safe.left}:${props.safe.right}:${props.mobile}`;
  useEffect(() => {
    const host = hostRef.current;
    const scene = sceneRef.current;
    if (!host || !scene) return;
    const apply = () => {
      scene.resize(host.clientWidth, host.clientHeight, cbRef.current.mobile, cbRef.current.safe);
      scene.setView(viewOf(cbRef.current));
    };
    apply();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(apply);
    ro?.observe(host);
    return () => ro?.disconnect();
  }, [safeKey]);

  useEffect(() => {
    sceneRef.current?.setView(viewOf(props));
  }, [props.ownBoard, props.ownBench, props.enemyBoard, props.hp, props.dragEnabled, props.boardFull]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (props.replay) scene.playReplay(props.replay, cbRef.current.replaySpeed ?? 1);
    else scene.stopReplay();
  }, [props.replay]);
  useEffect(() => sceneRef.current?.setReplaySpeed(props.replaySpeed ?? 1), [props.replaySpeed]);
  useEffect(() => {
    if (props.skipToken) sceneRef.current?.skipReplay();
  }, [props.skipToken]);

  const stacked = useMemo(() => stackFloaters(props.floaters ?? [], 2), [props.floaters]);
  const byUid = useMemo(() => {
    const map = new Map<string, typeof stacked>();
    for (const f of stacked) map.set(f.uid, [...(map.get(f.uid) ?? []), f]);
    return map;
  }, [stacked]);

  // Screen-space de-overlap: neighbouring cells' number stacks never collide.
  const lift = useMemo(() => resolveFloaterLift(anchors, byUid), [anchors, byUid]);

  return (
    <div className="ta-scene" ref={hostRef}>
      <canvas ref={canvasRef} className="ta-canvas" aria-label="潮阵 3D 棋盘" data-testid="tide-arena-canvas" />
      <div className="ta-overlay" aria-hidden>
        {anchors.map((a) => {
          const hp = props.liveHp?.get(a.uid) ?? (props.replay ? a.maxHp : a.hp);
          if (hp <= 0) return null;
          const damaged = hp < a.maxHp;
          // Mobile: back-row bars only when damaged; bench never shows bars.
          const showBar = !a.onBench && (!props.mobile || !a.backRow || damaged);
          const pct = Math.max(0, Math.min(1, hp / Math.max(1, a.maxHp)));
          return (
            <div
              key={a.uid}
              className={`ta-anchor${a.own ? " is-own" : " is-enemy"}`}
              data-on-bench={a.onBench ? "1" : "0"}
              style={{ left: a.x, top: a.y }}
            >
              {(byUid.get(a.uid) ?? []).map((f) => (
                <span key={`${f.slot}`} className={`ta-floater is-${f.kind}`} style={{ bottom: f.offsetPx + (lift.get(a.uid) ?? 0) }}>
                  {f.text}
                </span>
              ))}
              {showBar ? (
                <span className={`ta-hp${props.mobile && a.backRow ? " is-thin" : ""}`}>
                  <i style={{ width: `${pct * 100}%` }} />
                </span>
              ) : null}
              <span className={`ta-stars${(a.stars ?? 1) >= 2 ? " is-star2" : " is-star1"}`} data-stars={a.stars ?? 1}>
                {"★".repeat(Math.max(1, Math.min(3, a.stars ?? 1)))}
              </span>
            </div>
          );
        })}
        {labels ? (
          <>
            <span className="ta-label is-tide" style={{ left: labels.tide.x, top: labels.tide.y }}>潮线</span>
            <span className="ta-label is-bench" style={{ left: labels.bench.x, top: labels.bench.y }}>备战席</span>
          </>
        ) : null}
      </div>
    </div>
  );
}

function viewOf(p: TideArenaSceneProps) {
  return {
    ownBoard: p.ownBoard,
    ownBench: p.ownBench,
    enemyBoard: p.enemyBoard,
    hp: p.hp,
    dragEnabled: p.dragEnabled,
    boardFull: Boolean(p.boardFull),
  };
}
