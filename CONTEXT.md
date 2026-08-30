# GoDesk

GoDesk turns a creator's game idea or rule sources into an editable Rule System,
an executable build, and a shared session that produces evidence about the idea.
It covers rule-orchestrated games; tabletop play is one possible presentation,
not the product boundary.

## Language

**Creator**:
The person who authors a game idea, supplies optional source material, and owns
the questions the prototype should answer.
_Avoid_: Tabletop creator, rulebook uploader

**Rule System**:
The editable model of participants, entities, setup, actions, stages,
constraints, outcomes, and presentation for one game.
_Avoid_: Board-game schema, rules document

**Design Hypothesis**:
A concrete claim the Creator wants a play session to support, refute, or leave
inconclusive.
_Avoid_: Goal, generic feedback request

**Game Project**:
The tenant-scoped, versioned home for sources, one or more Rule Systems, builds,
shared sessions, and validation evidence.

**Source Library**:
Traceable creator briefs, rules documents, images, and generated assets used by
a Game Project.

**Visual Reference**:
An image that guides the style or composition of generated Project Assets but
is not itself placed in a Rule System.
_Avoid_: Asset, bound image

**Project Asset**:
An image that can be placed directly on a Game Entity, Play Surface, or Rule
System presentation.
_Avoid_: Reference image, inspiration image

**Game Entity**:
A named thing governed by the Rule System, including a resource, card,
character, token, location, concept, or other game-specific object.
_Avoid_: Component

**Play Surface**:
The presentation and interaction arrangement for play, such as a table, cards,
conversation, screen, scene, or hybrid surface.
_Avoid_: Board

**Executable Kernel**:
A deterministic rules implementation selected by a Rule System. Unsupported
behavior remains explicit.
_Avoid_: LLM rules engine

**Changeset**:
One atomic, idempotent, expected-version mutation to a Game Project.

**Playable Build**:
An immutable executable output compiled from one Rule System version.

**Restored Rule System**:
A new editable Rule System copied from one immutable Playable Build in the same
Game Project. The source Build, Shared Sessions, Replays, and Validation
Findings remain unchanged.
_Avoid_: Rollback in place, activate old version

**Shared Session**:
An authoritative run of one Playable Build that participants can join through
an invitation URL.
_Avoid_: Table session

**Playtest Link**:
A stable Game Project URL that resolves to one Creator-published Shared Session.
Changing its target affects new visits without mutating prior Sessions or Replays.
_Avoid_: Latest Room, mutable Session URL

**Experiment Brief**:
The immutable Design Hypothesis question and success signal shown to
participants in one Shared Session. An exploratory Shared Session has no
Experiment Brief.
_Avoid_: Survey, generic feedback prompt

**Feedback Moment**:
The exact Accepted Action a participant had most recently completed when they
submitted or updated Shared Session feedback. It identifies the action sequence
and action, so the observation can be checked against the Replay.
_Avoid_: Free-floating comment, inferred play context

**Intent**:
A participant-requested action submitted to a Shared Session.

**Accepted Action**:
A validated Intent persisted in sequence by the Executable Kernel.

**Session State**:
The authoritative state reconstructed from a Playable Build and its Accepted
Actions.
_Avoid_: Table State

**Replay**:
A read-only reconstruction of a Shared Session that cannot mutate it.

**Validation Finding**:
A Creator-recorded interpretation of human or automated evidence against one
Design Hypothesis, classified as supported, refuted, or inconclusive, with one
concrete `nextChange` for the next focused iteration of the same project.
_Avoid_: Playtest result

**Web Studio**:
The visible collaboration surface for the same Game Project Codex edits through
MCP.
_Avoid_: Web Editor

## Trust language

**Automated Evidence**:
Deterministic bot or contract evidence that can establish system behavior but
cannot establish human acceptance.

**Human Evidence**:
Evidence recorded from real people using a Shared Session.

**Presentation Floor**:
The minimum legible and intentional presentation required before a Shared
Session invitation can be exposed.
_Avoid_: Visual Floor
