import "server-only";
import { BaseRepository } from "@/features/shared/base.repository";
import type {
  AgentContextReaderPort,
  FarmWithLots,
  RecentExpense,
} from "../../domain/ports/agent-context-reader.port";

/**
 * PrismaAgentContextRepository — implements AgentContextReaderPort.
 * Renamed from features/ai-agent/agent-context.repository.ts.
 *
 * Privacy boundary: `memberId` parameter scopes a `member` socio's view to
 * their own farms / lots / expenses. `admin` and `owner` pass `undefined`
 * and see everything. Without this, leaking other members' data would be
 * trivial via the agent context channel.
 */
export class PrismaAgentContextRepository
  extends BaseRepository
  implements AgentContextReaderPort
{
  async findMemberIdByUserId(
    orgId: string,
    userId: string,
  ): Promise<string | null> {
    const member = await this.db.organizationMember.findFirst({
      where: { organizationId: orgId, userId, deactivatedAt: null },
      select: { id: true },
    });
    return member?.id ?? null;
  }

  async findFarmsWithActiveLots(
    orgId: string,
    memberId?: string,
  ): Promise<FarmWithLots[]> {
    const scope = this.requireOrg(orgId);

    const rows = await this.db.farm.findMany({
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
    });

    return rows.map((farm) => ({
      id: farm.id,
      name: farm.name,
      lots: farm.lots.map((l) => ({
        id: l.id,
        name: l.name,
        isActive: l.status === "ACTIVE",
        // Legacy-shaped extras retained on the runtime object via cast —
        // agent.context.ts (application) reads barnNumber/initialCount.
        barnNumber: l.barnNumber,
        initialCount: l.initialCount,
        startDate: l.startDate,
        status: l.status,
      })) as unknown as FarmWithLots["lots"],
    }));
  }

  async findRecentExpenses(
    orgId: string,
    limit: number,
    memberId?: string,
  ): Promise<RecentExpense[]> {
    const scope = this.requireOrg(orgId);

    const rows = await this.db.expense.findMany({
      where: {
        ...scope,
        ...(memberId ? { lot: { farm: { memberId } } } : {}),
      },
      orderBy: { date: "desc" },
      take: limit,
      select: {
        id: true,
        amount: true,
        category: true,
        description: true,
        lotId: true,
        date: true,
        lot: { select: { name: true } },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      amount: Number(r.amount),
      category: r.category,
      description: r.description ?? null,
      lotId: r.lotId,
      date: r.date,
      // legacy-shaped extra: agent.context.ts reads `.lot.name`
      lot: { name: r.lot.name },
    })) as unknown as RecentExpense[];
  }

  async countJournalEntries(orgId: string): Promise<number> {
    const scope = this.requireOrg(orgId);
    return this.db.journalEntry.count({ where: scope });
  }
}
