# Manila AI-native tabletop prototype: next-phase handoff

> **Superseded on 2026-07-23.** The product owner clarified that Godesk is a
> player-facing, end-to-end generation and online-play platform, not a
> designer-facing validation workbench. Do not execute this handoff's
> manual-review-first sequence. Continue from
> `.scratch/player-to-playable-platform/spec.md` and ADR 0001.

Status: ready for planning  
Prepared: 2026-07-23  
Workspace: `/Users/halyu/Documents/Code/godesk`

## 1. Handoff purpose

Continue the current prototype through two evidence gates:

1. Make the source-to-playable creation flow understandable and operable by an
   unfamiliar tabletop designer without facilitator explanation.
2. Use a rules-complete, internal-only digital implementation of *Manila* to
   pressure-test whether that creation flow can produce a genuinely complete
   game rather than a convincing vertical slice.

The next planner should turn this handoff into a new spec, map, and one Markdown
issue per implementation ticket under `.scratch/`.

## 2. Product decision

The next phase has two ordered tracks, not two alternatives.

- **Track A — fix the creation journey first.** The first stranger session
  already showed that the user could not tell what each step was for, what
  decision they were making, what operation was expected, or how a decision
  changed the generated game.
- **Track B — complete the digital rules fixture second.** A complete *Manila*
  implementation is needed as a stress test for extraction, review, compilation,
  play, and validation. It is not the product itself and must not displace the
  PRD's platform loop.

Do not start by adding the remaining game rules to the current opaque journey.
That would increase the amount of material an unfamiliar user cannot understand
and make later usability findings harder to isolate.

## 3. Important scope boundary

The original PRD says the MVP is a general platform for a designer to upload
materials, assemble a table, create a browser room, run a remote playtest, use a
source-bounded rules assistant, save the action log, collect feedback, and
iterate. It explicitly does not require fully automatic rule execution.

Therefore:

- The rules-complete *Manila* build is an **internal validation fixture** for the
  authoring pipeline.
- It must not be presented as a publishable or commercially licensed product.
- The existing source-provenance and licensing blocker must remain visible.
- Reusable platform concepts should be separated from Manila-specific rules,
  but no speculative general framework should be built until the complete
  fixture reveals the real abstraction boundary.
- Completing *Manila* alone does not satisfy the platform MVP. The PRD's room,
  multiplayer, private information, reconnect, replay, feedback, and iteration
  loop remain separate gates.

## 4. Evidence available now

### Confirmed

- The accepted English rulebook has 8 pages and a recorded source/hash.
- A corrupt mirror is retained as a rejected source.
- Core components and rule facts have source anchors.
- Three authoring UI variants exist: workbench, provenance graph, and guided
  review.
- A human can complete one three-player voyage against two deterministic bots.
- The current playable slice covers four worker placements per player, three
  movements, port/shipyard bets, a simplified pirate path, pilot action,
  simplified insurance settlement, voyage payout, leader announcement, and
  restart.
- Existing recorded verification says tests, typecheck, build, desktop browser,
  and 390 px browser checks passed at the end of the prior phase.

### Newly observed

One unfamiliar user attempted the creation flow and could not independently
understand:

- what the overall flow was trying to produce;
- why the current step existed;
- what had been extracted or generated;
- where AI and source material disagreed;
- which item required a human decision;
- what operation to perform on that item;
- what accepting, editing, or rejecting would change downstream;
- when a step was complete;
- how to recover after uncertainty.

This is a product failure, not a copy-only issue. The current flow exposes
artifacts but does not reliably teach the user's job.

### Not yet proven

- A stranger can complete the authoring flow without verbal help.
- The AI extraction is real rather than pre-authored fixture data.
- The generated game is rules-complete across multiple voyages.
- Real players can play in a server-authoritative shared room.
- Private state, reconnect, replay, feedback, and two-hour stability work.
- The platform can import a second game without Manila-specific code changes.

Recorded completion must not be reported as current live verification until the
next owner reruns the relevant checks.

## 5. North-star validation chain

The next phase should preserve this chain:

```text
source fixtures
  -> AI candidate facts
  -> visible conflicts and uncertainty
  -> human decisions with consequences
  -> accepted project version
  -> compiled rules-complete game
  -> full play evidence
  -> coverage and failure report
  -> corrected project version
```

Each arrow is a product contract. A step is incomplete if the user can only
view information but cannot make the decision needed to advance the project.

## 6. Track A — make the creation flow understandable

### A0. Re-establish the baseline

