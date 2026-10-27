/** unitId → look for content-defined units (filled by the board from kernel content). */
type UnitLook = {
  proceduralPreset: string;
  cost: number;
  /** Imported asset id; when set the scene prefers the GLB over procedural geometry. */
  modelRef?: string;
};

export const unitAppearance = new Map<string, UnitLook>();

export function setTideArenaUnitAppearance(
  units: ReadonlyArray<{ id: string; cost: number; proceduralPreset: string; modelRef?: string }>,
) {
  unitAppearance.clear();
  for (const u of units) {
    unitAppearance.set(u.id, {
      proceduralPreset: u.proceduralPreset,
      cost: u.cost,
      ...(u.modelRef ? { modelRef: u.modelRef } : {}),
    });
  }
}
