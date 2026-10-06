#!/usr/bin/env node
/**
 * PR Lighthouse jobs collect 1 run per URL (docs/ci/actions-budget.md).
 * A single simulated-throttle sample of homepage TBT is too noisy to keep as
 * error (G3D-05 3-run median was 0 ms; 1-run CI has landed at 229 / 369 ms).
 * workflow_dispatch still uses lighthouserc.json unchanged (3-run median, error).
 */
import { readFileSync, writeFileSync } from "node:fs";

export function demoteSingleRunTbt(rc) {
  const next = structuredClone(rc);
  for (const row of next.ci?.assert?.assertMatrix ?? []) {
    const spec = row.assertions?.["total-blocking-time"];
    if (Array.isArray(spec) && spec[0] === "error") spec[0] = "warn";
  }
  return next;
}

const [, , input, output] = process.argv;
if (input && output) {
  const rc = JSON.parse(readFileSync(input, "utf8"));
  writeFileSync(output, `${JSON.stringify(demoteSingleRunTbt(rc), null, 2)}\n`);
}
