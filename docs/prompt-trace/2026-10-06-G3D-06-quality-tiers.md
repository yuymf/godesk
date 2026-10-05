# G3D-06 · 质量分级

| 项 | 值 |
| --- | --- |
| goal | SPEC §4.7 / §6.3 G3D-06：`tiers.ts` 自动检测 + localStorage 覆盖 + 运行时降级 + `?tier=`；设置页画质/省电；SceneHost 应用 DPR/FPS/阴影/MSAA |
| deps | G3D-04 #109、G3D-05 #110 已在 main |
| knife | Track B 承接（原 Track A 调度改由 B 做 06，A 做 09→07） |
| tools | Codex 额度耗尽；手写实现 |
| 验收 | `?tier=` 下 `data-tier` / caps 一致；单测覆盖 concurrency / deviceMemory；EP 画像：移动 saver=auto→low、桌面→high；证据 `/workspace/g3d-evidence/G3D-06/` |
