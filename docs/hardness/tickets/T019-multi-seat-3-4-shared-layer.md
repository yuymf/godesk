# T019 — 多席能力（3–4），优先跨内核共享层

| 字段 | 值 |
| --- | --- |
| 回归靶 | H01 / H03 / H04（及任何仍锁 2 席的盘面内核） |
| 层 | **内核共享层**（席位 / 轮转 / playability） |
| 状态 | **闭** |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0{1,3,4}-t019/` |

## 现象（Open · regress-t015）
多套件仍报 **3–4 席** 缺口（hex / gem / pattern 等）。gallery 已示范 2–5；路线/宝石/纹样草稿仍偏 2 席硬编码。

## 落地（通用能力）
- 新增 `src/runtime/seat-capacity.ts`：`SEAT_CAPACITY` / `clampSeatCount` / `parseSeatCountFromIdea`（区间取上界）/ `resolveSeatCount` / `nextSeatId` / `winnerByHighestScore` / bank·factory 缩放
- **gem-engine-v1** / **pattern-draft-v1**：2–4 席；轮转、席数组、终局胜者不再假设仅 2；nobles≈N+1、factories≈2N+1
- **hex-settlement-v1**：job-runner 经共享层解析人数（内核本已 2–4）
- playability floor：gem/pattern 接受 2–4；`configure_*` 校验与 participants 同步 max=4
- network-route 仍 2 席（未扩本票；共享层已声明 capacity）

## 验收对照
- [x] 至少两个盘面内核在 3/4 席冷启动可执行且 floors 合理（H03/H04 → playerCount=4；H01 亦 4）
- [x] unsupported 去掉「仅因 2 席硬编码」类条目（H03/H04 Open 席位关闭）
- [x] 无样例 IP 特判；未合 #179；Collecta 未动

## Out of scope（仍开）
- 复杂多方经纪 / 国内拍卖议价矩阵（H01）
- network-route 3–5 席
- 同时实时密封（→ T020）
- Collecta / T021

## 冷跑
| 套件 | kernelPC | floors | 证据 |
| --- | --- | --- | --- |
| H01 | 4 | passed | `H01-t019/` |
| H03 | 4 | passed | `H03-t019/` |
| H04 | 4 | passed | `H04-t019/` |
