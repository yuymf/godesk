# T152 — hex force sub-5s

| 字段 | 值 |
| --- | --- |
| 回归靶 | T149 ~6.2s → elapsed <5000ms |
| 层 | **共享工具** · chainSetup hops + budget |
| 状态 | **关（PASS）** |

## 实现（通用）
- DO `hop < 16` + seat0 goal early-break
- force inject budget default 5000；client early-exit after chain RTT
- 保 forceOk / settle·roads 2/2 / listLegalActions / glyphOk / canvasReady
