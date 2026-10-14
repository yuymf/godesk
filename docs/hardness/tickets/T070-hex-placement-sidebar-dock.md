# T070 — hex placement sidebar dock

| 字段 | 值 |
| --- | --- |
| 回归靶 | H01 targetsOpen=true 时 canvas share≥0.60；侧栏贴边细条；默认折叠；rejectedShell=false |
| 层 | **共享呈现 / Room chrome** |
| 状态 | **开** |
| tip | pending |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t070/` |

## 问题
T067 打开落点仍约 378² 占岛一角，需更贴边的细侧栏。

## 实现（通用）
1. open → 贴边/底细条；禁半屏盖岛；默认仍折叠。
2. **不**自宣 ≥9。
