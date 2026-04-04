import { BaseRepository } from "@/features/shared/base.repository";

// ── Return types for agent context queries ──

export interface AgentFarmWithActiveLots {
  id: string;
  name: string;
  lots: {
    id: string;
    name: string;
    barnNumber: number;
    initialCount: number;
    startDate: Date;
    status: string;
  }[];
}

export interface AgentRecentExpense {
  amount: unknown; // Prisma Decimal
  category: string;
  date: Date;
  lot: { name: string };
}

export interface AgentActiveAccount {
  id: string;
  code: string;
  name: string;
  type: string;
  level: number;
}

// ── Repository ──

export class AgentContextRepository extends BaseRepository {
  async findFarmsWithActiveLots(organizationId: string): Promise<AgentFarmWithActiveLots[]> {
    const scope = this.requireOrg(organizationId);

    return this.db.farm.findMany({
      where: scope,
      include: {
        lots: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            name: true,
            barnNumber: true,
            initialCount: true,
            startDate: true,
            status: true,
          },
        },
      },
    }) as unknown as AgentFarmWithActiveLots[];
  }

  async findRecentExpenses(
    organizationId: string,
    limit: number = 5,
  ): Promise<AgentRecentExpense[]> {
    const scope = this.requireOrg(organizationId);

    return this.db.expense.findMany({
      where: scope,
      orderBy: { date: "desc" },
      take: limit,
      select: {
        amount: true,
        category: true,
        date: true,
        lot: { select: { name: true } },
      },
    });
  }

  async findActiveAccounts(organizationId: string): Promise<AgentActiveAccount[]> {
    const scope = this.requireOrg(organizationId);

    return this.db.account.findMany({
      where: { ...scope, isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        level: true,
      },
      orderBy: { code: "asc" },
    });
  }

  async countJournalEntries(organizationId: string): Promise<number> {
    const scope = this.requireOrg(organizationId);

    return this.db.journalEntry.count({
      where: scope,
    });
  }
}
