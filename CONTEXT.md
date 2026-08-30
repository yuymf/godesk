# GoDesk

GoDesk is a ChatCut-style rule-game generator. A Creator or hobbyist installs
it in Codex or opens the website, supplies a script, a rulebook, a written
idea, or optional visuals, and receives a playable, shareable game. Other
people join a Shared Session through a URL and play together.

It covers rule-orchestrated games. Tabletop play is one possible presentation,
not the product boundary.

The success bar is `source in → playable game out → others can play together`.
Web Studio and Codex operate the same Game Project. Validation Findings are
optional iteration tools, not the product.

## Language

**Creator**:
The person who supplies a game idea, script, or rules and wants a playable,
shareable game. Includes professional authors and hobbyists.
_Avoid_: Tabletop creator, rulebook uploader, playtest researcher

**Participant**:
A person who joins a Shared Session through an invitation URL and plays. They
do not install Codex or GoDesk.
_Avoid_: Tester, subject

**Rule System**:
The editable model of participants, entities, setup, actions, stages,
constraints, outcomes, and presentation for one game.
_Avoid_: Board-game schema, rules document

**Game Project**:
The tenant-scoped, versioned home for sources, one or more Rule Systems,
builds, and Shared Sessions.

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
Game Project. The source Build, Shared Sessions, and Replays remain unchanged.
_Avoid_: Rollback in place, activate old version

**Shared Session**:
An authoritative run of one Playable Build that Participants can join through
an invitation URL.
_Avoid_: Table session, experiment room as the primary name

**Playtest Link**:
A stable Game Project URL that resolves to one Creator-published Shared Session.
Changing its target affects new visits without mutating prior Sessions or Replays.
_Avoid_: Latest Room, mutable Session URL

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

**Web Studio**:
The visible collaboration surface for the same Game Project Codex edits through
MCP.
_Avoid_: Web Editor

**Design Hypothesis**:
An optional concrete claim a Creator may attach when iterating. Not required to
share or play.
_Avoid_: Goal, the product outcome

**Experiment Brief**:
The optional snapshot of one Design Hypothesis shown in a Shared Session.
_Avoid_: Survey, required playtest form

**Feedback Moment**:
The exact Accepted Action a Participant had most recently completed when they
submitted Shared Session feedback.

**Validation Finding**:
An optional Creator-recorded note against a Design Hypothesis, with one
`nextChange` for focused iteration. It is not human acceptance of the game and
not the product destination.
_Avoid_: Playtest result, product success metric

## Trust language

**Automated Evidence**:
Deterministic bot or contract evidence that can establish system behavior but
cannot establish that people enjoyed or accepted the game.

**Human Evidence**:
Evidence recorded from real people using a Shared Session, only when the
Creator attests that.

**Presentation Floor**:
The minimum legible and intentional presentation required before a Shared
Session invitation can be exposed.
_Avoid_: Visual Floor
