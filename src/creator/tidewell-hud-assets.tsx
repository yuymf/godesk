/** G3D-13 / G3D-judge-HUD · Tidewell HUD asset URLs. */
export const inkIconsUrl = new URL("../../assets/ui/ink-icons.svg", import.meta.url).href;

const cardUrls = import.meta.glob("../../assets/illustrations/cards/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const seatUrls = import.meta.glob("../../assets/illustrations/brand/seat-*.webp", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const portraitUrls = import.meta.glob("../../assets/illustrations/brand/portrait-*.webp", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const brandUrls = import.meta.glob("../../assets/illustrations/brand/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const aiIconUrls = import.meta.glob("../../assets/ui/ai/icons/*-64.webp", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const buildIconUrls = import.meta.glob("../../assets/ui/ai/icons/build-*-128.webp", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const uiAiUrls = import.meta.glob("../../assets/ui/ai/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

function pick(map: Record<string, string>, fragment: string): string | undefined {
  const keys = Object.keys(map).filter((k) => k.includes(fragment));
  if (keys.length === 0) return undefined;
  // Prefer `portrait-0.webp` over `portrait-0-128.webp` when fragment is `portrait-0`.
  const exact = keys.find((k) => k.includes(`/${fragment}.webp`) || k.endsWith(`${fragment}.webp`));
  if (exact) return map[exact];
  const noVariant = keys.find((k) => !/-\d+\.webp$/.test(k));
  return map[noVariant ?? keys[0]!];
}

export const RESOURCE_CARD_URL: Record<string, string | undefined> = {
  wood: pick(cardUrls, "resource-wood"),
  brick: pick(cardUrls, "resource-brick"),
  sheep: pick(cardUrls, "resource-sheep"),
  wheat: pick(cardUrls, "resource-wheat"),
  ore: pick(cardUrls, "resource-ore"),
};

export const RESOURCE_AI_ICON_URL: Record<string, string | undefined> = {
  wood: pick(aiIconUrls, "wood-64"),
  brick: pick(aiIconUrls, "brick-64"),
  sheep: pick(aiIconUrls, "sheep-64"),
  wheat: pick(aiIconUrls, "wheat-64"),
  ore: pick(aiIconUrls, "ore-64"),
};

export const RESOURCE_ICON_ID: Record<string, string> = {
  wood: "icon-res-wood",
  brick: "icon-res-brick",
  sheep: "icon-res-wool",
  wheat: "icon-res-grain",
  ore: "icon-res-ore",
};

export const BUILD_ICON_URL: Record<string, string | undefined> = {
  road: pick(buildIconUrls, "build-road"),
  settlement: pick(buildIconUrls, "build-settlement"),
  city: pick(buildIconUrls, "build-city"),
  buy: pick(buildIconUrls, "build-card"),
};

export const PANEL_FRAME_URL = pick(uiAiUrls, "panel-frame");
export const CARD_FRAME_URL = pick(uiAiUrls, "card-frame");
/** Tileable HUD wood / parchment (round-3h / ④). Prefer 512 over -256. */
export const WOOD_GRAIN_URL =
  Object.entries(uiAiUrls).find(([k]) => k.endsWith("/wood-grain.webp"))?.[1] ??
  pick(uiAiUrls, "wood-grain");
export const PARCHMENT_GRAIN_URL =
  Object.entries(uiAiUrls).find(([k]) => k.endsWith("/parchment-grain.webp"))?.[1] ??
  pick(uiAiUrls, "parchment-grain");
export const ISLAND_FLOURISH_URL = pick(brandUrls, "island-flourish");

/** Character-portrait medallion (2h4); falls back to seat brand mark. */
export function seatPortraitUrl(seat: number): string | undefined {
  return (
    pick(portraitUrls, `portrait-${seat}`) ??
    pick(portraitUrls, `portrait-${seat}-128`) ??
    pick(seatUrls, `seat-${seat}`)
  );
}

export function seatMarkUrl(seat: number): string | undefined {
  return seatPortraitUrl(seat);
}

export function InkIcon({ id, className }: { id: string; className?: string }) {
  return (
    <svg className={className} aria-hidden="true" width="20" height="20">
      <use href={`${inkIconsUrl}#${id}`} />
    </svg>
  );
}
