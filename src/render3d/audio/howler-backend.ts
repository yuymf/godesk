/**
 * howler 2.2.4 后端（core 构建）。只在音频 chunk 里被动态加载。
 */
import { Howl, Howler } from "howler/dist/howler.core.min.js";
import type { AudioBackend, ContextState, LoopHandle, SpriteHandle } from "./backend";
import type { SpriteMap } from "./sources";

export function createHowlerBackend(): AudioBackend {
  return {
    ensureContext() {
      // Howler.volume() 会在没有 AudioContext 时创建它（不播放任何声音）。
      Howler.volume(Howler.volume());
    },
    contextState(): ContextState {
      const ctx = Howler.ctx as AudioContext | null | undefined;
      return ctx ? (ctx.state as ContextState) : "unavailable";
    },
    onContextStateChange(listener) {
      const ctx = Howler.ctx as AudioContext | null | undefined;
      if (!ctx) return () => undefined;
      const handler = () => listener(ctx.state as ContextState);
      ctx.addEventListener("statechange", handler);
      return () => ctx.removeEventListener("statechange", handler);
    },
    async resume() {
      const ctx = Howler.ctx as AudioContext | null | undefined;
      if (ctx && ctx.state !== "running") await ctx.resume();
    },
    setMuted(muted) {
      Howler.mute(muted);
    },
    loadSprite(url: string, sprite: SpriteMap): SpriteHandle {
      const howl = new Howl({ src: [url], sprite, preload: true });
      return {
        play(fragment, volume) {
          if (!(fragment in sprite)) return false;
          const id = howl.play(fragment);
          howl.volume(volume, id);
          return true;
        },
        hasFragment: (fragment) => fragment in sprite,
        unload: () => howl.unload(),
      };
    },
    loadLoop(url: string): LoopHandle {
      const howl = new Howl({ src: [url], loop: true, preload: true, volume: 0 });
      return {
        play() {
          if (!howl.playing()) howl.play();
        },
        stop: () => howl.stop(),
        setVolume: (volume) => howl.volume(volume),
        unload: () => howl.unload(),
      };
    },
  };
}
