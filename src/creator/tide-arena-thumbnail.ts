/** Lightweight lobby mark for Tide Arena / 潮阵 (no external asset). */
export function tideArenaThumbnailDataUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="20" fill="#0b3d5c"/>
  <path d="M12 88c18-22 36-22 54 0s36 22 54 0" fill="none" stroke="#7ec8e3" stroke-width="6"/>
  <circle cx="40" cy="48" r="10" fill="#f4d35e"/>
  <circle cx="64" cy="40" r="12" fill="#ee964b"/>
  <circle cx="90" cy="50" r="10" fill="#f4d35e"/>
  <text x="64" y="118" text-anchor="middle" fill="#e8f4fa" font-size="14" font-family="sans-serif">潮阵</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
