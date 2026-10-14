# T019 — 多席能力（3–4），优先跨内核共享层

| 字段 | 值 |
| --- | --- |
| 回归靶 | H01 / H03 / H04（及任何仍锁 2 席的盘面内核） |
| 层 | **内核共享层**（席位 / 轮转 / playability） |
| 状态 | **开** |
| 证据 | （待） |

## 现象（Open · regress-t015）
多套件仍报 **3–4 席** 缺口（hex / gem / pattern 等）。gallery 已示范 2–5；路线/宝石/纹样草稿仍偏 2 席硬编码。

## 期望（通用能力）
优先落地**共享席位层**，再接到各 adapter：
- `playerCount` 合法范围上提至 3–4（按内核能力声明）
- 轮转、activePlayer、legalActions、bot 选座不假设仅 2
- playability floor / participants 与配置一致
- 避免每个内核复制粘贴「第三席」特例

## 验收
- 至少两个盘面内核（建议 hex-settlement / gem-engine / pattern-draft 中优先共享）在 3 或 4 席冷启动或单测下可执行且 floors 合理。
- 回归靶套件 unsupported 去掉「仅因 2 席硬编码」类条目。
- 无样例 IP 特判；不借机合 #179。

## Out of scope
- 复杂多方经纪 / 国内拍卖议价矩阵（H01 另项，可后票）
- 同时实时密封（→ T020）
- Collecta

## 相关
- 回归靶：H01、H03、H04
- 参考：T015 gallery 2–5 席
