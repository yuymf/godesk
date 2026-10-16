# T052 — 共享席位「购入物落桌」tableau

| 字段 | 值 |
| --- | --- |
| 回归靶 | H03/H05/H04 before/after seat-close；unit owned→seat |
| 层 | **共享呈现**（seatTableauOrigin / owned-pieces mapping） |
| 状态 | **关** |
| tip | `8001058` |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t052/` |

## 问题
席位≈仅 meeple；购入发展卡 / 拍品藏品 / pattern 墙未落在席前桌面。

## 实现（通用）
1. `seatTableauOrigin`：席前 owned 区（朝盘心）。
2. gem：购入卡扇形+面 schema；auction：藏品 framed-art 缩略；pattern：沿用 T050 墙格。
3. 无 sample 特判。**不**自宣 ≥9。

## 验收
- [x] H03/H05/H04 seat-close
- [x] unit owned→seat nodes
- [x] 他套 smoke
