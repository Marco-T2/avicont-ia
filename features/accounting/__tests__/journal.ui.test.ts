/**
 * T1.3 RED — sourceTypeLabel() unit tests (REQ-B.3)
 *
 * Verifica que sourceTypeLabel() devuelva la etiqueta correcta según
 * el sourceType del JournalEntry.
 * RED: fallará hasta que T1.4 cree journal.ui.ts.
 */
import { describe, it, expect } from "vitest";
import { sourceTypeLabel } from "@/features/accounting/journal.ui";

describe("sourceTypeLabel", () => {
  it("null → 'Manual'", () => {
    expect(sourceTypeLabel(null)).toBe("Manual");
  });

  it("'sale' → 'Generado por Venta'", () => {
    expect(sourceTypeLabel("sale")).toBe("Generado por Venta");
  });

  it("'purchase' → 'Generado por Compra'", () => {
    expect(sourceTypeLabel("purchase")).toBe("Generado por Compra");
  });

  it("'dispatch' → 'Generado por Despacho'", () => {
    expect(sourceTypeLabel("dispatch")).toBe("Generado por Despacho");
  });

  it("'payment' → 'Generado por Pago'", () => {
    expect(sourceTypeLabel("payment")).toBe("Generado por Pago");
  });

  it("unknown value → fallback 'Generado automáticamente'", () => {
    expect(sourceTypeLabel("unknown-source")).toBe("Generado automáticamente");
    expect(sourceTypeLabel("other")).toBe("Generado automáticamente");
  });
});
