import Decimal from "decimal.js";
import type {
  AccountingQueryPort,
  AccountBalanceDto,
  AccountSummaryDto,
  JournalEntrySummaryDto,
  LedgerEntryDto,
  PaymentSummaryDto,
  PurchaseSummaryDto,
  SaleSummaryDto,
} from "../../domain/ports/accounting-query.port";
import {
  AccountsService,
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
    private readonly accounts: AccountsService,
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
    limit?: number,
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
    // `getAccountLedger` retorna cronológico ascendente. "Últimos N" = los más
    // recientes preservando ese orden para que el saldo acumulado por fila
    // siga teniendo sentido visual (slice -N en lugar de reverse + take N).
    // Default 10 (más allá no aporta al uso real del agente — el sidebar QA
    // muestra resumen, no análisis profundo).
    const take = limit ?? 10;
    const sliced = entries.length > take ? entries.slice(-take) : entries;
    return sliced.map((e) => ({
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

  /**
   * Case-insensitive substring match against `code` OR `name` via in-memory
   * filter over the full COA (`AccountsService.list`). Accepted debt: the
   * existing `AccountsCrudPort.findAll` has no name-search column predicate,
   * and the COA size in this product (low hundreds) keeps the in-memory pass
   * cheap. If profiling later flags this as hot, add a dedicated
   * `findByNameOrCode` port method + Prisma `OR` predicate.
   */
  async findAccountsByName(
    orgId: string,
    query: string,
    limit?: number,
  ): Promise<AccountSummaryDto[]> {
    const take = Math.min(limit ?? 10, 50);
    const all = await this.accounts.list(orgId, { isActive: true });
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return [];
    const matches = all.filter(
      (a) =>
        a.code.toLowerCase().includes(needle) ||
        a.name.toLowerCase().includes(needle),
    );
    matches.sort((a, b) => a.code.localeCompare(b.code));
    return matches.slice(0, take).map(toAccountSummary);
  }

  async listAccounts(
    orgId: string,
    type?: "ACTIVO" | "PASIVO" | "PATRIMONIO" | "INGRESO" | "GASTO",
    isDetail?: boolean,
    limit?: number,
  ): Promise<AccountSummaryDto[]> {
    const take = Math.min(limit ?? 20, 50);
    const all = await this.accounts.list(orgId, {
      isActive: true,
      ...(type !== undefined ? { type } : {}),
      ...(isDetail !== undefined ? { isDetail } : {}),
    });
    all.sort((a, b) => a.code.localeCompare(b.code));
    return all.slice(0, take).map(toAccountSummary);
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

function toAccountSummary(a: {
  id: string;
  code: string;
  name: string;
  type: "ACTIVO" | "PASIVO" | "PATRIMONIO" | "INGRESO" | "GASTO";
  isDetail: boolean;
}): AccountSummaryDto {
  return {
    accountId: a.id,
    code: a.code,
    name: a.name,
    type: a.type,
    isDetail: a.isDetail,
  };
}
