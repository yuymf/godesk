/**
 * 音频后端接口：引擎只依赖这层，测试用假实现，浏览器用 howler（howler-backend.ts）。
 */
import type { SpriteMap } from "./sources";

export type ContextState = "suspended" | "running" | "closed" | "interrupted" | "unavailable";

export type SpriteHandle = {
  play(fragment: string, volume: number): boolean;
  hasFragment(fragment: string): boolean;
  unload(): void;
};

export type LoopHandle = {
  play(): void;
  stop(): void;
  setVolume(volume: number): void;
  unload(): void;
};

export type AudioBackend = {
  /** 创建（或取得）AudioContext；首次手势前通常为 suspended */
  ensureContext(): void;
  contextState(): ContextState;
  /** 订阅 AudioContext 状态变化（statechange）；返回取消订阅函数 */
  onContextStateChange(listener: (state: ContextState) => void): () => void;
  /** 首次用户手势里调用：恢复 AudioContext */
  resume(): Promise<void>;
  setMuted(muted: boolean): void;
  loadSprite(url: string, sprite: SpriteMap): SpriteHandle;
  loadLoop(url: string): LoopHandle;
};