Before changing the interface:

- Read `AGENTS.md`, `CONTEXT.md`, this handoff, the current creation-flow spec,
  map, issues, source provenance, and the original PRD.
- Preserve the dirty worktree. Do not reset, clean, or overwrite existing work.
- Run the existing typecheck, tests, and production build.
- Open all authoring variants and the playable route in a browser.
- Record which prior checks still pass and which cannot be reproduced.
- Convert the stranger feedback above into a new unresolved usability issue.

Deliverable: a current baseline note with command results, routes checked, and
known drift from the prior handoff.

### A1. Define the user's job at every step

Replace the current artifact-led flow with a task-led flow. Every step must show
these six fields:

1. **Goal:** what the user will have when the step is done.
2. **Why now:** why this decision blocks later compilation or play.
3. **Inputs:** source pages, images, candidate facts, and prior accepted facts.
4. **Required action:** the exact operation the user must perform.
5. **Decision consequence:** which project objects or game behavior will change.
6. **Done condition:** what must be true before continuing.

Keep the overall objective, current step, progress, unresolved blockers, and
next consequence visible without requiring the user to remember earlier pages.

Deliverable: one canonical guided route. The A/B/C variant switcher may remain
in development for comparison, but the product should stop asking end users to
choose an information architecture.

### A2. Make divergence points explicit and operable

A **divergence point** is any place where the system cannot safely promote a
candidate into the project without a human decision. It includes:

- rule text and component photography disagree;
- two rule passages imply different timing or precedence;
- a component count is missing or inconsistent;
- AI confidence is below the agreed threshold;
- the proposed runtime behavior has no source anchor;
- the source contains a rule the current runtime cannot represent;
- a required asset is missing, unreadable, duplicated, or rejected;
- a licensing or usage boundary blocks publishing.

Every divergence card must show:

- the question to decide in plain language;
- the competing interpretations side by side;
- source snippets or image crops with anchors;
- AI confidence and why the item was flagged;
- downstream impact in the playable build;
- one primary action and a small set of valid alternatives.

Required operations:

- **Accept candidate**
- **Edit before accepting**
- **Choose interpretation A/B**
- **Reject candidate**
- **Mark unresolved and block compilation**
- **Attach or replace source**
- **Open source anchor**
- **Preview downstream change**
- **Undo decision**

There must be at least one real user operation in every substantive step. A
screen whose only action is "Next" is an explanation page, not an authoring
step.

### A3. Add a seeded end-to-end authoring exercise

Create a repeatable usability fixture with known imperfections. It should
contain at least:

- one accepted source;
- one rejected source;
- one high-confidence candidate;
- one low-confidence candidate;
- one direct source conflict;
- one missing component/asset;
- one unsupported runtime rule;
- one licensing blocker that cannot be overridden as "passed."

The participant must:

1. understand the target playable output;
2. inspect source quality;
3. resolve a component discrepancy;
4. resolve or defer a rule ambiguity;
5. see the project model update;
6. compile the accepted version;
7. open and play the generated build;
8. find the validation report and identify what remains incomplete.

Seeded issues make sessions comparable. Do not rely on the participant
discovering an incidental problem in a clean fixture.

### A4. Stranger usability gate

Run at least three additional sessions with people who have not seen the
prototype. The facilitator may give the starting scenario but may not explain
the interface or tell the participant what to click.

Capture:

- screen and audio, with consent;
- time on each step;
- first-click errors and backtracking;
- facilitator rescues;
- questions spoken aloud;
- unresolved terms;
- whether the participant predicts a decision's consequence correctly;
- final task completion;
- post-session confidence and confusion.

Track A passes when:

- at least 2 of 3 participants compile and open the playable build without a
  facilitator rescue;
- all participants can state the overall goal and current step in their own
  words;
- at least 2 of 3 correctly resolve the seeded source conflict;
- no participant mistakes AI output for an already-authoritative rule;
- no participant can pass an unresolved blocking rule silently;
- every step has an obvious primary action and visible done condition;
- observations are converted into ranked issues with evidence.

If this gate fails, iterate Track A before expanding the rules fixture.

## 7. Track B — rules-complete digital Manila fixture

### B0. Build a rule-coverage ledger

Before implementation, convert every normative rule in the 8-page rulebook into
a coverage record:

- stable rule ID;
- rulebook page and source excerpt;
- domain objects affected;
- preconditions;
- legal player intents;
- authoritative state transition;
- ordering/precedence;
- payout or terminal effect;
- current status: missing, partial, implemented, disputed, blocked;
- automated example;
- human-play scenario.

