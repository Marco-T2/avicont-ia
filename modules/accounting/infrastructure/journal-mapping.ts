import type { JournalEntryWithLines } from "@/features/accounting/journal.types";
import { Money } from "@/modules/shared/domain/value-objects/money";
import { Journal } from "@/modules/accounting/domain/journal.entity";
import { JournalLine } from "@/modules/accounting/domain/journal-line.entity";
import { LineSide } from "@/modules/accounting/domain/value-objects/line-side";

/**
 * Shared mapping helpers for accounting infrastructure adapters (POC #10 C3-C
 * REFACTOR 1). Promoción del helper desde `prisma-journal-entries.repo.ts` al
 * emerger el segundo call-site en C3-C Ciclo 1
 * (`legacy-journal-entries-read.adapter.ts`) — materializa la nota 1 del
 * bookmark de cierre C3-B.
 *
 * Convention `helper-privado-al-módulo` (lockeada C3-A, refinada C3-C): los
 * mapping helpers viven como function declarations en este archivo cuando
 * tienen ≥2 call-sites, o privados al adapter cuando tienen 1. NUNCA son
 * métodos de la class adapter — la class expone solo los métodos del port.
 *
 * `mapLinesToInputs` (companion helper write-only) NO se promueve aún — sigue
 * privado a `prisma-journal-entries.repo.ts` con un único call-site. C3-D
 * UoW adapter o POC #11 podrían materializar el segundo y dispararían la
 * promoción equivalente.
 */

/**
 * Hidrata un `JournalEntryWithLines` legacy (shape de `journalIncludeLines`
 * include de `LegacyJournalRepository`) en un `Journal` aggregate.
 * Reconstruye `LineSide` desde `debit`/`credit` Decimal columns: side=DEBIT
 * cuando `debit > 0`, side=CREDIT cuando `credit > 0` (parity legacy — la
 * columna no-cero define el side, exclusivo por I10).
 */
export function hydrateJournalFromRow(row: JournalEntryWithLines): Journal {
  return Journal.fromPersistence({
    id: row.id,
    organizationId: row.organizationId,
    status: row.status,
    number: row.number,
    referenceNumber: row.referenceNumber,
    date: row.date,
    description: row.description,
    periodId: row.periodId,
    voucherTypeId: row.voucherTypeId,
    contactId: row.contactId,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    aiOriginalText: row.aiOriginalText,
    createdById: row.createdById,
    updatedById: row.updatedById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lines: row.lines.map((line) => {
      const side = !line.debit.isZero()
        ? LineSide.debit(Money.of(line.debit.toString()))
        : LineSide.credit(Money.of(line.credit.toString()));
      return JournalLine.fromPersistence({
        id: line.id,
        journalEntryId: line.journalEntryId,
        accountId: line.accountId,
        side,
        description: line.description,
        contactId: line.contactId,
        order: line.order,
      });
    }),
  });
}
