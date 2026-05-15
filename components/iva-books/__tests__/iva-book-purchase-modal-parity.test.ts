/**
 * Parity table — iva-book-purchase-modal `calcClientTotales` / `roundHalfUp`.
 *
 * RED-anchor (sub-POC 5 Cycle 2 oleada-money-decimal-hex-purity): captures
 * the CURRENT Math.round float-cents output as the snapshot of behavior
 * to preserve across the upcoming swap to `decimal.js` ROUND_HALF_UP. The
 * GREEN swap MUST keep every assertion below bit-perfect — divergence on
 * any SIN-canonical IVA 13% Bolivia reference case is a blocker.
 *
 * Cases hand-computed and cross-verified vs `Decimal.toDecimalPlaces(2,
 * Decimal.ROUND_HALF_UP)` on `decimal.js@10.6.0` prior to RED: 13/13 cases
 * produce identical {subtotal, baseImponible, ivaAmount} triples. The
 * swap is expected to be a behavioral no-op on these inputs.
 *
 * Case selection rationale (SIN-canonical IVA 13% references):
 *  - 0,1,7: round numbers (1000, 100, 10) — sanity floor
 *  - 2: 1234.56 — exercise 13% on a 2dp non-round (160.4928 → 160.49)
 *  - 3: 76.92 — boundary value where 76.92 × 0.13 = 9.9996 → 10.00
 *  - 4: 7.75 — half-up boundary (1.0075 → 1.01 vs 1.00)
 *  - 5: complex factura (1000 - 50 ICE - 30 IEHD - 20 IPJ - 30 desc - 20 gc = 850 base)
 *  - 6: clamp-to-zero (deducciones exceden importeTotal)
 *  - 8: 99.95 — boundary (12.9935 → 12.99, NOT 13.00)
 *  - 9: 123.45 — 16.0485 → 16.05 (half-up triggers)
 *  - 10: 0.05 — sub-cent baseline (0.0065 → 0.01)
 *  - 11: 1000 - 33.33 ICE = 966.67 → IEEE 754 float-subtraction drift case
 *    (subtotal exits 966.6700000000001 in raw, rounds identically under
 *    both Math.round and decimal.js ROUND_HALF_UP)
 *  - 12: 555.55 — 72.2215 → 72.22
 *
 * Sister parity file owns iva-book-sale-modal (sub-POC 5 Cycle 3).
 */
import { describe, expect, it } from "vitest";
import {
  calcClientTotales,
  roundHalfUp,
} from "../iva-book-purchase-modal";

interface CalcInputs {
  importeTotal: number;
  importeIce: number;
  importeIehd: number;
  importeIpj: number;
  tasas: number;
  otrosNoSujetos: number;
  exentos: number;
  tasaCero: number;
  codigoDescuentoAdicional: number;
  importeGiftCard: number;
}

const zero = {
  importeIce: 0,
  importeIehd: 0,
  importeIpj: 0,
  tasas: 0,
  otrosNoSujetos: 0,
  exentos: 0,
  tasaCero: 0,
  codigoDescuentoAdicional: 0,
  importeGiftCard: 0,
};

interface Case {
  label: string;
  inputs: CalcInputs;
  expected: { subtotal: number; baseImponible: number; ivaAmount: number };
}

