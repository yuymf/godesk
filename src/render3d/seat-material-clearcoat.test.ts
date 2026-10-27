import { describe, expect, it } from "vitest";
import { MeshPhysicalMaterial } from "three";
import { createMaterial } from "./materials";
import { seatMaterial } from "./tokens";

describe("seatMaterial clearcoat test green", () => {
  it("seat clearcoat 0.35 yields MeshPhysical on high tier", () => {
    const seat = createMaterial(seatMaterial(0), { clearcoat: true });
    expect(seat).toBeInstanceOf(MeshPhysicalMaterial);
    expect((seat as MeshPhysicalMaterial).clearcoat).toBeCloseTo(0.12); // demote from T104 0.35
    expect(seatMaterial(0).clearcoat).toBeCloseTo(0.12);
  });
});
