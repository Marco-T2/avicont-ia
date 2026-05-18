import "server-only";
import { BaseRepository } from "@/features/shared/base.repository";
import type {
  ActiveLot,
  AgentContextReaderPort,
  RecentExpense,
} from "../../domain/ports/agent-context-reader.port";

/**
 * PrismaAgentContextRepository — implements AgentContextReaderPort.
 *
 * Post retire-farm-collapse-to-lot (D-3, REQ-201): Farm desaparece. Queries
 * directas a `chickenLot` con `farmName` como texto libre (REQ-200). El
 * privacy boundary del agente respeta `memberId` directamente sobre el lot
 * (REQ-201) — sin Farm JOIN.
 *
 * Privacy boundary: `memberId` parameter scopes a `member` socio's view to
 * their own lots / expenses. `admin` and `owner` pass `undefined` and see
 * everything. Without this, leaking other members' data would be trivial
 * via the agent context channel.
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

  async findActiveLotsByMember(
    orgId: string,
    memberId?: string,
  ): Promise<ActiveLot[]> {
    const scope = this.requireOrg(orgId);

    const rows = await this.db.chickenLot.findMany({
      where: {
        ...scope,
        status: "ACTIVE",
        ...(memberId ? { memberId } : {}),
      },
      select: {
        id: true,
        name: true,
        barnNumber: true,
        initialCount: true,
        startDate: true,
        status: true,
        farmName: true,
        memberId: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return rows.map((l) => ({
      id: l.id,
      name: l.name,
      isActive: l.status === "ACTIVE",
      // farmName / memberId son NULLABLE en Prisma hasta F5-final (additive
      // migration F1 hizo las columnas nullable; F5-final las hace NOT NULL +
      // dropea el legacy `farmId`). En la práctica los lots creados post-F2
      // siempre traen valor — coerción defensiva, removible en F5-final.
      farmName: l.farmName ?? "",
      memberId: l.memberId ?? "",
      barnNumber: l.barnNumber,
      initialCount: l.initialCount,
      startDate: l.startDate,
      status: l.status,
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
        // REQ-201 privacy boundary: filter por `lot.memberId` directo
        // — Farm JOIN retirado en retire-farm-collapse-to-lot T25.
        ...(memberId ? { lot: { memberId } } : {}),
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
