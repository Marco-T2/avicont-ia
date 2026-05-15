/**
 * Revoked-by: DEC-1 (sub-POC 6 archive of oleada-money-decimal-hex-purity).
 * DEC-1 (Derived from: R1): domain + application use decimal.js@10.6.0 direct.
 * Prisma.Decimal is forbidden outside infrastructure adapters. This builder
 * now runtime-imports `decimal.js` directly (NOT `Prisma.Decimal`) per
 * sub-POC 2 Cycle 2 swap (commit 46c25251).
 *
 * [HISTORICAL — see Revoked-by above]
 * R1-permissible-value-type-exception: this file runtime-imports `Prisma` from
 * `@/generated/prisma/client` for `Prisma.Decimal` value-type arithmetic (ZERO constant).
 * Decimal is a VALUE-TYPE engine, not a Prisma entity. Locked invariant OLEADA 5 #2282.
 *
 * REQ-009: ZERO imports from `@/modules/accounting/financial-statements/**`.
 * sumDecimals + eq copied to own `./money.utils` (D4 Option A, proposal #2286).
 */
import Decimal from "decimal.js";
import { sumDecimals, eq } from "./money.utils";
import type { TrialBalanceAccountMetadata, TrialBalanceMovement } from "./trial-balance.types";
import type {
  TrialBalanceRow,
  TrialBalanceTotals,
  TrialBalanceReport,
} from "./trial-balance.types";

// ── Types ─────────────────────────────────────────────────────────────────────

export type BuildTrialBalanceInput = {
  /** Already ordered by code ASC from repo (findAccounts uses orderBy: { code: 'asc' }) */
  accounts: TrialBalanceAccountMetadata[];
  movements: TrialBalanceMovement[];
  dateFrom: Date;
  dateTo: Date;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const ZERO = new Decimal(0);

// ── Helpers ───────────────────────────────────────────────────────────────────

function z(): Decimal {
  return new Decimal(0);
}

function maxZero(d: Decimal): Decimal {
  return d.gt(ZERO) ? d : z();
}

// ── Core builder (pure function) ──────────────────────────────────────────────

/**
 * Pure function — no DB, no fs, no Date.now().
 * Accepts accounts (code-sorted ASC) and movement aggregations; produces a TrialBalanceReport.
 *
 * All arithmetic uses decimal.js Decimal (REQ-11, C12.E1).
 * rowNumber is NOT in the domain type — assigned at render time.
 */
export function buildTrialBalance(input: BuildTrialBalanceInput): TrialBalanceReport {
  const { accounts, movements, dateFrom, dateTo } = input;

  // Index movements by accountId for O(1) lookup
  const byId = new Map<string, TrialBalanceMovement>(
    movements.map((m) => [m.accountId, m]),
  );

  const rows: TrialBalanceRow[] = [];

  for (const acc of accounts) {
    // REQ-2: skip non-detail (agrupadora) accounts
    if (!acc.isDetail) {
      const m = byId.get(acc.id);
      if (m && (!m.totalDebit.isZero() || !m.totalCredit.isZero())) {
        console.warn(
          `[trial-balance.builder] Non-detail account "${acc.code}" (${acc.id}) has activity but is suppressed per REQ-2 visibility rule.`,
        );
      }
      continue;
    }

    const m = byId.get(acc.id);
    const sumasDebe = m?.totalDebit ?? z();
    const sumasHaber = m?.totalCredit ?? z();

    // REQ-2: skip zero-activity accounts
    if (sumasDebe.isZero() && sumasHaber.isZero()) continue;

    // REQ-4: clamp at zero
    const saldoDeudor = maxZero(sumasDebe.minus(sumasHaber));
    const saldoAcreedor = maxZero(sumasHaber.minus(sumasDebe));

    rows.push({
      accountId: acc.id,
      code: acc.code,
      name: acc.name,
      sumasDebe,
      sumasHaber,
      saldoDeudor,
      saldoAcreedor,
    });
  }

  // REQ-5: compute totals
  const totals: TrialBalanceTotals = {
    sumasDebe: sumDecimals(rows.map((r) => r.sumasDebe)),
    sumasHaber: sumDecimals(rows.map((r) => r.sumasHaber)),
    saldoDeudor: sumDecimals(rows.map((r) => r.saldoDeudor)),
    saldoAcreedor: sumDecimals(rows.map((r) => r.saldoAcreedor)),
  };

  const deltaSumas = totals.sumasDebe.minus(totals.sumasHaber);
  const deltaSaldos = totals.saldoDeudor.minus(totals.saldoAcreedor);

  const imbalanced =
    !eq(totals.sumasDebe, totals.sumasHaber) ||
    !eq(totals.saldoDeudor, totals.saldoAcreedor);

  return {
    orgId: "", // injected by service with real orgId
    dateFrom,
    dateTo,
    rows,
    totals,
    imbalanced,
    deltaSumas,
    deltaSaldos,
  };
}
