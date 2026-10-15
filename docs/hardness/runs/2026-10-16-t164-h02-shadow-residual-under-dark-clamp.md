# T164 · H02 shadow residual under dark-clamp

| field | value |
| --- | --- |
| baseline tip | `c67cde7` |
| evidence | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t164/` |

## Pixel gate

| suite | crop | mean | ge20% | gate |
| --- | --- | --- | --- | --- |
| H02 | wide | **8.044** | **14.49** | **PASS** |

## H04 upper-ink（勿压暗）
- vs T161 after：delta −1.19 · not_darkened_vs_t161 · lighter_ok
- vs T158：lighter_ok 保住

## T157
- H05 close ink 185.7 → 173.7 · calm_ok

## Change
- route `softContactShadow(usable*1.45, …, opacity 0.70)`；T161 mid blot 未回浓

未合 main。不自宣达标。
