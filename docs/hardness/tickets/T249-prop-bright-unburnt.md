# T249 · props 修暗（保留 GLB mesh）

观感挂账：T246/T247 宽帧里 Tidewell GLB 树/羊/岩过暗/偏焦。

## 改动（共享 `terrain-props`）
- `liftGlbAlbedo`：抬亮 GLB 烘焙顶点色，instanceColor 驱动桌游可读 albedo
- 去掉过重 grass/stone pattern + env/metalness；matte bright
- 树种 tone 提亮；减少向深色 wood albedo 的 blend
- 羊 dissolve pattern 0.8→0.18

交判必须附 **左 T247 / 右 T249** 同机位宽帧 JPEG。

## 探针
- PASS · 证据 `…/H0x-t249/` · JPEG 左T247/右T249
