/**
 * Shared canonical money math utilities for `modules/accounting/*`.
 *
 * **decimal.js direct dep**: this domain file value-imports `Decimal` from
 * `decimal.js@10.6.0` (pure math, no node builtins — legitimate domain dep).
 * Sister precedent: `modules/shared/domain/value-objects/money.ts:1` and
 * `monetary-amount.ts:1`. Locked invariant OLEADA 5 archive #2282.
 * (sub-POC 1 unblock-bundle: swapped from Prisma.Decimal value-import to
 * decimal.js default-import to remove node:module bundle leak —
 * oleada-money-decimal-hex-purity. EX-D3 R1-permissible-value-type-exception
 * formally revoked at umbrella archive — final sub-POC.)
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
import Decimal from "decimal.js";

// Tolerancia estándar para la verificación de ecuación contable
const TOLERANCE = new Decimal("0.01");

/**
 * Suma un array de Decimals. Lista vacía → 0.
 * No usa Number() — mantiene precisión arbitraria de decimal.js.
 */
export function sumDecimals(xs: Decimal[]): Decimal {
  return xs.reduce((acc, x) => acc.plus(x), new Decimal(0));
}

/**
 * Compara dos Decimals con tolerancia ±0.01 BOB.
 * Usado para verificar la ecuación contable.
 */
export function eq(a: Decimal, b: Decimal): boolean {
  return a.minus(b).abs().lte(TOLERANCE);
}

/**
 * Redondea un Decimal a 2 decimales con la convención half-up (mode 4
 * = ROUND_HALF_UP, away-from-zero). Helper canónico para TIER 1 money math
 * en `application/ledger.service.ts` y `application/auto-entry-generator.ts`
 * (poc-money-math-decimal-convergence — OLEADA 7 POC #2).
 *
 * EX-D3: este es el HOME canónico — FS `financial-statements/domain/money.utils.ts`
 * mantiene su copia local verbatim (2 líneas) por dirección de dependencia
 * (shared NO importa de FS). Duplicación aceptable per design #2447 D1.
 */
export function roundHalfUp(d: Decimal): Decimal {
  return d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}
