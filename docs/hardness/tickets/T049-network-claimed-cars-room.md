# T049 — network 已占边「分色车厢」Room 实证

| 字段 | 值 |
| --- | --- |
| 回归靶 | H02 before(未占)/after(已占分色车厢) 成对；他套 smoke |
| 层 | **共享呈现**（network-route claim → 车厢段） |
| 状态 | **关** |
| tip | `6e36ba7` |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t049/` |

## 问题
T046 灰轨槽在；Room 缺「强制 claim 至少一边 → 分色车厢」成对实证。

## 实现（通用）
1. 已占边：座位色可数车厢段（加高车身/车顶，区别未占弱轨）。
2. 探针 force-claim ≥1 edge 后拍 close+wide。
3. **不**自宣 ≥9。

## 验收
- [x] H02 before/after 成对
- [x] unit claimed≠unclaimed
- [x] 他套 smoke
