/**
 * Outbound port for reading agent context data (lots, expenses, members).
 * Domain layer: no server-only, no Prisma runtime, no SDK deps.
 *
 * Post retire-farm-collapse-to-lot (REQ-200, REQ-201, D-3): Farm desaparece
 * como agregado. Lots viven en `ChickenLot` directo con `farmName` como
 * texto libre (REQ-200) y `memberId` como FK al owner (REQ-201). El método
 * de contexto retorna lots planos — el agrupamiento por farmName lo hace
 * el consumer client-side cuando lo necesita.
 */

export interface ActiveLot {
  id: string;
  /**
   * Pre-derived "{farmName} - DD/MM/YYYY" identifier shown to the LLM
   * (post simplify-lot-identifier). The agent never sees the raw
   * `name`/`barnNumber` columns — both were dropped wholesale.
   */
  displayName: string;
  isActive: boolean;
  farmName: string;
  memberId: string;
  initialCount: number;
  startDate: Date;
  status: string;
}

export interface RecentExpense {
  id: string;
  amount: number;
  category: string;
  description: string | null;
  lotId: string;
  date: Date;
  /**
   * Pre-derived lot identifier surfaced to the LLM in the expense line
   * (post simplify-lot-identifier — replaces the legacy `lot.name`).
   */
  lot: { displayName: string };
}

/**
 * AgentContextReaderPort — narrow read surface for agent context queries.
 *
 * `findActiveLotsByMember` replaces the legacy `findFarmsWithActiveLots` per
 * D-3 (port collapse). Returns `ActiveLot[]` directly; the adapter queries
 * `chickenLot` without the retired Farm JOIN.
 */
export interface AgentContextReaderPort {
  findMemberIdByUserId(orgId: string, userId: string): Promise<string | null>;
  findActiveLotsByMember(orgId: string, memberId?: string): Promise<ActiveLot[]>;
  findRecentExpenses(orgId: string, limit: number, memberId?: string): Promise<RecentExpense[]>;
  countJournalEntries(orgId: string): Promise<number>;
}
