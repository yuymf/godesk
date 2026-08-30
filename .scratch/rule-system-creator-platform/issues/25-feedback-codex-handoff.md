# Hand participant feedback back to Codex

Type: task
Status: resolved

## Question

Can a friend's URL-only feedback return to the correct participant-feedback
validation form and produce a one-sentence prompt that continues iteration in
the same GoDesk project?

## Answer

Yes. A Shared Session with saved feedback now links Web Studio with
`evidenceType=participant-feedback`; a Room without feedback keeps the explicit
`human-session` path. Web Studio preselects the exact Build, evidence type, and
Shared Session from that deep link.

Each saved Validation Finding also exposes its exact Finding ID and a native
`Copy for Codex` button. The copied sentence names the same project and Finding,
quotes the actionable `nextChange`, and asks Codex to compile a new immutable
Build and compare fixed-seed self-play. This reuses the existing
`iterate-from-finding` workflow and adds no backend protocol or prose
interpreter.

An isolated application-browser run verified the participant-feedback deep
link, preselected Studio fields, visible Finding ID, successful copy-button
state, and an empty browser error log. The fixture used Project
`project_5a104520-63c3-471b-ba8a-788ef554a032`, Build
`build_262657de62465401161c6e62`, Shared Session
`room_e0e72d04-4fbd-4b66-a657-9bed86d5c456`, feedback
`feedback_9b7b410c-9dd1-454d-8746-bd5b4f134772`, and Finding
`finding_07484b97-729f-4f41-ac36-1ea6526e635d`.

This is automated local browser evidence, not a real-person playtest or public
Codex installation record.

## Comments

- 2026-08-10: Added the feedback-aware Studio link, deterministic continuation
  prompt, native copy control, frontend regression, and browser acceptance.
