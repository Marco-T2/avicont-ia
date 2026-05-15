import { describe, expect, it } from "vitest";
import { NotFoundError } from "@/features/shared/errors";
import { LedgerService } from "../ledger.service";
import { InMemoryJournalLedgerQueryPort } from "./fakes/in-memory-accounting-uow";
import type { AccountsCrudPort } from "../../domain/ports/accounts-crud.port";
import type { AccountBalancesService } from "@/modules/account-balances/application/account-balances.service";
import type { Account } from "@/generated/prisma/client";

/**
 * Behavioral unit test for the hex `LedgerService` (POC #7 OLEADA 6 — C1;
 * Decimal-converged at poc-money-math-decimal-convergence — OLEADA 7 POC #2).
 *
 * The load-bearing logic under test:
 *   - `getAccountLedger` running-balance (Decimal `.minus()` chain + roundHalfUp)
 *   - `getTrialBalance` primary (AccountBalance) + fallback (aggregate) paths
 *
 * ── DEV-1 / R-money DISCHARGED ──
 * The running-balance + totals math is now `Prisma.Decimal` (sumDecimals +
 * `.minus()` chain + roundHalfUp serialized via `.toFixed(2)`). DTOs serialize
 * monetary fields as `string` at the JSON boundary (LedgerEntry + TrialBalanceRow).
 * Fixture assertions migrated: `.toBe(75.5)` → `.toBe("75.50")` etc.
 */

// Minimal AccountsCrudPort stub — LedgerService touches only findById +
// findAll. The other 13 methods throw so an accidental call fails loud.
function makeAccountsStub(
  accountsById: Map<string, Account>,
  all: Account[] = [],
): AccountsCrudPort {
  const notUsed = () => {
    throw new Error("AccountsCrudPort method not exercised by LedgerService");
  };
  return {
    findById: async (_org, id) => accountsById.get(id) ?? null,
    findAll: async () => all,
    findByCode: notUsed,
    findManyByIds: notUsed,
    findTree: notUsed,
    findByType: notUsed,
    findSiblings: notUsed,
    findDetailAccounts: notUsed,
    findDetailChildrenByParentCodes: notUsed,
    findActiveChildren: notUsed,
    create: notUsed,
    update: notUsed,
    seedChartOfAccounts: notUsed,
    deactivate: notUsed,
    countJournalLines: notUsed,
  } as AccountsCrudPort;
}

// Minimal AccountBalancesService stub — LedgerService calls only getBalances.
function makeBalancesStub(
  balances: unknown[],
): AccountBalancesService {
  return {
    getBalances: async () => balances,
  } as unknown as AccountBalancesService;
}

function account(id: string, code: string, name: string): Account {
  return {
    id,
    code,
    name,
    type: "ACTIVO",
  } as unknown as Account;
}

describe("LedgerService.getAccountLedger", () => {
  it("accumulates a running balance across POSTED lines (Decimal arithmetic, string serialization)", async () => {
    const query = new InMemoryJournalLedgerQueryPort();
    query.linesByAccount = [
      {
        debit: 100,
        credit: 0,
        description: "Apertura",
        journalEntry: { date: new Date("2099-01-01"), number: 1, description: "E1" },
      },
      {
        debit: 0,
        credit: 30,
        description: null,
        journalEntry: { date: new Date("2099-01-02"), number: 2, description: "E2" },
      },
      {
        debit: 5.5,
        credit: 0,
        description: "Ajuste",
        journalEntry: { date: new Date("2099-01-03"), number: 3, description: "E3" },
      },
    ];
    const service = new LedgerService(
      query,
      makeAccountsStub(new Map([["acc-1", account("acc-1", "1.1", "Caja")]])),
      makeBalancesStub([]),
    );

    const ledger = await service.getAccountLedger("org-1", "acc-1");

    // running balance: 100 → 70 → 75.50  (Decimal arithmetic, string serialization)
    expect(ledger.map((e) => e.balance)).toEqual(["100.00", "70.00", "75.50"]);
    expect(ledger[0].debit).toBe("100.00");
    expect(ledger[1].credit).toBe("30.00");
    // description falls back to the entry description when the line has none
    expect(ledger[1].description).toBe("E2");
    expect(ledger[2].description).toBe("Ajuste");
    expect(ledger[2].entryNumber).toBe(3);
  });

  it("returns an empty ledger when the account has no POSTED lines", async () => {
    const query = new InMemoryJournalLedgerQueryPort();
    query.linesByAccount = [];
    const service = new LedgerService(
      query,
      makeAccountsStub(new Map([["acc-1", account("acc-1", "1.1", "Caja")]])),
      makeBalancesStub([]),
    );

    const ledger = await service.getAccountLedger("org-1", "acc-1");

    expect(ledger).toEqual([]);
  });

  it("throws NotFoundError when the account does not exist", async () => {
    const query = new InMemoryJournalLedgerQueryPort();
    const service = new LedgerService(
      query,
      makeAccountsStub(new Map()),
      makeBalancesStub([]),
    );

    const err = await service
      .getAccountLedger("org-1", "missing")
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(NotFoundError);
  });
});

