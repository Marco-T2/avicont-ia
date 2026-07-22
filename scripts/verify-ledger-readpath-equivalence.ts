/**
 * P8/P9 read-path equivalence gate (unified-comprobante-source-of-truth, D6).
 *
 * Compares, for EVERY contact-ledger row of EVERY contact in the database,
 * the displayed estado the UI/PDF/XLSX would render:
 *
 *   NEW path — the REAL `LedgerService.getContactLedgerPaginated` (since P9:
 *     JE.paymentStatus/dueDate ONLY — the CxC/CxP enrichment arms are
 *     retired), wired with the real Prisma query adapter.
 *   OLD path — an independent re-computation of the PRE-flip enrichment
 *     logic: raw aux status `receivable?.status ?? payable?.status ?? null`
 *     (NO toSettlementStatus collapse) + aux dueDate, exactly what
 *     ledger.service.ts:308 surfaced before the P8 flip. The aux queries are
 *     frozen inline below (the P9-deleted adapters' queries verbatim).
 *
 * P9 note: with the fallback retired, a JE-linked aux row whose JE
 * paymentStatus is NULL would DIFF here (OLD=aux status, NEW="—") — exactly
 * the regression this gate must catch. The STEP-0 fallback-dependency guard
 * (0 linked-but-null JEs) makes 0 diffs the expected outcome.
 *
 * Both sides are then pushed through the SAME `renderEstado` label
 * derivation the UI/exporters share (— / ATRASADO / Pagado / Parcial /
 * Pendiente / Anulado, CANCELLED→"Anulado", unknown→raw) with one shared
 * `now` instant, and the raw dueDate ISO values are compared too (dueDate
 * drives ATRASADO at any future `now`, so raw drift counts as a diff).
 *
 * 0 diffs ⇒ the flip is display-equivalent for all reachable data, GIVEN the
 * STEP-0 checked preconditions (no persisted CANCELLED/OVERDUE aux rows, no
 * same-side multi-linked JEs — both re-verified below; violations surface as
 * AMBIGUOUS/diff output). ANY diff ⇒ exit 1 ⇒ escalate, do NOT ship P9.
 *
 * Distinct from scripts/verify-je-settlement-backfill.ts, which checks
 * backfill INTEGRITY (stored JE values vs independent re-derivation of the
 * same mapping rules) but never exercises the read path.
 *
 * Read-only. Run (the react-server condition maps `server-only` — imported
 * transitively by prisma-journal-entries.repo.ts — to its empty build):
 *
 *   NODE_OPTIONS="--conditions=react-server" \
 *     pnpm exec tsx scripts/verify-ledger-readpath-equivalence.ts
 */
import { prisma } from "@/lib/prisma";
import { LedgerService } from "@/modules/accounting/application/ledger.service";
import { PrismaJournalLedgerQueryAdapter } from "@/modules/accounting/infrastructure/prisma-journal-ledger-query.adapter";
import type { AccountsCrudPort } from "@/modules/accounting/domain/ports/accounts-crud.port";
import type { AccountBalancesService } from "@/modules/account-balances/application/account-balances.service";
import type { ContactLedgerEnrichmentDeps } from "@/modules/accounting/domain/ports/contact-ledger-enrichment.ports";

const PAGE_SIZE = 200;

/** Frozen OLD-path aux projection — local since P9 deleted the
 *  `ReceivableLedgerEnrichmentRow`/`PayableLedgerEnrichmentRow` port types
 *  with the adapters. The gate's OLD-path re-computation must stay
 *  self-contained and immutable regardless of production retirements. */
interface AuxLedgerEnrichmentRow {
  journalEntryId: string;
  status: string;
  dueDate: Date | null;
}

// ── Inline OLD-path aux queries (mirror the P9-deleted
//    prisma-{receivables,payables}-contact-ledger.adapter.ts verbatim —
//    frozen here so the OLD path stays reproducible) ───────────────────────

async function findReceivablesByJournalEntryIds(
  organizationId: string,
  journalEntryIds: string[],
): Promise<AuxLedgerEnrichmentRow[]> {
  if (journalEntryIds.length === 0) return [];
  const rows = await prisma.accountsReceivable.findMany({
    where: { organizationId, journalEntryId: { in: journalEntryIds } },
    select: { journalEntryId: true, status: true, dueDate: true },
  });
  return rows
    .filter((r): r is typeof r & { journalEntryId: string } => r.journalEntryId !== null)
    .map((r) => ({ journalEntryId: r.journalEntryId, status: r.status, dueDate: r.dueDate }));
}

