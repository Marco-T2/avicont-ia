import "server-only";
import { BaseRepository } from "@/features/shared/base.repository";

// ── Return types for agent context queries ──

interface AgentFarmWithActiveLots {
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

interface AgentRecentExpense {
  amount: unknown; // Prisma Decimal
  category: string;
  date: Date;
  lot: { name: string };
}

interface AgentActiveAccount {
  id: string;
  code: string;
  name: string;
  type: string;
  level: number;
}

// ── Repository ──

export class AgentContextRepository extends BaseRepository {
  /**
   * Resolve the active OrganizationMember.id for a (org, user) pair. Returns
   * null if the user has no active membership in this org. Used by the agent
   * context layer to scope a socio's view to their own farms.
   */
  async findMemberIdByUserId(
    organizationId: string,
    userId: string,
  ): Promise<string | null> {
    const member = await this.db.organizationMember.findFirst({
      where: { organizationId, userId, deactivatedAt: null },
      select: { id: true },
    });
    return member?.id ?? null;
  }

  /**
   * @param memberId - When provided, only farms owned by this OrganizationMember
   *   are returned. Used to scope the socio agent context to "my farms only"
   *   instead of leaking every farm in the org.
   */
  async findFarmsWithActiveLots(
    organizationId: string,
    memberId?: string,
  ): Promise<AgentFarmWithActiveLots[]> {
    const scope = this.requireOrg(organizationId);

    return this.db.farm.findMany({
      where: { ...scope, ...(memberId ? { memberId } : {}) },
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

  /**
   * @param memberId - When provided, expenses are filtered to lots whose farm
   *   belongs to this member. Expense itself has no memberId column; the
   *   filter walks `lot.farm.memberId` via Prisma's nested relation where.
   */
  async findRecentExpenses(
    organizationId: string,
    limit: number = 5,
    memberId?: string,
  ): Promise<AgentRecentExpense[]> {
    const scope = this.requireOrg(organizationId);

    return this.db.expense.findMany({
      where: {
        ...scope,
        ...(memberId ? { lot: { farm: { memberId } } } : {}),
      },
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
