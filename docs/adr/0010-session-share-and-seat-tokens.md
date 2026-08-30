# ADR 0010: Session share tokens and seat tokens

Status: accepted

Date: 2026-08-30

Friend URLs no longer carry a raw Creator ID. A signed `share` token binds
one invitation to an explicit Shared Session family (Room, Playable Build,
Replay, and optional Playtest Link project). Seat claims issue a server-side
`seatToken`; public Intents and feedback require that token. Authenticated
MCP headless self-play remains a separate control-plane path and may submit
an Intent only when the Room has no claimed seats.
