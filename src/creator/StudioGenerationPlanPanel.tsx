import type { GenerationPlan } from "./project-contract";
import type { StudioHobbyistFocus } from "./studio-panel-types";

export type StudioGenerationPlanPanelProps = {
  generationPlan: GenerationPlan;
  hobbyistFocus: StudioHobbyistFocus;
  busy: boolean;
  ruleSystemDirty: boolean;
  sourceDraft: string;
  approveGenerationPlan: () => void;
};

export function StudioGenerationPlanPanel({
  generationPlan,
  hobbyistFocus,
  busy,
  ruleSystemDirty,
  sourceDraft,
  approveGenerationPlan,
}: StudioGenerationPlanPanelProps) {
  return (
    <section className={`generation-plan-panel ${generationPlan.status}`} id="plan">
      <header className="studio-section-heading">
        <div>
          <h2>{generationPlan.status === "pending" ? "先看这一局怎么玩" : "这一局的玩法"}</h2>
        </div>
      </header>
      <p className="generation-plan-summary">{generationPlan.summary}</p>
      <dl className="generation-plan-facts">
        <div><dt>人数</dt><dd>{generationPlan.participants.min}–{generationPlan.participants.max} 人</dd></div>
        <div><dt>时长</dt><dd>{generationPlan.durationMinutes} 分钟</dd></div>
        <div><dt>怎么玩</dt><dd>{generationPlan.playSurface.kind === "conversation" ? "对话" : generationPlan.playSurface.kind === "cards" ? "卡牌" : generationPlan.playSurface.kind === "table" ? "桌面" : generationPlan.playSurface.kind}</dd></div>
      </dl>
      {(generationPlan.status === "pending" || hobbyistFocus === "plan") && (
      <div className="generation-plan-columns">
        <section>
          <strong>一局怎么走</strong>
          {generationPlan.loop.length ? (
            <ol>{generationPlan.loop.map((item) => <li key={item}>{item}</li>)}</ol>
          ) : <p>还没识别到明确流程。</p>}
        </section>
        <section>
          <strong>你可以做什么</strong>
          {generationPlan.actions.length ? (
            <ul>{generationPlan.actions.map((action) => <li key={`${action.label}-${action.description}`}><b>{action.label}</b><span>{action.description}</span></li>)}</ul>
          ) : <p>还没识别到明确行动。</p>}
        </section>
        <section>
          <strong>怎么分胜负</strong>
          {generationPlan.outcomes.length ? (
            <ul>{generationPlan.outcomes.map((outcome) => <li key={outcome}>{outcome}</li>)}</ul>
          ) : <p>还没识别到明确结果。</p>}
        </section>
        {generationPlan.status === "approved" && generationPlan.unsupported.length > 0 && (
        <section>
          <strong>这局还做不到</strong>
          <ul>
            {generationPlan.unsupported.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
        )}
      </div>
      )}
      {generationPlan.status === "pending" ? (
        <div className="generation-plan-actions">
          <p>确认后立刻生成可玩版本。之后还能改规则、再开新一局。</p>
          <button
            disabled={busy || ruleSystemDirty || Boolean(sourceDraft.trim())}
            onClick={approveGenerationPlan}
            type="button"
          >
            {busy ? "正在生成可玩版本…" : "确认玩法并开始试玩"}
          </button>
        </div>
      ) : (
        <p className="generation-plan-approved" role="status">玩法已确认。可以直接开玩，或改下一版。</p>
      )}
    </section>
  );
}
