import {
  NotFoundError,
  ValidationError,
  MINIMUM_TWO_LINES_REQUIRED,
  JOURNAL_LINE_BOTH_SIDES,
  JOURNAL_LINE_ZERO_AMOUNT,
  ACCOUNT_NOT_POSTABLE,
  JOURNAL_NOT_BALANCED,
  INVALID_STATUS_TRANSITION,
  ENTRY_VOIDED_IMMUTABLE,
  ENTRY_POSTED_LINES_IMMUTABLE,
  FISCAL_PERIOD_CLOSED,
  VOUCHER_TYPE_NOT_IN_ORG,
} from "@/features/shared/errors";
import { AccountsRepository } from "./accounts.repository";
import { JournalRepository } from "./journal.repository";
import { AccountBalancesService } from "@/features/account-balances";
import { FiscalPeriodsService } from "@/features/fiscal-periods";
import { VoucherTypesService } from "@/features/voucher-types";
import type { JournalEntryStatus } from "@/generated/prisma/client";
import type {
  CreateJournalEntryInput,
  UpdateJournalEntryInput,
  JournalEntryWithLines,
  JournalFilters,
} from "./journal.types";

const VALID_TRANSITIONS: Record<JournalEntryStatus, JournalEntryStatus[]> = {
  DRAFT: ["POSTED"],
  POSTED: ["VOIDED"],
  VOIDED: [],
};

export class JournalService {
  private readonly repo: JournalRepository;
  private readonly accountsRepo: AccountsRepository;
  private readonly balancesService: AccountBalancesService;
  private readonly periodsService: FiscalPeriodsService;
  private readonly voucherTypesService: VoucherTypesService;

  constructor(
    repo?: JournalRepository,
    accountsRepo?: AccountsRepository,
    balancesService?: AccountBalancesService,
    periodsService?: FiscalPeriodsService,
    voucherTypesService?: VoucherTypesService,
  ) {
    this.repo = repo ?? new JournalRepository();
    this.accountsRepo = accountsRepo ?? new AccountsRepository();
    this.balancesService = balancesService ?? new AccountBalancesService();
    this.periodsService = periodsService ?? new FiscalPeriodsService();
    this.voucherTypesService = voucherTypesService ?? new VoucherTypesService();
  }

  // ── List journal entries ──

  async list(
    organizationId: string,
    filters?: JournalFilters,
  ): Promise<JournalEntryWithLines[]> {
    return this.repo.findAll(organizationId, filters);
  }

  // ── Get a single journal entry ──

  async getById(organizationId: string, id: string): Promise<JournalEntryWithLines> {
    const entry = await this.repo.findById(organizationId, id);
    if (!entry) throw new NotFoundError("Asiento contable");
    return entry;
  }

  // ── Create a journal entry in DRAFT ──

  async createEntry(
    organizationId: string,
    input: CreateJournalEntryInput,
  ): Promise<JournalEntryWithLines> {
    const { lines, ...entryData } = input;

    // Validate fiscal period is OPEN
    const period = await this.periodsService.getById(organizationId, entryData.periodId);
    if (period.status !== "OPEN") {
      throw new ValidationError(
        "No se pueden crear asientos en un período cerrado",
        FISCAL_PERIOD_CLOSED,
      );
    }

    // Validate voucher type belongs to this org (getById throws 404 if not found for this org)
    await this.voucherTypesService.getById(organizationId, entryData.voucherTypeId);

    // Validate at least 2 lines
    if (lines.length < 2) {
      throw new ValidationError(
        "Un asiento contable debe tener al menos 2 líneas",
        MINIMUM_TWO_LINES_REQUIRED,
      );
    }

    // Validate each line
    for (const line of lines) {
      if (line.debit > 0 && line.credit > 0) {
        throw new ValidationError(
          "Una línea no puede tener débito y crédito simultáneamente",
          JOURNAL_LINE_BOTH_SIDES,
        );
      }
      if (line.debit === 0 && line.credit === 0) {
        throw new ValidationError(
          "Al menos el débito o el crédito debe ser mayor a 0",
          JOURNAL_LINE_ZERO_AMOUNT,
        );
      }
    }

    // Validate all accounts exist, are active, and are detail accounts
    for (const line of lines) {
      const account = await this.accountsRepo.findById(organizationId, line.accountId);
      if (!account) {
        throw new NotFoundError(`Cuenta ${line.accountId}`);
      }
      if (!account.isActive) {
        throw new ValidationError(`La cuenta "${account.name}" está desactivada`);
      }
      if (!account.isDetail) {
        throw new ValidationError(
          `La cuenta "${account.name}" no es de detalle (no acepta movimientos)`,
          ACCOUNT_NOT_POSTABLE,
        );
      }
    }

    // Auto-assign next correlative number per [orgId, voucherTypeId, periodId]
    const number = await this.repo.getNextNumber(
      organizationId,
      entryData.voucherTypeId,
      entryData.periodId,
    );

    return this.repo.create(organizationId, entryData, lines, number);
  }

