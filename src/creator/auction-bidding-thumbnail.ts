export function auctionBiddingThumbnailDataUrl(): string {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" rx="18" fill="#172b35"/><circle cx="82" cy="90" r="43" fill="#be9b61"/><path d="m57 67 14-14 35 35-14 14zm45 29 8-8 31 31-8 8M50 135h111" fill="none" stroke="#172b35" stroke-width="9" stroke-linecap="round"/><text x="184" y="82" font-size="24" font-family="sans-serif" fill="#f9f2df">AUCTION</text><text x="184" y="113" font-size="18" font-family="sans-serif" fill="#e7ba69">BID · PASS</text></svg>';
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
