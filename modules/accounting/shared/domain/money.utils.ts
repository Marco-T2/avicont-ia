// Revoked-by: DEC-1 (sub-POC 6 archive of oleada-money-decimal-hex-purity).
// DEC-1 (Derived from: R1): domain + application use decimal.js@10.6.0 direct.
// Prisma.Decimal is forbidden outside infrastructure adapters.

/**
 * ── CANONICAL RULE: DEC-1 (decimal.js direct) ────────────────────────────
 *
 * As of `oleada-money-decimal-hex-purity` archive (HEAD 2d532320 — Cycle 1
 * GREEN R1 revocation, immediately preceding this canonical-rule cementation
 * commit), the following invariants are CANONICAL for this repo:
 *
 * 1. Domain + application layers (`modules/** /domain/`, `modules/** /application/`)
 *    MUST use `decimal.js@10.6.0` direct for ALL money/value-type math.
 *    Prisma.Decimal value-form is FORBIDDEN in these layers.
 *
 * 2. Infrastructure adapters (`modules/** /infrastructure/`) MAY import
 *    `Prisma` (value or type) — they ARE the Prisma adapter boundary.
 *
 * 3. UI components (`components/**`) MUST NOT use `Math.round(n*100)/100`
 *    or any float-cents arithmetic for money math. Use `new Decimal(n)
 *    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()` or call into
 *    a domain helper.
 *
 * 4. Type-only imports `import type { Prisma } from "..."` are allowed
 *    anywhere (no runtime, no bundle contribution).
 *
 * Supersedes: EX-D3 R1 (revoked at sub-POC 6 archive). History preserved
 * inline above per [[named_rule_immutability]].
 *
 * Enforcement: sentinels in `modules/** /__tests__/decimal-import.sentinel.test.ts`
 * (14 files across OLEADA sub-POCs 1-5) assert no Prisma value-import
 * in non-infra paths. Add new sentinels for new modules that introduce money math.
 */

/**
 * Shared canonical money math utilities for `modules/accounting/*`.
 *
 * **decimal.js direct dep**: this domain file value-imports `Decimal` from
 * `decimal.js@10.6.0` (pure math, no node builtins — legitimate domain dep).
 * Sister precedent: `modules/shared/domain/value-objects/money.ts:1` and
 * `monetary-amount.ts:1`. Locked invariant OLEADA 5 archive #2282.
 *
 * [HISTORICAL — see Revoked-by above]
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
