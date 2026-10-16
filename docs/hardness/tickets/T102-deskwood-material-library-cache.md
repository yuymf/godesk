# T102 — deskWood MaterialLibrary cache

| 字段 | 值 |
| --- | --- |
| 回归靶 | deskWood maps 进 MaterialLibrary 共享缓存；H02–H04 不 regress T098；T092 rim ok |
| 层 | **共享呈现**（MaterialLibrary + deskWoodMaterial） |
| 状态 | **关** |
| tip | `01f9a17` |

## 问题
deskWoodMaterial 每次新建 canvas maps，未走共享库。

## 拟实现（通用）
MaterialLibrary.ensure(key, factory)；deskWood 按 base 缓存。
