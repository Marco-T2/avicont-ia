import Decimal from "decimal.js";
import type {
  AccountingQueryPort,
  AccountBalanceDto,
  JournalEntrySummaryDto,
  LedgerEntryDto,
  PaymentSummaryDto,
  PurchaseSummaryDto,
  SaleSummaryDto,
} from "../../domain/ports/accounting-query.port";
import {
  JournalsService,
  LedgerService,
} from "@/modules/accounting/presentation/server";
import { SaleService } from "@/modules/sale/application/sale.service";
import { PurchaseService } from "@/modules/purchase/application/purchase.service";
import { PaymentsService } from "@/modules/payment/presentation/server";
import {
  roundHalfUp,
  sumDecimals,
} from "@/modules/accounting/shared/domain/money.utils";
import { formatCorrelativeNumber } from "@/modules/accounting/domain/correlative.utils";
import type { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

/**
 * Infrastructure adapter implementing `AccountingQueryPort` over the five
 * existing accounting/sale/purchase/payment services (F2 — REQ-16).
 *
 * Each method is a THIN pass-through: one underlying service call, then DTO
 * mapping (per design §3 — anti-pattern guard: no multi-service composition
 * per method). Monetary fields are serialized via `toMoneyString` —
 * `roundHalfUp(...).toFixed(2)` — at this boundary (REQ-18).
 *
 * `toMoneyString` and `sumDecimalsFromStrings` are LOCAL helpers
 * (NOT exported) — serialization is a transport concern of the agent layer;
 * domain `MonetaryAmount` stays serialization-agnostic.
 *
 * Accepted F2 debt (design §11):
 *   - `getAccountBalance` materializes the full ledger via
 *     `LedgerService.getAccountLedger` just to read the last row's balance
 *     (O(N) for what could be O(1)). Acceptable for chat scale — optimize
 *     in a follow-up SDD if profiling shows a hotspot.
 *   - `JournalEntryWithLines` (Prisma `JournalEntry & { lines, voucherType }`)
 *     does NOT pre-compute totalDebit/totalCredit on the aggregate — the
 *     adapter sums via local `sumDecimalsFromStrings(lines.map(l => l.debit))`
 *     on each entry. No new entity method.
 *   - `PaymentSummaryDto.contactId` falls back to the raw `contactId` string
 *     (no denormalized counterparty name exposed by `PaymentsService.listPaginated`).
 *     The LLM gets the id; UI can hydrate names downstream if needed.
 */
export class AccountingQueryAdapter implements AccountingQueryPort {
  constructor(
    private readonly journals: JournalsService,
    private readonly ledger: LedgerService,
    private readonly sales: SaleService,
    private readonly purchases: PurchaseService,
    private readonly payments: PaymentsService,
  ) {}

  async listRecentJournalEntries(
    orgId: string,
    limit: number,
  ): Promise<JournalEntrySummaryDto[]> {
    const result = await this.journals.listPaginated(orgId, undefined, {
      page: 1,
      pageSize: limit,
    });
    return result.items.map((entry) => {
      const debits = entry.lines.map((l) => String(l.debit));
      const credits = entry.lines.map((l) => String(l.credit));
      const totalDebit = sumDecimalsFromStrings(debits);
      const totalCredit = sumDecimalsFromStrings(credits);
      return {
        id: entry.id,
        date: toISODate(entry.date),
        displayNumber:
          formatCorrelativeNumber(
            entry.voucherType.prefix,
            entry.date,
            entry.number ?? 0,
          ) ?? String(entry.number ?? ""),
        description: entry.description ?? "",
        status: entry.status,
        totalDebit: roundHalfUp(totalDebit).toFixed(2),
        totalCredit: roundHalfUp(totalCredit).toFixed(2),
      };
    });
  }

  async getAccountMovements(
    orgId: string,
    accountId: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<LedgerEntryDto[]> {
    const range =
      dateFrom || dateTo
        ? {
            dateFrom: dateFrom ? new Date(dateFrom) : undefined,
            dateTo: dateTo ? new Date(dateTo) : undefined,
          }
        : undefined;
    const entries = await this.ledger.getAccountLedger(
      orgId,
      accountId,
      range,
    );
    return entries.map((e) => ({
      entryId: e.entryId,
      date: toISODate(e.date),
      displayNumber: e.displayNumber,
      description: e.description,
      debit: e.debit,
      credit: e.credit,
      balance: e.balance,
    }));
  }

  /**
   * O(N) over the full account ledger — accepted F2 debt (design §11). Empty
   * ledger → `{balance: "0.00", asOf: null}` sentinel (Marco lock).
   */
  async getAccountBalance(
    orgId: string,
    accountId: string,
  ): Promise<AccountBalanceDto> {
    const entries = await this.ledger.getAccountLedger(orgId, accountId);
    if (entries.length === 0) {
      return { accountId, balance: "0.00", asOf: null };
    }
    const last = entries[entries.length - 1];
    return {
      accountId,
      balance: last.balance,
      asOf: toISODate(last.date),
    };
  }

  async listSales(
    orgId: string,
    dateFrom?: string,
    dateTo?: string,
    limit?: number,
  ): Promise<SaleSummaryDto[]> {
    const filters =
      dateFrom || dateTo
        ? {
            dateFrom: dateFrom ? new Date(dateFrom) : undefined,
            dateTo: dateTo ? new Date(dateTo) : undefined,
          }
        : undefined;
    const result = await this.sales.listPaginated(orgId, filters, {
      page: 1,
      pageSize: limit ?? 20,
    });
    return result.items.map((sale) => ({
      id: sale.id,
      date: toISODate(sale.date),
      sequenceNumber: sale.sequenceNumber,
      status: sale.status,
      contactId: sale.contactId,
      description: sale.description,
      totalAmount: toMoneyString(sale.totalAmount),
    }));
  }

  async listPurchases(
    orgId: string,
    dateFrom?: string,
    dateTo?: string,
    limit?: number,
  ): Promise<PurchaseSummaryDto[]> {
    const filters =
      dateFrom || dateTo
        ? {
            dateFrom: dateFrom ? new Date(dateFrom) : undefined,
            dateTo: dateTo ? new Date(dateTo) : undefined,
          }
        : undefined;
    const result = await this.purchases.listPaginated(orgId, filters, {
      page: 1,
      pageSize: limit ?? 20,
    });
    return result.items.map((p) => ({
      id: p.id,
      date: toISODate(p.date),
      sequenceNumber: p.sequenceNumber,
      status: p.status,
      purchaseType: p.purchaseType,
      contactId: p.contactId,
      description: p.description,
      totalAmount: toMoneyString(p.totalAmount),
    }));
  }

  async listPayments(
    orgId: string,
    dateFrom?: string,
    dateTo?: string,
    limit?: number,
  ): Promise<PaymentSummaryDto[]> {
    const filters =
      dateFrom || dateTo
        ? {
            dateFrom: dateFrom ? new Date(dateFrom) : undefined,
            dateTo: dateTo ? new Date(dateTo) : undefined,
          }
        : undefined;
    const result = await this.payments.listPaginated(orgId, filters, {
      page: 1,
      pageSize: limit ?? 20,
    });
    return result.items.map((p) => ({
      id: p.id,
      date: toISODate(p.date),
      status: p.status,
      method: p.method,
      direction: p.direction,
      contactId: p.contactId,
      amount: toMoneyString(p.amount),
      description: p.description,
    }));
  }
}

// ── Local helpers (not exported — transport concern stays adapter-local) ──

function toMoneyString(m: MonetaryAmount): string {
  return roundHalfUp(new Decimal(m.value)).toFixed(2);
}

function sumDecimalsFromStrings(xs: string[]): Decimal {
  return sumDecimals(xs.map((x) => new Decimal(x)));
}

function toISODate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().split("T")[0];
}
