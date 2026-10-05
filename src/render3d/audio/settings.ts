/**
 * G3D-10：声音设置（SPEC §4.8）。
 * 结构对照 settlecoast.com 登录实测（2026-10-05）：总开关 + 音乐音量 + 曲目选择；
 * GoDesk 另加音效音量。文案自拟。存 localStorage，刷新后保持。
 */

export const MUSIC_TRACKS = [
  { id: "theme", label: "主题" },
  { id: "calm", label: "平稳" },
  { id: "finale", label: "终局" },
] as const;

export type MusicTrackId = (typeof MUSIC_TRACKS)[number]["id"];

export type AudioSettings = {
  /** 总开关「声音」 */
  enabled: boolean;
  /** 音乐音量 0–1，默认 0.6 */
  music: number;
  /** 音效音量 0–1，默认 0.8 */
  sfx: number;
  track: MusicTrackId;
};

export const DEFAULT_AUDIO_SETTINGS: Readonly<AudioSettings> = Object.freeze({
  enabled: true,
  music: 0.6,
  sfx: 0.8,
  track: "theme",
});

export const AUDIO_SETTINGS_STORAGE_KEY = "godesk.audio.v1";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function clampUnit(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, Math.round(value * 100) / 100));
}

export function normalizeAudioSettings(raw: unknown): AudioSettings {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const track = MUSIC_TRACKS.some((entry) => entry.id === value.track)
    ? (value.track as MusicTrackId)
    : DEFAULT_AUDIO_SETTINGS.track;
  return {
    enabled: typeof value.enabled === "boolean" ? value.enabled : DEFAULT_AUDIO_SETTINGS.enabled,
    music: clampUnit(value.music, DEFAULT_AUDIO_SETTINGS.music),
    sfx: clampUnit(value.sfx, DEFAULT_AUDIO_SETTINGS.sfx),
    track,
  };
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadAudioSettings(storage: StorageLike | null = defaultStorage()): AudioSettings {
  if (!storage) return { ...DEFAULT_AUDIO_SETTINGS };
  try {
    const raw = storage.getItem(AUDIO_SETTINGS_STORAGE_KEY);
    return raw ? normalizeAudioSettings(JSON.parse(raw)) : { ...DEFAULT_AUDIO_SETTINGS };
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

export function saveAudioSettings(settings: AudioSettings, storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(normalizeAudioSettings(settings)));
  } catch {
    // 隐私模式或配额满：静默失败，设置只在本次会话生效。
  }
}
