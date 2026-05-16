import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { JournalEntryStatus } from "@/generated/prisma/client";
import { BaseRepository } from "@/modules/shared/infrastructure/base.repository";
import { isPrismaUniqueViolation } from "@/features/shared/prisma-errors";
import { AppError, VOUCHER_NUMBER_CONTENTION } from "@/features/shared/errors";
import { logStructured } from "@/lib/logging/structured";
import type {
  CreateJournalEntryInput,
  UpdateJournalEntryInput,
  JournalEntryWithLines,
  JournalFilters,
  JournalLineInput,
  ReferenceNumberEntry,
} from "@/features/accounting/journal.types";
import type { DateRangeFilter } from "@/features/accounting/ledger.types";
import { Journal } from "@/modules/accounting/domain/journal.entity";
import type { JournalLine } from "@/modules/accounting/domain/journal-line.entity";
import { FINALIZED_JE_STATUSES } from "@/modules/accounting/shared/infrastructure/journal-status.sql";
import type { JournalEntriesRepository } from "@/modules/accounting/domain/ports/journal-entries.repo";
import type { LedgerPageResult, LedgerLineRow } from "@/modules/accounting/domain/ports/journal-ledger-query.port";
import type {
  PaginatedResult,
  PaginationOptions,
} from "@/modules/shared/domain/value-objects/pagination";
import { hydrateJournalFromRow } from "./journal-mapping";

