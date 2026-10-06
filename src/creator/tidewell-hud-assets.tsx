/** G3D-13 · Tidewell HUD asset URLs (ink icons + card/seat illustrations). */
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

function pick(map: Record<string, string>, fragment: string): string | undefined {
  const key = Object.keys(map).find((k) => k.includes(fragment));
  return key ? map[key] : undefined;
}

export const RESOURCE_CARD_URL: Record<string, string | undefined> = {
  wood: pick(cardUrls, "resource-wood"),
  brick: pick(cardUrls, "resource-brick"),
  sheep: pick(cardUrls, "resource-sheep"),
  wheat: pick(cardUrls, "resource-wheat"),
  ore: pick(cardUrls, "resource-ore"),
};

export const RESOURCE_ICON_ID: Record<string, string> = {
  wood: "icon-res-wood",
  brick: "icon-res-brick",
  sheep: "icon-res-wool",
  wheat: "icon-res-grain",
  ore: "icon-res-ore",
};

export function seatMarkUrl(seat: number): string | undefined {
  return pick(seatUrls, `seat-${seat}`);
}

export function InkIcon({ id, className }: { id: string; className?: string }) {
  return (
    <svg className={className} aria-hidden="true" width="20" height="20">
      <use href={`${inkIconsUrl}#${id}`} />
    </svg>
  );
}
