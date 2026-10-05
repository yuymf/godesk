/**
 * G3D-10：房间音效挂载点（懒加载 chunk，含 howler core）。
 *
 * - 从房间快照差量推导 cue（cues.ts），交给 AudioEngine 播放；
 * - 房间内按钮的 hover / 点击给 `hover` / `select`，动作被拒给 `illegal`；
 * - 首次用户手势解锁 AudioContext；
 * - 声音设置面板（总开关、音乐音量、音效音量、曲目选择），存 localStorage；
 * - `window.__godeskAudio` 暴露 cue 日志与引擎快照，供 e2e 断言。
 */
import { useEffect, useRef, useState } from "react";
import { cuesForRoomDelta, type AudioRoomSnapshot, type CueRequest } from "./cues";
import type { ContextState } from "./backend";
import { AudioEngine, type AudioEngineSnapshot, type CueLogEntry } from "./engine";
import { createHowlerBackend } from "./howler-backend";
import { loadAudioSettings, MUSIC_TRACKS, saveAudioSettings, type AudioSettings, type MusicTrackId } from "./settings";
import { AUDIO_SOURCES } from "./sources";
import "./sound-settings.css";

export type RoomAudioProps = {
  room: AudioRoomSnapshot;
  seat: number | null;
  /** RoomView 的错误文案；变为非空时播放 `illegal` */
  error: string;
};

declare global {
  interface Window {
    __godeskAudio?: {
      version: 1;
      log: CueLogEntry[];
      snapshot(): AudioEngineSnapshot;
      play(request: CueRequest): CueLogEntry;
    };
  }
}

const HOVER_THROTTLE_MS = 80;
const INTERACTIVE_FALLBACK_MS = 3_000;

function roomButton(target: EventTarget | null): HTMLButtonElement | null {
  if (!(target instanceof Element)) return null;
  const button = target.closest("main.room-view button");
  if (!(button instanceof HTMLButtonElement) || button.disabled) return null;
  // 声音设置面板自己的控件另有 panel / toggle cue。
  if (button.closest("[data-sound-settings]")) return null;
  return button;
}

