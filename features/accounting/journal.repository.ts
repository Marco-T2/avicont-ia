import "server-only";
import { BaseRepository } from "@/features/shared/base.repository";
import type { JournalEntryStatus, Prisma } from "@/generated/prisma/client";
import { isPrismaUniqueViolation } from "@/features/shared/prisma-errors";
import {
  AppError,
  VOUCHER_NUMBER_CONTENTION,
} from "@/features/shared/errors";
import { logStructured } from "@/lib/logging/structured";
import type {
  CreateJournalEntryInput,
  UpdateJournalEntryInput,
  JournalEntryWithLines,
  JournalFilters,
  JournalLineInput,
  ReferenceNumberEntry,
} from "./journal.types";
import type { DateRangeFilter } from "./ledger.types";

const JOURNAL_NUMBER_UNIQUE_INDEX =
  "organizationId_voucherTypeId_periodId_number";
const MAX_CONTENTION_ATTEMPTS = 5;

const journalIncludeLines = {
  lines: {
    include: { account: true, contact: true },
    orderBy: { order: "asc" as const },
  },
  contact: true,
  voucherType: true,
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

    if (filters?.origin === "manual") {
      where.sourceType = null;
    } else if (filters?.origin === "auto") {
      where.sourceType = { not: null };
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

  async findByIdForBalancesTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    id: string,
  ): Promise<JournalEntryWithLines | null> {
    const scope = this.requireOrg(organizationId);

    return tx.journalEntry.findFirst({
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

  async getLastReferenceNumber(
    organizationId: string,
    voucherTypeId: string,
  ): Promise<number | null> {
    const scope = this.requireOrg(organizationId);

    const last = await this.db.journalEntry.findFirst({
      where: {
        ...scope,
        voucherTypeId,
        referenceNumber: { not: null },
      },
      orderBy: { referenceNumber: "desc" },
      select: { referenceNumber: true },
    });

    return last?.referenceNumber ?? null;
  }

  async findForCorrelationAudit(
    organizationId: string,
    voucherTypeId: string,
    filters?: { dateFrom?: Date; dateTo?: Date },
  ): Promise<{
    withReference: ReferenceNumberEntry[];
    withoutReferenceCount: number;
  }> {
    const scope = this.requireOrg(organizationId);

    const dateFilter: Record<string, unknown> = {};
    if (filters?.dateFrom || filters?.dateTo) {
      dateFilter.date = {
        ...(filters?.dateFrom && { gte: filters.dateFrom }),
        ...(filters?.dateTo && { lte: filters.dateTo }),
      };
    }

    const where = { ...scope, voucherTypeId, ...dateFilter };

    const [withReference, withoutReferenceCount] = await Promise.all([
      this.db.journalEntry.findMany({
        where: { ...where, referenceNumber: { not: null } },
        select: {
          id: true,
          referenceNumber: true,
          date: true,
          number: true,
          description: true,
        },
        orderBy: { referenceNumber: "asc" },
      }),
      this.db.journalEntry.count({
        where: { ...where, referenceNumber: null },
      }),
    ]);

    return {
      withReference: withReference.map((e) => ({
        id: e.id,
        referenceNumber: e.referenceNumber!,
        date: e.date,
        number: e.number,
        description: e.description,
      })),
      withoutReferenceCount,
    };
  }

  async create(
    organizationId: string,
    data: Omit<CreateJournalEntryInput, "lines">,
    lines: JournalLineInput[],
  ): Promise<JournalEntryWithLines> {
    return this.db.$transaction((tx) =>
      this.createWithRetryTx(tx, organizationId, data, lines, "DRAFT"),
    );
  }

  /**
   * Race-safe create inside a caller-provided transaction. Reads the current
   * max `number` for {org, voucherType, period}, attempts INSERT, and retries
   * up to `MAX_CONTENTION_ATTEMPTS` times on unique-constraint violations on
   * the compound index `organizationId_voucherTypeId_periodId_number`. Any
   * other error surfaces immediately.
   *
   * On retry exhaustion throws `VOUCHER_NUMBER_CONTENTION` — a real system
   * issue the caller must surface to the user.
   */
  async createWithRetryTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    data: Omit<CreateJournalEntryInput, "lines">,
    lines: JournalLineInput[],
    status: JournalEntryStatus = "DRAFT",
  ): Promise<JournalEntryWithLines> {
    const scope = this.requireOrg(organizationId);

    for (let attempt = 0; attempt < MAX_CONTENTION_ATTEMPTS; attempt++) {
      const last = await tx.journalEntry.findFirst({
        where: {
          ...scope,
          voucherTypeId: data.voucherTypeId,
          periodId: data.periodId,
        },
        orderBy: { number: "desc" },
        select: { number: true },
      });
      const candidate = (last?.number ?? 0) + 1;

      try {
        const entry = await tx.journalEntry.create({
          data: {
            number: candidate,
            date: data.date,
            description: data.description,
            status,
            periodId: data.periodId,
            voucherTypeId: data.voucherTypeId,
            contactId: data.contactId ?? null,
            sourceType: data.sourceType ?? null,
            sourceId: data.sourceId ?? null,
            aiOriginalText: data.aiOriginalText ?? null,
            referenceNumber: data.referenceNumber ?? null,
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
        if (attempt > 0) {
          logStructured({
            event: "journal_number_succeeded_after_retry",
            level: "info",
            orgId: scope.organizationId,
            attempts: attempt + 1,
          });
        }
        return entry as JournalEntryWithLines;
      } catch (err) {
        if (isPrismaUniqueViolation(err, JOURNAL_NUMBER_UNIQUE_INDEX)) {
          continue;
        }
        throw err;
      }
    }

    throw new AppError(
      "No se pudo asignar un número correlativo tras varios intentos",
      409,
      VOUCHER_NUMBER_CONTENTION,
    );
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
          ...(data.referenceNumber !== undefined && { referenceNumber: data.referenceNumber }),
          updatedById,
        },
        include: journalIncludeLines,
      });

      if (lines !== undefined) {
        // Eliminar las líneas existentes y volver a crearlas
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

        // Releer con las líneas actualizadas
        const refreshed = await tx.journalEntry.findFirst({
          where: { id, ...scope },
          include: journalIncludeLines,
        });
        return refreshed as JournalEntryWithLines;
      }

      return entry as JournalEntryWithLines;
    });
  }

  async updateTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    id: string,
    data: Omit<UpdateJournalEntryInput, "updatedById" | "lines">,
    lines: JournalLineInput[] | undefined,
    updatedById: string,
  ): Promise<JournalEntryWithLines> {
    const scope = this.requireOrg(organizationId);

    const entry = await tx.journalEntry.update({
      where: { id, ...scope },
      data: {
        ...(data.date !== undefined && { date: data.date }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.contactId !== undefined && { contactId: data.contactId }),
        ...(data.referenceNumber !== undefined && { referenceNumber: data.referenceNumber }),
        updatedById,
      },
      include: journalIncludeLines,
    });

    if (lines !== undefined) {
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

      const refreshed = await tx.journalEntry.findFirst({
        where: { id, ...scope },
        include: journalIncludeLines,
      });
      return refreshed as JournalEntryWithLines;
    }

    return entry as JournalEntryWithLines;
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

  // ── Libro mayor: líneas de una cuenta específica ──

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

  // ── Libro mayor: agregar débitos/créditos por cuenta para un período ──

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
