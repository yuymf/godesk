import type { GenerationPlan } from "./project-contract";

/**
 * Approved plans always surface unsupported.
 * Pending plans show 「这局还做不到」 only when there is no Kernel to configure
 * (Wave4 refuse / draft gap) — not the temporary “待批准后配置” lines on happy path (W5-01).
 */
export function generationPlanShowsUnsupported(
  plan: Pick<GenerationPlan, "status" | "unsupported" | "proposedRuntime">,
): boolean {
  if (plan.unsupported.length === 0) return false;
  if (plan.status === "approved") return true;
  return !plan.proposedRuntime;
}

/**
 * Approve→compile only when a Kernel configure op is proposed.
 * Refuse / insufficient drafts stay pending with visible unsupported.
 */
export function generationPlanAllowsApprove(
  plan: Pick<GenerationPlan, "status" | "proposedRuntime">,
): boolean {
  return plan.status === "pending" && Boolean(plan.proposedRuntime);
}
