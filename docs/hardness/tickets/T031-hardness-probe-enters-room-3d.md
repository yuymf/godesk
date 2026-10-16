# T031 — 硬度冷启动探针进真 Room 3D

| 字段 | 值 |
| --- | --- |
| 回归靶 | H01–H05 证据链 |
| 层 | **硬度探针 / 证据**（非样例游戏） |
| 状态 | **关** |
| tip | `1f2f4e2a905a6401fd0db23f3eb476941a1a5d9c` |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-probe-t031/` |

## 现象
`hardness-real-probe.mjs` 的 `03-play` 常截到「这个版本长什么样」文档页，而非可分享 Room（hasStage/host+canvas）。与 share-gate / 总验收「中间 3D」证据链错位。

## 实现（通用）
1. 仓内 `scripts/hardness-real-probe.mjs`：floors 通过后 `POST /api/builds/:id/sessions` → 打开 Room → 入座 → 截 `03-play` + `15-room-stage`。
2. 记录 hasStage / g3d-scene-host / canvas / data-kernel；记分板注明探针路径。
3. 失败时才回退 playableUrl（标 `03-play-docs`）。

## 验收对照
- [x] 五套 `03-play` 为 Room 3D（非文档页）——见 `docs/hardness/runs/2026-10-15-H0x-T031.md`
- [x] 无样例特判；#179 draft；Collecta/T021 未动
