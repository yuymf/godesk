import type { RuleSystem } from "../project-contract";
import { GENERATOR_VERSION, RULES_VERSION, refreshGameSpec, type GameSpec } from "../game-spec";
import { defaultRenderSpec } from "../render-spec";

export const BASELINE_PROMPTS = [
  "做一款可以与电脑对战的汐屿基础版",
  "做一款可以与电脑对战的黑白棋",
] as const;

/** Contract fixtures, not executable implementations or generated success claims. */
export function structuredSpecFixture(kind: "hex" | "grid" | "network"): GameSpec {
  return {
    schemaVersion: 2, ruleSystemId: `fixture-${kind}`, ruleSystemVersion: 1,
    name: `${kind} contract fixture`,
    generation: {
      generatorVersion: GENERATOR_VERSION, rulesVersion: RULES_VERSION,
      sourcePrompt: kind === "hex" ? BASELINE_PROMPTS[0] : kind === "grid" ? BASELINE_PROMPTS[1] : "Connect stations by routes",
      seed: 42, assumptions: ["Contract example only; the executable adapter is unavailable."],
    },
    players: { min: 2, max: kind === "hex" ? 4 : 2, default: 2, visibility: "public" },
    objects: [{ id: "piece", name: "Piece", kind: "token", visibility: "public", regionId: "surface" }],
    regions: [{ id: "surface", name: kind, visibility: "public" }],
    relationships: [{ from: "piece", to: "surface", kind: "occupies" }],
    setup: ["Place the initial pieces according to the selected rules version."],
    actions: [{ id: "place", label: "Place", description: "Place a legal piece", phaseIds: ["turn"] }],
    phases: [{ id: "turn", name: "Player turn" }],
    endConditions: [{ id: "end", description: kind === "grid" ? "Neither player has a legal move" : "The source-defined goal is met" }],
    scoring: { kind: "none", hook: null },
    presentation: { kind: "table", layout: kind },
    render: defaultRenderSpec(null, "table")!,
    execution: { kernelType: null },
  };
}

export function executableSpecFixture(): RuleSystem {
  const rule: RuleSystem = {
    id: "rule-system-fixture", version: 1, name: "Conversation", pitch: "Speak in turns",
    generation: { generatorVersion: GENERATOR_VERSION, rulesVersion: RULES_VERSION,
      sourcePrompt: "Speak in turns", assumptions: [], seed: 42, requestedMechanics: ["conversation"] },
    participants: { min: 2, max: 3, default: 3, roles: [] }, durationMinutes: 10,
    entities: [], rules: [], constraints: [], setup: [], stages: [], outcomes: [],
    actions: [{ id: "speak", label: "Speak", description: "Record a sentence", sourceId: null, provenance: "source-anchored", confidence: 1 }],
    playSurface: { kind: "conversation", layout: "conversation-relay", regions: [] },
    presentation: {},
    runtimeSupport: { status: "executable", unsupported: [], kernel: {
      type: "conversation-relay-v1", maxTurns: 12, actions: [{ id: "speak", label: "Speak" }],
    } },
  };
  refreshGameSpec(rule);
  return rule;
}


/** Executable Othello / disc-flipping RuleSystem for PR5 thin bind tests. */
export function executableOthelloSpecFixture(): RuleSystem {
  const rule: RuleSystem = {
    id: "rule-system-othello-fixture", version: 1, name: "黑白棋", pitch: "Grid disc-flipping",
    generation: {
      generatorVersion: GENERATOR_VERSION, rulesVersion: RULES_VERSION,
      sourcePrompt: BASELINE_PROMPTS[1], assumptions: ["Standard Othello / Reversi 8×8"],
      seed: 42, requestedMechanics: ["disc-flipping"],
    },
    participants: { min: 2, max: 2, default: 2, roles: [] }, durationMinutes: 15,
    entities: [
      { id: "black-disc", name: "Black disc", kind: "token", sourceId: null, provenance: "source-anchored", confidence: 1 },
      { id: "white-disc", name: "White disc", kind: "token", sourceId: null, provenance: "source-anchored", confidence: 1 },
    ],
    rules: [{ id: "flip", text: "Place a disc to flip opponent discs in eight directions", sourceId: null, provenance: "source-anchored", confidence: 1 }],
    constraints: [], setup: ["Place four discs in the center; black moves first"],
    stages: [{ id: "play", name: "Play" }, { id: "ended", name: "Ended" }],
    outcomes: [{ id: "disc-count", name: "Most discs wins" }],
    actions: [
      { id: "place", label: "Place", description: "Place a disc on a legal cell", sourceId: null, provenance: "source-anchored", confidence: 1 },
      { id: "pass", label: "Pass", description: "Pass when no legal place remains", sourceId: null, provenance: "source-anchored", confidence: 1 },
    ],
    playSurface: { kind: "table", layout: "grid-8x8", regions: [{ id: "board", name: "Board", description: "8×8 grid" }] },
    presentation: {},
    runtimeSupport: {
      status: "executable", unsupported: [],
      kernel: { type: "disc-flipping-v1", playerCount: 2, rows: 8, cols: 8 },
    },
  };
  refreshGameSpec(rule);
  return rule;
}


