/**
 * Backfill precedence derivation — pure module
 * (settlement-invariant-hardening, D-2).
 *
 * Re-derives the expected JournalEntry settlement stamp from linked aux rows
 * using the SAME locked D4 rules the backfill migration implements: shared
 * toSettlementStatus collapse + CxC-over-CxP + createdAt DESC / id DESC
 * last-wins. Extracted from scripts/verify-je-settlement-backfill.ts so each
 * precedence branch is unit-testable in isolation
 * (scripts/lib/__tests__/settlement-backfill-precedence.test.ts).
 *
 * This is VERIFICATION re-derivation, not runtime domain behavior — its sole
 * consumer is the gate script, so it lives in scripts/lib, NOT in the hexagon
 * (modules/**). It does no IO: callers fetch rows and compare stamps.
 */
import {
  toSettlementStatus,
  type SettlementStatus,
} from "@/modules/shared/domain/value-objects/settlement-status";

export type AuxRow = {
  journalEntryId: string | null;
  status: string;
  dueDate: Date;
  createdAt: Date;
  id: string;
};

/** Deterministic last-wins: createdAt DESC, id DESC — mirror of the migration's DISTINCT ON order. */
export function pickWinner(rows: AuxRow[]): AuxRow | undefined {
  return [...rows].sort(
    (a, b) =>
      b.createdAt.getTime() - a.createdAt.getTime() ||
      (b.id > a.id ? 1 : b.id < a.id ? -1 : 0),
  )[0];
}

/**
 * Cross-side winning aux row. CxC-over-CxP: the receivable side wins whenever
 * it has ANY linked row, regardless of recency across sides. Exposed so the
 * gate script can report the winning row's id/status in mismatch diagnostics
 * without re-encoding the side preference.
 */
export function pickCrossSideWinner(
  arRows: AuxRow[],
  apRows: AuxRow[],
): AuxRow | undefined {
  return pickWinner(arRows) ?? pickWinner(apRows);
}

/**
 * Expected settlement stamp for one JE given its linked aux rows per side
 * (CxC-over-CxP via pickCrossSideWinner). Unlinked (both sides empty) → null:
 * the JE's paymentStatus/dueDate must both have stayed NULL.
 */
export function deriveExpectedSettlement(
  arRows: AuxRow[],
  apRows: AuxRow[],
): { status: SettlementStatus; dueDate: Date } | null {
  const winner = pickCrossSideWinner(arRows, apRows);
  if (!winner) return null;
  return {
    status: toSettlementStatus(
      winner.status as Parameters<typeof toSettlementStatus>[0],
    ),
    dueDate: winner.dueDate,
  };
}