async function findPayablesByJournalEntryIds(
  organizationId: string,
  journalEntryIds: string[],
): Promise<AuxLedgerEnrichmentRow[]> {
  if (journalEntryIds.length === 0) return [];
  const rows = await prisma.accountsPayable.findMany({
    where: { organizationId, journalEntryId: { in: journalEntryIds } },
    select: { journalEntryId: true, status: true, dueDate: true },
  });
  return rows
    .filter((r): r is typeof r & { journalEntryId: string } => r.journalEntryId !== null)
    .map((r) => ({ journalEntryId: r.journalEntryId, status: r.status, dueDate: r.dueDate }));
}

function makeDeps(): ContactLedgerEnrichmentDeps {
  return {
    // Existence gate bypassed on purpose — contacts are enumerated FROM the
    // DB below, and the gate must scan inactive contacts' history too.
    contacts: { getActiveById: async () => {} },
    // P9: no receivables/payables arms — the service reads estado/dueDate
    // off the JE row. The inline aux queries above feed ONLY the OLD-path
    // re-computation in main().
    // Payments feed paymentMethod/bankAccountName/direction — none of which
    // participate in estado/dueDate derivation on either path. Empty keeps
    // the gate read-surface minimal without weakening the comparison.
    payments: { findByJournalEntryIds: async () => [] },
    controlAccountCodes: {
      getControlAccountCodes: async (organizationId) => {
        const s = await prisma.orgSettings.findUnique({
          where: { organizationId },
          select: { cxcAccountCode: true, cxpAccountCode: true },
        });
        // Schema defaults — what OrgSettingsService.getOrCreate would mint
        // (read-only script: never create the row).
        return {
          cxcAccountCode: s?.cxcAccountCode ?? "1.1.4.1",
          cxpAccountCode: s?.cxpAccountCode ?? "2.1.1.1",
        };
      },
    },
  };
}

// ── Shared display derivation — mirror of renderEstado in
//    contact-ledger-page-client.tsx / contact-ledger-{pdf,xlsx}.exporter ────

function estadoLabel(status: string | null, dueDateIso: string | null, now: Date): string {
  if (status == null) return "—";
  if (
    (status === "PENDING" || status === "PARTIAL") &&
    dueDateIso &&
    new Date(dueDateIso) < now
  ) {
    return "ATRASADO";
  }
  switch (status) {
    case "PAID":
      return "Pagado";
    case "PARTIAL":
      return "Parcial";
    case "PENDING":
      return "Pendiente";
    case "VOIDED":
    case "CANCELLED":
      return "Anulado";
    default:
      return status;
  }
}

// ── OLD-path derivation (pre-flip ledger.service.ts:308 semantics) ─────────

type AuxWinner = { status: string; dueDate: Date | null } | undefined;

function oldPathFields(ar: AuxWinner, ap: AuxWinner): {
  status: string | null;
  dueDate: string | null;
} {
  return {
    status: ar?.status ?? ap?.status ?? null,
    dueDate: ar?.dueDate?.toISOString() ?? ap?.dueDate?.toISOString() ?? null,
  };
}

