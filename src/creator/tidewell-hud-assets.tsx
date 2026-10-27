/** G3D-13 / G3D-judge-HUD · Tidewell HUD asset URLs. */
const inkIconsUrl = new URL("../../assets/ui/ink-icons.svg", import.meta.url).href;

const portraitUrls = import.meta.glob("../../assets/illustrations/brand/portrait-*.webp", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const aiIconUrls = import.meta.glob("../../assets/ui/ai/icons/*-64.webp", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const resourceHandUrls = import.meta.glob("../../assets/ui/ai/icons/resource-*-hand.webp", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const buildWideUrls = import.meta.glob("../../assets/ui/ai/icons/build-*-wide.webp", {
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
  const exact = keys.find((k) => k.includes(`/${fragment}.webp`) || k.endsWith(`${fragment}.webp`));
  if (exact) return map[exact];
  const noVariant = keys.find((k) => !/-\d+\.webp$/.test(k));
  return map[noVariant ?? keys[0]!];
}

export const RESOURCE_CARD_URL: Record<string, string | undefined> = {
  // R11: landscape hand plaques (金框横牌).
  wood: pick(resourceHandUrls, "resource-wood-hand"),
  brick: pick(resourceHandUrls, "resource-brick-hand"),
  sheep: pick(resourceHandUrls, "resource-sheep-hand"),
  wheat: pick(resourceHandUrls, "resource-wheat-hand"),
  ore: pick(resourceHandUrls, "resource-ore-hand"),
};

/** G3D-24 development-card faces, keyed by kernel `DevCardKind`. */
export const DEV_CARD_KINDS = ["knight", "road_building", "victory"] as const;
type DevCardFaceKind = (typeof DEV_CARD_KINDS)[number];
export const DEV_CARD_URL: Record<DevCardFaceKind, string> = {
  knight: new URL("../../assets/illustrations/cards/dev-fog-signal.webp", import.meta.url).href,
  road_building: new URL("../../assets/illustrations/cards/dev-harbor-charter.webp", import.meta.url).href,
  victory: new URL("../../assets/illustrations/cards/dev-tide-plenty.webp", import.meta.url).href,
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
  // R9: horizontal wood-brick plaques (settlecoast-style bottom row).
  road: pick(buildWideUrls, "build-road-wide") ?? pick(buildIconUrls, "build-road"),
  settlement: pick(buildWideUrls, "build-settlement-wide") ?? pick(buildIconUrls, "build-settlement"),
  city: pick(buildWideUrls, "build-city-wide") ?? pick(buildIconUrls, "build-city"),
  buy: pick(buildWideUrls, "build-card-wide") ?? pick(buildIconUrls, "build-card"),
};

/** Tileable HUD wood / parchment (round-3h / ④). Prefer 512 over -256. */
export const WOOD_GRAIN_URL =
  Object.entries(uiAiUrls).find(([k]) => k.endsWith("/wood-grain.webp"))?.[1] ??
  pick(uiAiUrls, "wood-grain");
export const PARCHMENT_GRAIN_URL =
  Object.entries(uiAiUrls).find(([k]) => k.endsWith("/parchment-grain.webp"))?.[1] ??
  pick(uiAiUrls, "parchment-grain");
export const ISLAND_FLOURISH_URL = new URL("../../assets/illustrations/brand/island-flourish.webp", import.meta.url).href;

/** Character-portrait medallion (2h4). */
export function seatMarkUrl(seat: number): string | undefined {
  return pick(portraitUrls, `portrait-${seat}`);
}

export function InkIcon({ id, className }: { id: string; className?: string }) {
  return (
    <svg className={className} aria-hidden="true" width="20" height="20">
      <use href={`${inkIconsUrl}#${id}`} />
    </svg>
  );
}
