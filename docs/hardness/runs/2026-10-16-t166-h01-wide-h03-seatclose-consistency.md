# T166 · H01 wide + H03 seat-close/wide consistency

| field | value |
| --- | --- |
| baseline tip | `a456f00` |
| evidence | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t166/` |
| tipSrc | `H0x-t165/*/after` |

## Pixel gate（硬约束）

| suite | crop | mean | ge20% | gate |
| --- | --- | --- | --- | --- |
| H01 | wide | **7.050** | 4.09 | **PASS** |
| H01 | seat-close | **15.877** | **13.37** | **PASS** |
| H03 | wide | **23.215** | **20.55** | **PASS** |
| H03 | seat-close | **48.971** | **38.83** | **PASS** |

## Guards
- H02 wide/seat residual still present (T164 direction)
- H04 upper-ink：delta −6.68 · lighter_ok · not_darkened_vs_t161
- H05 T157 abs：185.7 → 155.7 · calm_ok

未合 main。不自宣达标。
