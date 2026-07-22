/**
 * Backfill INTEGRITY check (unified-comprobante-source-of-truth, Phase 7.2).
 *
 * SCOPE (downgraded at P8 — the original docstring overclaimed): this script
 * verifies that stored JournalEntry.paymentStatus/dueDate equal an
 * INDEPENDENT TS re-derivation of the SAME locked D4 rules the backfill
 * migration implements (shared toSettlementStatus collapse + CxC-over-CxP +
 * createdAt DESC/id DESC last-wins). It catches drift between the SQL CASE /
 * ordering and the canonical mapper, and rows the backfill missed or
 * overwrote.
 *
 * It is NOT a read-path equivalence proof: the pre-flip enrichment path
 * surfaced the RAW aux status (no CANCELLED/OVERDUE collapse,
 * ledger.service.ts pre-P8) and had NO deterministic 1:N winner (unordered
 * findMany + Map overwrite). Equivalence of what the UI actually displays is
 * proven by scripts/verify-ledger-readpath-equivalence.ts (P8 gate), which
 * exercises the real post-flip `getContactLedgerPaginated` against an
 * independent re-computation of the old enrichment output.
 *
 *   expected.status  = toSettlementStatus(winning aux row .status)
 *   expected.dueDate = winning aux row .dueDate
 *
 * Mismatches > 0 ⇒ exit 1 ⇒ backfill/live-sync integrity is broken.
 *
 * Read-only — safe to re-run anytime.
 * Run: pnpm exec tsx scripts/verify-je-settlement-backfill.ts
 */
import { prisma } from "@/lib/prisma";
import { toSettlementStatus } from "@/modules/shared/domain/value-objects/settlement-status";

type AuxRow = {
  journalEntryId: string | null;
  status: string;
  dueDate: Date;
  createdAt: Date;
  id: string;
};

/** Deterministic last-wins: createdAt DESC, id DESC — mirror of the migration's DISTINCT ON order. */
function pickWinner(rows: AuxRow[]): AuxRow | undefined {
  return [...rows].sort(
    (a, b) =>
      b.createdAt.getTime() - a.createdAt.getTime() ||
      (b.id > a.id ? 1 : b.id < a.id ? -1 : 0),
  )[0];
}

async function main() {
  const select = {
    id: true,
    journalEntryId: true,
    status: true,
    dueDate: true,
    createdAt: true,
  } as const;

  const [journalEntries, arRows, apRows] = await Promise.all([
    prisma.journalEntry.findMany({
      select: { id: true, paymentStatus: true, dueDate: true },
    }),
    prisma.accountsReceivable.findMany({
      where: { journalEntryId: { not: null } },
      select,
    }),
    prisma.accountsPayable.findMany({
      where: { journalEntryId: { not: null } },
      select,
    }),
  ]);

  const byJe = (rows: AuxRow[]) => {
    const map = new Map<string, AuxRow[]>();
    for (const r of rows) {
      if (r.journalEntryId === null) continue;
      const list = map.get(r.journalEntryId) ?? [];
      list.push(r);
      map.set(r.journalEntryId, list);
    }
    return map;
  };
  const arByJe = byJe(arRows);
  const apByJe = byJe(apRows);

  let backfilled = 0;
  let nullManual = 0;
  const mismatches: string[] = [];

  for (const je of journalEntries) {
    // CxC-over-CxP: receivable wins when both sides link the JE.
    const winner = pickWinner(arByJe.get(je.id) ?? []) ?? pickWinner(apByJe.get(je.id) ?? []);

    if (!winner) {
      // Unlinked (manual/AI/payment-only): both fields must have stayed NULL.
      if (je.paymentStatus !== null || je.dueDate !== null) {
        mismatches.push(
          `je=${je.id} UNLINKED but paymentStatus=${je.paymentStatus} dueDate=${je.dueDate?.toISOString() ?? null}`,
        );
      } else {
        nullManual++;
      }
      continue;
    }

    const expectedStatus = toSettlementStatus(
      winner.status as Parameters<typeof toSettlementStatus>[0],
    );
    const expectedDue = winner.dueDate;

    const statusOk = je.paymentStatus === expectedStatus;
    const dueOk =
      je.dueDate !== null && je.dueDate.getTime() === expectedDue.getTime();

    if (statusOk && dueOk) {
      backfilled++;
    } else {
      mismatches.push(
        `je=${je.id} expected=(${expectedStatus}, ${expectedDue.toISOString()}) ` +
          `actual=(${je.paymentStatus}, ${je.dueDate?.toISOString() ?? null}) ` +
          `[aux=${winner.id} status=${winner.status}]`,
      );
    }
  }

  console.log("═══ Pre-flip verification gate — JE settlement backfill ═══\n");
  console.log(`Total JEs:               ${journalEntries.length}`);
  console.log(`Backfilled (linked, ==): ${backfilled}`);
  console.log(`NULL (manual/unlinked):  ${nullManual}`);
  console.log(`MISMATCHES:              ${mismatches.length}`);

  if (mismatches.length > 0) {
    console.log("\n❌ GATE FAIL — backfill diverges from enrichment derivation.");
    console.log("Phase 8 read flip is BLOCKED. Examples (first 20):");
    for (const m of mismatches.slice(0, 20)) console.log(`  ${m}`);
    process.exit(1);
  }

  console.log("\n✅ GATE PASS — JE.paymentStatus/dueDate == enrichment-derived for ALL JEs.");
  console.log("Phase 8 read flip is safe with respect to backfilled data.");
  process.exit(0);
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(2);
});
