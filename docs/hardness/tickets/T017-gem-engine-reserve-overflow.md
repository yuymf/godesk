# T017 — gem-engine：保留手 / token 溢出规则

| 字段 | 值 |
| --- | --- |
| 回归靶 | H03（harness only） |
| 层 | **内核**（gem-engine-v1 同层扩） |
| 状态 | **开** |
| 证据 | （待） |

## 现象（Open · regress-t015）
gem-engine-v1 可玩子集已过 floor；仍缺 **reserve hand**、**3–4 席**、**complex gold overflow UI**（席位见 T019）。

## 期望（通用能力）
1. **Reserve hand**：从市场保留一张发展牌到手牌；后续可用折扣购买；保留位有上限。
2. **Token overflow**：持币上限与溢出弃回银行的通用规则；wild/gold 计入上限时规则明确；UI 至少能完成弃币，不依赖题材特判文案。

## 验收
- 冷启动 H03：reserve + overflow 可执行或仍诚实点名剩余缺口；floors 不因本能力回退。
- 单元覆盖 reserve / overflow；无样例 IP 特判。

## Out of scope
- 3–4 席（→ T019）
- 贵族/牌级已有能力重做；Collecta；合 #179

## 相关
- 回归靶：H03
- 前序：T010 gem-engine 内核
