import type { RuleSystem } from "../project-contract";
import { GENERATOR_VERSION, RULES_VERSION, refreshGameSpec, type GameSpec } from "../game-spec";

export const BASELINE_PROMPTS = [
  "做一款可以与电脑对战的卡坦岛基础版",
  "做一款可以与电脑对战的黑白棋",
] as const;

/** Contract fixtures, not executable implementations or generated success claims. */
export function structuredSpecFixture(kind: "hex" | "grid" | "network"): GameSpec {
  return {
    schemaVersion: 1, ruleSystemId: `fixture-${kind}`, ruleSystemVersion: 1,
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
    presentation: { theme: "conversation" },
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
    presentation: { theme: "othello" },
    runtimeSupport: {
      status: "executable", unsupported: [],
      kernel: { type: "disc-flipping-v1", playerCount: 2, rows: 8, cols: 8 },
    },
  };
  refreshGameSpec(rule);
  return rule;
}
