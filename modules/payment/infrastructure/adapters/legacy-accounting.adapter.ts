import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import {
  AutoEntryGenerator,
  AccountsRepository,
  JournalRepository,
  type JournalEntryWithLines,
} from "@/features/accounting/server";
import { VoucherTypesRepository } from "@/features/voucher-types/server";
import type {
  AccountingPort,
  AccountReference,
  GenerateEntryParams,
  JournalEntrySnapshot,
  ResolvedEntryLine,
  UpdateEntryParams,
} from "../../domain/ports/accounting.port";

/**
 * Adapter wrapping the three legacy collaborators payment uses for accounting:
 *
 *   - AutoEntryGenerator   → generateEntryTx
 *   - JournalRepository    → findEntryByIdTx, voidEntryTx, updateEntryTx
 *   - AccountsRepository   → findAccountByCodeTx
 *
 * Voucher types is consumed indirectly via AutoEntryGenerator (no separate
 * port — closed decision #4 of POC #8 plan).
 *
 * The adapter maps the legacy `JournalEntryWithLines` row into our local
 * `JournalEntrySnapshot` DTO, carrying just the slice payment needs (id +
 * lines with accountNature so balances can recompute without an extra DB
 * round-trip).
 */
export class LegacyAccountingAdapter implements AccountingPort {
  private readonly accountsRepo: AccountsRepository;
  private readonly journalRepo: JournalRepository;
  private readonly autoEntryGenerator: AutoEntryGenerator;

  constructor(deps?: {
    accountsRepo?: AccountsRepository;
    journalRepo?: JournalRepository;
    autoEntryGenerator?: AutoEntryGenerator;
    voucherTypesRepo?: VoucherTypesRepository;
  }) {
    this.accountsRepo = deps?.accountsRepo ?? new AccountsRepository();
    this.journalRepo = deps?.journalRepo ?? new JournalRepository();
    this.autoEntryGenerator =
      deps?.autoEntryGenerator ??
      new AutoEntryGenerator(
        this.accountsRepo,
        deps?.voucherTypesRepo ?? new VoucherTypesRepository(),
      );
  }

  async generateEntryTx(
    tx: unknown,
    params: GenerateEntryParams,
  ): Promise<JournalEntrySnapshot> {
    const entry = await this.autoEntryGenerator.generate(
      tx as Prisma.TransactionClient,
      {
        organizationId: params.organizationId,
        voucherTypeCode: params.voucherTypeCode,
        contactId: params.contactId,
        date: params.date,
        periodId: params.periodId,
        description: params.description,
        referenceNumber: params.referenceNumber,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        createdById: params.createdById,
        lines: params.lines.map((l) => ({
          accountCode: l.accountCode,
          side: l.side,
          amount: l.amount,
          contactId: l.contactId,
          description: l.description,
        })),
      },
    );
    return toSnapshot(entry);
  }

  async findEntryByIdTx(
    tx: unknown,
    organizationId: string,
    id: string,
  ): Promise<JournalEntrySnapshot | null> {
    const row = await this.journalRepo.findByIdForBalancesTx(
      tx as Prisma.TransactionClient,
      organizationId,
      id,
    );
    return row ? toSnapshot(row) : null;
  }

  async voidEntryTx(
    tx: unknown,
    organizationId: string,
    id: string,
    userId: string,
  ): Promise<JournalEntrySnapshot> {
    const txc = tx as Prisma.TransactionClient;
    await txc.journalEntry.update({
      where: { id, organizationId },
      data: { status: "VOIDED", updatedById: userId },
    });
    const row = await this.journalRepo.findByIdForBalancesTx(
      txc,
      organizationId,
      id,
    );
    if (!row) {
      throw new Error(
        `LegacyAccountingAdapter.voidEntryTx: entry ${id} disappeared after update`,
      );
    }
    return toSnapshot(row);
  }

  async updateEntryTx(
    tx: unknown,
    organizationId: string,
    id: string,
    data: UpdateEntryParams,
    lines: ResolvedEntryLine[],
    userId: string,
  ): Promise<JournalEntrySnapshot> {
    const updated = await this.journalRepo.updateTx(
      tx as Prisma.TransactionClient,
      organizationId,
      id,
      {
        date: data.date,
        description: data.description,
        contactId: data.contactId,
        referenceNumber: data.referenceNumber,
      },
      lines.map((l) => ({
        accountId: l.accountId,
        debit: l.debit,
        credit: l.credit,
        description: l.description,
        contactId: l.contactId,
        order: l.order,
      })),
      userId,
    );
    return toSnapshot(updated);
  }

  async findAccountByCodeTx(
    _tx: unknown,
    organizationId: string,
    code: string,
  ): Promise<AccountReference | null> {
    // Legacy AccountsRepository.findByCode is non-tx; reads from this.db. We
    // accept this mismatch in C2 — Prisma sees the read inside an open tx as
    // running against the same connection in the test environment, but in
    // production the legacy repo uses the global client. This will be fixed
    // in C3 when the Prisma adapter for payments lands and gives us a tx-
    // aware accounts read. Acceptable for the POC.
    const row = await this.accountsRepo.findByCode(organizationId, code);
    return row ? { id: row.id, code: row.code } : null;
  }
}

function toSnapshot(entry: JournalEntryWithLines): JournalEntrySnapshot {
  return {
    id: entry.id,
    organizationId: entry.organizationId,
    periodId: entry.periodId,
    lines: entry.lines.map((l) => ({
      accountId: l.accountId,
      debit: Number(l.debit),
      credit: Number(l.credit),
      contactId: l.contactId ?? null,
      accountNature: l.account.nature as "DEBIT" | "CREDIT",
    })),
  };
}
