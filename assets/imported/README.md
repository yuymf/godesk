# imported (CC0)

Round-6tex downloads via `http://127.0.0.1:8787` (3d-asset-server):

| id | source | license | used as |
|----|--------|---------|---------|
| polyhaven:forrest_ground_01 | https://polyhaven.com/a/forrest_ground_01 | CC0-1.0 | t01-pine |
| polyhaven:wood_planks | https://polyhaven.com/a/wood_planks | CC0-1.0 | t08-wood |
| ambientcg:Ground024 | https://ambientcg.com/a/Ground024 | CC0-1.0 | t03-meadow |
| ambientcg:Rock056 | https://ambientcg.com/a/Rock056 | CC0-1.0 | t05-reef |
| ambientcg:WoodFloor043 | https://ambientcg.com/a/WoodFloor043 | CC0-1.0 | t09-paintwood |
| ambientcg:Ground037 / Ground033 / Ground054 / Rock023 / Fabric045 / Paper001 | ambientcg.com | CC0-1.0 | t02/t04/t06/t07/t10/t11 |

Raw 1K caches live under `/workspace/g3d-evidence/` (not committed). Runtime ships only `assets/textures/pbr/**/*.ktx2`.
Bake: `TOKTX=... python3 scripts/bake-pbr-r6-tex.py`
