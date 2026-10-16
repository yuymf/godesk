# T225 · 共享编号/港口/水岸实体化（筹码·码头·浅滩）

## SUCCESS
- H01–H05 守 HARD vs tip；centerFails=0 cornerFails=0
- continuity 不回退 T217/T218/T221/T222；share 0.962/0.88 不降；purge false
- 可见从「可读」到「实体部件」的增量
- 只动共享 materials/tokens/pieces/render-spec/softContact；禁止 suite fork

## 数字（vs tip `36d1440` / H0x-t223 wide）
| suite | HARD | mean | ge20% | share |
|-------|------|------|-------|-------|
| H01 | yes | 11.22 | 15.5 | 0.962 |
| H02 | yes | 5.03 | 6.8 | 0.88 |
| H03 | yes | 6.07 | 5.8 | 0.88 |
| H04 | yes | 5.89 | 5.1 | 0.88 |
| H05 | yes | 5.32 | 4.8 | 0.88 |

RESULT：keepHARD true · contFails=[] · t157/t161 true · cornerFails=0

证据：`…/hardness-real/H0x-t225/`（不入库）
