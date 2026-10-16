# T265 · ortho 厚度 polar + 座次 chrome 让路

基线 `fa2f29a`（T263）。清 T264「ortho 压扁 + 座次抢读」。

## 改动（共享层）
1. **相机 polar**：play 54°→56°，`PLAY_MIN` 45→46；RenderSpec hex 40→44 / network 28→34 / desk 44→45 —— 立缘可读，保 corner/centerCalm。
2. **座次让路**：`SEAT_COLORS` 降饱和但**保亮度**（黄座 `#e8d070` 不压暗中心）；`seatMaterial` 哑光低 clearcoat；share collapse 下 yours-chip 更淡更小。
3. **calm**：desk hemi 暖抬 + shadow 0.94；禁 vignette。

## 守门
H01–H05 HARD + share 0.962/0.88 + purge/center/corner/T157/T161/T193/T202
