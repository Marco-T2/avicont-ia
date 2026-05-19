import { describe, it, expect } from "vitest";
import {
  buildPaymentGlosa,
  type PaymentGlosaInput,
} from "../payment-glosa-builder";

/**
 * REQ-GE-2 — buildPaymentGlosa domain builder.
 *
 * Template:
 *   COBRO <MÉTODO>: <contactName> Bs. <totalCobro,XX>[: <TIPO>-<NoRef> del <fecha> | ...]
 *
 * Pure-function unit tests. No I/O, no mocks. Date inputs are organization-
 * local (per design D6 contract).
 */
describe("buildPaymentGlosa (REQ-GE-2)", () => {
  it("Scenario 2.1 — single allocation, same year: short date", () => {
    const input: PaymentGlosaInput = {
      method: "EFECTIVO",
      contactName: "Marco",
      totalAmount: 200,
      allocations: [
        {
          sourceTypeCode: "VG",
          referenceNumber: "45",
          sourceDate: new Date(2026, 4, 17),
        },
      ],
      journalEntryDate: new Date(2026, 4, 19),
    };
    expect(buildPaymentGlosa(input)).toBe(
      "COBRO EFECTIVO: Marco Bs. 200,00: VG-45 del 17/05",
    );
  });

  it("Scenario 2.2 — multi allocation, same year: ' | ' separator", () => {
    const input: PaymentGlosaInput = {
      method: "EFECTIVO",
      contactName: "Marco",
      totalAmount: 200,
      allocations: [
        {
          sourceTypeCode: "VG",
          referenceNumber: "45",
          sourceDate: new Date(2026, 4, 17),
        },
        {
          sourceTypeCode: "ND",
          referenceNumber: "63",
          sourceDate: new Date(2026, 4, 18),
        },
      ],
      journalEntryDate: new Date(2026, 4, 19),
    };
    expect(buildPaymentGlosa(input)).toBe(
      "COBRO EFECTIVO: Marco Bs. 200,00: VG-45 del 17/05 | ND-63 del 18/05",
    );
  });

  it("Scenario 2.3 — cross-year allocation: DD/MM/YY format", () => {
    const input: PaymentGlosaInput = {
      method: "EFECTIVO",
      contactName: "Marco",
      totalAmount: 200,
      allocations: [
        {
          sourceTypeCode: "VG",
          referenceNumber: "45",
          sourceDate: new Date(2025, 11, 29),
        },
      ],
      journalEntryDate: new Date(2026, 0, 5),
    };
    expect(buildPaymentGlosa(input)).toBe(
      "COBRO EFECTIVO: Marco Bs. 200,00: VG-45 del 29/12/25",
    );
  });

  it("Scenario 2.4 — empty allocations: no ':' doc-list suffix", () => {
    const input: PaymentGlosaInput = {
      method: "EFECTIVO",
      contactName: "Marco",
      totalAmount: 200,
      allocations: [],
      journalEntryDate: new Date(2026, 4, 19),
    };
    expect(buildPaymentGlosa(input)).toBe(
      "COBRO EFECTIVO: Marco Bs. 200,00",
    );
  });

  it("Scenario 2.5 — NULL sourceTypeCode → 'DOC-<refNo>' fallback (D5)", () => {
    const input: PaymentGlosaInput = {
      method: "EFECTIVO",
      contactName: "Marco",
      totalAmount: 200,
      allocations: [
        {
          sourceTypeCode: null,
          referenceNumber: "45",
          sourceDate: new Date(2026, 4, 17),
        },
      ],
      journalEntryDate: new Date(2026, 4, 19),
    };
    expect(buildPaymentGlosa(input)).toBe(
      "COBRO EFECTIVO: Marco Bs. 200,00: DOC-45 del 17/05",
    );
  });

  it("Scenario 2.6 — TRANSFERENCIA method renders verbatim (caller already uppercased)", () => {
    const input: PaymentGlosaInput = {
      method: "TRANSFERENCIA",
      contactName: "Marco",
      totalAmount: 200,
      allocations: [],
      journalEntryDate: new Date(2026, 4, 19),
    };
    expect(buildPaymentGlosa(input)).toBe(
      "COBRO TRANSFERENCIA: Marco Bs. 200,00",
    );
  });

  it("REQ-GE-7 Scenario 7.2 — thousands separator + decimal comma in header total", () => {
    const input: PaymentGlosaInput = {
      method: "EFECTIVO",
      contactName: "Marco",
      totalAmount: 1234567.89,
      allocations: [],
      journalEntryDate: new Date(2026, 4, 19),
    };
    expect(buildPaymentGlosa(input)).toBe(
      "COBRO EFECTIVO: Marco Bs. 1.234.567,89",
    );
  });

  it("Determinism — same input produces byte-identical output across calls", () => {
    const input: PaymentGlosaInput = {
      method: "EFECTIVO",
      contactName: "Marco",
      totalAmount: 200,
      allocations: [
        {
          sourceTypeCode: "VG",
          referenceNumber: "45",
          sourceDate: new Date(2026, 4, 17),
        },
      ],
      journalEntryDate: new Date(2026, 4, 19),
    };
    expect(buildPaymentGlosa(input)).toBe(buildPaymentGlosa(input));
  });

  it("Mixed: multi-allocation with one NULL sourceTypeCode + cross-year mix", () => {
    const input: PaymentGlosaInput = {
      method: "EFECTIVO",
      contactName: "Marco",
      totalAmount: 350,
      allocations: [
        {
          sourceTypeCode: "VG",
          referenceNumber: "45",
          sourceDate: new Date(2025, 11, 29),
        },
        {
          sourceTypeCode: null,
          referenceNumber: "99",
          sourceDate: new Date(2026, 0, 5),
        },
      ],
      journalEntryDate: new Date(2026, 0, 5),
    };
    expect(buildPaymentGlosa(input)).toBe(
      "COBRO EFECTIVO: Marco Bs. 350,00: VG-45 del 29/12/25 | DOC-99 del 05/01",
    );
  });
});
