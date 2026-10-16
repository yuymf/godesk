# T254 · hex 切边细高光 + 通用桌面可读

共享层（MaterialLibrary / render-spec / tokens），非 suite fork。**PASS** vs tip `H0x-t251` @ `15f86da`。

## 改动
- `materials.ts`：`HEX_EDGE_HIGHLIGHT` + `gdHi` 切边细高光；kraft 侧唇对比；`TERRAIN_SATURATION`≤2.70；`SEAM_HALF_WIDTH`≤0.006
- `tokens.ts`：`TERRAIN_MATERIALS` 色度 / `pbrBaseColor:false` 让基色主导；`HEX_ISLAND_LIGHTING` cornerCalm≈tip
- `render-spec.ts`：network / desk 共享层 HARD 可读（无 vignette / 无暗垫 / 无 sample 特判）

## 证据
- `…/H0x-t254/` · RESULT PASS · 同 T253 守卫全绿
