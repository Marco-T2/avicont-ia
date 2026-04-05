import { BaseRepository } from "@/features/shared/base.repository";
import type { JournalEntryStatus, Prisma } from "@/generated/prisma/client";
import type {
  CreateJournalEntryInput,
  UpdateJournalEntryInput,
  JournalEntryWithLines,
  JournalFilters,
  JournalLineInput,
} from "./journal.types";
import type { DateRangeFilter } from "./ledger.types";

const journalIncludeLines = {
  lines: {
    include: { account: true, contact: true },
    orderBy: { order: "asc" as const },
  },
  contact: true,
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

    if (filters?.periodId) {
      where.periodId = filters.periodId;
    }

    if (filters?.voucherTypeId) {
      where.voucherTypeId = filters.voucherTypeId;
    }

    if (filters?.status) {
      where.status = filters.status;
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

  async getNextNumber(
    organizationId: string,
    voucherTypeId: string,
    periodId: string,
  ): Promise<number> {
    const scope = this.requireOrg(organizationId);

    const last = await this.db.journalEntry.findFirst({
      where: { ...scope, voucherTypeId, periodId },
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
          status: "DRAFT",
          periodId: data.periodId,
          voucherTypeId: data.voucherTypeId,
          contactId: data.contactId ?? null,
          sourceType: data.sourceType ?? null,
          sourceId: data.sourceId ?? null,
          createdById: data.createdById,
          organizationId: scope.organizationId,
          lines: {
            create: lines.map((line) => ({
              accountId: line.accountId,
              debit: line.debit,
              credit: line.credit,
              description: line.description ?? null,
              contactId: line.contactId ?? null,
              order: line.order,
            })),
          },
        },
        include: journalIncludeLines,
      });

      return entry as JournalEntryWithLines;
    });
  }

  async update(
    organizationId: string,
    id: string,
    data: Omit<UpdateJournalEntryInput, "updatedById" | "lines">,
    lines: JournalLineInput[] | undefined,
    updatedById: string,
  ): Promise<JournalEntryWithLines> {
    const scope = this.requireOrg(organizationId);

    return this.db.$transaction(async (tx) => {
      const entry = await tx.journalEntry.update({
        where: { id, ...scope },
        data: {
          ...(data.date !== undefined && { date: data.date }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.contactId !== undefined && { contactId: data.contactId }),
          updatedById,
        },
        include: journalIncludeLines,
      });

      if (lines !== undefined) {
        // Delete existing lines then re-create
        await tx.journalLine.deleteMany({ where: { journalEntryId: id } });
        await tx.journalLine.createMany({
          data: lines.map((line) => ({
            journalEntryId: id,
            accountId: line.accountId,
            debit: line.debit,
            credit: line.credit,
            description: line.description ?? null,
            contactId: line.contactId ?? null,
            order: line.order,
          })),
        });

        // Re-fetch with updated lines
        const refreshed = await tx.journalEntry.findFirst({
          where: { id, ...scope },
          include: journalIncludeLines,
        });
        return refreshed as JournalEntryWithLines;
      }

      return entry as JournalEntryWithLines;
    });
  }

  async updateStatus(
    organizationId: string,
    id: string,
    status: JournalEntryStatus,
    updatedById: string,
  ): Promise<JournalEntryWithLines> {
    const scope = this.requireOrg(organizationId);

    return this.db.journalEntry.update({
      where: { id, ...scope },
      data: { status, updatedById },
      include: journalIncludeLines,
    }) as Promise<JournalEntryWithLines>;
  }

  async updateStatusTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    id: string,
    status: JournalEntryStatus,
    updatedById: string,
  ): Promise<JournalEntryWithLines> {
    const scope = this.requireOrg(organizationId);

    return tx.journalEntry.update({
      where: { id, ...scope },
      data: { status, updatedById },
      include: journalIncludeLines,
    }) as Promise<JournalEntryWithLines>;
  }

  // ── Ledger: lines for a specific account ──

  async findLinesByAccount(
    organizationId: string,
    accountId: string,
    filters?: { dateRange?: DateRangeFilter; periodId?: string },
  ) {
    const dateFilter: Record<string, unknown> = {};
    if (filters?.dateRange?.dateFrom || filters?.dateRange?.dateTo) {
      dateFilter.date = {
        ...(filters.dateRange.dateFrom && { gte: filters.dateRange.dateFrom }),
        ...(filters.dateRange.dateTo && { lte: filters.dateRange.dateTo }),
      };
    }

    return this.db.journalLine.findMany({
      where: {
        accountId,
        journalEntry: {
          organizationId,
          status: "POSTED",
          ...(filters?.periodId && { periodId: filters.periodId }),
          ...dateFilter,
        },
      },
      include: {
        journalEntry: {
          select: {
            date: true,
            number: true,
            description: true,
          },
        },
      },
      orderBy: {
        journalEntry: { date: "asc" },
      },
    });
  }

  // ── Ledger: aggregate debits/credits by account for a period ──

  async aggregateByAccount(
    organizationId: string,
    accountId: string,
    periodId: string,
  ) {
    return this.db.journalLine.aggregate({
      where: {
        accountId,
        journalEntry: {
          organizationId,
          status: "POSTED",
          periodId,
        },
      },
      _sum: {
        debit: true,
        credit: true,
      },
    });
  }
}
