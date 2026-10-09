# Prompt trace — G3D-JUDGE-R6-TEX（刀序①，2026-10-07）

- 大主管 round-5/6 最高优先：杀掉塑性玩具感，地块/房屋走真 PBR/画感贴图。
- 基线 #148 tip `70b8a1a`；分支 `feat/g3d-judge-r6-tex`；draft PR base `feat/g3d-judge-r1`。
- **做法**：3d-asset-server 拉 Poly Haven forest/wood + ambientCG 地面/岩/木地板；`bake-pbr-r6-tex.py` 轻度分级后 toktx 覆盖 `assets/textures/pbr/t01–t11`（CC0，登记 LICENSES）。
- 棋子：保留 UV、合并进 mergeParts；`PIECE_VC_TOKEN` 用 t09-paintwood albedo×vertexColors，关 clearcoat。
- `PBR_TINT_TO_WHITE` 0.55→0.35；pattern 强度 0.2→0.08。
- **未达标**（交大主管）。手写。
