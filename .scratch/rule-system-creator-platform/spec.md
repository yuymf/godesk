# GoDesk Rule System creator platform

Status: accepted

## Problem

GoDesk's current ChatCut-style flow still defines its product as converting a
board-game rulebook into a table prototype. The public model requires physical
components and a board, the website leads with rule-document upload, and a
Shared Session does not capture what creative claim the Creator wanted to test.
This excludes rule-orchestrated games that use conversation, cards, screens,
scenes, or abstract state and makes sharing an endpoint rather than a learning
loop.

## Product outcome

A Creator installs GoDesk in Codex or opens the website, describes a game idea
or supplies optional sources, and receives an editable Rule System plus a
durable Generation Plan. The Creator reviews the plan's proposed loop, actions,
assumptions, and unsupported behavior; GoDesk requires explicit approval before
creating a new immutable Build for that generation. If the Rule System maps to a
supported Executable Kernel, GoDesk compiles it into a Playable Build, opens a
Shared Session, and returns one invitation URL. If it does not, GoDesk opens the
same project in Web Studio with unsupported behavior visible instead of
inventing executable rules. Friends need only the eventual invitation URL.
After play, the Creator records a Validation Finding against a Design
Hypothesis and iterates the same Game Project.

## Canonical model

`Game Project -> Source Library + Rule Systems + Design Hypotheses -> Playable
Builds -> Shared Sessions + Replays -> Validation Findings`

A Rule System contains:

- participant range and optional roles;
- Game Entities, including abstract concepts as well as physical objects;
- setup, stages, actions, constraints, and outcomes;
- a Play Surface whose kind is table, cards, conversation, screen, scene, or
  hybrid;
- an Executable Kernel plus explicit unsupported behavior.

## Acceptance

1. Prompt-only creation produces a durable, editable Rule System without
   inventing a board or physical components.
2. Existing tabletop examples migrate to Game Entities and a table Play
   Surface without a compatibility layer.
3. A rights-safe, non-tabletop example compiles, opens a Shared Session, accepts
   authoritative actions, and reconstructs a Replay.
4. A Creator can attach a Design Hypothesis and record a human, automated, or
   participant-feedback Validation Finding with an explicit evidence type,
   verdict, and one actionable next change for the same Game Project.
5. A claimed Shared Session seat can persist one rating and short participant
   comment; the creator can read it from the same project, while Replay remains
   an action-log-only artifact and the feedback does not become human evidence
   automatically. The public invitation route requires a client to claim its
   seat before submitting an Intent and does not allow one client to claim
   multiple seats.
   A persisted Room rating/comment can be copied into a
   `participant-feedback` Finding snapshot, but it never becomes
   `human-session` evidence automatically.
6. Website and MCP expose the same project, build, invitation, replay, session
   feedback, and validation data.
7. Source-driven generation persists a Generation Plan, exposes its bounded
   `generation-plan` view, and rejects Build creation until the creator records
   `approve_generation_plan` against the current project version.
   While pending, the project cannot duplicate or switch its active Rule System;
   focused corrections to the current candidate remain versioned and the
   approval records the resulting Rule System version.
8. The Skills package describes rule-game creation rather than tabletop-only
   creation and keeps friends on a URL-only join path.
9. Automated, local browser, deployment, and human evidence remain separate.
10. A Creator can restore an exact historical Playable Build into a new active
    editable Rule System in the same project. The restored Rule System and
    Changeset retain the source Build ID, while the source Build, Sessions,
    Replays, and Findings remain immutable.
11. A Creator can bind one Shared Session to one Design Hypothesis. The Room
    exposes an immutable Experiment Brief with the exact question and success
    signal, and its feedback can only support a Finding for that same
    hypothesis. An exploratory Room may remain unbound.
12. Participant feedback requires one Accepted Action from that seat and
    records its exact Feedback Moment. Room, Studio, MCP, and an immutable
    Finding snapshot expose the same action sequence and ID; comments without a
    participant action or with altered action context are rejected.
13. After compiling an executable Build, Web Studio can create and embed its
    latest Shared Session. A Creator can claim a seat and submit an Accepted
    Action without leaving Studio; the exact sequence, action ID, and resulting
    Session State appear in the same Replay. The Room retains an independent
    invitation URL for friends.
14. Web Studio keeps Codex-side Jobs and externally created Shared Sessions
    visible through one bounded activity refresh. Idle refresh does not reload
    every project view, and a changed project version or Job transition still
    triggers a complete authoritative reread.
15. An open Room receives its initial and subsequent authoritative Shared
    Session snapshots through a hibernation-compatible Durable Object
    WebSocket. Seat, Intent, and feedback transactions persist before
    broadcast; connections are isolated by Room ID, reconnect from persisted
    state, and do not retain a Session polling fallback.
16. Confirming a pending Generation Plan in Web Studio immediately compiles its
    exact approved project version. If the resulting Build has an executable
    Kernel and passes the Presentation Floor, Studio also completes one
    fixed-seed automated Playtest and embeds one authoritative Shared Session.
    Otherwise it stops after the immutable Build with unsupported behavior
    visible and creates neither synthetic evidence nor a Room.
17. A Game Project exposes one stable Playtest Link only after the Creator
    explicitly publishes an executable, presentation-ready Shared Session.
    Repointing the link changes new visits while old Room URLs, Accepted
    Actions, feedback, and Replays remain immutable. Creating a Build or Room
    alone never changes the published target.
18. Web Studio exposes persisted Shared Session feedback in a Feedback Inbox.
    Each item shows its rating, comment, and exact Feedback Moment; one action
    carries the same Design Hypothesis, Build, `participant-feedback` evidence,
    Room, and immutable feedback snapshot into a Validation Finding. Saving the
    Finding removes the item from the unreviewed count without claiming human
    evidence or changing the source Room and Replay.

## Non-goals

- A universal interpreter that executes arbitrary prose without an implemented
  Executable Kernel.
- A general-purpose 3D engine, asset marketplace, or website subscription
  billing system.
- Claiming automated clients are human playtest evidence.

## Delivery order

Issues are vertical and blocking. Work them in numeric order; each issue must
leave the relevant public seam green before the next starts.
