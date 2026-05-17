import { NotFoundError } from "@/features/shared/errors";
import { AccountBalancesService } from "@/modules/account-balances/application/account-balances.service";
import type { AccountsCrudPort } from "@/modules/accounting/domain/ports/accounts-crud.port";
import type { JournalLedgerQueryPort } from "@/modules/accounting/domain/ports/journal-ledger-query.port";
import type { ContactLedgerEnrichmentDeps } from "@/modules/accounting/domain/ports/contact-ledger-enrichment.ports";
import type {
  ContactLedgerEntry,
  ContactLedgerPaginatedDto,
  DateRangeFilter,
  LedgerEntry,
  LedgerPaginatedDto,
  TrialBalanceRow,
} from "@/modules/accounting/presentation/dto/ledger.types";
import {
  roundHalfUp,
  sumDecimals,
} from "@/modules/accounting/shared/domain/money.utils";
import { formatCorrelativeNumber } from "@/modules/accounting/domain/correlative.utils";
import type { PaginationOptions } from "@/modules/shared/domain/value-objects/pagination";
import type { AccountType } from "@/generated/prisma/client";
import Decimal from "decimal.js";

/**
 * Application-layer libro-mayor use cases.
 *
 * Migrated from legacy `features/accounting/ledger.service.ts` (POC #7 OLEADA 6 — C1);
 * shim retired at OLEADA 6 sub-POC 8/8.
 *
 * Port-driven: reaches journal-line data through `JournalLedgerQueryPort`
 * (not the Prisma repo directly), accounts through `AccountsCrudPort`, and
 * period balances through `AccountBalancesService`.
 *
 * Decimal-converged per poc-money-math-decimal-convergence (OLEADA 7 POC #2):
 * running-balance accumulation and trial-balance totals use `decimal.js`
 * `Decimal` (`sumDecimals` + `.minus()` chain) from `shared/domain/money.utils`,
 * with `roundHalfUp(...).toFixed(2)` serializing monetary fields as `string`
 * at the DTO boundary. R-money textual deviation DISCHARGED. Direct
 * `decimal.js` consumption per oleada-money-decimal-hex-purity sub-POC 4
 * (sister precedents: sub-POC 2 FS/TB/ES/WS/IB builders + sub-POC 3 sale/
 * purchase/dispatch/ai-agent domains).
 */
export class LedgerService {
  constructor(
    private readonly query: JournalLedgerQueryPort,
    private readonly accounts: AccountsCrudPort,
    private readonly accountBalances: AccountBalancesService,
    /**
     * Contact-ledger enrichment collaborators (design D3 — service-side
     * post-query merge with CxC/CxP/Payment lookups). Optional at the ctor
     * for back-compat with sister tests that don't exercise contact-ledger;
     * `getContactLedgerPaginated` throws clearly when called without these
     * wired. Composition root injects concrete adapters (C4).
     */
    private readonly contactLedgerDeps?: ContactLedgerEnrichmentDeps,
  ) {}

  // ── Obtener el libro mayor de una cuenta con saldo acumulado ──

  async getAccountLedger(
    organizationId: string,
    accountId: string,
    dateRange?: DateRangeFilter,
    periodId?: string,
  ): Promise<LedgerEntry[]> {
    const account = await this.accounts.findById(organizationId, accountId);
    if (!account) throw new NotFoundError("Cuenta");

    const lines = await this.query.findLinesByAccount(
      organizationId,
      accountId,
      { dateRange, periodId },
    );

    // Decimal running balance: arbitrary-precision cumulative sum of
    // (debit - credit) per line; serialize each row's monetary fields via
    // roundHalfUp(...).toFixed(2). sumDecimals is the canonical helper from
    // shared/domain/money.utils (EX-D3 dependency direction). Port shape
    // declares debit/credit as `unknown` (Decimal serialization is adapter
    // concern); String(...) coercion is safe — decimal.js Decimal accepts string.
    const deltas = lines.map((line) =>
      new Decimal(String(line.debit)).minus(
        new Decimal(String(line.credit)),
      ),
    );
    return lines.map((line, idx) => {
      const debit = new Decimal(String(line.debit));
      const credit = new Decimal(String(line.credit));
      const runningBalance = sumDecimals(deltas.slice(0, idx + 1));

      return {
        entryId: line.journalEntry.id,
        date: line.journalEntry.date,
        entryNumber: line.journalEntry.number,
        voucherCode: line.journalEntry.voucherType.code,
        displayNumber:
          formatCorrelativeNumber(
            line.journalEntry.voucherType.prefix,
            line.journalEntry.date,
            line.journalEntry.number,
          ) ?? String(line.journalEntry.number),
        description: line.description ?? line.journalEntry.description,
        debit: roundHalfUp(debit).toFixed(2),
        credit: roundHalfUp(credit).toFixed(2),
        balance: roundHalfUp(runningBalance).toFixed(2),
      };
    });
  }

