# T008 — 车票之旅式规则书未推断 route-network，错绑 hand-play

| 字段 | 值 |
| --- | --- |
| 套件 | H02-ticket-to-ride probe1 |
| 层 | **解析（mechanics infer）** |
| 状态 | **已关** · sha `45adb74` / tip `114ef13` · H02-probe2 PASS |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H02-probe2/` |

## 现象
`requestedMechanics=[]`，executable **hand-play-v1**。规则书含「认领路线 / 车厢牌 / 车票起终点 / 铺线」。

## 期望
命中 `route-network` → network-route-v1（或诚实缺口）；禁止用出牌计分手牌内核冒充铁道铺线。

## 最小通用修法
扩展 route-network cue（车票、车厢、认领路线、铺线、铁道）并加否定；hand-play 回落不得抢路线题材。

## 关闭（probe2）
扩展 route-network cue；hand-play 不得抢路线题材。冷启动 `H02-probe2`：mechanics=[route-network] → network-route-v1，floor passed。
