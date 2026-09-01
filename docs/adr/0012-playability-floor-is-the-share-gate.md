# ADR 0012: Playability Floor is the share gate

Status: accepted

Date: 2026-08-31

Raises: ADR 0004's shareable-prototype low bar and ADR 0011's
"playable, shareable output." Presentation Floor remains the visual minimum.
Playability Floor is the additional gate before a Shared Session or Playtest
Link may be exposed.

## Context

ADR 0004 allowed a disclosed subset of rules to execute, as long as the shared
surface was a real session rather than a definition viewer. In practice that
subset collapsed most sources onto `score-race-v1`: 剧本杀、聚会卡牌、对话创作
都变成两颗计分按钮。Presentation Floor blocked naked text tables. It did not
block a themed scoreboard pretending to be the requested game.

ADR 0011 restored "source in → others can play" as the product. The first
principles now require a **playable finished game**, not a Demo. Honest
partial executability remains, but the shared product must still be the
source's core loop.

## Decision

A Shared Session invitation and a Playtest Link require both floors:

```text
Presentation Floor  →  the table is legible
Playability Floor   →  the table is that game
```

Playability Floor passes only when all of the following hold:

- **Genre fidelity.** The Executable Kernel is the game the source asked for.
  A hidden-role source must run `hidden-role-v1`. A hand-play source must run
  `hand-play-v1`. A conversation source must run `conversation-relay-v1`. A
  placement source must run `harbor-voyage-v1`. `score-race-v1` may execute a
  source that is itself a point race. It must not stand in for another genre.
- **Decision density.** The core loop changes non-scalar state: roles, hands,
  spoken text, spatial placements, or an equivalent genre object. Two score
  buttons racing to a target are not enough when the source asked for another
  game.
- **Surface fidelity.** The Room UI follows the Play Surface kind and the
  Kernel contract. `cards` shows hands. `conversation` shows a transcript.
  `table` placement shows regions. A shared score track with renamed labels
  is not a surface.
- **Session completeness.** Setup, mid-game decisions, and an ending that
  matches the source's victory condition are executable.
- **Presentation.** Presentation Floor still applies. Objects should read as
  that game's cards, seats, or regions.

Failure stops at the immutable Playable Build with the gap visible. GoDesk
creates neither a Shared Session nor a Playtest Link.

ADR 0004's "honest subset" is tightened: a subset may execute, but it must
still be the requested game's core loop. Substituting a different, simpler
game is not honesty.

LLM-authored briefs remain allowed. Accepted Actions remain Kernel-only
(ADR 0002).

## Consequences

- Compile still produces a Build when only Presentation Floor passes.
- Share, publish Playtest Link, and "open a Room after approve" check
  Playability Floor.
- Default examples and hobbyist starters that demonstrated score-race skins
  are replaced by genre-faithful Kernels or removed from the shareable path.
- Playwright must take a genre action (speak, accuse, play a card), not only
  click a scored button.
- GameFactory-3A is a process reference (plan, mechanic/UI contract, play to
  validate). It is not a 3D engine target.
