import {
  ACCOUNT_NOT_POSTABLE,
  NotFoundError,
  ValidationError,
} from "@/features/shared/errors";
import { AutoEntryGenerator } from "@/features/accounting/auto-entry-generator";
import { Prisma } from "@/generated/prisma/client";
import type { Journal } from "@/modules/accounting/domain/journal.entity";
import type { JournalEntriesReadPort } from "@/modules/accounting/domain/ports/journal-entries-read.port";
import type { JournalEntriesRepository } from "@/modules/accounting/domain/ports/journal-entries.repo";
import { LineSide } from "@/modules/accounting/domain/value-objects/line-side";
import { hydrateJournalFromRow } from "@/modules/accounting/infrastructure/journal-mapping";
import type { AccountLookupPort } from "@/modules/org-settings/domain/ports/account-lookup.port";
import { Money } from "@/modules/shared/domain/value-objects/money";

import type {
  JournalEntryFactoryPort,
  RegenerateJournalResult,
  SaleJournalTemplate,
} from "../domain/ports/journal-entry-factory.port";

/**
 * Prisma + legacy adapter for `JournalEntryFactoryPort` (POC #11.0a A3 Ciclo 4).
 * Constructor c2 (Marco lockeado): tx + 4 sub-deps inyectables. Composition
 * root cablea cross-module (sale + accounting + org-settings). Per-tx via
 * UoW callback (parity scope-bound repos POC #10).
 *
 * Dos paths internos (D-5, NO redundancia):
 *   - `generateForSale` wrappea `AutoEntryGenerator.generate(tx, ...)` legacy
 *     (CREATE flow). Hardcode `voucherTypeCode: "CI"` mirror legacy
 *     `sale.service.ts:333/475`. Status POSTED directo (auto-entry).
 *   - `regenerateForSaleEdit` usa `writeRepo.update(journal, {replaceLines:true})`
 *     directo (load+mutate+persist). NO usa AutoEntryGenerator (CREATE-only).
 *     Mutation via `Journal.regenerateFromSource` — γ7 §13 emergente Ciclo 4-pre
 *     que skip I9 sin relajar I7/I1/I2.
 *
 * §13 emergente Ciclo 4 α: `regenerateForSaleEdit` lee old via
 * `readPort.findById` NON-TX (drift vs legacy `sale.service.ts:1091` que lee
 * in-tx). Safe: old journal no co-mutado pre-write en la misma tx. Port doc
 * + use case A2 Ciclo 6b lockeados.
 *
 * accountLookup direcciones distintas (D-4, NO redundancia): sale-hex use
 * case hace `findManyByIds` (id→code) PRE-tx para `buildSaleEntryLines`; este
 * adapter hace `findManyByCodes` (code→id) IN-tx para resolver
 * `JournalLine.accountId`.
 *
 * §17 carve-out: `hydrateJournalFromRow` importado de
 * `accounting/infrastructure/journal-mapping` es helper puro row → entity
 * (sin estado, sin efectos). Reutilizar evita duplicar el mapeo byte-equivalente
 * de Prisma rows a `Journal` aggregate.
 */
export class PrismaJournalEntryFactoryAdapter
  implements JournalEntryFactoryPort
{
  constructor(
    private readonly tx: Prisma.TransactionClient,
    private readonly readPort: JournalEntriesReadPort,
    private readonly lookupPort: AccountLookupPort,
    private readonly writeRepo: JournalEntriesRepository,
    private readonly autoEntryGen: AutoEntryGenerator,
  ) {}

  async generateForSale(template: SaleJournalTemplate): Promise<Journal> {
    const row = await this.autoEntryGen.generate(this.tx, {
      organizationId: template.organizationId,
      voucherTypeCode: "CI",
      contactId: template.contactId,
      date: template.date,
      periodId: template.periodId,
      description: template.description,
      sourceType: template.sourceType,
      sourceId: template.sourceId,
      lines: template.lines.map((l) => ({
        accountCode: l.accountCode,
        side: l.side,
        amount: l.amount,
        contactId: l.contactId,
        description: l.description,
      })),
      createdById: template.createdById,
    });
    return hydrateJournalFromRow(row);
  }

  async regenerateForSaleEdit(
    oldJournalId: string,
    template: SaleJournalTemplate,
  ): Promise<RegenerateJournalResult> {
    const old = await this.readPort.findById(
      template.organizationId,
      oldJournalId,
    );
    if (!old) {
      throw new NotFoundError("Asiento contable");
    }

    const codes = template.lines.map((l) => l.accountCode);
    const accounts = await this.lookupPort.findManyByCodes(
      template.organizationId,
      codes,
    );
    const accountByCode = new Map(accounts.map((a) => [a.code, a]));
    const drafts = template.lines.map((line) => {
      const acc = accountByCode.get(line.accountCode);
      if (!acc || !acc.isActive || !acc.isDetail) {
        throw new ValidationError(
          `Cuenta ${line.accountCode} no es posteable (no encontrada, inactiva o no es de detalle)`,
          ACCOUNT_NOT_POSTABLE,
        );
      }
      return {
        accountId: acc.id,
        side:
          line.side === "DEBIT"
            ? LineSide.debit(Money.of(line.amount))
            : LineSide.credit(Money.of(line.amount)),
        description: line.description ?? null,
        contactId: line.contactId ?? null,
      };
    });

    const mutated = old.regenerateFromSource(
      {
        date: template.date,
        description: template.description,
        contactId: template.contactId,
        updatedById: template.createdById,
      },
      drafts,
    );

    const persisted = await this.writeRepo.update(mutated, {
      replaceLines: true,
    });

    return { old, new: persisted };
  }
}
