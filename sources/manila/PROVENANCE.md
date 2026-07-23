# Manila internal validation fixtures

Status: internal-prototype-only

These files are retained only to validate the PRD's AI-native tabletop authoring
workflow. They are not cleared for redistribution, publishing, or production use.

## Rulebook

| Local file | Source | SHA-256 | Result |
| --- | --- | --- | --- |
| `manila-rulebook-en.pdf` | <https://michalskig.files.wordpress.com/2010/10/manilaenglishgame_133_gamerules.pdf> | `9a6a02b79e1a3155a8539166aacefe7f447c191b37352ebb80e38379f0e26f4b` | Accepted; 8 readable pages, visually inspected |
| `manila-rulebook-en.rejected-corrupt.pdf` | <https://world-of-board-games.com.sg/docs/Manila.pdf> | `ab787ca888fed07c3bb82ec0b6b563afb711fbd0c03c312e9e210d1ee4814171` | Rejected; corrupt download |

`manila-rulebook-en.txt` is a local text extraction of the accepted PDF. The
rendered page images under `public/manila/rules/` are local validation
derivatives of that PDF.

## Reference photography

| Local file | Source | SHA-256 |
| --- | --- | --- |
| `assets/manila/source/box-cn.jpg` | <https://cdn.prod.website-files.com/575714cc825e8dbc6c83b98a/5ab9086a326fa93d1cea1590_Manila_Box_3D_CN.jpg> | `7c98f86a02ea658761ce32935168b52de46e4ea7ab04afe0226784c481b6ff67` |
| `assets/manila/source/play-1.jpg` | <https://cdn.prod.website-files.com/575714cc825e8dbc6c83b98a/5cdc0d8f7720d458952ea3c1_Malina_Play1.jpg> | `ef0a7c3b19e2a5cf21cd4d8c6c70e1c79d7a3341a79486f73c103fdfd98f8951` |
| `assets/manila/source/play-2.jpg` | <https://cdn.prod.website-files.com/575714cc825e8dbc6c83b98a/5cdc0d93b9eac857ef3a90a2_Malina_Play2.jpg> | `acd5dd9df5eb42ed196f204e89bd3a28224b759083d9a3c027f921a19dd25ffe` |
| `assets/manila/source/box.jpg` | <https://www.planetongames.com/7556-large_default/manila.jpg> | `bcaa67ddd9172e10b0d6e8137c5b8cdb95978d2f2ed4c4c54251b7a0a7119efc` |
| `assets/manila/source/setup.jpg` | <https://www.planetongames.com/7553-home_default/manila.jpg> | `529d28396c256553d80fbe908de88b891f7f253742243324c7a9e9ac3a42a360` |
| `assets/manila/source/components-a.jpg` | <https://www.planetongames.com/7554-home_default/manila.jpg> | `db0c41e6b18b9a500068de9cf893d1c4506b7aa8dfca33615349fd08f66dc6c9` |
| `assets/manila/source/components-b.jpg` | <https://www.planetongames.com/7555-home_default/manila.jpg> | `a569cb6edd4da2175908515fd0bf8cdcb96c3f7ad279eb99cfe72da168998652` |

The copied files under `public/manila/photos/` exist only so the local prototype
can render the validation fixtures.
