import { describe, expect, it } from "vitest";
import { materializeRulebookDefinition } from "./rulebook-generation";

describe("rulebook definition materialization", () => {
  it("extracts editable structure and anchors it to the uploaded rulebook", () => {
    const definition = materializeRulebookDefinition({
      name: "Harbor Traders",
      description: "A 3 player trading game in 45 minutes.",
      sourceId: "source_test",
      sourceText: [
        "SETUP Place the harbor board in the center and shuffle 24 cargo cards.",
        "Each player may bid for one ship and move a cargo marker.",
        "VOYAGE PHASE Players take turns placing workers in harbor zones.",
        "The winner is the player with the most coins after three voyages.",
      ].join("\n"),
    });
    expect(definition).toMatchObject({ playerCount: 3, durationMinutes: 45 });
    expect(definition.rules.length).toBeGreaterThan(2);
    expect(definition.actions.length).toBeGreaterThan(0);
    expect(definition.components.length).toBeGreaterThan(0);
    expect(definition.rules[0].sourceId).toBe("source_test");
    expect(definition.actions[0]).toMatchObject({
      id: "source-action-1",
      sourceId: "source_test",
      provenance: "source-anchored",
    });
  });
});