No rule should be considered complete only because a UI element with the same
name exists.

### B1. Correct the domain model and authoritative reducer

The complete fixture must model:

- 3–5 players and the correct accomplice count;
- randomized initial distribution of two private shares per player;
- the public share supply and four black-market value tracks;
- cash, encumbered shares, loans, and repayment;
- harbor-master ownership and clockwise turn/auction order;
- bids, passes, permanent exit from an auction, affordability, and no-bid
  retention;
- optional harbor-master share purchase at `max(5, current ware value)`;
- selection of three of four goods;
- three unique sea routes and starting positions totaling exactly 9, each 0–5;
- legal worker placement, escalating costs, capacity, pass, and loss of future
  placement after passing;
- dice tied to the loaded good;
- deterministic port and shipyard arrival order;
- source-linked accepted actions and replayable state reconstruction.

Clients and bots submit intents. The reducer decides whether they are legal and
creates accepted actions. Presentation code must not decide outcomes.

### B2. Complete one voyage without simplifications

Replace the current shortcuts with the rulebook behavior:

- correct capacity for every loaded good, including jade;
- port A/B/C and shipyard A/B/C occupancy and payouts;
- second-movement pirate boarding choices, captain order, optional boarding, and
  only vacant-space boarding in the base rules;
- third-movement plunder, removal of punt accomplices, profit sharing, and the
  pirate captain's port/shipyard destination choice per captured punt;
- small pilot first, then large pilot;
- small-pilot one-space option;
- large-pilot one punt by up to two spaces or two punts by one space each;
- pilot movement into port and the rule that pilot movement to space 13 does
  not trigger pirates;
- insurance agent's immediate 10 pesos;
- shipyard payouts paid by the insurer, including payment to the harbor cash
  box when the shipyard slot is empty;
- mandatory loans when the insurer cannot pay;
- harbor cash-box fallback when all available credit is exhausted;
- ware-value increases only for goods delivered to port, including a pirate
  captain's port decision;
- reset for the next voyage while preserving the economy.

Acceptance requires deterministic rule examples for every branch plus a visible
human playthrough. Random happy-path play is insufficient.

### B3. Complete the multi-voyage economy and game end

Implement:

- repeated harbor-master auctions;
- share buying across voyages;
- persistent cash, shares, loans, and ware values;
- voluntary loans against unencumbered shares for 12 pesos;
- mandatory borrowing for required payments;
- repayment of 15 pesos;
- blind-passenger eligibility and payment behavior;
- player placement pass and subsequent lockout for that voyage;
- voyage cleanup and next-voyage setup;
- game end as soon as any ware reaches value 30;
- final fortune: cash plus current share values minus 15 per encumbered share;
- final winner and tie behavior, explicitly sourced or marked unresolved if the
  rulebook does not define it.

### B4. Complete player choices and edge cases

Add scenario coverage for:

- no auction bids;
- bids funded by available credit;
- a player unable to afford any normal placement;
- multiple punts on space 13 after movement two;
- pirate captain boarding, declining, or leaving captaincy to the second pirate;
- full punts that cannot be boarded under base rules;
- multiple punts plundered after movement three;
- pirate captain choosing a different destination for each plundered punt;
- pilots acting or declining independently;
- pilots moving a punt through port, onto 13, or backward;
- insurer paying self, another player, the bank, partially paying, and exhausting
  all loans;
- ships arriving before movement three;
- all combinations of 0–3 port, shipyard, and pirate outcomes;
- depleted share supply for a ware;
- final-value and final-fortune calculations.

The optional pirate variant should be a separate project setting, not silently
mixed into the base game.

### B5. Make the complete game teachable and traceable

The playable build must provide:

- current objective and phase;
- active player and legal actions;
- costs, capacities, expected payout, and risk before commitment;
- source link for any rule-bearing action;
- a concise explanation when an intent is rejected;
- visible private/public information boundaries;
- action log and replay;
- voyage summary showing why each payout occurred;
- final score breakdown;
- a coverage report linked back to the authoring decisions that generated the
  behavior.

The AI rules helper may explain sourced rules but must not mutate table state or
invent a decision for a player.

### B6. Rules-complete acceptance gate

Track B passes only when:

- the coverage ledger has no unexplained missing or partial base-game rule;
- every implemented rule has a source anchor;
- automated scenario tests cover every ledger branch and important ordering
  combination;