  // ── Update a DRAFT journal entry ──

  async updateEntry(
    organizationId: string,
    id: string,
    input: UpdateJournalEntryInput,
  ): Promise<JournalEntryWithLines> {
    const entry = await this.repo.findById(organizationId, id);
    if (!entry) throw new NotFoundError("Asiento contable");

    if (entry.status === "VOIDED") {
      throw new ValidationError(
        "Un asiento anulado no puede ser modificado",
        ENTRY_VOIDED_IMMUTABLE,
      );
    }
    if (entry.status === "POSTED") {
      throw new ValidationError(
        "No se pueden modificar las líneas de un asiento contabilizado",
        ENTRY_POSTED_LINES_IMMUTABLE,
      );
    }

    const { lines, updatedById, ...data } = input;

    if (lines !== undefined) {
      if (lines.length < 2) {
        throw new ValidationError(
          "Un asiento contable debe tener al menos 2 líneas",
          MINIMUM_TWO_LINES_REQUIRED,
        );
      }

      for (const line of lines) {
        if (line.debit > 0 && line.credit > 0) {
          throw new ValidationError(
            "Una línea no puede tener débito y crédito simultáneamente",
            JOURNAL_LINE_BOTH_SIDES,
          );
        }
        if (line.debit === 0 && line.credit === 0) {
          throw new ValidationError(
            "Al menos el débito o el crédito debe ser mayor a 0",
            JOURNAL_LINE_ZERO_AMOUNT,
          );
        }
      }

      for (const line of lines) {
        const account = await this.accountsRepo.findById(organizationId, line.accountId);
        if (!account) throw new NotFoundError(`Cuenta ${line.accountId}`);
        if (!account.isActive) {
          throw new ValidationError(`La cuenta "${account.name}" está desactivada`);
        }
        if (!account.isDetail) {
          throw new ValidationError(
            `La cuenta "${account.name}" no es de detalle (no acepta movimientos)`,
            ACCOUNT_NOT_POSTABLE,
          );
        }
      }
    }

    return this.repo.update(organizationId, id, data, lines, updatedById);
  }

  // ── Transition status ──

  async transitionStatus(
    organizationId: string,
    id: string,
    targetStatus: JournalEntryStatus,
    userId: string,
  ): Promise<JournalEntryWithLines> {
    const entry = await this.repo.findById(organizationId, id);
    if (!entry) throw new NotFoundError("Asiento contable");

    if (entry.status === "VOIDED") {
      throw new ValidationError(
        "Un asiento anulado no puede ser modificado",
        ENTRY_VOIDED_IMMUTABLE,
      );
    }

    const allowed = VALID_TRANSITIONS[entry.status];
    if (!allowed.includes(targetStatus)) {
      throw new ValidationError(
        `No se puede pasar de ${entry.status} a ${targetStatus}`,
        INVALID_STATUS_TRANSITION,
      );
    }

    // On POST: validate period is still OPEN and double-entry balance
    if (targetStatus === "POSTED") {
      const period = await this.periodsService.getById(organizationId, entry.periodId);
      if (period.status !== "OPEN") {
        throw new ValidationError(
          "No se puede contabilizar un asiento en un período cerrado",
          FISCAL_PERIOD_CLOSED,
        );
      }

      const totalDebit = entry.lines.reduce((sum, l) => sum + Number(l.debit), 0);
      const totalCredit = entry.lines.reduce((sum, l) => sum + Number(l.credit), 0);

      if (Math.round(totalDebit * 100) !== Math.round(totalCredit * 100)) {
        throw new ValidationError(
          "Los débitos y créditos no balancean",
          JOURNAL_NOT_BALANCED,
        );
      }
    }

    return this.repo.transaction(async (tx) => {
      const updated = await this.repo.updateStatusTx(
        tx,
        organizationId,
        id,
        targetStatus,
        userId,
      );

      if (targetStatus === "POSTED") {
        await this.balancesService.applyPost(tx, updated);
      } else if (targetStatus === "VOIDED") {
        await this.balancesService.applyVoid(tx, updated);
      }

      return updated;
    });
  }
}
