import "server-only";
import {
  makeReceivablesRepository,
  type PrismaReceivablesRepository,
} from "@/modules/receivables/presentation/server";
import { prisma } from "@/lib/prisma";
import type {
  DispatchReceivablesPort,
  CreateReceivableInput,
} from "../domain/ports/dispatch-receivables.port";

/**
 * Legacy adapter: wraps PrismaReceivablesRepository for dispatch receivable ops.
 */
export class LegacyReceivablesAdapter implements DispatchReceivablesPort {
  private readonly repo: PrismaReceivablesRepository;

  constructor() {
    this.repo = makeReceivablesRepository();
  }

  async createTx(input: CreateReceivableInput): Promise<string> {
    const result = await prisma.$transaction(async (tx) => {
      return this.repo.createTx(tx, {
        organizationId: input.organizationId,
        contactId: input.contactId,
        description: input.description,
        amount: input.amount,
        dueDate: input.dueDate,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        journalEntryId: input.journalEntryId,
      });
    });
    return result.id;
  }

  async voidTx(organizationId: string, receivableId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await this.repo.voidTx(tx, organizationId, receivableId);
    });
  }
}
