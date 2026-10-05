/**
 * G3D-10 音频引擎：cue → sprite 片段、环境声、音乐、声音设置、首次手势解锁。
 *
 * 加载时机（§4.8）：
 * - 核心 sprite：引擎启动即加载（可交互前）；
 * - 扩展 sprite + 环境声：`afterInteractive()`（可交互后）；
 * - 音乐第 1 首：首次用户手势后 5 秒懒加载；其余曲目在用户选择时加载。
 *
 * 每次 cue 都写入有界日志（`window.__godeskAudio.log`），便于 e2e 断言。
 * 素材缺失时照常记日志（`reason: "asset-missing"`），不抛错。
 */
import type { AudioBackend, ContextState, LoopHandle, SpriteHandle } from "./backend";
import { CORE_SPRITE_CUES, DEFAULT_CUE_FRAGMENTS, pickVariantIndex, type CueId, type CueRequest } from "./cues";
import { MUSIC_TRACKS, type AudioSettings } from "./settings";
import type { AudioSources } from "./sources";

export type CueLogEntry = {
  cue: CueId;
  source: string;
  fragment: string;
  variant: number;
  played: boolean;
  reason?: "muted" | "asset-missing" | "disposed";
  at: number;
};

export type AudioEngineSnapshot = {
  contextState: ContextState;
  settings: AudioSettings;
  loaded: { core: boolean; extended: boolean; ambience: number; music: string[] };
  currentTrack: string | null;
};

export type AudioEngineOptions = {
  sources: AudioSources;
  settings: AudioSettings;
  backend: AudioBackend;
  /** 关闭时只加载第一条环境声（low 档，§4.8） */
  lowTier?: boolean;
  musicDelayMs?: number;
  random?: () => number;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  logLimit?: number;
};

const AMBIENCE_GAIN = 0.5;

export class AudioEngine {
  readonly log: CueLogEntry[] = [];
  private settings: AudioSettings;
  private core: SpriteHandle | null = null;
  private extended: SpriteHandle | null = null;
  private ambience: LoopHandle[] = [];
  private music = new Map<string, LoopHandle>();
  private currentTrack: string | null = null;
  private unlocked = false;
  private musicTimer: unknown = null;
  private disposed = false;
  private readonly opts: Required<Omit<AudioEngineOptions, "settings" | "lowTier">> & { lowTier: boolean };

  constructor(options: AudioEngineOptions) {
    this.settings = { ...options.settings };
    this.opts = {
      sources: options.sources,
      backend: options.backend,
      lowTier: options.lowTier ?? false,
      musicDelayMs: options.musicDelayMs ?? 5_000,
      random: options.random ?? Math.random,
      now: options.now ?? (() => Date.now()),
      setTimer: options.setTimer ?? ((fn, ms) => setTimeout(fn, ms)),
      clearTimer: options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>)),
      logLimit: options.logLimit ?? 200,
    };
  }

  /** 创建 AudioContext 并加载核心 sprite（可交互前）。 */
  start(): void {
    const { backend, sources } = this.opts;
    backend.ensureContext();
    backend.setMuted(!this.settings.enabled);
    if (sources.core && !this.core) this.core = backend.loadSprite(sources.core.url, sources.core.sprite);
  }

  /** 可交互后：扩展 sprite + 环境声。 */
  afterInteractive(): void {
    if (this.disposed) return;
    const { backend, sources, lowTier } = this.opts;
    if (sources.extended && !this.extended) {
      this.extended = backend.loadSprite(sources.extended.url, sources.extended.sprite);
    }
    if (this.ambience.length === 0) {
      const loops = lowTier ? sources.ambience.slice(0, 1) : sources.ambience;
      this.ambience = loops.map((loop) => backend.loadLoop(loop.url));
      this.applyLoopVolumes();
      if (this.unlocked) this.ambience.forEach((loop) => loop.play());
    }
  }

  /** 首次用户手势：恢复 AudioContext，开始环境声，5 秒后懒加载第 1 首音乐。 */
  async unlock(): Promise<void> {
    if (this.unlocked || this.disposed) return;
    this.unlocked = true;
    await this.opts.backend.resume().catch(() => undefined);
    this.ambience.forEach((loop) => loop.play());
    this.musicTimer = this.opts.setTimer(() => {
      this.musicTimer = null;
      this.playTrack(this.settings.track);
    }, this.opts.musicDelayMs);
  }

  play(request: CueRequest): CueLogEntry {
    const fragments = DEFAULT_CUE_FRAGMENTS[request.cue];
    const variant = pickVariantIndex(request, fragments.length, this.opts.random);
    const fragment = fragments[variant] ?? fragments[0];
    const sprite = CORE_SPRITE_CUES.has(request.cue) ? this.core : this.extended;
    let played = false;
    let reason: CueLogEntry["reason"];
    if (this.disposed) reason = "disposed";
    else if (!this.settings.enabled) reason = "muted";
    else if (!sprite || !sprite.hasFragment(fragment)) reason = "asset-missing";
    else played = sprite.play(fragment, this.settings.sfx);
    if (!played && !reason) reason = "asset-missing";
    const entry: CueLogEntry = {
      cue: request.cue,
      source: request.source,
      fragment,
      variant,
      played,
      ...(reason ? { reason } : {}),
      at: this.opts.now(),
    };
    this.log.push(entry);
    if (this.log.length > this.opts.logLimit) this.log.splice(0, this.log.length - this.opts.logLimit);
    return entry;
  }

  /** 订阅 AudioContext 状态变化（需在 start() 之后调用）。 */
  onContextStateChange(listener: (state: ContextState) => void): () => void {
    return this.opts.backend.onContextStateChange(listener);
  }

  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  setSettings(next: AudioSettings): void {
    const prev = this.settings;
    this.settings = { ...next };
    if (prev.enabled !== next.enabled) this.opts.backend.setMuted(!next.enabled);
    this.applyLoopVolumes();
    if (prev.track !== next.track && this.currentTrack !== null) this.playTrack(next.track);
  }

  snapshot(): AudioEngineSnapshot {
    return {
      contextState: this.opts.backend.contextState(),
      settings: this.getSettings(),
      loaded: {
        core: this.core !== null,
        extended: this.extended !== null,
        ambience: this.ambience.length,
        music: [...this.music.keys()],
      },
      currentTrack: this.currentTrack,
    };
  }

  dispose(): void {
    this.disposed = true;
    if (this.musicTimer !== null) this.opts.clearTimer(this.musicTimer);
    this.core?.unload();
    this.extended?.unload();
    this.ambience.forEach((loop) => loop.unload());
    this.music.forEach((loop) => loop.unload());
    this.core = null;
    this.extended = null;
    this.ambience = [];
    this.music.clear();
  }

  private playTrack(trackId: AudioSettings["track"]): void {
    if (this.disposed) return;
    const index = MUSIC_TRACKS.findIndex((track) => track.id === trackId);
    const source = this.opts.sources.music[index] ?? null;
    if (this.currentTrack && this.currentTrack !== trackId) this.music.get(this.currentTrack)?.stop();
    this.currentTrack = trackId;
    if (!source) return;
    let loop = this.music.get(trackId);
    if (!loop) {
      loop = this.opts.backend.loadLoop(source.url);
      this.music.set(trackId, loop);
    }
    loop.setVolume(this.settings.music);
    loop.play();
  }

  private applyLoopVolumes(): void {
    for (const loop of this.ambience) loop.setVolume(this.settings.music * AMBIENCE_GAIN);
    if (this.currentTrack) this.music.get(this.currentTrack)?.setVolume(this.settings.music);
  }
}
