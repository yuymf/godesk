# 第三方声明（THIRD_PARTY_NOTICES）

本文件汇总 GoDesk / 汐屿（Tidewell Isles）分发中涉及的第三方组件许可证全文或摘要。
资产文件逐项登记见 [`assets/LICENSES.md`](./assets/LICENSES.md)。

## 运行时依赖

### three（MIT）

- 版本：0.186.1
- 用途：WebGL 渲染、`GLTFLoader`、`KTX2Loader`、`OrbitControls`、`RoomEnvironment`
- 许可证：MIT License
- 版权：Copyright © 2010-2026 three.js authors

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

### Basis Universal 转码器（Apache-2.0）

- 来源：随 three `examples/jsm/libs/basis`
- 用途：KTX2 / Basis 纹理 GPU 转码（G3D-11 起懒加载）
- 许可证：Apache License 2.0
- 全文：https://www.apache.org/licenses/LICENSE-2.0

### meshopt 解码器（MIT）

- 来源：随 three `examples/jsm/libs/meshopt_decoder.module.js`
- 用途：`EXT_meshopt_compression` GLB 网格解压
- 许可证：MIT
- 版权：Copyright (c) 2016-2024 Arseny Kapoulkine

## 构建期依赖（不随生产 JS 下发）

### @gltf-transform/*（MIT）

- 用途：GLB meshopt 压缩、贴图管线辅助（G3D-11）
- 许可证：MIT

### size-limit / @size-limit/file（MIT）

- 用途：包体预算门

## 字体

### Manrope（SIL Open Font License 1.1）

- 用途：现有 HUD 字体
- 许可证：OFL-1.1
- 全文：https://openfontlicense.org/open-font-license-official-text/

### Fraunces Display（SIL Open Font License 1.1）

- 文件：`assets/fonts/fraunces-latin-display.woff2`
- 用途：汐屿标题显示字体（G3D-23）
- 来源：https://github.com/google/fonts/tree/main/ofl/fraunces
- 修改：实例化 Soft=50 / opsz=36 / wght=600，pyftsubset 拉丁子集
- 许可证全文：`assets/fonts/fraunces-OFL.txt`


## 明确不包含

- settlecoast.com 及其任何模型、音频、插画、文案、shader
- 任何 CC BY 或附加署名限制的素材（SPEC §5.1 不允许）

## Kenney UI Audio (via OpenGameArt)

- Source: https://opengameart.org/content/51-ui-sound-effects-buttons-switches-and-clicks
- License: CC0-1.0
- Used in: G3D-26 core/extended SFX sprites (selected click/switch clips)

## OpenGameArt CC0 music (G3D-27)
See prompt-trace.
