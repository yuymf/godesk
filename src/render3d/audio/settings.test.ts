import { describe, expect, it } from "vitest";
import { AUDIO_SETTINGS_STORAGE_KEY, DEFAULT_AUDIO_SETTINGS, loadAudioSettings, normalizeAudioSettings, saveAudioSettings } from "./settings";

function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
}

describe("audio settings", () => {
  it("defaults: sound on, music 60%, sfx 80%, theme track (§4.8)", () => {
    expect(DEFAULT_AUDIO_SETTINGS).toEqual({ enabled: true, music: 0.6, sfx: 0.8, track: "theme" });
    expect(loadAudioSettings(memoryStorage())).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(loadAudioSettings(null)).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it("round-trips through storage", () => {
    const storage = memoryStorage();
    saveAudioSettings({ enabled: false, music: 0.25, sfx: 1, track: "finale" }, storage);
    expect(JSON.parse(storage.data.get(AUDIO_SETTINGS_STORAGE_KEY)!)).toEqual({ enabled: false, music: 0.25, sfx: 1, track: "finale" });
    expect(loadAudioSettings(storage)).toEqual({ enabled: false, music: 0.25, sfx: 1, track: "finale" });
  });

  it("clamps and repairs bad values", () => {
    expect(normalizeAudioSettings({ enabled: "yes", music: 7, sfx: -1, track: "jazz" })).toEqual({ enabled: true, music: 1, sfx: 0, track: "theme" });
    const storage = memoryStorage();
    storage.setItem(AUDIO_SETTINGS_STORAGE_KEY, "{not json");
    expect(loadAudioSettings(storage)).toEqual(DEFAULT_AUDIO_SETTINGS);
  });
});
