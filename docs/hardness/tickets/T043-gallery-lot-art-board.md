# T043 — 共享「画廊拍品板」保真

| 字段 | 值 |
| --- | --- |
| 回归靶 | H05 Room 宽+近；H03/H04 smoke |
| 层 | **共享呈现**（auction lot + market track；phase→HUD） |
| 状态 | **关** |
| tip | （feat commit 后填） |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t043/` |

## 现象
拍品仍是素卡；桌面持久 `open r1` 类 phase debug 字串；市场轨/出价可读性弱。

## 实现（通用）
1. 拍品：`framed-art` 木框画板 + 程序色块/笔触（**无外站版权图**）；offer 手牌 / live floor / currentLot 共用。
2. 市场轨：画家 plaque + 可读行情价。
3. **禁止**桌面持久 `open r1` 式 phase debug；phase/现价进 HUD overlay。
4. 无样例特判。**不**自宣 ≥9。

## 验收对照
- [x] H05 before/after 宽+近（含 lot-close）
- [x] H03/H04 smoke 无回退
- [x] 桌面无 phase debug token；单测绿
