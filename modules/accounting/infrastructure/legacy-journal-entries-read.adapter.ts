import { JournalRepository as LegacyJournalRepository } from "@/features/accounting/journal.repository";
import type { Journal } from "@/modules/accounting/domain/journal.entity";
import type { JournalEntriesReadPort } from "@/modules/accounting/domain/ports/journal-entries-read.port";
import { hydrateJournalFromRow } from "./journal-mapping";

/**
 * Tx-less wrapper over `LegacyJournalRepository.findById` (POC #10 C3-C Ciclo 1).
 *
 * Implements `JournalEntriesReadPort` for non-tx reads BEFORE the UoW tx opens
 * (parity with legacy `journal.service.ts:557` `this.repo.findById`). The
 * legacy method is non-tx (uses `BaseRepository.db` directly) and includes the
 * same `journalIncludeLines` shape that C3-B's write adapter consumes, so
 * hydration parity is automatic vía `hydrateJournalFromRow` (shared en
 * `./journal-mapping.ts` REFACTOR 1).
 *
 * §13 lockeado en C3-C Ciclo 1 (decisión emergente pre-RED):
 *   - **Wrap-thin legacy**: hereda `journalIncludeLines` del legacy (no
 *     duplica include shape — Stop rule v4 monitorea drift). Coherente con
 *     write adapter C3-B (mismo patrón).
 *   - **Constructor sin args, legacy singleton module-scope**: paridad C3-B
 *     write — el legacy es state-less. C4 revisa DI cuando el composition
 *     root lo pida.
 *
 * Convention `infrastructure-adapter-naming` (lockeada C3-C pre-RED):
 *   - Filename `legacy-*.adapter.ts` — accounting consume legacy, no posee la
 *     fila `journal_entries` (vive en `features/accounting/`). El aggregate
 *     `Journal` del módulo es la proyección de dominio sobre la misma fila —
 *     la persistencia la posee legacy hasta C5 cleanup.
 */

const legacyRepo = new LegacyJournalRepository();

export class LegacyJournalEntriesReadAdapter implements JournalEntriesReadPort {
  async findById(
    organizationId: string,
    entryId: string,
  ): Promise<Journal | null> {
    const row = await legacyRepo.findById(organizationId, entryId);
    return row ? hydrateJournalFromRow(row) : null;
  }
}
