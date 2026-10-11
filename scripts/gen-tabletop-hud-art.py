#!/usr/bin/env python3
"""step3 R2 · 通用木框外壳的 HUD 插画包（程序化 SVG，原创，LicenseRef-GoDesk-Original）。

  python3 scripts/gen-tabletop-hud-art.py

输出 assets/illustrations/tabletop/：
  portrait-traveler-{0..3}.svg  座位肖像（旅人包，RenderSpec.hud.portraits = "travelers"）
  card-landscape-{0..5}.svg     行动卡风景小图（RenderSpec.hud.cardArt = "landscape"）
"""
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "assets" / "illustrations" / "tabletop"
OUT.mkdir(parents=True, exist_ok=True)

INK = "#3a2a1c"

# ---------- portraits ----------
TRAVELERS = [
    # bg, coat, skin, hair, hat kind, accent
    dict(bg=("#f3d9a8", "#c98f4a"), coat="#9b2f24", skin="#f0c49a", hair="#4a2c1a", hat="cap", accent="#e8c15a"),
    dict(bg=("#cfe3ee", "#5d8fb0"), coat="#24527a", skin="#d9a477", hair="#1f1a17", hat="brim", accent="#f2efe4"),
    dict(bg=("#dcebc9", "#6f9a4c"), coat="#2f6b3a", skin="#f3d2b0", hair="#b8752f", hat="scarf", accent="#d9473a"),
    dict(bg=("#f2dcc6", "#b0703f"), coat="#c07a1e", skin="#c48a5f", hair="#2b211a", hat="bowler", accent="#4b3a8c"),
]


