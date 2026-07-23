# Player-to-playable platform

Status: active

## Product promise

An ordinary player uploads a rulebook PDF and a visual asset package, waits
while the platform automatically constructs the game, creates an online room,
and invites friends to play. The player should not need tabletop design,
programming, or AI workflow knowledge.

## Primary journey

1. Add the rulebook PDF.
2. Add an asset atlas, component PDF, or image set.
3. Start one automatic generation run.
4. Answer a small grouped clarification only if generation is genuinely
   blocked.
5. Preview the generated game.
6. Create a synchronized online room and share its invitation.
7. Play with friends, using source-bounded rule help when needed.

## Required platform capabilities

- PDF and image ingestion with provenance and private-by-default storage.
- Rule, setup, component, action, turn, settlement, and end-state understanding.
- Board and component extraction from supplied visuals.
- Image generation for missing or unusable visuals, with clear provenance.
- A generated game definition and authoritative, replayable runtime.
- A browser room with invites, reconnect, private state, synchronization, and
  room lifecycle controls.
- A rules helper grounded in the uploaded rulebook.
- Generation diagnostics for developers without turning them into player work.

## Clarification policy

- Ask only about high-impact ambiguity that cannot be resolved safely.
- Group the smallest sufficient number of questions into one interruption.
- Show the practical effect in plain language, offer a recommended default, and
  allow the player to continue.
- Never make the player approve every extracted component or rule.

## First vertical slice

Use the existing Manila fixture to replace the default authoring UI with a
player-facing upload → generation → playable flow. Reuse the existing playable
voyage as an honest partial output. Do not claim that real PDF understanding,
image generation, complete rules, or networking exist until their respective
issues pass.

## Acceptance

- A stranger can state the product promise from the first screen.
- The first screen has one primary action and does not use authoring jargon.
- The normal path contains no manual candidate review.
- Generation progress separates completed, pending, blocked, and unavailable
  capabilities.
- A necessary clarification appears as one interruption, not a review workflow.
- The generated Manila fixture opens from the same player journey.
- Online-room controls are enabled only after authoritative synchronization is
  implemented and verified with at least two browsers.
- The final gate is an end-to-end stranger session from uploads to playing with
  invited friends.
