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
