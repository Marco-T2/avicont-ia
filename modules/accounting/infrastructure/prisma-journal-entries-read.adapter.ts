import { JournalRepository } from "./prisma-journal-entries.repo";
import type { Journal } from "@/modules/accounting/domain/journal.entity";
import type { JournalEntriesReadPort } from "@/modules/accounting/domain/ports/journal-entries-read.port";
import { hydrateJournalFromRow } from "./journal-mapping";

/**
 * Tx-less Prisma adapter for `JournalEntriesReadPort` (POC #10 C3-C Ciclo 1;
 * un-wrapped from legacy in POC #7 OLEADA 6 C0).
 *
 * Implements `JournalEntriesReadPort` for non-tx reads BEFORE the UoW tx opens
 * (parity with legacy `journal.service.ts:557` `this.repo.findById`). Delegates
 * to the hex `JournalRepository` (folded into `prisma-journal-entries.repo.ts`
 * at C0) — the `findById` non-tx read uses `BaseRepository.db` directly and
 * includes the same `journalIncludeLines` shape the write adapter consumes, so
 * hydration parity is automatic vía `hydrateJournalFromRow` (shared en
 * `./journal-mapping.ts` REFACTOR 1).
 *
 * §13 lockeado en C3-C Ciclo 1 (decisión emergente pre-RED):
 *   - **Constructor sin args, hex repo singleton module-scope**: paridad C3-B
 *     write — el repo es state-less.
 *
 * Convention `infrastructure-adapter-naming` (refinada C0 OLEADA 6):
 *   - Filename `prisma-*.adapter.ts` — el módulo accounting ahora POSEE la
 *     fila `journal_entries` (la persistencia se folded en C0; el legacy
 *     `features/accounting/journal.repository.ts` sobrevive como aditivo
 *     hasta el C5 wholesale-delete pero ya no es la fuente del hex). El
 *     prefijo `legacy-*` se retiró: el adapter ya no envuelve legacy.
 */

const journalRepo = new JournalRepository();

export class PrismaJournalEntriesReadAdapter implements JournalEntriesReadPort {
  async findById(
    organizationId: string,
    entryId: string,
  ): Promise<Journal | null> {
    const row = await journalRepo.findById(organizationId, entryId);
    return row ? hydrateJournalFromRow(row) : null;
  }
}
