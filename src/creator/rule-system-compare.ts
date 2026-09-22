import type { RuleSystem } from "./project-contract";

/** True when two Rule Systems match ignoring identity / version / restore metadata. */
export function sameRuleSystemContent(left: RuleSystem, right: RuleSystem) {
  const comparable = (ruleSystem: RuleSystem) => ({
    ...structuredClone(ruleSystem),
    id: "",
    version: 0,
    restoredFromBuildId: undefined,
  });
  return JSON.stringify(comparable(left)) === JSON.stringify(comparable(right));
}
