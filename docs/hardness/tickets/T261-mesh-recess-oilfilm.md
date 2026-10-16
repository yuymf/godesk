# T261 · mesh face-well + oil-film clearcoat（产品级阶跃）

基线 `d3c2c0b`（T259）。**禁止**再拧 stamp ox/oy、gdHi apothem、sheep vertex。

## 改动（共享层）
1. **编号筹码 mesh 凹井**：`SceneHost.sharedNumberGeom` 顶面内盘下沉 `CHIP_FACE_RECESS` + 外缘抬唇 `CHIP_FACE_RIM`；数字贴花 `LABEL_LIFT` 落入井底（拓扑凹印，非 canvas 带宽）。
2. **岛面油膜**：`TERRAIN_MATERIALS` 加 clearcoat；`createMaterial` 对 brush+clearcoat 走 MeshPhysical 油膜；brush dab 场驱动 **法线扰动 + 粗糙度湿峰**（连续油彩厚度，非 pbrTint）。
3. **牌匾 mesh 沉面**：parchment 面改为下沉 Box 板 + 木框抬唇。

## 守门
H01–H05 HARD + share 0.962/0.88 + purge/center/corner/T157/T161/T193/T202
禁 vignette / suite fork / bevel-constant 空转。
