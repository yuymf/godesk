# T140 · hex-force-budget-trim

| tip base | `d7ea1f6` |
| --- | --- |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t140/` |
| 层 | 工具 · prefetch seats + reuse intent state + first legal only |

## Timing

| | before (T136) | after (T140) |
| --- | --- | --- |
| wall / elapsed | ~67s / budget 90s | **46.97s** / budget 55s |
| forceOk | true | **true** |
| settle / roads | ≥2 | **2 / 2** |
| via | listLegalActions | listLegalActions |
| glyphOk / canvasReady | — | **true / true** |

Material reduction ≈30% wall time；legal-actions path retained。

未合 main。不自宣 ≥9。
