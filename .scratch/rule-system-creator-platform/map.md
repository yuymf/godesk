# Rule System creator platform map

## Notes

Product identity is the ChatCut-style charter in `AGENTS.md` and ADR 0011:
source in → playable shareable game out → others can play together. This map
is a historical delivery log. Do not revive "validation loop as the product."

## Decisions-so-far

- 01: The root domain uses Rule Systems, Game Entities, Play Surfaces, Shared
  Sessions, and explicit unsupported behavior.
- 02: Prompt-only generation may remain a durable draft; it must not invent an
  Executable Kernel.
- 03: The rights-safe conversation example proves a non-table playable slice.
- 04: Design Hypotheses and Validation Findings are authoritative project data;
  human evidence requires explicit creator attestation.
- 05: Website and Skills share the same Rule System/Web Studio vocabulary. A
  one-click share path must configure an explicit supported Kernel before build.
- 06: Automated, local browser, production, and real-human evidence are reported
  as separate gates.
- 07: The full same-project self-play and feedback chain has a repeatable
  isolated Worker verifier, not only one-off black-box records.
- 08: Standalone visual material enters Source Library through the same first
  pass as prompts and rule text; pixels never justify fabricated mechanics.
- 09: Shared Session URLs are public friend handoffs: only the URL-scoped Room,
  Build, Replay, seat, and intent surfaces bypass creator OAuth; project and
  MCP control remains protected.
- 10: Stale pre-refactor records remain unsupported and untouched; the current
  project list excludes them so they cannot block new Rule System work.
- 11: A Validation Finding must carry one actionable `nextChange`; feedback is
  a traceable input to the next focused patch, not an unbounded note.
- 12: `iterate-from-finding` is the Codex-facing follow-up seam: it turns one
  Finding into one version-checked same-project patch, new immutable Build,
  self-play comparison, and optional new Finding.
- 13: Shared Session feedback belongs to the experiment Room, is one updatable
  rating/comment per claimed seat, and is readable by the creator through the
  same project. The invitation URL is the friend write surface; feedback is
  qualitative input and never substitutes for human attestation or Replay
  action evidence.
- 14: Source-driven generation persists a Generation Plan as a review seam
  between Rule System materialization and immutable Build creation. The plan
  exposes its bounded assumptions and unsupported behavior; `approve_generation_plan`
  is a versioned project mutation, pending plans refresh after focused candidate
  corrections, and pending plans block new Builds, Rule System duplication, and
  active-version switching.
- 15: MCP must expose the structured state of every supported Executable Kernel;
  `harbor-voyage-v1` therefore declares its voyage state in Shared Session,
  Accepted Action, and Replay schemas instead of reducing it to scores.
- 16: Public invitation URLs are capability-scoped friend surfaces: a client
  must claim one seat before submitting an Intent and cannot claim multiple
  seats; authenticated/MCP headless self-play remains a separate control-plane
  path.
- 17: The Plugin's MCP declaration is verified through the real local
  Streamable HTTP route: initialize, tool discovery, durable jobs, plan
  approval, Build/preview, self-play, Shared Session, and Replay all remain
  one Codex control-plane loop.
- 18: Shared Session feedback can be attached to a same-Build Validation
  Finding as an immutable `participant-feedback` snapshot; it remains
  qualitative participant evidence and never silently becomes `human-session`.
- 19: The local thin Plugin and the separately published public bundle are
  checked as one distribution contract; public drift is an explicit open gate,
  not a successful install claim.
- 20: Prompt-first participant ranges remain editable source-derived data;
  explicit creator input overrides inference, while the inferred default stays
  conservative at the minimum seat count.
- 21: The MCP control-plane acceptance must exercise the full feedback loop,
  not stop after saving a Finding: same-project patch, new immutable Build,
  same-seed Playtest, and old-Build immutability are one seam.
- 22: English scored-action extraction must preserve every explicit action and
  value; incomplete or ambiguous source semantics remain draft instead of
  silently configuring a partial Kernel.
- 23: Source action extraction must not truncate before the runtime decision;
  twelve actions remain executable, while an over-limit action set stays an
  editable draft with an explicit warning.
- 24: Explicit bounded turn-taking can compile through `turn-taking-v1`
  without inventing score, shared-target, resource, or winner semantics; the
  same Kernel state is visible through MCP, Shared Session, and Replay.
- 25: Shared Session feedback returns to Studio as `participant-feedback`, and
  each Finding exposes one deterministic same-project Codex continuation prompt
  that reuses `iterate-from-finding` without a new backend protocol.
- 26: Explicit finite shared-pool take-away rules compile through
  `take-away-v1`; the authoritative runtime enforces legal take amounts,
  reaches zero, names the last taker as winner, and replays the same state.
- 27: Explicit die-based movement rules compile through `roll-and-move-v1`;
  seeded rolls advance authoritative per-seat positions, first-to-target wins,
  and a safety turn limit never invents a winner.
