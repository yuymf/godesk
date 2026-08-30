# Show durable agent activity in Studio

Type: task
Status: resolved

## Question

Can creators see what GoDesk is actually doing during a long-running project
operation, and still inspect the last result when a local job finishes too fast
to observe in flight?

## Answer

Yes. Studio now updates the visible Job snapshot on every authoritative poll,
instead of only adding the submitted Job and refreshing after completion. The
same tracker covers Build compilation, bot playtests, preview/export handoff,
and failed-job retries.

The sticky project surface shows the real Job kind and one of the durable
`queued`, `running`, `succeeded`, or `failed` states. A full-width activity row
also exposes the exact Job ID. It prioritizes any active Job; when none is
active, it keeps the newest terminal result visible. It does not invent a
percentage or intermediate phase that the Worker does not persist. The row is
a polite live status for assistive technology.

Local browser acceptance used Project
`project_67af3075-cc6c-4eec-881a-d8931977283f`. Compilation left visible Job
`job_b0018333-11b1-4159-952b-02ad839dacdc` as `编译可玩版本 · 已完成` and created
Build `build_d076acfa1a95dcf80dc7f04f`. The same project then ran bot playtest
Job `job_279c6e9d-a70b-4411-a591-ccac5568b78c`; Studio changed the activity to
`自动试玩 · 已完成` and exposed Playtest
`playtest_6fb62b51-7491-4376-bba9-173dbefd8a1d`.

The playtest completed in 11 turns with seat 1 at 22 points and Replay
`replay_ea086a39-3d97-4cf9-89df-d2e74f46d4e9`. This is local automated
evidence, not a public installation or real-person playtest.

## Comments

- 2026-08-11: Added poll callbacks, one shared Studio job tracker, persistent
  latest-result activity, accessible status semantics, focused unit coverage,
  and same-project browser/self-play acceptance.
