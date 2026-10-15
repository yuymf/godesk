# T222 · 共享 hex/桌面部件产品化（地形 PBR·编号·港口·水岸·聚落）

## SUCCESS
- H01–H05 守 HARD vs tip；centerFails=0 cornerFails=0
- continuity 不回退 T217/T218；可见产品向增量
- 只动共享 materials / tokens / pieces / render-spec / softContact；禁止样例特判

## 数字（vs tip `8bb40c5` wide）
| suite | HARD | mean | ge20% | share |
|-------|------|------|-------|-------|
| H01 | yes | 45.70 | 53.4 | 0.962 |
| H02 | yes | 25.25 | 23.3 | 0.88 |
| H03 | yes | 20.46 | 25.0 | 0.88 |
| H04 | yes | 17.51 | 22.3 | 0.88 |
| H05 | yes | 19.08 | 25.8 | 0.88 |

RESULT：keepHARD true · contFails=[] · h01-vs-t217 / h03-vs-t218 HARD · t157/t161 true

证据：`…/hardness-real/H0x-t222/`（不入库）
