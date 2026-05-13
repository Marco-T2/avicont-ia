/**
 * Pure money math utilities for Initial Balance.
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
 * Functions are pure copies of `modules/accounting/financial-statements/domain/money.utils.ts`
 * `sumDecimals` + `eq`. 5th copy total (FS+TB+ES+WS+IB). Duplication justified:
 * 2 trivial helpers; consolidation MANDATORY at sub-POC 6 (poc-accounting-exporters-cleanup —
 * scope extended to include money.utils shared extraction to
 * modules/accounting/shared/domain/money.utils.ts). D4 Option A, proposal #2329.
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