describe("LedgerService.getTrialBalance", () => {
  it("primary path: maps AccountBalance records with Decimal debit/credit totals (string-serialized)", async () => {
    const query = new InMemoryJournalLedgerQueryPort();
    const balances = [
      {
        debitTotal: 200,
        creditTotal: 50,
        account: { code: "1.1", name: "Caja", type: "ACTIVO" },
      },
      {
        debitTotal: 0,
        creditTotal: 150,
        account: { code: "2.1", name: "Proveedores", type: "PASIVO" },
      },
    ];
    const service = new LedgerService(
      query,
      makeAccountsStub(new Map()),
      makeBalancesStub(balances),
    );

    const rows = await service.getTrialBalance("org-1", "period-1");

    expect(rows).toEqual([
      {
        accountCode: "1.1",
        accountName: "Caja",
        accountType: "ACTIVO",
        totalDebit: "200.00",
        totalCredit: "50.00",
        balance: "150.00",
      },
      {
        accountCode: "2.1",
        accountName: "Proveedores",
        accountType: "PASIVO",
        totalDebit: "0.00",
        totalCredit: "150.00",
        balance: "-150.00",
      },
    ]);
  });

  it("fallback path: aggregates from journal lines when no AccountBalance records exist", async () => {
    const query = new InMemoryJournalLedgerQueryPort();
    // The fallback aggregate is keyed per-account; the fake returns the same
    // aggregate for every account, so use a single account to keep it crisp.
    query.aggregate = { _sum: { debit: 80.25, credit: 20 } };
    const accounts = [account("acc-1", "1.1", "Caja")];
    const service = new LedgerService(
      query,
      makeAccountsStub(new Map(), accounts),
      makeBalancesStub([]), // zero AccountBalance rows → fallback
    );

    const rows = await service.getTrialBalance("org-1", "period-1");

    expect(rows).toEqual([
      {
        accountCode: "1.1",
        accountName: "Caja",
        accountType: "ACTIVO",
        totalDebit: "80.25",
        totalCredit: "20.00",
        balance: "60.25",
      },
    ]);
  });

  it("fallback path: treats null aggregate sums as zero", async () => {
    const query = new InMemoryJournalLedgerQueryPort();
    query.aggregate = { _sum: { debit: null, credit: null } };
    const accounts = [account("acc-1", "1.1", "Caja")];
    const service = new LedgerService(
      query,
      makeAccountsStub(new Map(), accounts),
      makeBalancesStub([]),
    );

    const rows = await service.getTrialBalance("org-1", "period-1");

    expect(rows[0].totalDebit).toBe("0.00");
    expect(rows[0].totalCredit).toBe("0.00");
    expect(rows[0].balance).toBe("0.00");
  });
});

