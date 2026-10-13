/** unitId → silhouette preset + cost for content-defined units (filled by the board from kernel content). */
export const unitAppearance = new Map<string, { shape: string; cost: number }>();

export function setTideArenaUnitAppearance(units: ReadonlyArray<{ id: string; cost: number; shape: string }>) {
  for (const u of units) unitAppearance.set(u.id, { shape: u.shape, cost: u.cost });
}
