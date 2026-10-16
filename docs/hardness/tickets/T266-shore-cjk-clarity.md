# T266 · 水岸接缝 + 牌面/画布清晰

基线 T265。清 T264「水岸两套材质接缝 + 牌面 CJK 发虚」。

## 改动（共享层）
1. **水岸接缝**：tide shader wet-sand / shoreHug 加宽加色；`island:wet-sand-apron` 水线砂盘 mesh；medium/low shoreFoam 可见；shallow `#7affd8`。
2. **画布清晰**：plaque/label/card/lot Canvas 2× + anisotropy 16 + mipmaps；station/lot 字号；glaze 对比；desk/network 牌布/地图/卡牌材质清晰读（非 vignette）。

## 守门
H01–H05 HARD + share 0.962/0.88 + purge/center/corner/T157/T161/T193/T202
