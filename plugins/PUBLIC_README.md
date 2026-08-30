# GoDesk Codex Plugin

This is the public, thin Codex Plugin distribution for
[GoDesk](https://godesk.yumengfan220.workers.dev/chatgpt-plugin), a ChatCut-style
rule-game generator: upload a script or rules, receive a playable
shareable game, let others join through a URL.

It contains only:

- the Codex Marketplace manifest;
- GoDesk Plugin metadata and brand assets;
- creator workflow Skills;
- the declaration for GoDesk's hosted MCP endpoint.

Game Projects, Rule Systems, Builds, Shared Sessions, Replays, validation
records, authentication, and deterministic execution remain on the hosted
GoDesk service.

After compilation, the Creator can use the Studio embedded Shared Session for
an immediate authoritative self-play action. Studio remains on the same Game
Project while the action enters the Room's Session State and Replay. Creators
can publish one project-level stable Playtest Link to a fresh Room. Later
iterations explicitly move that pointer while old Room URLs and Replays remain
unchanged; friends need no Codex install.

After a playtest, ask Codex to apply a recorded Finding. The
`iterate-from-finding` Skill keeps the same project, creates a new immutable
Build, reruns self-play, and preserves the old evidence for comparison.
Persisted Room ratings and comments can be recorded as `participant-feedback`
evidence with an immutable snapshot; this is qualitative participant input,
not automatic `human-session` proof.
When a Shared Session is created with a `hypothesisId`, friends see its exact
question and success signal as an immutable Experiment Brief. Findings from
that Room must stay attached to the same Design Hypothesis.
After a participant completes an action, their rating/comment stores a Feedback
Moment with the exact `actionSequence` and `actionId`; Codex checks it against
the Replay before interpreting the observation.

To continue from an exact historical version, ask Codex to restore its Build.
The `restore-build-version` Skill calls `restore_build_as_rule_system`, creates
a new editable Rule System in the same project, and preserves the old Build,
Sessions, Replays, and Findings unchanged.

## Install

Give Codex Desktop this sentence:

> 阅读 https://godesk.yumengfan220.workers.dev/chatgpt-plugin，帮我安装 GoDesk；完成登录后，自动新建一个 Codex 任务，根据我的剧本或规则生成一款别人能立刻打开、立刻玩、还能联机的游戏。

The hosted page is the authoritative, version-specific installation contract.
Friends who receive a Shared Session URL can join in a browser without Codex.
After claiming a seat, they can also leave a rating and short comment on that
same URL; the creator reads it back in the Shared Session and continues the
same project.
