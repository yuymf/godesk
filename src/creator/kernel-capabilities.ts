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
  "disc-flipping-v1": ["grid-placement", "directional-flips", "forced-pass", "terminal-disc-count"],
  "hex-settlement-v1": ["hex-topology", "resource-production", "player-trading", "network-building"],
  "network-route-v1": ["graph-topology", "route-claiming", "path-connectivity"],
  "auction-bidding-v1": ["bid-pass-resolution", "award-selection", "seeded-draw"],
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
  "route-network": ["graph-topology", "route-claiming", "path-connectivity"],
  "auction-bidding": ["bid-pass-resolution", "award-selection", "seeded-draw"],
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
  if (/拍卖|竞价|出价|\bauction\b|\bbid(?:s|ding)?\b/i.test(corpus)) return ["auction-bidding"];
  if (/\bcatan\b|settlecoast|卡坦|卡版|六角.*(?:资源|建造)|hex.*(?:resource|build)/i.test(corpus)) mechanics.push("hex-settlement");
  if (/\bothello\b|\breversi\b|黑白棋|翻转棋|翻子|flipp?ing.*dis[ck]|dis[ck].*flipp?ing/i.test(corpus)) mechanics.push("disc-flipping");
  // Line / route network (PR11) — must not also match hex or disc cues above.
  if (/线路网络|路线连接|铺设路线|连接城市|route\s*network|connect(?:ing)?\s+cities|claim(?:ing)?\s+routes/i.test(corpus)) {
    mechanics.push("route-network");
  }
  // Card / area-control (PR12) — reuse hand-play-v1; never also match hex/disc/route above.
  if (
    /卡牌区域控制|出牌争夺区域|区域控制.*(?:卡牌|出牌)|area[- ]?control|play(?:ing)? cards?.*(area|region|zone)|claim(?:ing)? areas? with cards?/i.test(
      corpus,
    )
  ) {
    mechanics.push("hand-play");
  }
  return mechanics;
}
