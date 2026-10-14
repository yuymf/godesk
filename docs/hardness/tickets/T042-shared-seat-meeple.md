# T042 — 共享席位棋子「人偶/meeple」

| 字段 | 值 |
| --- | --- |
| 回归靶 | H03 / H04 / H05 Room 同机位近距席位子 |
| 层 | **共享呈现**（tabletop seat marker mesh） |
| 状态 | **开** |
| tip | （实现后填） |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t042/` |

## 现象
席位标记仍是 `building`→house 锥房；桌面像「小房子阵列」而非通用桌游人偶；前后不可辨。

## 实现（通用）
1. 以共享 `meeple`/`pawn` 网格替换 gem/pattern/auction（及 network）席位 house-cone。
2. 按座位色着色；前后可辨（正面脸/胸，背面平）。
3. 无样例特判。**不**自宣 ≥9。

## 验收对照
- [ ] H03/H04/H05 before/after 近距
- [ ] 单测：席位 marker 绑定 meeple，非 house
