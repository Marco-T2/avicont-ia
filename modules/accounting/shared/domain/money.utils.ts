/**
 * Shared canonical money math utilities for `modules/accounting/*`.
 *
 * **R1-permissible-value-type-exception**: this domain file runtime-imports
 * `Prisma` from `@/generated/prisma/client` to access `Prisma.Decimal`
 * (re-export of `decimal.js`). Decimal is a VALUE-TYPE arithmetic engine,
 * not a Prisma-generated entity. Sister precedent textually verified:
 * `modules/shared/domain/value-objects/money.ts:4-10`:
 *   "Decimal-based monetary VO. Uses Prisma.Decimal (re-export of decimal.js)
 *    internally because partida-doble requires bit-perfect equality on sums; a
 *    number-based VO with rounding can drift in journals with many lines.
 *    Domain does NOT expose Prisma.Decimal — only the methods on Money."
 * Locked invariant OLEADA 5 archive #2282.
 *
 * **EX-D3 consolidation**: this is the canonical home for `sumDecimals` + `eq`.
 * Verbatim copy of the 2 helpers from
 * `modules/accounting/financial-statements/domain/money.utils.ts`. The 5
 * standalone copies (FS+TB+ES+WS+IB) become re-export shims at C1 — D4
 * consolidation mandate, proposal #2357 (OLEADA 6 sub-POC 6/8).
 *
 * **EX-D2 dep-direction invariant**: this file is the dependency SOURCE — it
 * MUST NOT import from any module under
 * `modules/accounting/{financial-statements,trial-balance,equity-statement,worksheet,initial-balance}`.
 */
import { Prisma } from "@/generated/prisma/client";

// Alias local para no repetir Prisma.Decimal en firmas
type Decimal = Prisma.Decimal;

// Tolerancia estándar para la verificación de ecuación contable
const TOLERANCE = new Prisma.Decimal("0.01");

/**
 * Suma un array de Decimals. Lista vacía → 0.
 * No usa Number() — mantiene precisión arbitraria de decimal.js.
 */
export function sumDecimals(xs: Decimal[]): Decimal {
  return xs.reduce((acc, x) => acc.plus(x), new Prisma.Decimal(0));
}

/**
 * Compara dos Decimals con tolerancia ±0.01 BOB.
 * Usado para verificar la ecuación contable.
 */
export function eq(a: Decimal, b: Decimal): boolean {
  return a.minus(b).abs().lte(TOLERANCE);
}
