import "server-only";
import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@/generated/prisma/client";
import type { ReceivablesQueryPort } from "../domain/ports/receivables-query.port";
import type {
  OpenAggregate,
  PendingDocumentSnapshot,
} from "../domain/ports/types";
import { ReceivablesRepository } from "@/features/receivables/receivables.repository";

type DbClient = Pick<PrismaClient, "accountsReceivable">;

/**
 * Adapter that delegates to the legacy `features/receivables` repository.
 * Will be replaced by a port wired to receivables' own hexagonal module
 * once that migration ships.
 */
export class LegacyReceivablesAdapter implements ReceivablesQueryPort {
  private readonly repo: ReceivablesRepository;

  constructor(private readonly db: DbClient = prisma) {
    this.repo = new ReceivablesRepository();
  }

  async aggregateOpen(
    organizationId: string,
    contactId: string,
  ): Promise<OpenAggregate> {
    const result = await this.repo.aggregateOpen(organizationId, contactId);
    return {
      totalBalance: Number(result.totalBalance),
      count: result.count,
    };
  }

  async findPendingByContact(
    organizationId: string,
    contactId: string,
  ): Promise<PendingDocumentSnapshot[]> {
    const rows = await this.db.accountsReceivable.findMany({
      where: { organizationId, contactId, status: { in: ["PENDING", "PARTIAL"] } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        description: true,
        amount: true,
        paid: true,
        balance: true,
        dueDate: true,
        sourceType: true,
        sourceId: true,
        createdAt: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      description: r.description,
      amount: Number(r.amount),
      paid: Number(r.paid),
      balance: Number(r.balance),
      dueDate: r.dueDate,
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      createdAt: r.createdAt,
    }));
  }
}
