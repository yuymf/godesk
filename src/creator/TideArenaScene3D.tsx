/**
 * Tide Arena / 潮阵 — lazy 3D stage: canvas + DOM overlay (HP bars, star pips,
 * vertically stacked floaters). Exposes `window.__tideArena` for e2e/perf.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { Piece } from "../runtime/adapters/auto-battler";
import { TideArenaScene, type TokenAnchor } from "../render3d/tide-arena/scene";
import { stackFloaters, type FloaterEvent } from "../render3d/tide-arena/floaters";
import { detectEnvFromBrowser, resolveTier } from "../render3d/tiers";

export type TideArenaSceneProps = {
  ownBoard: Array<Piece | null>;
  ownBench: Array<Piece | null>;
  enemyBoard: Array<Piece | null>;
  hp?: Map<string, number>;
  floaters?: FloaterEvent[];
  dragEnabled: boolean;
  mobile: boolean;
  safe: { top: number; bottom: number; left: number; right: number };
  onAction: (type: string, payload: Record<string, unknown>) => void;
  onDrag: (state: { dragging: boolean; overSell: boolean }) => void;
};

declare global {
  interface Window {
    __tideArena?: {
      perf: () => { calls: number; triangles: number; peakCalls: number; peakTriangles: number };
      screenOf: TideArenaScene["screenOf"];
      tier: string;
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const tier = resolveTier({ env: detectEnvFromBrowser() });
    const scene = new TideArenaScene(canvas, tier.caps, {
      onAction: (type, payload) => cbRef.current.onAction(type, payload),
      onDrag: (state) => cbRef.current.onDrag(state),
      onAnchors: setAnchors,
    });
    sceneRef.current = scene;
    window.__tideArena = { perf: () => scene.perf(), screenOf: (slot) => scene.screenOf(slot), tier: tier.tier };
    return () => {
      scene.dispose();
      sceneRef.current = null;
      delete window.__tideArena;
    };
  }, []);

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
  }, [props.ownBoard, props.ownBench, props.enemyBoard, props.hp, props.dragEnabled]);

  const stacked = useMemo(() => stackFloaters(props.floaters ?? []), [props.floaters]);
  const byUid = useMemo(() => {
    const map = new Map<string, typeof stacked>();
    for (const f of stacked) map.set(f.uid, [...(map.get(f.uid) ?? []), f]);
    return map;
  }, [stacked]);

  return (
    <div className="ta-scene" ref={hostRef}>
      <canvas ref={canvasRef} className="ta-canvas" aria-label="潮阵 3D 棋盘" data-testid="tide-arena-canvas" />
      <div className="ta-overlay" aria-hidden>
        {anchors.map((a) => {
          const damaged = a.hp < a.maxHp;
          // Mobile: back-row bars only when damaged; bench never shows bars.
          const showBar = !a.onBench && (!props.mobile || !a.backRow || damaged);
          const pct = Math.max(0, Math.min(1, a.hp / Math.max(1, a.maxHp)));
          return (
            <div
              key={a.uid}
              className={`ta-anchor${a.own ? " is-own" : " is-enemy"}`}
              data-on-bench={a.onBench ? "1" : "0"}
              style={{ left: a.x, top: a.y }}
            >
              {(byUid.get(a.uid) ?? []).map((f) => (
                <span key={`${f.slot}`} className={`ta-floater is-${f.kind}`} style={{ bottom: f.offsetPx }}>
                  {f.text}
                </span>
              ))}
              {showBar ? (
                <span className={`ta-hp${props.mobile && a.backRow ? " is-thin" : ""}`}>
                  <i style={{ width: `${pct * 100}%` }} />
                </span>
              ) : null}
              <span className="ta-stars">★</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function viewOf(p: TideArenaSceneProps) {
  return { ownBoard: p.ownBoard, ownBench: p.ownBench, enemyBoard: p.enemyBoard, hp: p.hp, dragEnabled: p.dragEnabled };
}
