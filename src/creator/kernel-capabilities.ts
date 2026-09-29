import type { RuleSystem } from "./project-contract";

type KernelType = Extract<RuleSystem["runtimeSupport"], { status: "executable" }>["kernel"]["type"];

/** Only capabilities implemented by worker/runtime.ts and its deterministic adapters. */
export const KERNEL_CAPABILITIES = {
  "score-race-v1": ["point-actions"],
  "shared-goal-v1": ["shared-progress"],
  "turn-taking-v1": ["turn-budget"],
  "take-away-v1": ["shared-pool-removal"],
  "roll-and-move-v1": ["seeded-dice", "linear-movement"],
  "draw-and-score-v1": ["seeded-deck", "draw-scoring"],
  "push-your-luck-v1": ["seeded-dice", "bust-and-bank"],
  "harbor-voyage-v1": ["harbor-placement"],
  "worker-placement-v1": ["region-capacity", "worker-allocation"],
  "hidden-role-v1": ["private-roles", "accusation", "speech-log"],
  "hand-play-v1": ["seeded-deck", "private-hands", "card-play-scoring"],
  "conversation-relay-v1": ["speech-log", "turn-budget"],
} satisfies Record<KernelType, readonly string[]>;

/** Mechanics are declarations, independent of a game's title or source language. */
export const MECHANIC_CAPABILITIES: Record<string, readonly string[]> = {
  "point-race": ["point-actions"],
  "shared-goal": ["shared-progress"],
  "turn-taking": ["turn-budget"],
  "take-away": ["shared-pool-removal"],
  "roll-and-move": ["seeded-dice", "linear-movement"],
  "draw-and-score": ["seeded-deck", "draw-scoring"],
  "push-your-luck": ["seeded-dice", "bust-and-bank"],
  "harbor-placement": ["harbor-placement"],
  "worker-placement": ["region-capacity", "worker-allocation"],
  "hidden-role": ["private-roles", "accusation"],
  "hand-play": ["private-hands", "card-play-scoring"],
  "conversation": ["speech-log", "turn-budget"],
  "hex-settlement": ["hex-topology", "resource-production", "player-trading", "network-building"],
  "disc-flipping": ["grid-placement", "directional-flips", "forced-pass", "terminal-disc-count"],
};

export function kernelCapabilities(kernelType: string): readonly string[] | undefined {
  return Object.hasOwn(KERNEL_CAPABILITIES, kernelType)
    ? KERNEL_CAPABILITIES[kernelType as KernelType] : undefined;
}

export function kernelScoringHook(kernelType: string): string | null {
  return kernelCapabilities(kernelType) ? `${kernelType}: authoritative outcome` : null;
}

export function mechanicsCapabilityGap(mechanics: readonly string[], kernelType?: string | null): string | null {
  const unknown = mechanics.filter((mechanic) => !Object.hasOwn(MECHANIC_CAPABILITIES, mechanic));
  const required = [...new Set(mechanics.flatMap((mechanic) =>
    Object.hasOwn(MECHANIC_CAPABILITIES, mechanic) ? MECHANIC_CAPABILITIES[mechanic] : []))];
  const candidates: readonly (readonly string[])[] = kernelType === undefined
    ? Object.values(KERNEL_CAPABILITIES) : [kernelType ? kernelCapabilities(kernelType) ?? [] : []];
  if (!unknown.length && candidates.some((capabilities) => required.every((capability) => capabilities.includes(capability)))) return null;
  return `能力缺口：声明的机制 ${mechanics.join(", ")} 需要 ${[...required, ...unknown.map((name) => `unknown mechanic: ${name}`)].join(", ")}；当前没有对应 Executable Kernel，不能生成可玩版本。`;
}

/** Existing source guards now produce declarations consumed by the same registry. */
export function inferRequestedMechanics(corpus: string): string[] {
  const mechanics: string[] = [];
  if (/\bcatan\b|settlecoast|卡坦|卡版|六角.*(?:资源|建造)|hex.*(?:resource|build)/i.test(corpus)) mechanics.push("hex-settlement");
  if (/\bothello\b|\breversi\b|黑白棋|翻转棋|翻子|flipp?ing.*dis[ck]|dis[ck].*flipp?ing/i.test(corpus)) mechanics.push("disc-flipping");
  return mechanics;
}