  /**
   * Paginated libro-mayor: running-balance SEEDED FROM `openingBalanceDelta`
   * (sum of debit-credit of all prior-page rows) NOT from Decimal(0).
   * Correctness invariant: page-1 → opening=0 → byte-identical to legacy
   * getAccountLedger; page-N → opening=sum-prior → correct continuation.
   *
   * R-money TIER 1 discharged: accumulator stays in decimal.js Decimal
   * end-to-end (REQ-6/D6); string serialization only at DTO boundary via
   * roundHalfUp + toFixed(2). Returns LedgerPaginatedDto where openingBalance: string is
   * serialized via roundHalfUp+toFixed(2). Legacy getAccountLedger PRESERVED
   * untouched (REQ-7, dual-method additive transitional 5th evidence).
   *
   * §13 candidate: arch/§13/cumulative-state-paginated-dto-pattern 1st
   * evidence — paginated views requiring cumulative state get a dedicated
   * port DTO (LedgerPageResult) + DTO (LedgerPaginatedDto) without polluting
   * the shared PaginatedResult<T> VO.
   */
  async getAccountLedgerPaginated(
    organizationId: string,
    accountId: string,
    dateRange?: DateRangeFilter,
    periodId?: string,
    pagination?: PaginationOptions,
  ): Promise<LedgerPaginatedDto> {
    const account = await this.accounts.findById(organizationId, accountId);
    if (!account) throw new NotFoundError("Cuenta");

    const result = await this.query.findLinesByAccountPaginated(
      organizationId,
      accountId,
      { dateRange, periodId },
      pagination,
    );

    // Port declares openingBalanceDelta as `unknown` (decimal.js Decimal at
    // the adapter, opaque at the port edge). Coerce via String(...) — Decimal
    // accepts string input, preserving precision.
    const opening = new Decimal(String(result.openingBalanceDelta));

    // Running-balance accumulator SEEDED FROM opening (NOT Decimal(0)) —
    // novel vs legacy. Page 1 → opening=0 → equivalent to legacy behavior.
    let running = opening;
    const items: LedgerEntry[] = result.items.map((line) => {
      const debit = new Decimal(String(line.debit));
      const credit = new Decimal(String(line.credit));
      running = running.plus(debit).minus(credit);
      return {
        entryId: line.journalEntry.id,
        date: line.journalEntry.date,
        entryNumber: line.journalEntry.number,
        voucherCode: line.journalEntry.voucherType.code,
        displayNumber:
          formatCorrelativeNumber(
            line.journalEntry.voucherType.prefix,
            line.journalEntry.date,
            line.journalEntry.number,
          ) ?? String(line.journalEntry.number),
        description: line.description ?? line.journalEntry.description,
        debit: roundHalfUp(debit).toFixed(2),
        credit: roundHalfUp(credit).toFixed(2),
        balance: roundHalfUp(running).toFixed(2),
      };
    });

    return {
      items,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
      openingBalance: roundHalfUp(opening).toFixed(2),
    };
  }

