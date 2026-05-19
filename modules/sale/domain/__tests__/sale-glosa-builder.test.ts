import { describe, it, expect } from "vitest";
import {
  buildSaleGlosa,
  type SaleGlosaInput,
} from "../sale-glosa-builder";

/**
 * REQ-GE-1 — buildSaleGlosa domain builder.
 *
 * Template:
 *   VENTA: <contactName> VG-<referenceNumber> por Bs. <total,XX> (<lineConcepts joined by " | ">)
 *
 * Pure-function unit tests. No I/O, no mocks. Each scenario from spec
 * REQ-GE-1 has a matching case below.
 */
describe("buildSaleGlosa (REQ-GE-1)", () => {
  it("Scenario 1.1 — single line: matches VENTA template", () => {
    const input: SaleGlosaInput = {
      contactName: "Marco",
      referenceNumber: "45",
      totalAmount: 460,
      lineConcepts: ["Venta de pollo faenado"],
      saleDate: new Date(2026, 4, 17),
    };
    expect(buildSaleGlosa(input)).toBe(
      "VENTA: Marco VG-45 por Bs. 460,00 (Venta de pollo faenado)",
    );
  });

  it("Scenario 1.2 — multi line: joined with ' | '", () => {
    const input: SaleGlosaInput = {
      contactName: "Marco",
      referenceNumber: "45",
      totalAmount: 460,
      lineConcepts: ["Venta de pollo faenado", "servicio Flete"],
      saleDate: new Date(2026, 4, 17),
    };
    expect(buildSaleGlosa(input)).toBe(
      "VENTA: Marco VG-45 por Bs. 460,00 (Venta de pollo faenado | servicio Flete)",
    );
  });

  it("Scenario 1.4 — contact name with spaces preserved", () => {
    const input: SaleGlosaInput = {
      contactName: "Pollería Don Pepe",
      referenceNumber: "1023",
      totalAmount: 1250,
      lineConcepts: ["Pollo entero"],
      saleDate: new Date(2026, 4, 17),
    };
    expect(buildSaleGlosa(input)).toBe(
      "VENTA: Pollería Don Pepe VG-1023 por Bs. 1.250,00 (Pollo entero)",
    );
  });

  it("REQ-GE-7 Scenario 7.2 — thousands separator + decimal comma", () => {
    const input: SaleGlosaInput = {
      contactName: "Marco",
      referenceNumber: "45",
      totalAmount: 1234567.89,
      lineConcepts: ["Big invoice"],
      saleDate: new Date(2026, 4, 17),
    };
    expect(buildSaleGlosa(input)).toBe(
      "VENTA: Marco VG-45 por Bs. 1.234.567,89 (Big invoice)",
    );
  });

  it("Design D3 / Open question #3 — empty line concepts preserved (no filter, no dedupe)", () => {
    const input: SaleGlosaInput = {
      contactName: "Marco",
      referenceNumber: "45",
      totalAmount: 460,
      lineConcepts: ["A", "", "B"],
      saleDate: new Date(2026, 4, 17),
    };
    expect(buildSaleGlosa(input)).toBe(
      "VENTA: Marco VG-45 por Bs. 460,00 (A |  | B)",
    );
  });

  it("Determinism — same input produces byte-identical output across calls", () => {
    const input: SaleGlosaInput = {
      contactName: "Marco",
      referenceNumber: "45",
      totalAmount: 460,
      lineConcepts: ["Venta de pollo faenado"],
      saleDate: new Date(2026, 4, 17),
    };
    expect(buildSaleGlosa(input)).toBe(buildSaleGlosa(input));
  });
});
