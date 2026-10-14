# T027 — 共享 3D 桌面：pattern-draft → TabletopStage

| 字段 | 值 |
| --- | --- |
| 回归靶 | H04（presentation / 可分享 3D 链路） |
| 层 | **共享呈现**（复用 T026 舞台约定） |
| 状态 | **开** |
| 证据 | （T026 闭后开刀；`H04-t027/`） |

## 现象（Open · post-T025 gap scan）
pattern-draft-v1 内核 + floors 已过；Room 仍 DOM `PatternDraftBoard`，无 TabletopStage。  
与 H03 同因：记分停 **PASS（子集）**，总验收「中间 3D」未满足。

## 实现（通用）
1. `patternDraftLayout`：工厂圆盘、中心堆、准备行、纹样墙、地板 → TabletopLayout（objectKind 尽量与 T026 共享 disc/card/token）。
2. `PatternDraftBoard` 挂 `TabletopStage` + 可访问行动列表。
3. 单测 layout；H04 冷启动 floors 不回退。

## 验收对照
- [ ] H04 冷启动：3D 舞台可见；floors 不回退
- [ ] 记分趋向 **PASS（可玩子集）**
- [ ] 无样例 IP 特判；未合 #179；Collecta 未动；T021 未排

## Out of scope
- T026 未完成前不排刀
- auction-bidding 3D（可后续复用同层）
- presentationFloor 强制收紧（可与本刀后序）

## 相关
- T026；gap-scan-post-t025；ADR 0014；前序 T013/T018/T019