- a full game reaches the value-30 terminal condition and produces auditable
  final fortunes;
- a second full game is reconstructed from its accepted action log with the
  same terminal state;
- at least one 3-player and one 5-player game are completed;
- an unfamiliar player can complete a game using the visible guidance and
  source-linked rules helper;
- all deviations or unresolved rulebook ambiguities remain explicit.

Bot-only runs can verify reachability and invariants but do not replace the
unfamiliar-player session.

## 8. Track C — return to the platform MVP

Do not declare the project complete after Track B. Use the complete fixture to
identify which authoring concepts are genuinely reusable, then return to the
original PRD:

1. Import a second, authorized or original game through the same creation flow.
2. Measure how much Manila-specific code or manual data had to be added.
3. Extract only the repeated project schema, constraints, actions, zones, setup,
   phases, and settlement concepts.
4. Create a real 2–4 player browser room with server-authoritative state.
5. Verify private information, link entry, reconnect, reset, undo, and
   synchronization.
6. Add source-bounded rules Q&A with citations and uncertainty.
7. Save action logs, replay, end-of-session feedback, and export.
8. Run the PRD's complete designer loop from upload through revision.

The platform MVP is not complete until a non-developer designer can independently:

```text
upload sources
  -> build the initial table
  -> create and share a room
  -> complete a multiplayer test
  -> use the rules helper
  -> inspect replay and feedback
  -> revise the next project version
```

## 9. Recommended issue order

The next planner should create a new effort, suggested slug:
`.scratch/manila-complete-validation/`.

Recommended issue sequence:

1. `01-current-baseline-and-stranger-feedback.md`
2. `02-guided-step-contract.md`
3. `03-divergence-decision-operations.md`
4. `04-seeded-usability-fixture.md`
5. `05-stranger-usability-round.md`
6. `06-rule-coverage-ledger.md`
7. `07-authoritative-complete-domain-model.md`
8. `08-complete-auction-setup-and-shares.md`
9. `09-complete-placement-credit-and-blind-passenger.md`
10. `10-complete-movement-pirates-and-pilots.md`
11. `11-complete-settlement-insurance-and-market.md`
12. `12-multi-voyage-game-end-and-scoring.md`
13. `13-replay-traceability-and-coverage-report.md`
14. `14-rules-complete-human-acceptance.md`
15. `15-second-game-platform-transfer.md`

Issues 06–13 may be refined after the coverage ledger, but Track B
implementation must remain blocked by the Track A usability gate.

## 10. Stop conditions and reporting

Use these reporting categories:

- **Completed:** implemented and verified now, with artifact and command/session
  evidence.
- **Blocked:** cannot proceed without a decision, source, permission, person, or
  environment change.
- **Deferred:** intentionally outside the current gate, with the gate that will
  revisit it.
- **Next priority:** the single highest-value unblocked action.

Do not report:

- a screen as operable when it only displays generated artifacts;
- automated browser traversal as stranger usability evidence;
- a single voyage as a complete game;
- bot simulation as human playtest evidence;
- local client state as server-authoritative multiplayer;
- a rule name in the UI as proof that the rule is implemented;
- source fixtures as publication-ready assets;
- the complete *Manila* fixture as proof that the general platform works.

## 11. Files to read first

- `AGENTS.md`
- `CONTEXT.md`
- `README.md`
- `docs/AI Native 在线桌游平台｜MVP PRD v0.1.docx`
- `.scratch/manila-creation-flow/spec.md`
- `.scratch/manila-creation-flow/map.md`
- `.scratch/manila-creation-flow/issues/01-source-ingest.md`
- `.scratch/manila-creation-flow/issues/02-project-model.md`
- `.scratch/manila-creation-flow/issues/03-authoring-variants.md`
- `.scratch/manila-creation-flow/issues/04-single-voyage-validation.md`
- `.scratch/manila-creation-flow/issues/05-generated-playable-output.md`
- `sources/manila/PROVENANCE.md`
- `sources/manila/manila-rulebook-en.pdf`
- `sources/manila/manila-rulebook-en.txt`
- `src/manila/project.ts`
- `src/manila/playable.ts`
- `src/manila/CreationPrototype.tsx`
- `src/manila/PlayableManila.tsx`

## 12. First action for the next planner

Create the new `.scratch/manila-complete-validation/` spec and issue map from
this handoff, but claim only issue 01. Reproduce the current baseline and append
the first stranger session as evidence. Then plan and execute Track A through
the stranger usability gate before authorizing Track B implementation.
