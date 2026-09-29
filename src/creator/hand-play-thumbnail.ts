/**
 * Deterministic SVG data-URL thumbnails for hand-play lobby cards.
 * Simple card fan / two rectangles — distinguishable from catan/othello/network.
 */

export function handPlayStartingBoardThumbnailDataUrl(): string {
  const size = 128;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img">`,
    `<rect width="${size}" height="${size}" rx="12" fill="#fef3c7"/>`,
    // Back card (rotated left)
    `<rect x="28" y="30" width="44" height="64" rx="6" fill="#f8fafc" stroke="#92400e" stroke-width="2" transform="rotate(-12 50 62)"/>`,
    // Front card (rotated right)
    `<rect x="52" y="28" width="44" height="64" rx="6" fill="#fffbeb" stroke="#b45309" stroke-width="2" transform="rotate(10 74 60)"/>`,
    // Card pip dots on front card
    `<circle cx="74" cy="48" r="4" fill="#d97706"/>`,
    `<circle cx="74" cy="62" r="4" fill="#d97706"/>`,
    `<circle cx="74" cy="76" r="4" fill="#d97706"/>`,
    `</svg>`,
  ];
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(parts.join(""))}`;
}
