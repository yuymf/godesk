/**
 * Deterministic SVG data-URL thumbnails for hand-play lobby cards.
 * Felt table + card fan — distinguishable from hexSettlement/othello/network; polish bar matches #79/#80.
 */

export function handPlayStartingBoardThumbnailDataUrl(): string {
  const size = 128;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img">`,
    `<defs>`,
    `<linearGradient id="hpFelt" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="0%" stop-color="#14532d"/>`,
    `<stop offset="100%" stop-color="#0f3d24"/>`,
    `</linearGradient>`,
    `<linearGradient id="hpCardFace" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="0%" stop-color="#fffbeb"/>`,
    `<stop offset="100%" stop-color="#fef3c7"/>`,
    `</linearGradient>`,
    `<linearGradient id="hpCardBack" x1="0" y1="0" x2="1" y2="1">`,
    `<stop offset="0%" stop-color="#7c2d12"/>`,
    `<stop offset="100%" stop-color="#9a3412"/>`,
    `</linearGradient>`,
    `</defs>`,
    `<rect width="${size}" height="${size}" rx="12" fill="url(#hpFelt)"/>`,
    `<ellipse cx="64" cy="72" rx="52" ry="36" fill="#0a2e1a" opacity="0.45"/>`,
    // Deck stack (back)
    `<rect x="18" y="38" width="34" height="48" rx="4" fill="url(#hpCardBack)" stroke="#431407" stroke-width="1.5"/>`,
    `<rect x="20" y="40" width="30" height="44" rx="3" fill="none" stroke="#fbbf24" stroke-width="1" opacity="0.55"/>`,
    `<circle cx="35" cy="62" r="7" fill="none" stroke="#fcd34d" stroke-width="1.2"/>`,
    // Fan card left
    `<g transform="rotate(-18 52 70)">`,
    `<rect x="36" y="34" width="36" height="52" rx="4" fill="url(#hpCardFace)" stroke="#92400e" stroke-width="1.6"/>`,
    `<text x="43" y="48" font-family="system-ui,sans-serif" font-size="11" font-weight="700" fill="#b45309">3</text>`,
    `<circle cx="54" cy="60" r="3.2" fill="#d97706"/>`,
    `<circle cx="54" cy="70" r="3.2" fill="#d97706"/>`,
    `<text x="58" y="80" font-family="system-ui,sans-serif" font-size="11" font-weight="700" fill="#b45309" text-anchor="end">3</text>`,
    `</g>`,
    // Fan card center (front)
    `<g transform="rotate(4 68 68)">`,
    `<rect x="50" y="28" width="38" height="56" rx="4" fill="url(#hpCardFace)" stroke="#b45309" stroke-width="1.8"/>`,
    `<text x="57" y="44" font-family="system-ui,sans-serif" font-size="12" font-weight="700" fill="#92400e">5</text>`,
    `<circle cx="69" cy="52" r="3.4" fill="#d97706"/>`,
    `<circle cx="69" cy="62" r="3.4" fill="#d97706"/>`,
    `<circle cx="69" cy="72" r="3.4" fill="#d97706"/>`,
    `<text x="78" y="78" font-family="system-ui,sans-serif" font-size="12" font-weight="700" fill="#92400e" text-anchor="end">5</text>`,
    `</g>`,
    // Fan card right
    `<g transform="rotate(22 86 72)">`,
    `<rect x="68" y="36" width="36" height="52" rx="4" fill="url(#hpCardFace)" stroke="#92400e" stroke-width="1.6"/>`,
    `<text x="75" y="50" font-family="system-ui,sans-serif" font-size="11" font-weight="700" fill="#b45309">2</text>`,
    `<circle cx="86" cy="62" r="3.2" fill="#d97706"/>`,
    `<text x="94" y="80" font-family="system-ui,sans-serif" font-size="11" font-weight="700" fill="#b45309" text-anchor="end">2</text>`,
    `</g>`,
    `</svg>`,
  ];
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(parts.join(""))}`;
}