const CASES: Case[] = [
  {
    label: "C00: round 1000 → IVA 130 (SIN floor)",
    inputs: { importeTotal: 1000, ...zero },
    expected: { subtotal: 1000, baseImponible: 1000, ivaAmount: 130 },
  },
  {
    label: "C01: round 100 → IVA 13 (SIN baseline)",
    inputs: { importeTotal: 100, ...zero },
    expected: { subtotal: 100, baseImponible: 100, ivaAmount: 13 },
  },
  {
    label: "C02: 1234.56 → IVA 160.49 (non-round 2dp)",
    inputs: { importeTotal: 1234.56, ...zero },
    expected: { subtotal: 1234.56, baseImponible: 1234.56, ivaAmount: 160.49 },
  },
  {
    label: "C03: 76.92 → IVA 10.00 (boundary, 9.9996 rounds up)",
    inputs: { importeTotal: 76.92, ...zero },
    expected: { subtotal: 76.92, baseImponible: 76.92, ivaAmount: 10 },
  },
  {
    label: "C04: 7.75 → IVA 1.01 (half-up boundary 1.0075)",
    inputs: { importeTotal: 7.75, ...zero },
    expected: { subtotal: 7.75, baseImponible: 7.75, ivaAmount: 1.01 },
  },
  {
    label: "C05: complex factura with ICE/IEHD/IPJ + descuento + giftcard",
    inputs: {
      importeTotal: 1000,
      importeIce: 50,
      importeIehd: 30,
      importeIpj: 20,
      tasas: 0,
      otrosNoSujetos: 0,
      exentos: 0,
      tasaCero: 0,
      codigoDescuentoAdicional: 30,
      importeGiftCard: 20,
    },
    expected: { subtotal: 900, baseImponible: 850, ivaAmount: 110.5 },
  },
  {
    label: "C06: clamp to zero — deducciones exceden importeTotal",
    inputs: {
      importeTotal: 100,
      importeIce: 200,
      importeIehd: 0,
      importeIpj: 0,
      tasas: 0,
      otrosNoSujetos: 0,
      exentos: 0,
      tasaCero: 0,
      codigoDescuentoAdicional: 50,
      importeGiftCard: 0,
    },
    expected: { subtotal: 0, baseImponible: 0, ivaAmount: 0 },
  },
  {
    label: "C07: small base — 10 → IVA 1.30",
    inputs: { importeTotal: 10, ...zero },
    expected: { subtotal: 10, baseImponible: 10, ivaAmount: 1.3 },
  },
  {
    label: "C08: 99.95 → IVA 12.99 (12.9935 rounds DOWN, NOT 13.00)",
    inputs: { importeTotal: 99.95, ...zero },
    expected: { subtotal: 99.95, baseImponible: 99.95, ivaAmount: 12.99 },
  },
  {
    label: "C09: 123.45 → IVA 16.05 (half-up 16.0485)",
    inputs: { importeTotal: 123.45, ...zero },
    expected: { subtotal: 123.45, baseImponible: 123.45, ivaAmount: 16.05 },
  },
  {
    label: "C10: 0.05 → IVA 0.01 (sub-cent boundary, 0.0065 half-up)",
    inputs: { importeTotal: 0.05, ...zero },
    expected: { subtotal: 0.05, baseImponible: 0.05, ivaAmount: 0.01 },
  },
  {
    label: "C11: 1000 - 33.33 ICE = 966.67 → IVA 125.67 (IEEE 754 drift case)",
    inputs: {
      importeTotal: 1000,
      importeIce: 33.33,
      importeIehd: 0,
      importeIpj: 0,
      tasas: 0,
      otrosNoSujetos: 0,
      exentos: 0,
      tasaCero: 0,
      codigoDescuentoAdicional: 0,
      importeGiftCard: 0,
    },
    expected: { subtotal: 966.67, baseImponible: 966.67, ivaAmount: 125.67 },
  },
  {
    label: "C12: 555.55 → IVA 72.22 (72.2215 → 72.22)",
    inputs: { importeTotal: 555.55, ...zero },
    expected: { subtotal: 555.55, baseImponible: 555.55, ivaAmount: 72.22 },
  },
];

describe("iva-book-purchase-modal — calcClientTotales SIN-canonical parity table (sub-POC 5)", () => {
  for (const c of CASES) {
    it(c.label, () => {
      const result = calcClientTotales(c.inputs);
      expect(result.subtotal).toBe(c.expected.subtotal);
      expect(result.baseImponible).toBe(c.expected.baseImponible);
      expect(result.ivaAmount).toBe(c.expected.ivaAmount);
    });
  }
});

describe("iva-book-purchase-modal — roundHalfUp signature contract (sub-POC 5)", () => {
  it("returns number for number input (signature preservation across swap)", () => {
    const out: number = roundHalfUp(1.23);
    expect(typeof out).toBe("number");
  });

  it("explicit dp argument respected", () => {
    // 1.2345 → 1.235 at dp=3 (both Math.round and decimal.js agree here:
    // 1.2345 × 1000 = 1234.5 exact in IEEE 754, both round half-up to 1235)
    expect(roundHalfUp(1.2345, 3)).toBeCloseTo(1.235, 10);
    // dp=0 returns integer
    expect(roundHalfUp(1.2345, 0)).toBe(1);
  });

  /*
   * KNOWN sub-cent divergence (NOT a SIN-canonical case, NOT asserted here):
   *  roundHalfUp(1.005, 2) → Math.round float-cents returns 1.00 (because
   *  1.005 × 100 = 100.49999999999999 in IEEE 754); decimal.js ROUND_HALF_UP
   *  returns 1.01 (Decimal-exact). The modal form has `step="0.01"` so users
   *  cannot enter 1.005 as a direct input, but composed math (subtotal ×
   *  0.13) can produce sub-cent intermediates. The swap (sub-POC 5 GREEN)
   *  will CORRECT this — it is documented in the GREEN commit body as a
   *  behavioral FIX (decimal.js conforms to nominal ROUND_HALF_UP semantics
   *  on exact-half decimals; Math.round drifts). Verified pre-RED across
   *  13 SIN-canonical IVA 13% Bolivia cases: zero divergence under those
   *  inputs (bit-perfect parity).
   */
});
