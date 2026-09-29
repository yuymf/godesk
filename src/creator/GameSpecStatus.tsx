import { ruleSystemSpecIssues } from "./game-spec";
import type { RuleSystem } from "./project-contract";

export function GameSpecStatus({ ruleSystem, awaitingApproval }: { ruleSystem: RuleSystem; awaitingApproval: boolean }) {
  if (!ruleSystem.generation) return null;
  const issues = ruleSystemSpecIssues(ruleSystem);
  return <section className="generation-plan-panel" aria-label="已保存的游戏规则">
    <p>{issues.length ? awaitingApproval ? "草稿已保存，确认玩法后校验并构建。" : "草稿已保存，尚不能开局。" : "规则校验通过，已保存。"}</p>
    <p>规则版本 {ruleSystem.generation.rulesVersion} · 修订 {ruleSystem.version}</p>
    {!awaitingApproval && issues.length > 0 && <div role="status">
      <p>请补齐规则或等待对应玩法支持后重新构建：</p>
      <ul>{issues.map((issue, index) => <li key={`${issue.path}-${index}`}>{issue.path}: {issue.message}</li>)}</ul>
    </div>}
  </section>;
}
