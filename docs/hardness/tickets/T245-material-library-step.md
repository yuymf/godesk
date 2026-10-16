# T245 · MaterialLibrary / materials / lighting 材质阶跃

基线 `345eafc`。判官纠偏：禁止再拧倒角常数；本刀做用户冷启动能一眼看出的 **PBR-ish 材质阶跃**。

## 改动（共享层，禁样例特判）
- `materials.ts`：grain/cloth/stone PATTERN_GLSL 重写（车木年轮/纸板纤维/沉积岩层）；kraft soft-edge + pressed lip；lacquer grain → MeshPhysical；normalScale/AO/PATTERN_STRENGTH 抬升
- `tokens.ts`：number-token / wood clearcoat + 更低 roughness；environment intensity 抬升
- `lighting.ts`：AgX 注释锚定产品桌面曝光
- `render-spec.ts`：共享 felt 由 tip cool mint → ochre/parchment（H02/H03/H04/H05），HARD 可辨

## 守门
H01–H05 HARD + share 0.962/0.88 + purge/center/corner/T157/T161/T193/T202