describe("LedgerService.getAccountLedgerPaginated", () => {
  function row(debit: number, credit: number, date: string, num: number) {
    return {
      debit,
      credit,
      description: null,
      journalEntry: {
        date: new Date(date),
        number: num,
        description: `E${num}`,
      },
    };
  }

  it("T1 page 1 running-balance: openingBalance=0.00, balance chain starts at 0 (mirror legacy getAccountLedger SC-3)", async () => {
    const query = new InMemoryJournalLedgerQueryPort();
    query.linesByAccountPaginated = [
      row(100, 0, "2099-01-01", 1),
      row(0, 30, "2099-01-02", 2),
      row(5.5, 0, "2099-01-03", 3),
    ];
    query.openingBalanceDeltaPrimed = 0;
    const service = new LedgerService(
      query,
      makeAccountsStub(new Map([["acc-1", account("acc-1", "1.1", "Caja")]])),
      makeBalancesStub([]),
    );

    const result = await service.getAccountLedgerPaginated(
      "org-1",
      "acc-1",
      undefined,
      undefined,
      { page: 1, pageSize: 25 },
    );

    expect(result.openingBalance).toBe("0.00");
    expect(result.items.map((e) => e.balance)).toEqual([
      "100.00",
      "70.00",
      "75.50",
    ]);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(25);
    expect(result.total).toBe(3);
    expect(result.totalPages).toBe(1);
  });

  it("T2 page N running-balance: accumulator seeded FROM openingBalanceDelta=42.5 NOT from Decimal(0) (SC-2)", async () => {
    const query = new InMemoryJournalLedgerQueryPort();
    query.linesByAccountPaginated = [
      row(200, 0, "2099-02-01", 11),
      row(0, 50, "2099-02-02", 12),
    ];
    query.openingBalanceDeltaPrimed = 42.5;
    const service = new LedgerService(
      query,
      makeAccountsStub(new Map([["acc-1", account("acc-1", "1.1", "Caja")]])),
      makeBalancesStub([]),
    );

    const result = await service.getAccountLedgerPaginated(
      "org-1",
      "acc-1",
      undefined,
      undefined,
      { page: 1, pageSize: 25 },
    );

    expect(result.openingBalance).toBe("42.50");
    // 42.5 + 200 = 242.5 → 242.5 - 50 = 192.5
    expect(result.items.map((e) => e.balance)).toEqual(["242.50", "192.50"]);
  });

  it("T3 empty page: no rows → items=[], total=0, totalPages=1, openingBalance=0.00 (SC-10)", async () => {
    const query = new InMemoryJournalLedgerQueryPort();
    query.linesByAccountPaginated = [];
    query.openingBalanceDeltaPrimed = 0;
    const service = new LedgerService(
      query,
      makeAccountsStub(new Map([["acc-1", account("acc-1", "1.1", "Caja")]])),
      makeBalancesStub([]),
    );

    const result = await service.getAccountLedgerPaginated(
      "org-1",
      "acc-1",
      undefined,
      undefined,
      { page: 1, pageSize: 25 },
    );

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(1);
    expect(result.openingBalance).toBe("0.00");
  });

  it("T4 empty page with nonzero opening boundary: items=[] but openingBalance=100.00 preserved", async () => {
    const query = new InMemoryJournalLedgerQueryPort();
    query.linesByAccountPaginated = [];
    query.openingBalanceDeltaPrimed = 100;
    const service = new LedgerService(
      query,
      makeAccountsStub(new Map([["acc-1", account("acc-1", "1.1", "Caja")]])),
      makeBalancesStub([]),
    );

    const result = await service.getAccountLedgerPaginated(
      "org-1",
      "acc-1",
      undefined,
      undefined,
      { page: 1, pageSize: 25 },
    );

    expect(result.items).toEqual([]);
    expect(result.openingBalance).toBe("100.00");
  });

  it("T5 NotFoundError when account missing (parity with legacy getAccountLedger, SC-11)", async () => {
    const query = new InMemoryJournalLedgerQueryPort();
    const service = new LedgerService(
      query,
      makeAccountsStub(new Map()),
      makeBalancesStub([]),
    );

    const err = await service
      .getAccountLedgerPaginated(
        "org-1",
        "missing",
        undefined,
        undefined,
        { page: 1, pageSize: 25 },
      )
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(NotFoundError);
  });

  it("T6 DTO serialization: openingBalance is string, debit/credit/balance are strings via .toFixed(2) (REQ-6/SC-12)", async () => {
    const query = new InMemoryJournalLedgerQueryPort();
    query.linesByAccountPaginated = [row(123.456, 0, "2099-01-01", 1)];
    query.openingBalanceDeltaPrimed = 50;
    const service = new LedgerService(
      query,
      makeAccountsStub(new Map([["acc-1", account("acc-1", "1.1", "Caja")]])),
      makeBalancesStub([]),
    );

    const result = await service.getAccountLedgerPaginated(
      "org-1",
      "acc-1",
      undefined,
      undefined,
      { page: 1, pageSize: 25 },
    );

    expect(typeof result.openingBalance).toBe("string");
    expect(result.openingBalance).toBe("50.00");
    expect(typeof result.items[0].debit).toBe("string");
    expect(result.items[0].debit).toBe("123.46");
    expect(typeof result.items[0].balance).toBe("string");
    expect(result.items[0].balance).toBe("173.46");
  });

  it("T7 pagination metadata: page=2, pageSize=5 threaded through (SC-7)", async () => {
    const query = new InMemoryJournalLedgerQueryPort();
    query.linesByAccountPaginated = [row(10, 0, "2099-01-05", 5)];
    query.openingBalanceDeltaPrimed = 0;
    const service = new LedgerService(
      query,
      makeAccountsStub(new Map([["acc-1", account("acc-1", "1.1", "Caja")]])),
      makeBalancesStub([]),
    );

    const result = await service.getAccountLedgerPaginated(
      "org-1",
      "acc-1",
      undefined,
      undefined,
      { page: 2, pageSize: 5 },
    );

    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(5);
  });
});
