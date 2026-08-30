# Feedback Inbox to Validation Finding

Type: task
Status: resolved

## Question

Can a Creator see persisted Shared Session feedback in Web Studio and turn one
observation into a traceable Validation Finding without losing the Feedback
Moment or presenting participant evidence as human acceptance?

## Answer

Yes. Web Studio now renders a Feedback Inbox in the validation workspace. It
sorts persisted feedback by update time, shows the rating, comment, seat, exact
action sequence and action label, Experiment Brief, and a Replay link. The
Creator can use one item to prefill the Finding's Design Hypothesis, Playable
Build, `participant-feedback` evidence type, Shared Session, immutable feedback
snapshot, and observation notes. The Creator still chooses the verdict and
writes one actionable `nextChange`; the saved Finding remains explicitly
participant feedback and never becomes `human-session` evidence.

## Acceptance

Fresh isolated local browser acceptance used Project
`project_365f3945-878d-435d-81c6-fd5365dd704a`, hypothesis
`hypothesis_38941e3d-bb54-4ab3-8749-084ac1a996ce`, Build
`build_aae3859678bfb2c89e2905e3`, and Room
`room_85c4a718-f18c-46f9-9347-3480a4c5ddbe` on Worker `127.0.0.1:8830`.
The agent claimed seat 0, submitted `constraint` as Accepted Action sequence 1,
and saved feedback `feedback_12da1857-74b2-4b8d-b069-c0a49a15e750` with rating
4 and comment `目标清楚，但第二个选择还不够有张力。`.

Studio showed `1 条待归纳`, the exact Feedback Moment
`座位 0 · 行动 #1 加入约束`, and a Replay link. Clicking `用这局反馈记录结论`
selected the same hypothesis, Build, `participant-feedback`, and Room and
prefilled the notes with the exact rating, comment, seat, and action. Saving
next change `把行动 2 的说明提前，并用相同 seed 重测。` produced Finding
`finding_9b97b996-964d-434c-adc7-a696304cc712`, changed the inbox to `0 条待归纳`,
and displayed `参与者反馈（非真人验收）`.

This is local automated and agent-operated evidence. It proves the feedback
handoff and provenance boundary, not a real-person playtest, human attestation,
public deployment, or fresh Plugin installation.