  /**
   * Paginated contact-keyed libro mayor — sister of
   * `getAccountLedgerPaginated` keyed por contacto (CxC / CxP libro por
   * cliente / proveedor — contact-ledger-refactor C3).
   *
   * Design D2 (LedgerService.method, NOT new service) + D3 (enrichment in
   * service, NOT adapter) + D4 (withoutAuxiliary fallback flag) + DEC-1
   * (decimal.js accumulator wrapped from port string boundary).
   *
   * Pipeline:
   *   1. Existence check via `ContactsReadPort.getActiveById` → throws
   *      NotFoundError when the contact is missing/inactive (parity sister
   *      `getAccountLedger` `accounts.findById` check).
   *   2. Fetch raw page via `query.findLinesByContactPaginated` — pure
   *      JournalLine rows + `openingBalanceDelta` (per ContactLedgerPageResult).
   *   3. Collect unique `journalEntryId` set across page rows.
   *   4. Issue THREE batched enrichment lookups in parallel
   *      (`Promise.all`) — ReceivablesContactLedgerPort + PayablesContactLedgerPort +
   *      PaymentsContactLedgerPort all called ONCE with the dedup'd id list.
   *      Mitigates design risk #1 N+1 (NO per-row queries).
   *   5. Build per-JE indexes (Map<jeId, row>) for O(N) merge.
   *   6. Per row, derive ContactLedgerEntry:
   *      - status: from CxC/CxP row when found; null otherwise.
   *      - voucherTypeHuman: from `voucherType.name`.
   *      - sourceType: forwarded from row (lowercase raw — "sale" | "purchase"
   *        | "payment" | "receipt" | null).
   *      - paymentMethod + bankAccountName: from Payment row when found.
   *      - withoutAuxiliary: true iff `sourceType === null` AND no CxC/CxP
   *        match for `journalEntry.id`.
   *      - dueDate: from CxC/CxP (ISO string at the DTO boundary).
   *   7. Running balance: decimal.js `running = opening.plus(debit).minus(credit)`
   *      per row; serialize monetary fields via `roundHalfUp(...).toFixed(2)`.
   *
   * Throws `Error` (loud) when ctor's `contactLedgerDeps` is undefined —
   * use cases must wire these collaborators via the composition root.
   */
  async getContactLedgerPaginated(
    organizationId: string,
    contactId: string,
    dateRange?: DateRangeFilter,
    periodId?: string,
    pagination?: PaginationOptions,
  ): Promise<ContactLedgerPaginatedDto> {
    if (!this.contactLedgerDeps) {
      throw new Error(
        "LedgerService.getContactLedgerPaginated requires contactLedgerDeps wired at the composition root",
      );
    }
    const { contacts, receivables, payables, payments, controlAccountCodes } =
      this.contactLedgerDeps;

    // 1. Existence check — throws NotFoundError parity sister method.
    await contacts.getActiveById(organizationId, contactId);

    // BF1 — fetch org-wide CxC/CxP control account codes ONCE per call and
    // forward both as `accountCodes` so the query is narrowed to
    // control-account movements only. Solves bug #2 (duplicate rows from
    // header+line dual surface): a JE whose CxC line is the only
    // contact-tagged debit/credit pair surfaces ONCE, and contrapartida
    // lines (Caja/Banco/Ventas/Compras) are filtered out. Passing BOTH codes
    // (instead of one based on contact type) handles the rare edge case of
    // a contact with movements on both sides.
    const { cxcAccountCode, cxpAccountCode } =
      await controlAccountCodes.getControlAccountCodes(organizationId);
    const accountCodes = [cxcAccountCode, cxpAccountCode];

    // 2. Raw page from port (adapter does SQL + opening balance scalar).
    const page = await this.query.findLinesByContactPaginated(
      organizationId,
      contactId,
      { dateRange, periodId, accountCodes },
      pagination,
    );

    // 3. Dedup journal entry ids for batched enrichment.
    const journalEntryIds = Array.from(
      new Set(page.items.map((row) => row.journalEntry.id)),
    );

    // 4. Three batched lookups in parallel — N+1 mitigated (design risk #1).
    //    Each port is called exactly ONCE per page (not per row), even when
    //    the id list is empty (parallel arms keep the contract uniform —
    //    adapters return [] on empty input).
    const [receivableRows, payableRows, paymentRows] = await Promise.all([
      receivables.findByJournalEntryIds(organizationId, journalEntryIds),
      payables.findByJournalEntryIds(organizationId, journalEntryIds),
      payments.findByJournalEntryIds(organizationId, journalEntryIds),
    ]);

    // 5. Indexes for O(N) merge.
    const receivableByJe = new Map(
      receivableRows.map((r) => [r.journalEntryId, r]),
    );
    const payableByJe = new Map(
      payableRows.map((r) => [r.journalEntryId, r]),
    );
    const paymentByJe = new Map(
      paymentRows.map((r) => [r.journalEntryId, r]),
    );

    // 6+7. Decimal accumulator seeded from openingBalanceDelta (port → string
    //      boundary, DEC-1 wrap via `new Decimal(String(...))`).
    const opening = new Decimal(String(page.openingBalanceDelta));
    let running = opening;

    const items: ContactLedgerEntry[] = page.items.map((row) => {
      const debit = new Decimal(String(row.debit));
      const credit = new Decimal(String(row.credit));
      running = running.plus(debit).minus(credit);

      const jeId = row.journalEntry.id;
      const receivable = receivableByJe.get(jeId);
      const payable = payableByJe.get(jeId);
      const payment = paymentByJe.get(jeId);

      // Status: CxC takes precedence over CxP (per-contact a row is one or
      // the other; arbitrary tie-break for the pathological both-present case).
      const status = receivable?.status ?? payable?.status ?? null;
      const dueDate =
        receivable?.dueDate?.toISOString() ??
        payable?.dueDate?.toISOString() ??
        null;

      // withoutAuxiliary: D4 flag — sourceType null AND no CxC/CxP match.
      // Payment-only rows (sourceType="payment" no auxiliar) do NOT flag —
      // payments aren't an "auxiliar" in the Sin auxiliar sense (spec REQ
      // "Fallback" only mentions CxC/CxP absence).
      const withoutAuxiliary =
        row.sourceType === null && !receivable && !payable;

      return {
        entryId: row.journalEntry.id,
        date: row.journalEntry.date,
        entryNumber: row.journalEntry.number,
        voucherCode: row.journalEntry.voucherType.code,
        displayNumber:
          formatCorrelativeNumber(
            row.journalEntry.voucherType.prefix,
            row.journalEntry.date,
            row.journalEntry.number,
          ) ?? String(row.journalEntry.number),
        description: row.description ?? row.journalEntry.description,
        debit: roundHalfUp(debit).toFixed(2),
        credit: roundHalfUp(credit).toFixed(2),
        balance: roundHalfUp(running).toFixed(2),
        // contact-ledger extensions
        status,
        dueDate,
        voucherTypeHuman: row.journalEntry.voucherType.name,
        sourceType: row.sourceType,
        paymentMethod: payment?.paymentMethod ?? null,
        bankAccountName: payment?.bankAccountName ?? null,
        // BF2 — forward Payment.direction (COBRO|PAGO) so renderTipo en
        // UI/PDF/XLSX puede distinguir "Cobranza" vs "Pago" cuando
        // `sourceType="payment"`. `null` para sale/purchase/manual.
        paymentDirection: payment?.direction ?? null,
        withoutAuxiliary,
      };
    });

    return {
      items,
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
      totalPages: page.totalPages,
      openingBalance: roundHalfUp(opening).toFixed(2),
    };
  }