/** Executable Tidewell / hex-settlement RuleSystem for PR6 thin bind tests. */
export function executableTidewellSpecFixture(): RuleSystem {
  const rule: RuleSystem = {
    id: "rule-system-hexSettlement-fixture", version: 1, name: "汐屿基础版", pitch: "Hex settlement",
    generation: {
      generatorVersion: GENERATOR_VERSION, rulesVersion: RULES_VERSION,
      sourcePrompt: BASELINE_PROMPTS[0], assumptions: ["Basic Settlers beginner board"],
      seed: 42, requestedMechanics: ["hex-settlement"],
    },
    participants: { min: 2, max: 4, default: 2, roles: [] }, durationMinutes: 45,
    entities: [
      { id: "settlement", name: "Settlement", kind: "token", sourceId: null, provenance: "source-anchored", confidence: 1 },
      { id: "road", name: "Road", kind: "token", sourceId: null, provenance: "source-anchored", confidence: 1 },
      { id: "city", name: "City", kind: "token", sourceId: null, provenance: "source-anchored", confidence: 1 },
    ],
    rules: [{ id: "build", text: "Build roads and settlements on a connected hex network", sourceId: null, provenance: "source-anchored", confidence: 1 }],
    constraints: [], setup: ["Place two settlements and roads; second settlement collects resources"],
    stages: [
      { id: "setup", name: "Setup" }, { id: "roll", name: "Roll" }, { id: "discard", name: "Discard" },
      { id: "robber", name: "Robber" }, { id: "main", name: "Main" }, { id: "ended", name: "Ended" },
    ],
    outcomes: [{ id: "vp", name: "First to 10 victory points wins" }],
    actions: [
      { id: "place_settlement", label: "Place settlement", description: "Build or place a settlement", sourceId: null, provenance: "source-anchored", confidence: 1 },
      { id: "place_road", label: "Place road", description: "Build a road on an edge", sourceId: null, provenance: "source-anchored", confidence: 1 },
      { id: "place_city", label: "Place city", description: "Upgrade a settlement to a city", sourceId: null, provenance: "source-anchored", confidence: 1 },
      { id: "roll_dice", label: "Roll dice", description: "Roll production dice", sourceId: null, provenance: "source-anchored", confidence: 1 },
      { id: "end_turn", label: "End turn", description: "End the current turn", sourceId: null, provenance: "source-anchored", confidence: 1 },
    ],
    playSurface: { kind: "table", layout: "hex-radius-2", regions: [{ id: "island", name: "Island", description: "Hex settlement board" }] },
    presentation: {},
    runtimeSupport: {
      status: "executable", unsupported: [],
      kernel: { type: "hex-settlement-v1", playerCount: 2, victoryPointsToWin: 10 },
    },
  };
  refreshGameSpec(rule);
  return rule;
}


/** Executable network-route RuleSystem for PR11 thin bind tests. */
export function executableAuctionBiddingSpecFixture(): RuleSystem {
  const rule: RuleSystem = {
    id: "rule-system-auction-bidding-fixture", version: 1, name: "拍卖竞价", pitch: "轮流公开出价，竞得单件拍品",
    generation: { generatorVersion: GENERATOR_VERSION, rulesVersion: RULES_VERSION,
      sourcePrompt: "做一款拍卖竞价桌游", assumptions: ["单件拍品，公开轮流出价"],
      seed: 42, requestedMechanics: ["auction-bidding"] },
    participants: { min: 2, max: 2, default: 2, roles: [] }, durationMinutes: 10,
    entities: [{ id: "lot", name: "拍品", kind: "token", sourceId: null, provenance: "source-anchored", confidence: 1 }],
    rules: [{ id: "auction", text: "公开轮流出价或放弃；最高有效出价者获得拍品", sourceId: null, provenance: "source-anchored", confidence: 1 }],
    constraints: [], setup: ["两席各有 20 筹码；拍品价值 10"],
    stages: [{ id: "bidding", name: "竞价" }, { id: "ended", name: "结算" }],
    outcomes: [{ id: "award", name: "最高出价者获得拍品" }],
    actions: [
      { id: "bid", label: "出价", description: "提高当前出价", sourceId: null, provenance: "source-anchored", confidence: 1 },
      { id: "pass", label: "放弃", description: "放弃当前叫价", sourceId: null, provenance: "source-anchored", confidence: 1 },
    ],
    playSurface: { kind: "table", layout: "auction-table", regions: [{ id: "lot-region", name: "拍品区", description: "公开拍品与出价" }] },
    presentation: {},
    runtimeSupport: { status: "executable", unsupported: [], kernel: { type: "auction-bidding-v1", playerCount: 2 } },
  };
  refreshGameSpec(rule);
  return rule;
}