/**
 * Prisma journal-entries infrastructure (POC #7 OLEADA 6 — C0 fold).
 *
 * Hosts BOTH:
 *   1. `JournalRepository` — the hex-owned Prisma repository, folded verbatim
 *      from legacy `features/accounting/journal.repository.ts` in C0. Owns the
 *      `journal_entries` row outright: the `createWithRetryTx` retry loop,
 *      `journalIncludeLines` shape, `MAX_CONTENTION_ATTEMPTS`, non-tx reads
 *      (`findAll`/`findById`/`getNextNumber`/`getLastReferenceNumber`/
 *      `findForCorrelationAudit`) and the libro-mayor aggregates
 *      (`findLinesByAccount`/`aggregateByAccount`).
 *   2. `PrismaJournalEntriesRepository` — the tx-aware `JournalEntriesRepository`
 *      port adapter (POC #10 C3-B). Delegates to a module-scope `JournalRepository`
 *      instance instead of the legacy import — the hex→legacy circular wrap is
 *      eliminated as of C0 (no `@/features/accounting/journal.repository` import).
 *
 * The legacy `features/accounting/journal.repository.ts` file SURVIVES C0
 * (additive cutover): legacy `journal.service.ts` + its `__tests__/` still
 * consume it; it is wholesale-deleted at C5.
 *
 * §13 lockeado en C3-B (RED 1 emergente):
 *   - `create` retorna el aggregate hidratado desde DB, NO el input. Los
 *     `id` (Journal + JournalLine) son CUIDs asignados por Prisma; los
 *     UUIDs pre-persist generados por `Journal.create()` se descartan. Esto
 *     alinea `create` con el contrato ya documentado de `update` y
 *     `updateStatus` ("hydrated from DB").
 *   - Opción B status: el adapter persiste `journal.status` tal cual lo trae
 *     el aggregate. NO asume DRAFT — el use case `createEntry` lo garantiza
 *     vía `Journal.create()` factory; `createAndPost` lo posterea pre-tx.
 */

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
    const where = buildJournalEntryWhere(
      this.requireOrg(organizationId),
      filters,
    );

    return this.db.journalEntry.findMany({
      where,
      include: journalIncludeLines,
      orderBy: { number: "desc" },
    }) as Promise<JournalEntryWithLines[]>;
  }

  /**
   * Paginated read. Offset pagination (skip/take) + parallel count via
   * Promise.all (NO `$transaction`) — heredado Sale/Purchase pilot canonical
   * EXACT. Preserves `journalIncludeLines` 3-JOIN eager hydration (accepted
   * paginated tradeoff — §13/journal-include-lines-eager-hydration-accepted-
   * paginated-tradeoff 1ra evidencia). DRY where via buildJournalEntryWhere
   * (§13/origin-filter-null-check-preserve-findpaginated-shared-where-builder
   * 1ra evidencia — sourceType IS NULL/NOT NULL preserved EXACT).
   */
  async findPaginated(
    organizationId: string,
    filters?: JournalFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<JournalEntryWithLines>> {
    const where = buildJournalEntryWhere(
      this.requireOrg(organizationId),
      filters,
    );
    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const take = pageSize;
    const [rows, total] = await Promise.all([
      this.db.journalEntry.findMany({
        where,
        include: journalIncludeLines,
        // Libro contable: cronología por fecha del asiento, no por captura.
        // Diverge de Sale/Purchase/Payment/Dispatch (createdAt desc) porque
        // `number` resetea por voucherType+período → mezclar I/E/D en una
        // tabla por `number desc` produce interleaving sin semántica.
        // Tiebreakers (createdAt desc, id desc) per AD-2 — page-shift safe.
        orderBy: [
          { date: "desc" as const },
          { createdAt: "desc" as const },
          { id: "desc" as const },
        ],
        skip: skip,
        take: take,
      }),
      this.db.journalEntry.count({ where }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
      items: rows as unknown as JournalEntryWithLines[],
      total,
      page,
      pageSize,
      totalPages,
    };
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
    fields?: { sourceType?: string | null; aiOriginalText?: string | null },
  ): Promise<JournalEntryWithLines> {
    const scope = this.requireOrg(organizationId);

    return this.db.journalEntry.update({
      where: { id, ...scope },
      data: { status, updatedById, ...(fields ?? {}) },
      include: journalIncludeLines,
    }) as Promise<JournalEntryWithLines>;
  }

  // `fields` opcional persiste cambios del aggregate que las transiciones de
  // status pueden traer en memoria. Caso concreto: sdd/ai-journal-posted-
  // editable — Journal.transitionTo("POSTED") sobre sourceType="ai" disuelve
  // provenance a null en memoria; sin propagar al UPDATE, la fila DB conserva
  // sourceType="ai" + aiOriginalText="..." → badge UI "Generado por IA" no
  // cambia + edit page guard bloquea (POSTED + sourceType!==null → redirect).
  async updateStatusTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    id: string,
    status: JournalEntryStatus,
    updatedById: string,
    fields?: { sourceType?: string | null; aiOriginalText?: string | null },
  ): Promise<JournalEntryWithLines> {
    const scope = this.requireOrg(organizationId);

    return tx.journalEntry.update({
      where: { id, ...scope },
      data: { status, updatedById, ...(fields ?? {}) },
      include: journalIncludeLines,
    }) as Promise<JournalEntryWithLines>;
  }

  // ── Libro mayor: líneas de una cuenta específica ──

  async findLinesByAccount(
    organizationId: string,
    accountId: string,
    filters?: { dateRange?: DateRangeFilter; periodId?: string },
  ) {
    return this.db.journalLine.findMany({
      where: buildLedgerLineWhere(organizationId, accountId, filters),
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

  /**
   * Paginated POSTED journal lines for one account + opening balance delta.
   * 4-query Promise.all: page window + count + within-range prior-rows +
   * historical aggregate (sum of POSTED lines BEFORE `dateFrom`). Split-port
   * 3-touchpoint cascade 2nd evidence (Journal 1st → Ledger 2nd). Cumulative-
   * state paginated DTO 1st evidence — port declares openingBalanceDelta:
   * unknown to abstract Prisma.Decimal.
   *
   * `openingBalanceDelta` semantics (post poc-pagination-ledger-bugfix):
   *   historicalOpening (date < dateFrom, scoped to periodId if provided)
   *   + withinRangePriorsDelta (sum debit-credit of the (page-1)*pageSize
   *     rows inside the filter range, preserves slice consistency for the
   *     running-balance accumulator).
   *
   * Edge cases:
   *   - `dateFrom` undefined → historical query is SKIPPED (no boundary),
   *     historicalOpening = 0. Preserves pre-bugfix behavior for no-filter
   *     reads.
   *   - `periodId` filter applies to BOTH the page WHERE AND the historical
   *     aggregate — opening within a period filter means "opening of that
   *     period at dateFrom".
   *   - `dateTo` is irrelevant to historical opening (only `dateFrom`
   *     bounds the past).
   *
   * Asymmetry vs findPaginated (Journal): 3rd findMany prior-rows query
   * (skip:0, take:skip, select:{debit,credit}) for within-range slice
   * consistency — Prisma aggregate doesn't accept skip/take. 4th query is
   * a pure aggregate (no skip/take needed for historical sum).
   */
  async findLinesByAccountPaginated(
    organizationId: string,
    accountId: string,
    filters?: { dateRange?: DateRangeFilter; periodId?: string },
    pagination?: PaginationOptions,
  ): Promise<LedgerPageResult> {
    const where = buildLedgerLineWhere(organizationId, accountId, filters);
    const orderBy = { journalEntry: { date: "asc" as const } };
    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const take = pageSize;
    const dateFrom = filters?.dateRange?.dateFrom;

    // Query 4 (historical aggregate) is conditional on `dateFrom`. Without
    // a `date < dateFrom` boundary there is no "historical" sub-set — all
    // POSTED lines are inside the open range. Skipping the query preserves
    // pre-bugfix behavior for unfiltered reads.
    const historicalPromise = dateFrom
      ? this.db.journalLine.aggregate({
          where: buildLedgerLinePriorWhere(organizationId, accountId, {
            dateFrom,
            periodId: filters?.periodId,
          }),
          _sum: { debit: true, credit: true },
        })
      : Promise.resolve({ _sum: { debit: null, credit: null } });

    const [rows, total, priorRows, historicalAgg] = await Promise.all([
      this.db.journalLine.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          journalEntry: {
            select: { date: true, number: true, description: true },
          },
        },
      }),
      this.db.journalLine.count({ where }),
      this.db.journalLine.findMany({
        where,
        orderBy,
        skip: 0,
        take: skip,
        select: { debit: true, credit: true },
      }),
      historicalPromise,
    ]);

    const historicalOpening = new Prisma.Decimal(
      String(historicalAgg._sum.debit ?? 0),
    ).minus(new Prisma.Decimal(String(historicalAgg._sum.credit ?? 0)));

    const withinRangePriorsDelta = priorRows.reduce(
      (acc, r) =>
        acc
          .plus(new Prisma.Decimal(String(r.debit)))
          .minus(new Prisma.Decimal(String(r.credit))),
      new Prisma.Decimal(0),
    );

    const openingBalanceDelta = historicalOpening.plus(withinRangePriorsDelta);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
      items: rows as unknown as LedgerLineRow[],
      total,
      page,
      pageSize,
      totalPages,
      openingBalanceDelta,
    };
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
          status: { in: [...FINALIZED_JE_STATUSES] },
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

// Module-scope hex repository instance. State-less (extends `BaseRepository`,
// default `prisma` client) — parity with the legacy module-scope singleton the
// adapters delegated to pre-C0. The hex→legacy circular wrap is gone: this is
// the hex's own repository, not an import from `features/accounting/`.
const journalRepo = new JournalRepository();

export class PrismaJournalEntriesRepository implements JournalEntriesRepository {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  async create(journal: Journal): Promise<Journal> {
    const data: Omit<CreateJournalEntryInput, "lines"> = {
      date: journal.date,
      description: journal.description,
      periodId: journal.periodId,
      voucherTypeId: journal.voucherTypeId,
      createdById: journal.createdById,
      contactId: journal.contactId ?? undefined,
      sourceType: journal.sourceType ?? undefined,
      sourceId: journal.sourceId ?? undefined,
      aiOriginalText: journal.aiOriginalText ?? undefined,
      referenceNumber: journal.referenceNumber ?? undefined,
    };
    const row = await journalRepo.createWithRetryTx(
      this.tx,
      journal.organizationId,
      data,
      mapLinesToInputs(journal.lines),
      journal.status,
    );

    return hydrateJournalFromRow(row);
  }

  async updateStatus(journal: Journal, userId: string): Promise<Journal> {
    // Propagar sourceType + aiOriginalText desde el aggregate. Necesario
    // para que la disolución AI (transitionTo POSTED clears these on
    // sourceType="ai") aterrice en DB. No-op para transiciones que no
    // mutan provenance (lock/void, post sale/purchase/payment/dispatch).
    const row = await journalRepo.updateStatusTx(
      this.tx,
      journal.organizationId,
      journal.id,
      journal.status,
      userId,
      {
        sourceType: journal.sourceType,
        aiOriginalText: journal.aiOriginalText,
      },
    );
    return hydrateJournalFromRow(row);
  }

  async update(
    journal: Journal,
    options: { replaceLines: boolean },
  ): Promise<Journal> {
    const data: Omit<UpdateJournalEntryInput, "updatedById" | "lines"> = {
      date: journal.date,
      description: journal.description,
      contactId: journal.contactId,
      referenceNumber: journal.referenceNumber,
    };
    const lines = options.replaceLines
      ? mapLinesToInputs(journal.lines)
      : undefined;
    // `journal.updatedById!` non-null assertion — `UpdateJournalEntryInput.
    // updatedById` (use case) es required y `Journal.update(input)` lo
    // persiste en `props.updatedById`, así que post-`current.update(input)`
    // siempre es string.
    const row = await journalRepo.updateTx(
      this.tx,
      journal.organizationId,
      journal.id,
      data,
      lines,
      journal.updatedById!,
    );
    return hydrateJournalFromRow(row);
  }
}

/**
 * DRY `where` builder shared by `findAll` + `findPaginated`. Preserves the
 * `sourceType IS NULL/NOT NULL` origin filter pattern EXACT (manual=NULL /
 * auto=NOT NULL). §13/origin-filter-null-check-preserve-findpaginated-shared-
 * where-builder 1ra evidencia.
 */
function buildJournalEntryWhere(
  scope: { organizationId: string },
  filters?: JournalFilters,
): Record<string, unknown> {
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

  return where;
}

/**
 * DRY `where` builder shared by `findLinesByAccount` + `findLinesByAccount
 * Paginated` (page window + count + WITHIN-RANGE priors). Mirror of
 * `buildJournalEntryWhere` pattern. Same WHERE used in queries 1-3 of
 * `findLinesByAccountPaginated` — slice consistency invariant: those three
 * queries MUST share where+orderBy or the running-balance accumulator
 * desyncs. POSTED-status filter baked in (parity legacy `findLinesByAccount`).
 *
 * NOTE — historical opening uses `buildLedgerLinePriorWhere` instead. Slice
 * consistency (this builder) and accounting semantics (the prior builder)
 * are SEPARATE concerns: opening at `dateFrom` reflects the ledger BEFORE
 * the filter, not within it. Conflating them was the poc-pagination-ledger
 * bug (commit 0ed87baf, fixed in follow-up).
 */
function buildLedgerLineWhere(
  organizationId: string,
  accountId: string,
  filters?: { dateRange?: DateRangeFilter; periodId?: string },
): Record<string, unknown> {
  const dateFilter: Record<string, unknown> = {};
  if (filters?.dateRange?.dateFrom || filters?.dateRange?.dateTo) {
    dateFilter.date = {
      ...(filters.dateRange.dateFrom && { gte: filters.dateRange.dateFrom }),
      ...(filters.dateRange.dateTo && { lte: filters.dateRange.dateTo }),
    };
  }
  return {
    accountId,
    journalEntry: {
      organizationId,
      status: { in: [...FINALIZED_JE_STATUSES] },
      ...(filters?.periodId && { periodId: filters.periodId }),
      ...dateFilter,
    },
  };
}

/**
 * `where` builder for the HISTORICAL opening aggregate (query 4 of
 * `findLinesByAccountPaginated`). Selects POSTED lines BEFORE `dateFrom`
 * for the same account+org, scoped to `periodId` when provided. `dateTo`
 * is irrelevant — historical opening only depends on the lower bound.
 *
 * Accounting semantics: opening at `dateFrom` = sum(debit - credit) of all
 * POSTED activity prior to the filter. If `periodId` is set, opening is
 * "opening of THAT period at dateFrom" (period-scoped historical sum).
 *
 * Distinct from `buildLedgerLineWhere` by design — see that builder's JSDoc
 * for the slice-consistency vs accounting-semantics separation.
 */
function buildLedgerLinePriorWhere(
  organizationId: string,
  accountId: string,
  options: { dateFrom: Date; periodId?: string },
): Record<string, unknown> {
  return {
    accountId,
    journalEntry: {
      organizationId,
      status: { in: [...FINALIZED_JE_STATUSES] },
      ...(options.periodId && { periodId: options.periodId }),
      date: { lt: options.dateFrom },
    },
  };
}

// Mapping `JournalLine[]` (domain) → `JournalLineInput[]` (legacy DTO).
// Function declaration privada al módulo (convention 9). Compartido entre
// `create` y `update` (cuando `replaceLines: true`).
function mapLinesToInputs(lines: JournalLine[]): JournalLineInput[] {
  return lines.map((line) => ({
    accountId: line.accountId,
    debit: line.side.debit?.toNumber() ?? 0,
    credit: line.side.credit?.toNumber() ?? 0,
    description: line.description ?? undefined,
    contactId: line.contactId ?? undefined,
    order: line.order,
  }));
}

// `hydrateJournalFromRow` extraído a `./journal-mapping.ts` en C3-C REFACTOR
// 1 (segundo call-site materializado por `PrismaJournalEntriesReadAdapter`).