  // ── Obtener balance de comprobación ──

  async getTrialBalance(
    organizationId: string,
    periodId: string,
  ): Promise<TrialBalanceRow[]> {
    // Principal: leer desde los registros de AccountBalance para el período
    const balances = await this.accountBalances.getBalances(
      organizationId,
      periodId,
    );

    if (balances.length > 0) {
      return balances.map((b) => {
        const totalDebit = new Decimal(String(b.debitTotal));
        const totalCredit = new Decimal(String(b.creditTotal));
        return {
          accountCode: b.account.code,
          accountName: b.account.name,
          accountType: b.account.type as AccountType,
          totalDebit: roundHalfUp(totalDebit).toFixed(2),
          totalCredit: roundHalfUp(totalCredit).toFixed(2),
          balance: roundHalfUp(totalDebit.minus(totalCredit)).toFixed(2),
        };
      });
    }

    // Fallback: agregar directamente desde las líneas de asiento POSTED
    const accounts = await this.accounts.findAll(organizationId);
    const rows: TrialBalanceRow[] = [];

    for (const account of accounts) {
      const aggregation = await this.query.aggregateByAccount(
        organizationId,
        account.id,
        periodId,
      );

      const totalDebit = new Decimal(
        aggregation._sum.debit == null ? 0 : String(aggregation._sum.debit),
      );
      const totalCredit = new Decimal(
        aggregation._sum.credit == null ? 0 : String(aggregation._sum.credit),
      );

      rows.push({
        accountCode: account.code,
        accountName: account.name,
        accountType: account.type,
        totalDebit: roundHalfUp(totalDebit).toFixed(2),
        totalCredit: roundHalfUp(totalCredit).toFixed(2),
        balance: roundHalfUp(totalDebit.minus(totalCredit)).toFixed(2),
      });
    }

    return rows;
  }
}
