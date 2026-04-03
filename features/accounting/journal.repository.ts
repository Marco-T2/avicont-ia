import { BaseRepository } from "@/features/shared/base.repository";
import type { JournalEntry } from "@/generated/prisma/client";
import type {
  CreateJournalEntryInput,
  JournalEntryWithLines,
  JournalFilters,
  JournalLineInput,
} from "./journal.types";

const journalIncludeLines = {
  lines: {
    include: { account: true },
  },
} as const;

export class JournalRepository extends BaseRepository {
  async findAll(
    organizationId: string,
    filters?: JournalFilters,
  ): Promise<JournalEntryWithLines[]> {
    const scope = this.requireOrg(organizationId);

    const where: Record<string, unknown> = { ...scope };

    if (filters?.dateFrom || filters?.dateTo) {
      where.date = {
        ...(filters.dateFrom && { gte: filters.dateFrom }),
        ...(filters.dateTo && { lte: filters.dateTo }),
      };
    }

    if (filters?.voucherType) {
      where.voucherType = filters.voucherType;
    }

    return this.db.journalEntry.findMany({
      where,
      include: journalIncludeLines,
      orderBy: { number: "desc" },
    }) as Promise<JournalEntryWithLines[]>;
  }

  async findById(
    organizationId: string,
    id: string,
  ): Promise<JournalEntryWithLines | null> {
    const scope = this.requireOrg(organizationId);

    return this.db.journalEntry.findFirst({
      where: { id, ...scope },
      include: journalIncludeLines,
    }) as Promise<JournalEntryWithLines | null>;
  }

  async getNextNumber(organizationId: string): Promise<number> {
    const scope = this.requireOrg(organizationId);

    const last = await this.db.journalEntry.findFirst({
      where: scope,
      orderBy: { number: "desc" },
      select: { number: true },
    });

    return (last?.number ?? 0) + 1;
  }

  async create(
    organizationId: string,
    data: Omit<CreateJournalEntryInput, "lines">,
    lines: JournalLineInput[],
    number: number,
  ): Promise<JournalEntryWithLines> {
    const scope = this.requireOrg(organizationId);

    return this.db.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          number,
          date: data.date,
          description: data.description,
          voucherType: data.voucherType,
          createdById: data.createdById,
          organizationId: scope.organizationId,
          lines: {
            create: lines.map((line) => ({
              accountId: line.accountId,
              debit: line.debit,
              credit: line.credit,
              description: line.description ?? null,
            })),
          },
        },
        include: journalIncludeLines,
      });

      return entry as JournalEntryWithLines;
    });
  }
}
