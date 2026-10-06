# GitHub Actions minute budget (G1–G8)

The `yuymf` account shares **2,000 private Actions minutes per month** across all private repos. On 2026-10-06, godesk had used 1,445 of the 2,000 consumed in October. After that, jobs were billing-blocked. The audit and numbers come from 大主管's 2026-10-06 Actions audit. Its raw data stays outside the repo.

## Trigger matrix

| Workflow (check name) | Before | After |
| --- | --- | --- |
| `verify.yml` (**Tests and Playwright**) | Every `pull_request` push to `main`. Full suite, about 11 min, including Playwright e2e and `perf:ci` | `pull_request` types `opened, synchronize, reopened, ready_for_review, labeled`, with docs-only paths ignored. **Draft:** fast subset only (unit, Worker, typecheck, build, verify:assets, size, verify:plugin, about 4 min). **Ready (non-draft) or label `full-e2e`:** fast subset + Playwright e2e + `perf:ci`. Labels other than `full-e2e` skip the job and do not cancel running jobs. The Playwright browser download is cached. |
| `lighthouse.yml` (**Lighthouse (mobile preset)**) | Every `pull_request` and every push to `main`. 3 runs × 2 URLs | `pull_request` (non-draft) only when `src/`, `public/`, `assets/`, `worker/`, `index.html`, `vite.config.ts`, `tsconfig*.json`, `package.json`, `pnpm-lock.yaml`, `wrangler.jsonc`, `lighthouserc.json`, `scripts/perf-serve.mjs`, `scripts/perf/**` or the workflow change (`.md` excluded). **1 run** per URL on PRs. No push trigger. `workflow_dispatch` keeps the 3-run median. |
| `deploy.yml` (verify job **Build and unit tests**, previously "Tests and Playwright") | Every push to `main`. Full Playwright again before deploy | Push to `main` with docs-only paths ignored. Verify job: unit, release records, build, Worker tests, typecheck, verify:plugin. **No e2e.** Deploy, smoke, plugin publish and release steps are unchanged. `workflow_dispatch` input `full_e2e=true` reruns Playwright on demand. |

Docs-only means every changed file matches `docs/**`, `**/*.md`, `**/STATUS*` or `**/prompt-trace/**`.

## Full e2e guarantee before merge

Full Playwright runs on **every** `pull_request` event while the PR is not a draft:

- `opened` as ready
- `ready_for_review`
- `synchronize` or `reopened` while ready

It also runs whenever the `full-e2e` label is present. So the final head of a ready PR always gets a full e2e run.

- Merge only when **Tests and Playwright** on the final head shows the Playwright e2e step **ran** (not skipped) and passed.
- If a PR is a draft, mark it ready (or add `full-e2e`) and wait for green before merging.
- `concurrency.cancel-in-progress` is kept: a newer push cancels the older run of the same PR.

## Required checks

- `yuymf/godesk` is private on GitHub Free. Branch protection, rulesets and required checks are **unavailable** (the API returns 403), so a missing check never blocks a merge today.
- PR check names are kept stable: **Tests and Playwright** and **Lighthouse (mobile preset)**.
- The only rename is the push-to-main job in `deploy.yml`: "Tests and Playwright" → "Build and unit tests". It is not a PR gate.
- Docs-only PRs now produce **no** CI check. If a required check is ever enabled (Pro plan or public repo), do **not** add a same-named always-pass workflow with mirrored `paths`. That workflow would also report success on mixed PRs and could satisfy the gate while the real check is still running. Instead, replace `paths-ignore` with an in-workflow change filter: a first step detects docs-only and skips the heavy steps, but the job still reports **Tests and Playwright**.

## Agent rules (G2, G3, G7)

1. **Docs travel with code in one push.** Commit STATUS / prompt-trace updates together with the code change and push once. A STATUS-only follow-up push re-runs the full suite. In October that cost ≥275 min, 18.5% of godesk minutes.
2. If a docs-only follow-up commit on a code PR is unavoidable *and the previous code head is already green with e2e*, put `[skip ci]` in its commit message.
3. **Merge `origin/main` into a branch only to resolve a conflict**, or once right before merge. Don't merge it at the start of every session. In October that cost ≥119 min.
4. **Open PRs as draft while iterating.** Drafts get the fast subset. Mark ready for review when done; that runs the full Playwright suite.
5. Lighthouse thresholds are warn-level. Use "Run workflow" on `Lighthouse CI` for a 3-run median when you need stable numbers.

## Estimated savings

| Item | Change | Oct 1–6 measured | Monthly (sprint pace / Sept-like) |
| --- | --- | ---: | ---: |
| G1 | Docs-only paths-ignore on verify / Lighthouse / deploy | ≥174 min | ~870 / ~30 |
| G2 | Docs travel with code (agent rule + `[skip ci]`) | ≥275 min | ~1,370 / ~10 |
| G3 | Merge main only on conflict (agent rule) | ≥119 min | ~600 / ~20 |
| G4 | Lighthouse: paths, no push-to-main, 1 run on PRs | ~150 min | ~750 / ~0 |
| G5 | Deploy: build + unit only, no e2e rerun on main | ~175–235 min | ~900–1,170 / ~100 |
| G6 + G7 | Drafts run the fast subset; full e2e when ready / label | ~250 min (+100–200 overlap) | ~1,250 / ~150 |
| G8 | Playwright browser cache | ~30 min | ~150 / ~20 |

Total: about 60–70% of godesk Actions minutes.
