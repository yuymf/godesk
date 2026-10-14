# T006 — 星港物流核心规则超出 network-route-v1（内核能力缺口）

| 字段 | 值 |
| --- | --- |
| 套件 | H02-starport-convoy（run2） |
| 层 | **内核配置 / 内容**（network-route 能力边界） |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness/H02-run2/` |
| 前置 | T004 已修解析否定；本票不是误绑 auto-battler |

## 现象

H02-run2 正确选 `route-network` → `network-route-v1` executable，并诚实写 unsupported（无车票副牌/多色路等）。但规则书**核心可玩循环**仍未落地：

- 货运合约（起点→终点、报酬、时限）
- 船型（载重/速度/防护）与航行逐步移动
- 资金/信誉双资源与信誉 10 胜负
- 通行费边、事件（风暴/海盗）

当前内核只跑「固定城市图、轮流占线、先连终端枢纽」近似，用户粘贴的物流规则书无法按书玩完一局。

## 复现

1. 粘贴 `docs/hardness/suites/H02-starport-convoy/INPUT.md` 生成并确认
2. 观察 `runtimeSupport.kernel.type === network-route-v1` 且 status executable
3. 进房：无合约市场、无船调度；仅 route claim 图

## 期望

二选一（诚实优先）：

- **A**：扩 `network-route-v1`（或物流专用 kernel）支持合约牌/边权/双资源到可玩最小闭环；或
- **B**：无物流闭环时 **不**标 executable；Plan/unsupported 写明「无 freight-contract / fleet logistics 内核」，引导用户改规则或等内核

## 最小通用修法方向

不要为星港写死皮肤。扩内核能力矩阵：边权费用、目标连接以外的「合约交付」胜负、或显式 capability gap → non-executable。禁止放宽 H02 SUCCESS 来绿闸。

## 状态

**Open**（H02 记「部分过」：解析/反假阳性过；核心可玩未过）
