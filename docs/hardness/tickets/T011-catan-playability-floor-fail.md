# T011 — 卡坦式已绑 hex-settlement 但 playabilityFloor failed

| 字段 | 值 |
| --- | --- |
| 套件 | H01-catan probe1 |
| 层 | **配置 / 呈现门闩** |
| 状态 | **已关** · sha `45adb74` / tip `114ef13` · H01-probe2 部分（floor passed） |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H01-probe2/` |

## 现象
kernel hex-settlement-v1 executable，presentation passed，**playabilityFloor failed**；预览可开但门闩挡完整开玩路径。

## 期望
与来源体裁一致时 floor 应过；或给出可读 reason。核心闭环（掷产/建造/强盗）可玩。

## 最小通用修法
查 playabilityFloor 对 hex + participants 3–4 / generic genre 的误拒；修门闩或生成 participants 与内核对齐。

## 关闭（probe2）
playabilityFloor：声明机制与 board kernel 对齐时放行（不特判卡坦）。冷启动 `H01-probe2`：hex-settlement-v1 + floor/presentation passed。
