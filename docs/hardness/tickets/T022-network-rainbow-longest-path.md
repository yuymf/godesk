# T022 — network-route：脸朝上彩虹拿取限制 + 最长路奖励

| 字段 | 值 |
| --- | --- |
| 回归靶 | H02 |
| 层 | **内核**（network-route-v1 tickets） |
| 状态 | **闭** |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H02-t022/` |

## 落地
1. **Face-up rainbow take limits**：脸朝上万能仅可单抽；非万能可组两张（第二张不得为脸朝上万能）；公开列万能达阈值整列重刷。
2. **Longest-path bonus**：终局按自有边最长简单路径发参数化奖励（并列均得）。

## 验收对照
- [x] H02 冷启动 floors 不回退；unsupported 去掉 rainbow/longest
- [x] 单测：彩虹限制 + 最长路各 ≥1 绿
- [x] 无样例 IP 特判；未合 #179
