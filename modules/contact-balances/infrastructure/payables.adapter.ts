import "server-only";
import {
  PrismaPayablesRepository,
  type PayableRepository,
} from "@/modules/payables/presentation/server";
import type { PayablesQueryPort } from "../domain/ports/payables-query.port";
import type {
  OpenAggregate,
  PendingDocumentSnapshot,
} from "../domain/ports/types";

/**
 * Adapter that delegates to the hexagonal `modules/payables/` port.
 * Bridges the payables module's DTOs to the contact-balances port shape
 * (currently identical — the bridge exists so each module owns its types).
 */
export class PayablesQueryAdapter implements PayablesQueryPort {
  constructor(
    private readonly repo: PayableRepository = new PrismaPayablesRepository(),
  ) {}

  async aggregateOpen(
    organizationId: string,
    contactId: string,
  ): Promise<OpenAggregate> {
    const result = await this.repo.aggregateOpen(organizationId, contactId);
    return { totalBalance: result.totalBalance, count: result.count };
  }

  async findPendingByContact(
    organizationId: string,
    contactId: string,
  ): Promise<PendingDocumentSnapshot[]> {
    const docs = await this.repo.findPendingByContact(organizationId, contactId);
    return docs.map((d) => ({
      id: d.id,
      description: d.description,
      amount: d.amount,
      paid: d.paid,
      balance: d.balance,
      dueDate: d.dueDate,
      sourceType: d.sourceType,
      sourceId: d.sourceId,
      createdAt: d.createdAt,
    }));
  }
}