def portrait(i: int, t: dict) -> str:
    a, b = t["bg"]
    hat = {
        "cap": f'<path d="M34 46 Q64 18 94 46 L96 52 Q64 44 32 52 Z" fill="{t["coat"]}" stroke="{INK}" stroke-width="2.5"/>'
               f'<path d="M30 52 Q64 44 100 54 L104 60 Q64 52 28 58 Z" fill="{INK}" opacity=".85"/>'
               f'<circle cx="64" cy="34" r="4" fill="{t["accent"]}" stroke="{INK}" stroke-width="1.5"/>',
        "brim": f'<ellipse cx="64" cy="48" rx="40" ry="8" fill="{t["coat"]}" stroke="{INK}" stroke-width="2.5"/>'
                f'<path d="M42 48 Q44 22 64 22 Q84 22 86 48 Z" fill="{t["coat"]}" stroke="{INK}" stroke-width="2.5"/>'
                f'<rect x="43" y="40" width="42" height="6" fill="{t["accent"]}"/>',
        "scarf": f'<path d="M38 56 Q40 26 64 26 Q88 26 90 56 Q80 40 64 40 Q48 40 38 56 Z" fill="{t["hair"]}" stroke="{INK}" stroke-width="2.5"/>',
        "bowler": f'<ellipse cx="64" cy="47" rx="34" ry="6" fill="{INK}"/>'
                  f'<path d="M44 47 Q44 22 64 22 Q84 22 84 47 Z" fill="#3b2f27" stroke="{INK}" stroke-width="2.5"/>'
                  f'<rect x="44" y="40" width="40" height="5" fill="{t["accent"]}"/>',
    }[t["hat"]]
    scarf = (f'<path d="M44 92 Q64 104 84 92 L86 102 Q64 114 42 102 Z" fill="{t["accent"]}" stroke="{INK}" stroke-width="2"/>'
             f'<path d="M72 100 L80 122 L70 120 Z" fill="{t["accent"]}" stroke="{INK}" stroke-width="2"/>') if t["hat"] in ("scarf", "cap") else \
            f'<path d="M58 96 L64 110 L70 96 Z" fill="{t["accent"]}" stroke="{INK}" stroke-width="2"/>'
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<defs><radialGradient id="bg{i}" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="{a}"/><stop offset="1" stop-color="{b}"/></radialGradient>
<clipPath id="c{i}"><circle cx="64" cy="64" r="60"/></clipPath></defs>
<circle cx="64" cy="64" r="62" fill="url(#bg{i})"/>
<g clip-path="url(#c{i})">
<path d="M8 70 Q30 60 50 66 T96 62 T130 70 V130 H0 Z" fill="#ffffff" opacity=".18"/>
<path d="M14 132 Q18 96 44 90 L84 90 Q110 96 114 132 Z" fill="{t["coat"]}" stroke="{INK}" stroke-width="3"/>
<path d="M54 90 L64 108 L74 90" fill="none" stroke="{INK}" stroke-width="2.5" opacity=".6"/>
<rect x="56" y="74" width="16" height="18" rx="5" fill="{t["skin"]}" stroke="{INK}" stroke-width="2.5"/>
<ellipse cx="64" cy="60" rx="21" ry="24" fill="{t["skin"]}" stroke="{INK}" stroke-width="3"/>
<path d="M43 58 Q46 38 64 38 Q82 38 85 58 Q78 48 64 48 Q50 48 43 58 Z" fill="{t["hair"]}"/>
<ellipse cx="56" cy="62" rx="2.4" ry="3" fill="{INK}"/><ellipse cx="72" cy="62" rx="2.4" ry="3" fill="{INK}"/>
<path d="M57 73 Q64 78 71 73" fill="none" stroke="{INK}" stroke-width="2.2" stroke-linecap="round"/>
<ellipse cx="51" cy="70" rx="4" ry="2.5" fill="#e0765a" opacity=".35"/><ellipse cx="77" cy="70" rx="4" ry="2.5" fill="#e0765a" opacity=".35"/>
{hat}
{scarf}
</g>
<circle cx="64" cy="64" r="61" fill="none" stroke="{INK}" stroke-width="3"/>
</svg>
'''


# ---------- landscape card vignettes (160×100) ----------
def sky(i, top, bottom, sun=True):
    s = f'<defs><linearGradient id="s{i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{top}"/><stop offset="1" stop-color="{bottom}"/></linearGradient></defs><rect width="160" height="100" fill="url(#s{i})"/>'
    if sun:
        s += '<circle cx="124" cy="24" r="10" fill="#fff4c8" opacity=".9"/>'
    s += '<path d="M18 22 q8-6 16 0 q6-4 12 0" fill="none" stroke="#ffffff" stroke-width="2.4" opacity=".8" stroke-linecap="round"/>'
    return s


def pines(xs, base, h, col="#2f5e34"):
    out = ""
    for x in xs:
        out += f'<path d="M{x} {base-h} L{x-h*0.35} {base} L{x+h*0.35} {base} Z" fill="{col}" stroke="{INK}" stroke-width="1.2"/>'
    return out


SCENES = [
    # 0 rolling hills + river
    lambda i: sky(i, "#9fd0e8", "#f4e7c4")
      + '<path d="M0 62 Q40 44 80 58 T160 52 V100 H0 Z" fill="#8fb865" stroke="#3a2a1c" stroke-width="1.5"/>'
      + '<path d="M0 74 Q50 62 100 76 T160 70 V100 H0 Z" fill="#6f9a4c" stroke="#3a2a1c" stroke-width="1.5"/>'
      + '<path d="M70 100 Q84 86 72 76 Q64 68 84 60" fill="none" stroke="#5aa8c8" stroke-width="7" stroke-linecap="round"/>'
      + pines([24, 34, 132], 76, 16),
    # 1 snowy mountains
    lambda i: sky(i, "#b8d6ea", "#eef0e6")
      + '<path d="M-4 78 L38 26 L62 56 L92 18 L134 64 L164 40 V100 H-4 Z" fill="#8a8f96" stroke="#3a2a1c" stroke-width="1.5"/>'
      + '<path d="M38 26 L48 38 L42 40 L34 34 Z M92 18 L104 32 L96 34 L86 28 Z" fill="#ffffff"/>'
      + '<path d="M0 82 Q60 70 160 84 V100 H0 Z" fill="#7aa356" stroke="#3a2a1c" stroke-width="1.5"/>'
      + pines([16, 26, 140, 150], 88, 14),
    # 2 coast with sailboat
    lambda i: sky(i, "#a6d8e6", "#f6ebcc")
      + '<path d="M0 58 H160 V100 H0 Z" fill="#2ab8af"/><path d="M0 66 q20-4 40 0 t40 0 t40 0 t40 0" fill="none" stroke="#e9fbf6" stroke-width="1.6" opacity=".8"/>'
      + '<path d="M96 100 Q112 70 160 66 V100 Z" fill="#dcc48e" stroke="#3a2a1c" stroke-width="1.5"/>'
      + '<path d="M40 56 L40 30 L58 54 Z" fill="#f7f1e2" stroke="#3a2a1c" stroke-width="1.4"/><path d="M28 56 H62 L56 62 H34 Z" fill="#9b2f24" stroke="#3a2a1c" stroke-width="1.4"/>'
      + pines([136, 148], 74, 14),
    # 3 pine forest
    lambda i: sky(i, "#c7e2d6", "#f2ead0", sun=False)
      + '<path d="M0 70 Q80 58 160 70 V100 H0 Z" fill="#6f9a4c" stroke="#3a2a1c" stroke-width="1.5"/>'
      + pines([10, 26, 44, 60, 100, 118, 134, 150], 74, 26, "#2f5e34")
      + pines([18, 36, 52, 108, 126, 142], 90, 22, "#3d7340")
      + '<path d="M74 100 Q80 84 86 76" fill="none" stroke="#c9a46a" stroke-width="6" stroke-linecap="round"/>',
    # 4 wheat fields
    lambda i: sky(i, "#a9d2ea", "#f8e9bf")
      + '<path d="M0 56 Q80 46 160 56 V100 H0 Z" fill="#e2b84f" stroke="#3a2a1c" stroke-width="1.5"/>'
      + ''.join(f'<path d="M{x} 100 Q{80+(x-80)*0.35} 70 80 56" fill="none" stroke="#b98a2a" stroke-width="1.4" opacity=".75"/>' for x in range(-40, 220, 18))
      + '<rect x="112" y="40" width="20" height="16" fill="#c0392b" stroke="#3a2a1c" stroke-width="1.4"/><path d="M108 42 L122 30 L136 42 Z" fill="#7a3b25" stroke="#3a2a1c" stroke-width="1.4"/>',
    # 5 stone bridge over gorge
    lambda i: sky(i, "#b3d4e8", "#f1e6c8")
      + '<path d="M0 50 L50 46 L56 100 H0 Z M160 50 L106 46 L100 100 H160 Z" fill="#a08566" stroke="#3a2a1c" stroke-width="1.5"/>'
      + '<path d="M56 100 Q78 84 100 100 Z" fill="#5aa8c8"/>'
      + '<path d="M44 48 H112 V58 H44 Z" fill="#c8b59a" stroke="#3a2a1c" stroke-width="1.5"/><path d="M56 58 Q78 30 100 58 Z" fill="#f1e6c8" stroke="#3a2a1c" stroke-width="1.5"/>'
      + '<path d="M0 50 Q20 44 50 46 M106 46 Q140 44 160 50" fill="none" stroke="#6f9a4c" stroke-width="5"/>'
      + pines([14, 146], 50, 14),
]


def card(i: int, body: str) -> str:
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100" width="160" height="100">{body}<rect x="1" y="1" width="158" height="98" fill="none" stroke="{INK}" stroke-width="2"/></svg>\n'


for i, t in enumerate(TRAVELERS):
    (OUT / f"portrait-traveler-{i}.svg").write_text(portrait(i, t))
for i, scene in enumerate(SCENES):
    (OUT / f"card-landscape-{i}.svg").write_text(card(i, scene(i)))
print("wrote", len(TRAVELERS), "portraits,", len(SCENES), "cards →", OUT)
