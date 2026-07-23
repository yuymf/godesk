# Domain Context

## Purpose

This repository builds a player-facing, AI-native tabletop platform. An ordinary
player supplies a rulebook PDF and a visual asset package, the platform turns
them into a playable digital tabletop, and the player opens an online room to
invite friends. Rule understanding, asset extraction or generation, prototype
assembly, and room setup are one automated generation run rather than a manual
authoring workflow.

The current vertical slice uses the real *Manila* rulebook and reference
photography as internal-only fixtures for that end-to-end pipeline.

## Glossary

- **Player**: an ordinary person who generates a game or joins a room. Domain
  language must not assume that this person is a tabletop designer.
- **Host player**: the player who supplies a game source bundle and starts the
  room. They are not expected to review an extraction model.
- **Game source bundle**: a rulebook PDF plus a PDF, image atlas, or image set
  containing the game's board and component visuals.
- **Generation run**: the automated job that understands rules, extracts usable
  assets, generates missing visuals, assembles a playable build, and prepares a
  room.
- **Clarification**: an exceptional, high-impact question asked only when the
  generation run cannot make a safe decision. A clarification is not a routine
  review queue and should group the smallest possible number of questions.
- **Source fixture**: a rulebook or reference image used during internal
  development, with origin, hash, review result, and usage boundary recorded.
- **Candidate fact**: an AI-extracted component, rule, constraint, or sequence
  used inside a generation run. It is an internal pipeline object, not normally
  exposed as player work.
- **Source anchor**: a page or asset reference attached to every candidate fact
  and generated runtime object.
- **Game definition**: the generated rules, components, setup, actions, and
  visual assets compiled into a playable build.
- **Room**: an online synchronized play session created from a playable build
  and shared with invited friends.
- **Intent**: an action requested by a client, such as placing a worker or rolling dice.
- **Accepted action**: an intent that passed authoritative rule validation and may be persisted.
- **Action log**: the ordered accepted actions used to reconstruct and replay room state.
- **Table state**: the authoritative game snapshot reconstructed from the action log.
- **Presentation layer**: Three.js rendering and animation. It never decides authoritative outcomes.
- **Rules helper**: a source-bounded question-answering surface. Unknown answers must remain unknown.
- **Playable build**: the generated digital game. It must render the table and
  components, enforce or guide the interpreted rules, accept player actions,
  synchronize room state, reach a result, and support another session. A
  manifest, mock board, or phase inspector is not a playable build.

## Trust boundaries

- Clients emit intents; they do not directly replace table state.
- AI extraction and compilation remain traceable internally. Promotion policy,
  automated verification, and confidence thresholds handle normal cases;
  only unresolved high-impact ambiguity creates a player clarification.
- Every generated rule-bearing object must retain a source anchor.
- Internal source fixtures are not publication-ready assets. A blocked licensing
  gate must remain visible to the development team and cannot be converted into
  a passed check. It must not become a routine player authoring task.
- Dice values are accepted only through validated actions. The local prototype creates them in-browser; a networked product must create or authorize them server-side.
- Replay reconstructs a preview and cannot mutate live state.
- The rules helper cannot mutate table state.
