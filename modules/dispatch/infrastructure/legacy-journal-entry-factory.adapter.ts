import "server-only";
import { prisma } from "@/lib/prisma";
import {
  AutoEntryGenerator,
  AccountsRepository,
} from "@/features/accounting/server";
import { makeVoucherTypeRepository } from "@/modules/voucher-types/presentation/server";
import type {
  DispatchJournalEntryFactoryPort,
  DispatchJournalTemplate,
  DispatchRegenerateJournalResult,
} from "../domain/ports/dispatch-journal-entry-factory.port";

/**
 * Legacy adapter: wraps AutoEntryGenerator for dispatch journal generation.
 * TEMPORARY bridge until accounting migrates to hex.
 */
export class LegacyJournalEntryFactoryAdapter
  implements DispatchJournalEntryFactoryPort
{
  private readonly generator: AutoEntryGenerator;
  private readonly accountsRepo: AccountsRepository;

  constructor() {
    this.accountsRepo = new AccountsRepository();
    const voucherTypesRepo = makeVoucherTypeRepository();
    this.generator = new AutoEntryGenerator(
      this.accountsRepo,
      voucherTypesRepo,
    );
  }

  async generateForDispatch(
    template: DispatchJournalTemplate,
  ): Promise<string> {
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
