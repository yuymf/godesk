# Domain Context

## Purpose

This repository explores an AI-native online tabletop testing platform. The current vertical slice is Harbor 13, an original mechanics probe inspired by the voyage, wagering, dice, and worker-placement structure of Manila.

## Glossary

- **Project**: a designer-owned tabletop definition and its uploaded assets.
- **Room**: a live playtest session created from a project version.
- **Intent**: an action requested by a client, such as placing a worker or rolling dice.
- **Accepted action**: an intent that passed authoritative rule validation and may be persisted.
- **Action log**: the ordered accepted actions used to reconstruct and replay room state.
- **Table state**: the authoritative game snapshot reconstructed from the action log.
- **Presentation layer**: Three.js rendering and animation. It never decides authoritative outcomes.
- **Rules helper**: a source-bounded question-answering surface. Unknown answers must remain unknown.
- **Voyage**: one complete Harbor 13 round from placement through settlement.

## Trust boundaries

- Clients emit intents; they do not directly replace table state.
- Dice values are accepted only through validated actions. The local prototype creates them in-browser; a networked product must create or authorize them server-side.
- Replay reconstructs a preview and cannot mutate live state.
- The rules helper cannot mutate table state.
