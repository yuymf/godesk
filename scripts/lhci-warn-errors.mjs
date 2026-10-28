#!/usr/bin/env node
/**
 * PR Lighthouse jobs collect 1 run per URL (CI Lighthouse workflow).
 * A single simulated-throttle sample of homepage TBT is too noisy to keep as
 * error (G3D-05 3-run median was 0 ms; 1-run CI has landed at 229 / 369 ms).
 * Room categories.performance is also demoted: CI SwiftShader under 4× CPU
 * throttle reports Room TBT in the 10^5 ms range (docs/perf/emulation-protocol.md),
 * which tanks the performance category score on a single sample (0.4 vs 0.52).
 * workflow_dispatch still uses lighthouserc.json unchanged (3-run median, error).
 */
import { readFileSync, writeFileSync } from "node:fs";

export function demoteSingleRunTbt(rc) {
  const next = structuredClone(rc);
  for (const row of next.ci?.assert?.assertMatrix ?? []) {
    const tbt = row.assertions?.["total-blocking-time"];
    if (Array.isArray(tbt) && tbt[0] === "error") tbt[0] = "warn";
    // Room only: SwiftShader TBT is not a valid signal and drives categories.performance.
    if (typeof row.matchingUrlPattern === "string" && row.matchingUrlPattern.includes("/room/")) {
      const perf = row.assertions?.["categories:performance"];
      if (Array.isArray(perf) && perf[0] === "error") perf[0] = "warn";
    }
  }
  return next;
}

const [, , input, output] = process.argv;
if (input && output) {
  const rc = JSON.parse(readFileSync(input, "utf8"));
  writeFileSync(output, `${JSON.stringify(demoteSingleRunTbt(rc), null, 2)}\n`);
}
