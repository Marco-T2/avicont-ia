/**
 * RED → GREEN: OperationalDocDirection VO extension (Task 1.1 / 1.2)
 *
 * The VO must list VENTA, COMPRA, DESPACHO alongside the existing
 * COBRO, PAGO, BOTH. The TS type is derived from the const array, so a
 * missing value would surface as an exclusion from the union.
 */

import { describe, expect, it } from "vitest";
import {
  OPERATIONAL_DOC_DIRECTIONS,
  type OperationalDocDirection,
} from "../domain/value-objects/operational-doc-direction";

describe("OperationalDocDirection (journal-physical-document Phase 1)", () => {
  it("1.2-S1 — array contains the three legacy values plus VENTA/COMPRA/DESPACHO", () => {
    expect([...OPERATIONAL_DOC_DIRECTIONS].sort()).toEqual(
      ["BOTH", "COBRO", "COMPRA", "DESPACHO", "PAGO", "VENTA"].sort(),
    );
  });

  it("1.2-S2 — legacy values COBRO, PAGO, BOTH still present (I-7 invariant)", () => {
    expect(OPERATIONAL_DOC_DIRECTIONS).toContain("COBRO");
    expect(OPERATIONAL_DOC_DIRECTIONS).toContain("PAGO");
    expect(OPERATIONAL_DOC_DIRECTIONS).toContain("BOTH");
  });

  it("1.2-S3 — VENTA, COMPRA, DESPACHO are typed as valid OperationalDocDirection", () => {
    // Triangulation: assigning each new value to the union must compile.
    const venta: OperationalDocDirection = "VENTA";
    const compra: OperationalDocDirection = "COMPRA";
    const despacho: OperationalDocDirection = "DESPACHO";
    expect([venta, compra, despacho]).toEqual(["VENTA", "COMPRA", "DESPACHO"]);
  });

  it("1.2-S4 — exactly 6 values (no accidental duplicates)", () => {
    expect(new Set(OPERATIONAL_DOC_DIRECTIONS).size).toBe(6);
    expect(OPERATIONAL_DOC_DIRECTIONS).toHaveLength(6);
  });
});