export default function RoomAudio({ room, seat, error }: RoomAudioProps) {
  const engineRef = useRef<AudioEngine | null>(null);
  const prevRoomRef = useRef<AudioRoomSnapshot | null>(null);
  const [settings, setSettings] = useState<AudioSettings>(() => loadAudioSettings());
  const [open, setOpen] = useState(false);
  // AudioContext 状态同步到 DOM（data-audio-context），e2e 读属性即可，不必 evaluate
  // （Playwright 的 evaluate 带用户手势，会让自动播放策略失效）。
  const [contextState, setContextState] = useState<ContextState>("unavailable");

  // 引擎生命周期
  useEffect(() => {
    const engine = new AudioEngine({ sources: AUDIO_SOURCES, settings: loadAudioSettings(), backend: createHowlerBackend() });
    engineRef.current = engine;
    engine.start();
    setContextState(engine.snapshot().contextState);
    const stopStateSync = engine.onContextStateChange(setContextState);
    window.__godeskAudio = {
      version: 1,
      log: engine.log,
      snapshot: () => engine.snapshot(),
      play: (request) => engine.play(request),
    };

    // 可交互后加载扩展 sprite 与环境声：等 render3d:interactive 标记，最多 3 秒。
    let interactiveDone = false;
    const markInteractive = () => {
      if (interactiveDone) return;
      interactiveDone = true;
      engine.afterInteractive();
    };
    const fallback = setTimeout(markInteractive, INTERACTIVE_FALLBACK_MS);
    let observer: PerformanceObserver | null = null;
    if (performance.getEntriesByName("render3d:interactive").length > 0) markInteractive();
    else if (typeof PerformanceObserver !== "undefined") {
      observer = new PerformanceObserver((list) => {
        if (list.getEntries().some((entry) => entry.name === "render3d:interactive")) markInteractive();
      });
      try {
        observer.observe({ type: "mark", buffered: true });
      } catch {
        observer = null;
      }
    }

    // 首次用户手势解锁 AudioContext。
    const unlock = () => {
      void engine.unlock();
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("touchend", unlock, true);
      window.removeEventListener("keydown", unlock, true);
    };
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("touchend", unlock, true);
    window.addEventListener("keydown", unlock, true);

    // 按钮 hover / 点击。
    let lastHover = 0;
    let lastHoverTarget: Element | null = null;
    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const button = roomButton(event.target);
      if (!button || button === lastHoverTarget) return;
      lastHoverTarget = button;
      const now = performance.now();
      if (now - lastHover < HOVER_THROTTLE_MS) return;
      lastHover = now;
      engine.play({ cue: "hover", source: "ui:hover" });
    };
    const onClick = (event: MouseEvent) => {
      if (roomButton(event.target)) engine.play({ cue: "select", source: "ui:select" });
    };
    document.addEventListener("pointerover", onPointerOver);
    document.addEventListener("click", onClick);

    return () => {
      clearTimeout(fallback);
      stopStateSync();
      observer?.disconnect();
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("touchend", unlock, true);
      window.removeEventListener("keydown", unlock, true);
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("click", onClick);
      engine.dispose();
      engineRef.current = null;
      prevRoomRef.current = null;
      if (window.__godeskAudio?.log === engine.log) delete window.__godeskAudio;
    };
  }, []);

  // 房间快照 → cue
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    for (const request of cuesForRoomDelta(prevRoomRef.current, room, seat)) engine.play(request);
    prevRoomRef.current = room;
  }, [room, seat]);

  // 动作被拒
  useEffect(() => {
    if (error) engineRef.current?.play({ cue: "illegal", source: "ui:error" });
  }, [error]);

  const update = (patch: Partial<AudioSettings>, cue?: CueRequest["cue"]) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveAudioSettings(next);
    engineRef.current?.setSettings(next);
    if (cue) engineRef.current?.play({ cue, source: "ui:settings" });
  };

  return (
    <div className="room-sound-settings" data-audio-context={contextState} data-sound-settings>
      <button
        aria-controls="room-sound-settings-panel"
        aria-expanded={open}
        className="room-sound-settings-trigger"
        onClick={() => {
          setOpen((value) => !value);
          engineRef.current?.play({ cue: "panel", source: "ui:panel" });
        }}
        type="button"
      >
        {settings.enabled ? "🔊" : "🔇"} 声音设置
      </button>
      {open ? (
        <div aria-label="声音设置" className="room-sound-settings-panel" id="room-sound-settings-panel" role="group">
          <label className="room-sound-settings-row">
            <input
              checked={settings.enabled}
              onChange={(event) => update({ enabled: event.target.checked }, "toggle")}
              type="checkbox"
            />
            声音
          </label>
          <label className="room-sound-settings-row">
            音乐音量
            <input
              aria-valuetext={`${Math.round(settings.music * 100)}%`}
              max={100}
              min={0}
              onChange={(event) => update({ music: Number(event.target.value) / 100 })}
              type="range"
              value={Math.round(settings.music * 100)}
            />
            <output>{Math.round(settings.music * 100)}%</output>
          </label>
          <label className="room-sound-settings-row">
            音效音量
            <input
              aria-valuetext={`${Math.round(settings.sfx * 100)}%`}
              max={100}
              min={0}
              onChange={(event) => update({ sfx: Number(event.target.value) / 100 })}
              type="range"
              value={Math.round(settings.sfx * 100)}
            />
            <output>{Math.round(settings.sfx * 100)}%</output>
          </label>
          <label className="room-sound-settings-row">
            曲目
            <select
              onChange={(event) => update({ track: event.target.value as MusicTrackId }, "toggle")}
              value={settings.track}
            >
              {MUSIC_TRACKS.map((track) => (
                <option key={track.id} value={track.id}>
                  {track.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
    </div>
  );
}
