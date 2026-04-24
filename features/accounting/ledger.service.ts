import "server-only";
import { NotFoundError } from "@/features/shared/errors";
import { AccountsRepository } from "./accounts.repository";
import { JournalRepository } from "./journal.repository";
import { AccountBalancesService } from "@/features/account-balances/server";
import type { LedgerEntry, TrialBalanceRow, DateRangeFilter } from "./ledger.types";
import type { AccountType } from "@/generated/prisma/client";

export class LedgerService {
  private readonly accountsRepo: AccountsRepository;
  private readonly journalRepo: JournalRepository;
  private readonly accountBalancesService: AccountBalancesService;

  constructor(
    accountsRepo?: AccountsRepository,
    journalRepo?: JournalRepository,
    accountBalancesService?: AccountBalancesService,
  ) {
    this.accountsRepo = accountsRepo ?? new AccountsRepository();
    this.journalRepo = journalRepo ?? new JournalRepository();
    this.accountBalancesService =
      accountBalancesService ?? new AccountBalancesService();
  }

  // ── Obtener el libro mayor de una cuenta con saldo acumulado ──

  async getAccountLedger(
    organizationId: string,
    accountId: string,
    dateRange?: DateRangeFilter,
    periodId?: string,
  ): Promise<LedgerEntry[]> {
    const account = await this.accountsRepo.findById(organizationId, accountId);
    if (!account) throw new NotFoundError("Cuenta");

    const lines = await this.journalRepo.findLinesByAccount(
      organizationId,
      accountId,
      { dateRange, periodId },
    );

    let runningBalance = 0;
    return lines.map((line) => {
      const debit = Number(line.debit);
      const credit = Number(line.credit);
      runningBalance += debit - credit;

      return {
        date: line.journalEntry.date,
        entryNumber: line.journalEntry.number,
        description: line.description ?? line.journalEntry.description,
        debit,
        credit,
        balance: runningBalance,
      };
    });
  }

  // ── Obtener balance de comprobación ──

  async getTrialBalance(
    organizationId: string,
    periodId: string,
  ): Promise<TrialBalanceRow[]> {
    // Principal: leer desde los registros de AccountBalance para el período
    const balances = await this.accountBalancesService.getBalances(
      organizationId,
      periodId,
    );

    if (balances.length > 0) {
      return balances.map((b) => {
        const totalDebit = Number(b.debitTotal);
        const totalCredit = Number(b.creditTotal);
        return {
          accountCode: b.account.code,
          accountName: b.account.name,
          accountType: b.account.type as AccountType,
          totalDebit,
          totalCredit,
          balance: totalDebit - totalCredit,
        };
      });
    }

    // Fallback: agregar directamente desde las líneas de asiento POSTED
    const accounts = await this.accountsRepo.findAll(organizationId);
    const rows: TrialBalanceRow[] = [];

    for (const account of accounts) {
      const aggregation = await this.journalRepo.aggregateByAccount(
        organizationId,
        account.id,
        periodId,
      );

      const totalDebit = Number(aggregation._sum.debit ?? 0);
      const totalCredit = Number(aggregation._sum.credit ?? 0);

      rows.push({
        accountCode: account.code,
        accountName: account.name,
        accountType: account.type,
        totalDebit,
        totalCredit,
        balance: totalDebit - totalCredit,
      });
    }

    return rows;
  }
}
