import { Prisma } from "@/generated/prisma/client";
import { sumDecimals, eq } from "@/features/accounting/financial-statements/money.utils";
import type { TrialBalanceAccountMetadata, TrialBalanceMovement } from "./trial-balance.repository";
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

const ZERO = new Prisma.Decimal(0);

// ── Helpers ───────────────────────────────────────────────────────────────────

function z(): Prisma.Decimal {
  return new Prisma.Decimal(0);
}

function maxZero(d: Prisma.Decimal): Prisma.Decimal {
  return d.gt(ZERO) ? d : z();
}

// ── Core builder (pure function) ──────────────────────────────────────────────

/**
 * Pure function — no DB, no fs, no Date.now().
 * Accepts accounts (code-sorted ASC) and movement aggregations; produces a TrialBalanceReport.
 *
 * All arithmetic uses Prisma.Decimal (REQ-11, C12.E1).
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
