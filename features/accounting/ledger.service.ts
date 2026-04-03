import { NotFoundError } from "@/features/shared/errors";
import { AccountsRepository } from "./accounts.repository";
import { prisma } from "@/lib/prisma";
import type { LedgerEntry, TrialBalanceRow, DateRangeFilter } from "./ledger.types";

export class LedgerService {
  private readonly accountsRepo: AccountsRepository;

  constructor(accountsRepo?: AccountsRepository) {
    this.accountsRepo = accountsRepo ?? new AccountsRepository();
  }

  // ── Get account ledger with running balance ──

  async getAccountLedger(
    organizationId: string,
    accountId: string,
    dateRange?: DateRangeFilter,
  ): Promise<LedgerEntry[]> {
    const account = await this.accountsRepo.findById(organizationId, accountId);
    if (!account) throw new NotFoundError("Cuenta");

    const dateFilter: Record<string, unknown> = {};
    if (dateRange?.dateFrom || dateRange?.dateTo) {
      dateFilter.date = {
        ...(dateRange.dateFrom && { gte: dateRange.dateFrom }),
        ...(dateRange.dateTo && { lte: dateRange.dateTo }),
      };
    }

    const lines = await prisma.journalLine.findMany({
      where: {
        accountId,
        journalEntry: {
          organizationId,
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

  // ── Get trial balance (balance de comprobación) ──

  async getTrialBalance(
    organizationId: string,
    date?: Date,
  ): Promise<TrialBalanceRow[]> {
    const accounts = await this.accountsRepo.findAll(organizationId);

    const dateFilter: Record<string, unknown> = {};
    if (date) {
      dateFilter.date = { lte: date };
    }

    const rows: TrialBalanceRow[] = [];

    for (const account of accounts) {
      const aggregation = await prisma.journalLine.aggregate({
        where: {
          accountId: account.id,
          journalEntry: {
            organizationId,
            ...dateFilter,
          },
        },
        _sum: {
          debit: true,
          credit: true,
        },
      });

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
