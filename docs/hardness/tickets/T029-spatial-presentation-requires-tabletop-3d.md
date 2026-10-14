# T029 — 空间体裁 presentationFloor / share-gate 须 TabletopStage·SceneHost

| 字段 | 值 |
| --- | --- |
| 回归靶 | H01–H05（呈现门闩 · 可分享 3D） |
| 层 | **共享呈现 / share-gate** |
| 状态 | **闭** |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/T029-floor/` |

## 落地
1. `BoardPresentation` 新增 `tabletop-3d`；已挂 SceneHost/TabletopStage 的空间内核改登记。
2. `dedicated-board`（纯 DOM）→ presentationFloor **失败**（文案含 SceneHost/TabletopStage）。
3. share-gate 读 floor；DOM-only 拒分享。
4. 单测：DOM 失败 / tabletop-3d 与 gem-engine floor 通过。

## 验收对照
- [x] 单测绿（presentation-floor + share-gate）
- [x] 无样例特判；未合 #179；Collecta 未动；T021 未排
