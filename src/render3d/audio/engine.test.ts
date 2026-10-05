import { describe, expect, it } from "vitest";
import type { AudioBackend, ContextState } from "./backend";
import { AudioEngine } from "./engine";
import { DEFAULT_AUDIO_SETTINGS } from "./settings";
import { buildAudioSources, type AudioSources } from "./sources";

function fakeBackend() {
  const calls: string[] = [];
  let state: ContextState = "unavailable";
  const backend: AudioBackend = {
    ensureContext: () => { state = "suspended"; calls.push("ctx"); },
    contextState: () => state,
    onContextStateChange: () => () => undefined,
    resume: async () => { state = "running"; calls.push("resume"); },
    setMuted: (muted) => void calls.push(`muted:${muted}`),
    loadSprite: (url, sprite) => {
      calls.push(`sprite:${url}`);
      return {
        play: (fragment, volume) => { calls.push(`play:${fragment}@${volume}`); return true; },
        hasFragment: (fragment) => fragment in sprite,
        unload: () => void calls.push(`unload:${url}`),
      };
    },
    loadLoop: (url) => {
      calls.push(`loop:${url}`);
      return {
        play: () => void calls.push(`loop-play:${url}`),
        stop: () => void calls.push(`loop-stop:${url}`),
        setVolume: (v) => void calls.push(`loop-vol:${url}@${v}`),
        unload: () => void calls.push(`loop-unload:${url}`),
      };
    },
  };
  return { backend, calls };
}

const fullSources: AudioSources = buildAudioSources(
  {
    "/a/sfx-core.mp3": "/u/core.mp3",
    "/a/sfx-extended.mp3": "/u/ext.mp3",
    "/a/ambience-surf.mp3": "/u/surf.mp3",
    "/a/ambience-harbor-wind.mp3": "/u/wind.mp3",
    "/a/music-tide-harbor.mp3": "/u/m1.mp3",
    "/a/music-crystal-shore.mp3": "/u/m2.mp3",
    "/a/music-observing-star.mp3": "/u/m3.mp3",
  },
  {
    "/a/sfx-core.json": { src: ["sfx-core.mp3"], sprite: { "sfx/dice-1": [0, 10], "sfx/dice-2": [10, 10], "sfx/dice-3": [20, 10], "sfx/dice-4": [30, 10], "sfx/win": [40, 10] } },
    "/a/sfx-extended.json": { src: ["sfx-extended.mp3"], sprite: { "sfx/gain-ore": [0, 10] } },
  },
);

function timers() {
  const queue: (() => void)[] = [];
  return { setTimer: (fn: () => void) => { queue.push(fn); return queue.length; }, clearTimer: () => undefined, flush: () => queue.splice(0).forEach((fn) => fn()) };
}

describe("AudioEngine", () => {
  it("loads core before interactive, extended + ambience after, music 1 after first gesture delay", async () => {
    const { backend, calls } = fakeBackend();
    const t = timers();
    const engine = new AudioEngine({ sources: fullSources, settings: DEFAULT_AUDIO_SETTINGS, backend, ...t });
    engine.start();
    expect(calls).toEqual(["ctx", "muted:false", "sprite:/u/core.mp3"]);
    expect(engine.snapshot().contextState).toBe("suspended");
    engine.afterInteractive();
    expect(calls).toContain("sprite:/u/ext.mp3");
    expect(calls).toContain("loop:/u/surf.mp3");
    expect(calls).toContain("loop:/u/wind.mp3");
    expect(calls.some((c) => c.startsWith("loop:/u/m"))).toBe(false);
    await engine.unlock();
    expect(engine.snapshot().contextState).toBe("running");
    expect(calls).toContain("loop-play:/u/surf.mp3");
    t.flush();
    expect(calls).toContain("loop:/u/m1.mp3");
    expect(engine.snapshot().currentTrack).toBe("theme");
  });

  it("low tier loads only the surf ambience", () => {
    const { backend, calls } = fakeBackend();
    const engine = new AudioEngine({ sources: fullSources, settings: DEFAULT_AUDIO_SETTINGS, backend, lowTier: true });
    engine.start();
    engine.afterInteractive();
    expect(calls).toContain("loop:/u/surf.mp3");
    expect(calls).not.toContain("loop:/u/wind.mp3");
  });

  it("plays cue variants at sfx volume and logs every cue", () => {
    const { backend, calls } = fakeBackend();
    const engine = new AudioEngine({ sources: fullSources, settings: DEFAULT_AUDIO_SETTINGS, backend, random: () => 0.6, now: () => 42 });
    engine.start();
    engine.afterInteractive();
    expect(engine.play({ cue: "dice", source: "action:roll_dice#3" })).toMatchObject({ fragment: "sfx/dice-3", variant: 2, played: true, at: 42 });
    expect(calls).toContain("play:sfx/dice-3@0.8");
    expect(engine.play({ cue: "gain", resource: "ore", source: "x" })).toMatchObject({ fragment: "sfx/gain-ore", played: true });
    expect(engine.play({ cue: "steal", source: "x" })).toMatchObject({ played: false, reason: "asset-missing" });
    expect(engine.log.map((e) => e.cue)).toEqual(["dice", "gain", "steal"]);
  });

  it("muting stops playback but keeps logging; settings drive volumes and track switch", async () => {
    const { backend, calls } = fakeBackend();
    const t = timers();
    const engine = new AudioEngine({ sources: fullSources, settings: DEFAULT_AUDIO_SETTINGS, backend, ...t });
    engine.start();
    await engine.unlock();
    t.flush();
    engine.setSettings({ ...DEFAULT_AUDIO_SETTINGS, enabled: false });
    expect(calls).toContain("muted:true");
    expect(engine.play({ cue: "win", source: "ended" })).toMatchObject({ played: false, reason: "muted" });
    engine.setSettings({ ...DEFAULT_AUDIO_SETTINGS, music: 0.3, track: "finale" });
    expect(calls).toContain("loop-stop:/u/m1.mp3");
    expect(calls).toContain("loop:/u/m3.mp3");
    expect(calls).toContain("loop-vol:/u/m3.mp3@0.3");
    expect(engine.snapshot().currentTrack).toBe("finale");
  });

  it("works without any audio files (assets not merged yet)", async () => {
    const { backend } = fakeBackend();
    const engine = new AudioEngine({ sources: buildAudioSources({}, {}), settings: DEFAULT_AUDIO_SETTINGS, backend });
    engine.start();
    engine.afterInteractive();
    await engine.unlock();
    expect(engine.play({ cue: "place", source: "x" })).toMatchObject({ played: false, reason: "asset-missing" });
    expect(engine.snapshot().loaded).toEqual({ core: false, extended: false, ambience: 0, music: [] });
  });

  it("dispose unloads everything", () => {
    const { backend, calls } = fakeBackend();
    const engine = new AudioEngine({ sources: fullSources, settings: DEFAULT_AUDIO_SETTINGS, backend });
    engine.start();
    engine.afterInteractive();
    engine.dispose();
    expect(calls).toEqual(expect.arrayContaining(["unload:/u/core.mp3", "unload:/u/ext.mp3", "loop-unload:/u/surf.mp3"]));
    expect(engine.play({ cue: "win", source: "x" })).toMatchObject({ played: false, reason: "disposed" });
  });
});