async function main() {
  const now = new Date();
  const service = new LedgerService(
    new PrismaJournalLedgerQueryAdapter(),
    // Never reached by getContactLedgerPaginated — loud stub.
    new Proxy({} as AccountsCrudPort, {
      get() {
        throw new Error("AccountsCrudPort must not be touched by the contact ledger");
      },
    }),
    { getBalances: async () => [] } as unknown as AccountBalancesService,
    makeDeps(),
  );

  // Precondition re-checks (STEP-0): persisted CANCELLED/OVERDUE + same-side 1:N.
  const [arBad, apBad] = await Promise.all([
    prisma.accountsReceivable.count({ where: { status: { in: ["CANCELLED", "OVERDUE"] } } }),
    prisma.accountsPayable.count({ where: { status: { in: ["CANCELLED", "OVERDUE"] } } }),
  ]);

  const contacts = await prisma.contact.findMany({
    select: { id: true, organizationId: true, name: true },
  });

  let contactsScanned = 0;
  let rowsCompared = 0;
  let jeSourced = 0;
  let jeUnstamped = 0;
  const diffs: string[] = [];
  const ambiguous: string[] = [];

  for (const contact of contacts) {
    let page = 1;
    let totalPages = 1;
    let sawRows = false;
    do {
      const dto = await service.getContactLedgerPaginated(
        contact.organizationId,
        contact.id,
        undefined,
        undefined,
        { page, pageSize: PAGE_SIZE },
      );
      totalPages = dto.totalPages;
      if (dto.items.length === 0) break;
      sawRows = true;

      const jeIds = Array.from(new Set(dto.items.map((e) => e.entryId)));
      const [arRows, apRows, jeRows] = await Promise.all([
        findReceivablesByJournalEntryIds(contact.organizationId, jeIds),
        findPayablesByJournalEntryIds(contact.organizationId, jeIds),
        prisma.journalEntry.findMany({
          where: { id: { in: jeIds } },
          select: { id: true, paymentStatus: true },
        }),
      ]);
      const collect = (rows: AuxLedgerEnrichmentRow[]) => {
        const m = new Map<string, Array<{ status: string; dueDate: Date | null }>>();
        for (const r of rows) {
          const list = m.get(r.journalEntryId) ?? [];
          list.push({ status: r.status, dueDate: r.dueDate });
          m.set(r.journalEntryId, list);
        }
        return m;
      };
      const arByJe = collect(arRows);
      const apByJe = collect(apRows);
      const statusByJe = new Map(jeRows.map((j) => [j.id, j.paymentStatus]));

      for (const entry of dto.items) {
        rowsCompared++;
        if (statusByJe.get(entry.entryId) != null) jeSourced++;
        else jeUnstamped++;

        const arList = arByJe.get(entry.entryId) ?? [];
        const apList = apByJe.get(entry.entryId) ?? [];
        if (arList.length > 1 || apList.length > 1) {
          ambiguous.push(
            `je=${entry.entryId} contact=${contact.id} same-side multi-link ` +
              `(AR=${arList.length}, AP=${apList.length}) — OLD path winner was nondeterministic`,
          );
        }
        const old = oldPathFields(arList[0], apList[0]);

        const oldLabel = estadoLabel(old.status, old.dueDate, now);
        const newLabel = estadoLabel(entry.status, entry.dueDate, now);

        if (oldLabel !== newLabel || old.dueDate !== entry.dueDate) {
          diffs.push(
            `je=${entry.entryId} contact=${contact.id} (${contact.name}) ` +
              `OLD=(${old.status}, ${old.dueDate}, "${oldLabel}") ` +
              `NEW=(${entry.status}, ${entry.dueDate}, "${newLabel}")`,
          );
        }
      }
      page++;
    } while (page <= totalPages);
    if (sawRows) contactsScanned++;
  }

  console.log("═══ P8 read-path equivalence gate — contact ledger estado ═══\n");
  console.log(`Contacts total / with rows:  ${contacts.length} / ${contactsScanned}`);
  console.log(`Ledger rows compared:        ${rowsCompared}`);
  console.log(`  estado from JE (flip):     ${jeSourced}`);
  console.log(`  estado null (JE unstamped):${jeUnstamped}`);
  console.log(`Persisted CANCELLED/OVERDUE: AR=${arBad} AP=${apBad} (precondition: 0/0)`);
  console.log(`Same-side multi-link (ambiguous OLD winner): ${ambiguous.length}`);
  console.log(`DIFFS:                       ${diffs.length}`);

  if (ambiguous.length > 0) {
    console.log("\n⚠ AMBIGUOUS rows (STEP-0 precondition violated — escalate):");
    for (const a of ambiguous.slice(0, 20)) console.log(`  ${a}`);
  }
  if (diffs.length > 0 || ambiguous.length > 0 || arBad + apBad > 0) {
    console.log("\n❌ GATE FAIL — flip is NOT display-equivalent (or preconditions broke).");
    console.log("Escalate; do NOT proceed to P9. Examples (first 20):");
    for (const d of diffs.slice(0, 20)) console.log(`  ${d}`);
    process.exit(1);
  }

  console.log("\n✅ GATE PASS — post-flip read path is display-equivalent to the old");
  console.log("enrichment path for every contact-ledger row in the database.");
  process.exit(0);
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(2);
});