- 28: Explicit finite shuffled-deck rules compile through `draw-and-score-v1`;
  seeded draws score without replacement, future order stays out of public
  Session State, and target/exhaustion results replay deterministically.
- 29: Explicit push-your-luck rules compile through `push-your-luck-v1`;
  same-turn rolls accumulate unbanked score, busts clear and pass, banking
  persists score and passes, and every decision replays deterministically.
- 30: Studio surfaces every persisted Job transition while work is active and
  keeps the latest terminal result visible with its exact Job ID; it never
  fabricates percentages or phases outside the durable job contract.
- 31: Studio derives a visible comparison for the latest two immutable Builds
  only when both have same-seed automated Playtests; it shows both Replays and
  metrics while preserving the automated-evidence boundary.
- 32: A Finding-driven compile persists `basedOnFindingId` on both the immutable
  Build and compile Changeset, rejects compilation before a real Rule System
  revision, and lets Studio show exact causal lineage without date inference.
- 33: A host-generated image persists `basedOnSourceIds` to its creator brief
  and Visual References; the Worker rejects missing dependencies, Builds retain
  the transitive source closure, and Studio shows the exact generation lineage.
- 34: Concise Chinese cooperative briefs can name participant roles and state
  progress actions directly; the deterministic materializer preserves the
  participant count and emits a complete `shared-goal-v1` Kernel without a
  manual runtime repair.
- 35: Every image is explicitly a Visual Reference or Project Asset. References
  guide generation but cannot bind directly; generated Project Assets retain
  the creator brief and all influencing references in the immutable Build.
- 36: Historical restore uses the immutable Playable Build as its source of
  truth and creates a new active editable Rule System with exact Build lineage;
  Rule System duplication and activation remain branch operations.
- 37: A Shared Session snapshots at most one Design Hypothesis as an immutable
  Experiment Brief. The Room shows its question and success signal, Studio
  carries the exact hypothesis back with the feedback, and the Worker rejects
  cross-hypothesis evidence attribution.
- 38: Participant feedback requires one Accepted Action from that seat and
  stores the latest action as a Feedback Moment. Room, Studio, MCP, and Finding
  snapshots preserve the exact sequence and action ID for Replay inspection.
- 39: Web Studio embeds the latest executable Build's authoritative Shared
  Session for immediate Creator self-play. The Room keeps its independent
  invitation URL, and every inline action enters the same Session State and
  Replay instead of a second preview-only runtime.
- 40: Idle Studio refresh uses one compact project `activity` view every five
  seconds. It carries project version, Jobs, and Shared Sessions; a full reload
  occurs only when project or Job activity changes, while external Rooms remain
  visible without concurrent Durable Object reads.
- 41: Room collaboration uses the Durable Object Hibernation WebSocket API.
  HTTP mutations persist first, then broadcast the resulting Shared Session
  only to connections attached to that Room; reconnect requests a fresh
  persisted snapshot and no Session polling fallback remains.
- 42: Generation Plan confirmation is one Studio action that approves the
  exact version and compiles its immutable Build. Executable, presentation-ready
  Builds continue through a fixed-seed bot Playtest and embedded Shared Session;
  unsupported Builds stop honestly without invented evidence or a Room.
- 43: A project-level stable Playtest Link pins one explicitly published Shared
  Session. New visits follow a later pointer update, while existing Room URLs,
  Accepted Actions, feedback, and Replays remain on their immutable Builds.
- 44: Studio's Feedback Inbox is the explicit handoff from persisted Shared
  Session observations to Validation Findings. It preserves the exact Feedback
  Moment and participant-feedback evidence boundary, while one action pre-fills
  the same hypothesis, Build, Room, and feedback snapshot for the next focused
  iteration.
- 45: The standard local Plugin verification command must exercise both the
  bundle manifest/Skill contract and the current local distribution set. The
  public distribution check remains separate and may fail only at the external
  publication boundary; it must not hide local Skill-count drift.
- 46: Executable runtime invalidation is structural: participant, rule,
  constraint, or action identity/label changes require Kernel reconfiguration;
  description-only action edits preserve the executable Kernel so a focused
  feedback iteration can compile and self-play without manual repair.
- 47: Chinese natural-language materialization must preserve action boundaries
  and names. Explicit action point values unlock `score-race-v1`; a target or
  winner statement without action values remains `turn-taking-v1` with the
  unsupported boundary visible.
- 48: Web Studio follow-up is a bounded same-project `iterate-rule-system` job:
  one explicit action-description rewrite is source-traceable, version-checked,
  compiled, and self-played with seed 42; unsupported rule-value or action-shape
  prose fails closed and remains a structured Codex operation.
- 49: Studio distinguishes a missing project ID from a service failure at the
  initial load boundary. Stale isolated-test links explain that the project is
  absent and return to the current project list; valid project loading and
  background refresh keep their existing behavior.

## Fog

- Production OAuth installation and real two-person playtesting remain external
  acceptance gates.
- The public `yuymf/godesk-plugin` repository is currently an older tabletop
  release; synchronizing it requires explicit external publication authority.
