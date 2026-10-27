/**
 * step3 R2 · 通用木框外壳的 HUD 插画包（RenderSpec.hud）。
 * 文件由 scripts/gen-tabletop-hud-art.py 生成（原创程序化 SVG，登记在 assets/LICENSES.md）。
 * 不含任何汐屿专属插画；任何 chrome = "wood" 的桌面 Kernel 都可选用。
 */
import portrait0 from "../../assets/illustrations/tabletop/portrait-traveler-0.svg?url";
import portrait1 from "../../assets/illustrations/tabletop/portrait-traveler-1.svg?url";
import portrait2 from "../../assets/illustrations/tabletop/portrait-traveler-2.svg?url";
import portrait3 from "../../assets/illustrations/tabletop/portrait-traveler-3.svg?url";
import card0 from "../../assets/illustrations/tabletop/card-landscape-0.svg?url";
import card1 from "../../assets/illustrations/tabletop/card-landscape-1.svg?url";
import card2 from "../../assets/illustrations/tabletop/card-landscape-2.svg?url";
import card3 from "../../assets/illustrations/tabletop/card-landscape-3.svg?url";
import card4 from "../../assets/illustrations/tabletop/card-landscape-4.svg?url";
import card5 from "../../assets/illustrations/tabletop/card-landscape-5.svg?url";

const PORTRAITS = { travelers: [portrait0, portrait1, portrait2, portrait3] } as const;
const CARDS = { landscape: [card0, card1, card2, card3, card4, card5] } as const;

type TabletopHudArt = { portraits?: "none" | "travelers"; cardArt?: "none" | "landscape" } | undefined;

export function seatPortrait(hud: TabletopHudArt, seat: number): string | null {
  const pack = hud?.portraits && hud.portraits !== "none" ? PORTRAITS[hud.portraits] : null;
  return pack ? pack[((seat % pack.length) + pack.length) % pack.length]! : null;
}

/** 行动卡插画：按行动 key 稳定散列选图（同一张卡整局不变）。 */
export function actionCardArt(hud: TabletopHudArt, key: string): string | null {
  const pack = hud?.cardArt && hud.cardArt !== "none" ? CARDS[hud.cardArt] : null;
  if (!pack) return null;
  let h = 2166136261;
  for (let i = 0; i < key.length; i += 1) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return pack[(h >>> 0) % pack.length]!;
}
