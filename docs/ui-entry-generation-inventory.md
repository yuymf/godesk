# Entry and generation UI inventory (PR1)

Routes are resolved by `src/App.tsx`, `src/creator/CreatorWorkspace.tsx`, and `src/public-mount.ts`. `/chatgpt-plugin` is the install guide; `/chatgpt-plugin/new` maps to the same home component as `/`. The public mount also prefixes Studio, Room, preview, and Replay paths.

| Path | Component | Current primary action | Delete candidates in this PR | Keep path |
| --- | --- | --- | --- | --- |
| `/`, `/chatgpt-plugin/new` | `CreatorHome` | Describe an idea or attach a source, then **生成可玩版本** | Duplicate **＋ 新游戏** control; second paste-rules textarea and name field; prominent example card actions | One source input and submit; optional file/image upload; recent project links; optional examples; install link |
| `/studio/:projectId` | `ProjectStudio` → `StudioGenerationPlanPanel`, `StudioBuildPlayPanel` | Confirm a pending Generation Plan; then open a playable Shared Session | Pending plan's competing build/iteration actions; duplicate progress and unclear failure/ready copy | Plan approval and unsupported-behavior explanation; existing Studio editing and play controls once approved |
| `/play/:buildId` | `PlayablePreview` | Inspect a Build and return to Studio | None | Existing Build preview deep link |
| `/room/:sessionId` | `RoomView` | Join and take an Intent in a Shared Session | None | Existing session and `share=` deep links |
| `/replay/:replayId` | `ReplayView` | View a Replay | None | Existing Replay deep link |
| No lobby route | `CreatorHome` recent-project navigation; `ProjectStudio` project view | Open a prior Game Project | Do not redesign here | Recent project links stay on home |
| No settings route | No settings page in `CreatorWorkspace` | None | None | No link to repair |

The removed **＋ 新游戏** action cleared the home form. The single home composer remains the creation entry; users can edit or clear its text and submit another idea. The removed rules field is replaced by the same idea textarea, which accepts pasted rules. Existing example sessions remain available under **先玩一局现成的**. No Room, auth, or share URL behavior changes in this PR.

## PR2 lobby, session, and settings shell

`CreatorWorkspace` now resolves `/games` to `GameLobby` and `/settings` to `CreatorSettings` (with the same `/chatgpt-plugin` mount behavior). `/room/:sessionId` still resolves to `RoomView`; its `share=` URL and invitation source are unchanged.

| Path | Data slots and primary action | Secondary path |
| --- | --- | --- |
| `/games` | `listProjects` supplies the title; `getBuilds` and `getSharedSessions` determine whether to continue an existing Session, start one from a share-ready Build, or finish setup in Studio. No project summary, genre, or thumbnail field exists. | Manage in `/studio/:projectId`; create from `/`. |
| `/room/:sessionId` | Existing Build and Session state supply the seat picker, turn cue, game surface, and actions. A failed Build load offers retry. | Invitation URL and Replay remain; `/games` and `/settings` are navigation. |
| `/settings` | Existing `godesk-room-locale` preference is saved immediately. | Create and lobby navigation. |

Delete/keep mapping: the home recent-project sidebar remains a quick link on desktop, with the full project list at `/games` available on narrow screens. Lobby cards have one primary action and one manage link; no generic island thumbnail or invented summary is shown. The Room language switch moved to Settings; the Room continues reading its stored language on load. No volume, motion, or display preference exists to consolidate, so no inactive toggles were added. The Studio mobile rail previously hid its return link; visible header links now provide the lobby and settings path.
