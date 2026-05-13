// R1-permissible-value-type-exception
// ───────────────────────────────────────────────────────────────────────────────
// Pure money math utilities for EquityStatement domain.
//
// R1-permissible-value-type-exception: runtime-imports Prisma.Decimal (value-type
// arithmetic engine, not entity). Sister precedent verified textually:
//   modules/shared/domain/value-objects/money.ts:4-10 —
//     "Decimal-based monetary VO. Uses Prisma.Decimal (re-export of decimal.js)
//      internally because partida-doble requires bit-perfect equality on sums; a
//      number-based VO with rounding can drift in journals with many lines.
//      Domain does NOT expose Prisma.Decimal — only the methods on Money."
//
// Locked OLEADA 5 archive #2282. Verified TB archive #2298 + ES design #2302 §5.
// [[textual_rule_verification]] confirmed at C0 GREEN write time.
//
// Functions are verbatim copies of modules/accounting/financial-statements/domain/money.utils.ts
// (sumDecimals + eq only). D4 Option A: break FS-presentation cross-module dep
// in equity-statement.builder.ts → own domain/money.utils.ts (REQ-009).
// 3rd module (FS+TB+ES); consolidation CANDIDATE at sub-POC 3 (worksheet) per
// deferred item #3 (spec addendum #2303).
//
// ESLint: no exemption needed — modules/*/domain/** glob auto-covers this path.
// ───────────────────────────────────────────────────────────────────────────────
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
