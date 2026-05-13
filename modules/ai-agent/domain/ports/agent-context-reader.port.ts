/**
 * Outbound port for reading agent context data (farms, lots, expenses, members).
 * Domain layer: no server-only, no Prisma runtime, no SDK deps.
 */

export interface FarmWithLots {
  id: string;
  name: string;
  lots: Array<{
    id: string;
    name: string;
    isActive: boolean;
  }>;
}

export interface RecentExpense {
  id: string;
  amount: number;
  category: string;
  description: string | null;
  lotId: string;
  date: Date;
}

/**
 * AgentContextReaderPort — narrow read surface for agent context queries.
 */
export interface AgentContextReaderPort {
  findMemberIdByUserId(orgId: string, userId: string): Promise<string | null>;
  findFarmsWithActiveLots(orgId: string, memberId?: string): Promise<FarmWithLots[]>;
  findRecentExpenses(orgId: string, limit: number, memberId?: string): Promise<RecentExpense[]>;
  countJournalEntries(orgId: string): Promise<number>;
}
