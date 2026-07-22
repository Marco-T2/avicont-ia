import "server-only";
import { prisma } from "@/lib/prisma";
import { AutoEntryGenerator } from "@/modules/accounting/application/auto-entry-generator";
import { AutoEntryJournalWriterAdapter } from "@/modules/accounting/infrastructure/adapters/auto-entry-journal-writer.adapter";
import { PrismaAccountsRepo } from "@/modules/accounting/infrastructure/prisma-accounts.repo";
import { makeVoucherTypeRepository } from "@/modules/voucher-types/presentation/server";
import { dispatchTypeToCode } from "@/modules/accounting/shared/infrastructure/document-type-codes";
import type { OperationalDocTypesRepository } from "@/modules/operational-doc-type/domain/operational-doc-type.repository";
import type {
  DispatchJournalEntryFactoryPort,
  DispatchJournalTemplate,
  DispatchRegenerateJournalResult,
} from "../domain/ports/dispatch-journal-entry-factory.port";

/**
 * Adapter: bridges DispatchJournalEntryFactoryPort (template) →
 * AutoEntryGenerator (tx + repos). Wires accounts + voucher-type repos at
 * construction; opens a Prisma transaction and delegates per call.
 *
 * journal-physical-document Phase 6 / R-D1:
 *   - Constructor refactored from zero-arg to DI — `docTypesRepo` is injected
 *     by the dispatch composition root. Match precedent set by
 *     PrismaJournalEntryFactoryAdapter (sale-hex c2 ctor DI).
 *   - `generateForDispatch` now resolves the operationalDocType id BEFORE
 *     delegating to the AutoEntryGenerator: dispatchTypeToCode maps the enum
 *     (NOTA_DESPACHO|BOLETA_CERRADA → ND|BC), findByCode resolves the
 *     org-scoped FK id, and the template forwards it to JE.operationalDocTypeId.
 *     Lookup returning null is tolerated (orgs whose catalog hasn't been
 *     seeded yet) — JE persists with null doc type, matching the I-5 orphan
 *     tolerance pattern.
 */
export class LegacyJournalEntryFactoryAdapter
  implements DispatchJournalEntryFactoryPort
{
  private readonly generator: AutoEntryGenerator;
  private readonly accountsRepo: PrismaAccountsRepo;

  constructor(private readonly docTypesRepo: OperationalDocTypesRepository) {
    this.accountsRepo = new PrismaAccountsRepo();
    const voucherTypesRepo = makeVoucherTypeRepository();
    this.generator = new AutoEntryGenerator(
      this.accountsRepo,
      voucherTypesRepo,
      new AutoEntryJournalWriterAdapter(),
    );
  }

  async generateForDispatch(
    template: DispatchJournalTemplate,
  ): Promise<string> {
    const code = dispatchTypeToCode(template.dispatchType);
    const docType = await this.docTypesRepo.findByCode(
      template.organizationId,
      code,
    );

    const entry = await prisma.$transaction(async (tx) => {
      return this.generator.generate(tx, {
        organizationId: template.organizationId,
        voucherTypeCode: "CD",
        contactId: template.contactId,
        date: template.date,
        periodId: template.periodId,
        description: template.description,
        sourceType: template.sourceType,
        sourceId: template.sourceId,
        operationalDocTypeId: docType?.id ?? null,
        referenceNumber: template.referenceNumber ?? undefined,
        createdById: template.createdById,
        lines: template.lines,
      });
    });
    return entry.id;
  }

  async regenerateForDispatchEdit(
    oldJournalId: string,
    template: DispatchJournalTemplate,
  ): Promise<DispatchRegenerateJournalResult> {
    // For now, void old + generate new (simplified)
    const newId = await this.generateForDispatch(template);
    return { oldJournalId, newJournalId: newId };
  }
}
