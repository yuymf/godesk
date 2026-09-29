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
