import { Prisma } from "@/generated/prisma/client";
import { JournalRepository as LegacyJournalRepository } from "@/features/accounting/journal.repository";
import type {
  CreateJournalEntryInput,
  JournalLineInput,
  UpdateJournalEntryInput,
} from "@/features/accounting/journal.types";
import { Journal } from "@/modules/accounting/domain/journal.entity";
import type { JournalLine } from "@/modules/accounting/domain/journal-line.entity";
import type { JournalEntriesRepository } from "@/modules/accounting/domain/ports/journal-entries.repo";
import { hydrateJournalFromRow } from "./journal-mapping";

/**
 * Tx-aware Prisma adapter for `JournalEntriesRepository` (POC #10 C3-B).
 *
 * Wrap-thin shim over the legacy `JournalRepository.{createWithRetryTx,
 * updateStatusTx, updateTx}` until the C5 cleanup folds the legacy code into
 * this module. Constructed against an open `Prisma.TransactionClient` by the
 * UoW adapter (POC #9) — the application layer never sees `tx` directly.
 *
 * §13 lockeado en C3-B (RED 1 emergente):
 *   - `create` retorna el aggregate hidratado desde DB, NO el input. Los
 *     `id` (Journal + JournalLine) son CUIDs asignados por Prisma; los
 *     UUIDs pre-persist generados por `Journal.create()` se descartan. Esto
 *     alinea `create` con el contrato ya documentado de `update` y
 *     `updateStatus` ("hydrated from DB").
 *   - Opción B status: el adapter persiste `journal.status` tal cual lo trae
 *     el aggregate. NO asume DRAFT — el use case `createEntry` lo garantiza
 *     vía `Journal.create()` factory; `createAndPost` lo posterea pre-tx.
 */

const legacyRepo = new LegacyJournalRepository();

export class PrismaJournalEntriesRepository implements JournalEntriesRepository {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  async create(journal: Journal): Promise<Journal> {
    const data: Omit<CreateJournalEntryInput, "lines"> = {
      date: journal.date,
      description: journal.description,
      periodId: journal.periodId,
      voucherTypeId: journal.voucherTypeId,
      createdById: journal.createdById,
      contactId: journal.contactId ?? undefined,
      sourceType: journal.sourceType ?? undefined,
      sourceId: journal.sourceId ?? undefined,
      aiOriginalText: journal.aiOriginalText ?? undefined,
      referenceNumber: journal.referenceNumber ?? undefined,
    };
    const row = await legacyRepo.createWithRetryTx(
      this.tx,
      journal.organizationId,
      data,
      mapLinesToInputs(journal.lines),
      journal.status,
    );

    return hydrateJournalFromRow(row);
  }

  async updateStatus(journal: Journal, userId: string): Promise<Journal> {
    const row = await legacyRepo.updateStatusTx(
      this.tx,
      journal.organizationId,
      journal.id,
      journal.status,
      userId,
    );
    return hydrateJournalFromRow(row);
  }

  async update(
    journal: Journal,
    options: { replaceLines: boolean },
  ): Promise<Journal> {
    const data: Omit<UpdateJournalEntryInput, "updatedById" | "lines"> = {
      date: journal.date,
      description: journal.description,
      contactId: journal.contactId,
      referenceNumber: journal.referenceNumber,
    };
    const lines = options.replaceLines
      ? mapLinesToInputs(journal.lines)
      : undefined;
    // `journal.updatedById!` non-null assertion — `UpdateJournalEntryInput.
    // updatedById` (use case) es required y `Journal.update(input)` lo
    // persiste en `props.updatedById`, así que post-`current.update(input)`
    // siempre es string.
    const row = await legacyRepo.updateTx(
      this.tx,
      journal.organizationId,
      journal.id,
      data,
      lines,
      journal.updatedById!,
    );
    return hydrateJournalFromRow(row);
  }
}

// Mapping `JournalLine[]` (domain) → `JournalLineInput[]` (legacy DTO).
// Function declaration privada al módulo (convention 9). Compartido entre
// `create` y `update` (cuando `replaceLines: true`).
function mapLinesToInputs(lines: JournalLine[]): JournalLineInput[] {
  return lines.map((line) => ({
    accountId: line.accountId,
    debit: line.side.debit?.toNumber() ?? 0,
    credit: line.side.credit?.toNumber() ?? 0,
    description: line.description ?? undefined,
    contactId: line.contactId ?? undefined,
    order: line.order,
  }));
}

// `hydrateJournalFromRow` extraído a `./journal-mapping.ts` en C3-C REFACTOR
// 1 (segundo call-site materializado por `LegacyJournalEntriesReadAdapter`).
