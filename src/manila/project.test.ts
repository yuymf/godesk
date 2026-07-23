import { describe, expect, it } from "vitest";
import { componentGroups, goods, phaseGraph, projectSummary, ruleFacts } from "./project";

describe("Manila extracted project", () => {
  it("keeps the defining component counts", () => {
    expect(goods).toHaveLength(4);
    expect(componentGroups.find((group) => group.name === "平底船")?.count).toBe(3);
    expect(componentGroups.find((group) => group.name === "股份")?.count).toBe(20);
    expect(componentGroups.find((group) => group.name === "伙计")?.count).toBe(20);
  });

  it("models the four placement and three movement cadence", () => {
    expect(phaseGraph.filter((phase) => phase.id.startsWith("place"))).toHaveLength(4);
    expect(phaseGraph.filter((phase) => phase.id.startsWith("move"))).toHaveLength(3);
  });

  it("requires a source anchor for every extracted fact", () => {
    expect(ruleFacts.every((fact) => fact.anchor.label.length > 0)).toBe(true);
    expect(ruleFacts.every((fact) => fact.anchor.page || fact.anchor.asset)).toBe(true);
  });

  it("does not treat review or licensing gaps as confirmed", () => {
    expect(projectSummary.reviewFacts).toBeGreaterThan(0);
    expect(projectSummary.blockedFacts).toBeGreaterThan(0);
    expect(ruleFacts.find((fact) => fact.id === "licensing")?.status).toBe("blocked");
  });
});
