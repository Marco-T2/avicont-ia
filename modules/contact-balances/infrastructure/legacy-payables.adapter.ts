import "server-only";
import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@/generated/prisma/client";
import type { PayablesQueryPort } from "../domain/ports/payables-query.port";
import type {
  OpenAggregate,
  PendingDocumentSnapshot,
} from "../domain/ports/types";
import { PayablesRepository } from "@/features/payables/payables.repository";

type DbClient = Pick<PrismaClient, "accountsPayable">;

/**
 * Adapter that delegates to the legacy `features/payables` repository.
 * Will be replaced by a port wired to payables' own hexagonal module
 * once that migration ships.
 */
export class LegacyPayablesAdapter implements PayablesQueryPort {
  private readonly repo: PayablesRepository;

  constructor(private readonly db: DbClient = prisma) {
    this.repo = new PayablesRepository();
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
    const rows = await this.db.accountsPayable.findMany({
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
    return rows.map((p) => ({
      id: p.id,
      description: p.description,
      amount: Number(p.amount),
      paid: Number(p.paid),
      balance: Number(p.balance),
      dueDate: p.dueDate,
      sourceType: p.sourceType,
      sourceId: p.sourceId,
      createdAt: p.createdAt,
    }));
  }
}
