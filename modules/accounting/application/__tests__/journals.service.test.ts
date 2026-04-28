import { describe, expect, it } from "vitest";
import { NotFoundError } from "@/features/shared/errors";
import {
  JournalAccountInactive,
  JournalAccountNotPostable,
  JournalContactRequiredForAccount,
  JournalFiscalPeriodClosed,
  JournalLineBothSides,
  JournalLineZeroAmount,
} from "../../domain/errors/journal-errors";
import { JournalsService } from "../journals.service";
import {
  InMemoryAccountingUnitOfWork,
  InMemoryAccountsReadPort,
  InMemoryContactsReadPort,
  InMemoryFiscalPeriodsReadPort,
  InMemoryVoucherTypesReadPort,
} from "./fakes/in-memory-accounting-uow";

describe("JournalsService.createEntry", () => {
  function setup() {
    const uow = new InMemoryAccountingUnitOfWork();
    const accounts = new InMemoryAccountsReadPort();
    const contacts = new InMemoryContactsReadPort();
    const periods = new InMemoryFiscalPeriodsReadPort();
    const voucherTypes = new InMemoryVoucherTypesReadPort();
    const service = new JournalsService(
      uow,
      accounts,
      contacts,
      periods,
      voucherTypes,
    );
    return { service, uow, accounts, contacts, periods, voucherTypes };
  }

  // Failure mode declarado: throws Error("JournalsService.createEntry not implemented")
  // from the stub before any read/write happens. GREEN flips it to a successful
  // create that lands a DRAFT Journal with sequential number=1 inside the UoW.
  it("happy path: persists a DRAFT entry with two valid lines", async () => {
    const { service, uow, accounts, periods, voucherTypes } = setup();
    accounts.accountsById.set("acc-1", {
      id: "acc-1",
      name: "Caja",
      isActive: true,
      isDetail: true,
      requiresContact: false,
    });
    accounts.accountsById.set("acc-2", {
      id: "acc-2",
      name: "Banco",
      isActive: true,
      isDetail: true,
      requiresContact: false,
    });
    periods.periodsById.set("period-1", {
      id: "period-1",
      status: "OPEN",
    });
    voucherTypes.voucherTypesById.set("voucher-1", { id: "voucher-1" });

    const journal = await service.createEntry(
      "org-1",
      {
        date: new Date("2026-04-28"),
        description: "Test entry",
        periodId: "period-1",
        voucherTypeId: "voucher-1",
        createdById: "user-1",
        lines: [
          { accountId: "acc-1", debit: 100, credit: 0 },
          { accountId: "acc-2", debit: 0, credit: 100 },
        ],
      },
      { userId: "user-1" },
    );

    expect(journal.status).toBe("DRAFT");
    expect(journal.number).toBe(1);
    expect(journal.lines).toHaveLength(2);
    expect(uow.runCount).toBe(1);
    expect(uow.journalEntries.created).toHaveLength(1);
  });

  // Failure mode declarado: current GREEN reads `period` but does NOT inspect
  // `period.status`, so a CLOSED period flows straight through Journal.create
  // and gets persisted. The promise resolves where it should reject. RED
  // surfaces this as `Expected JournalFiscalPeriodClosed, received Journal`.
  // GREEN adds a `period.status !== "OPEN"` guard pre-tx (parity with legacy
  // `journal.service.ts:116`).
  it("rejects when fiscal period is CLOSED (I6)", async () => {
    const { service, accounts, periods, voucherTypes } = setup();
    accounts.accountsById.set("acc-1", {
      id: "acc-1",
      name: "Caja",
      isActive: true,
      isDetail: true,
      requiresContact: false,
    });
    accounts.accountsById.set("acc-2", {
      id: "acc-2",
      name: "Banco",
      isActive: true,
      isDetail: true,
      requiresContact: false,
    });
    periods.periodsById.set("period-closed", {
      id: "period-closed",
      status: "CLOSED",
    });
    voucherTypes.voucherTypesById.set("voucher-1", { id: "voucher-1" });

    await expect(
      service.createEntry(
        "org-1",
        {
          date: new Date("2026-04-28"),
          description: "Test entry",
          periodId: "period-closed",
          voucherTypeId: "voucher-1",
          createdById: "user-1",
          lines: [
            { accountId: "acc-1", debit: 100, credit: 0 },
            { accountId: "acc-2", debit: 0, credit: 100 },
          ],
        },
        { userId: "user-1" },
      ),
    ).rejects.toBeInstanceOf(JournalFiscalPeriodClosed);
  });

  // Failure mode declarado: current GREEN does NOT read accounts. With a line
  // pointing to an account that exists but `isDetail: false`, the use case
  // builds `Journal.create` and persists without validating I3. RED surfaces
  // this as `Expected JournalAccountNotPostable, received Journal`. GREEN
  // adds a pre-tx loop loading each account via `accountsReadPort.findById`
  // and throwing `JournalAccountNotPostable` when `isDetail: false` (parity
  // with legacy `journal.service.ts:161`).
  it("rejects when a line targets a non-detail account (I3)", async () => {
    const { service, accounts, periods, voucherTypes } = setup();
    accounts.accountsById.set("acc-summary", {
      id: "acc-summary",
      name: "Activos (resumen)",
      isActive: true,
      isDetail: false,
      requiresContact: false,
    });
    accounts.accountsById.set("acc-2", {
      id: "acc-2",
      name: "Banco",
      isActive: true,
      isDetail: true,
      requiresContact: false,
    });
    periods.periodsById.set("period-1", {
      id: "period-1",
      status: "OPEN",
    });
    voucherTypes.voucherTypesById.set("voucher-1", { id: "voucher-1" });

    await expect(
      service.createEntry(
        "org-1",
        {
          date: new Date("2026-04-28"),
          description: "Test entry",
          periodId: "period-1",
          voucherTypeId: "voucher-1",
          createdById: "user-1",
          lines: [
            { accountId: "acc-summary", debit: 100, credit: 0 },
            { accountId: "acc-2", debit: 0, credit: 100 },
          ],
        },
        { userId: "user-1" },
      ),
    ).rejects.toBeInstanceOf(JournalAccountNotPostable);
  });

  // Failure mode declarado: previous GREEN landed a placeholder
  // `throw new Error("Account ${id} not found")` for the null branch — a
  // generic Error, not the typed NotFoundError. RED surfaces this as
  // `Expected NotFoundError, received Error`. GREEN replaces the placeholder
  // with `new NotFoundError(\`Cuenta ${id}\`)` reusing the shared error class
  // (parity with legacy `journal.service.ts:156`).
  it("rejects with NotFoundError when a line targets a missing account", async () => {
    const { service, accounts, periods, voucherTypes } = setup();
    accounts.accountsById.set("acc-2", {
      id: "acc-2",
      name: "Banco",
      isActive: true,
      isDetail: true,
      requiresContact: false,
    });
    periods.periodsById.set("period-1", {
      id: "period-1",
      status: "OPEN",
    });
    voucherTypes.voucherTypesById.set("voucher-1", { id: "voucher-1" });

    await expect(
      service.createEntry(
        "org-1",
        {
          date: new Date("2026-04-28"),
          description: "Test entry",
          periodId: "period-1",
          voucherTypeId: "voucher-1",
          createdById: "user-1",
          lines: [
            { accountId: "acc-missing", debit: 100, credit: 0 },
            { accountId: "acc-2", debit: 0, credit: 100 },
          ],
        },
        { userId: "user-1" },
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  // Failure mode declarado: current ternary
  // `line.debit > 0 ? LineSide.debit(...) : LineSide.credit(...)` enters the
  // first branch as soon as `debit > 0` is truthy, IGNORING `credit > 0`. A
  // line with `{debit: 50, credit: 50}` builds LineSide.debit(50) and the
  // aggregate persists a debit-only line. RED surfaces this as
  // `Expected JournalLineBothSides, received Journal` — both-sides never
  // detected. GREEN adds an explicit guard before the ternary (parity with
  // legacy `journal.service.ts:136`).
  it("rejects when a line carries both debit and credit > 0 (I10 both-sides)", async () => {
    const { service, accounts, periods, voucherTypes } = setup();
    accounts.accountsById.set("acc-1", {
      id: "acc-1",
      name: "Caja",
      isActive: true,
      isDetail: true,
      requiresContact: false,
    });
    accounts.accountsById.set("acc-2", {
      id: "acc-2",
      name: "Banco",
      isActive: true,
      isDetail: true,
      requiresContact: false,
    });
    periods.periodsById.set("period-1", {
      id: "period-1",
      status: "OPEN",
    });
    voucherTypes.voucherTypesById.set("voucher-1", { id: "voucher-1" });

    await expect(
      service.createEntry(
        "org-1",
        {
          date: new Date("2026-04-28"),
          description: "Test entry",
          periodId: "period-1",
          voucherTypeId: "voucher-1",
          createdById: "user-1",
          lines: [
            { accountId: "acc-1", debit: 50, credit: 50 },
            { accountId: "acc-2", debit: 0, credit: 100 },
          ],
        },
        { userId: "user-1" },
      ),
    ).rejects.toBeInstanceOf(JournalLineBothSides);
  });

  // Failure mode declarado: current GREEN reads accounts and rejects only when
  // `!isDetail`. With an account that is `isActive: false, isDetail: true` the
  // first guard does NOT trigger (account is "detail"), the loop completes,
  // and the use case persists the journal. RED surfaces this as
  // `Expected JournalAccountInactive, received Journal`. GREEN inserts the
  // `!account.isActive` guard BEFORE the isDetail one, parity with legacy
  // `journal.service.ts:158`.
  it("rejects when a line targets an inactive account", async () => {
    const { service, accounts, periods, voucherTypes } = setup();
    accounts.accountsById.set("acc-inactive", {
      id: "acc-inactive",
      name: "Caja Vieja",
      isActive: false,
      isDetail: true,
      requiresContact: false,
    });
    accounts.accountsById.set("acc-2", {
      id: "acc-2",
      name: "Banco",
      isActive: true,
      isDetail: true,
      requiresContact: false,
    });
    periods.periodsById.set("period-1", {
      id: "period-1",
      status: "OPEN",
    });
    voucherTypes.voucherTypesById.set("voucher-1", { id: "voucher-1" });

    await expect(
      service.createEntry(
        "org-1",
        {
          date: new Date("2026-04-28"),
          description: "Test entry",
          periodId: "period-1",
          voucherTypeId: "voucher-1",
          createdById: "user-1",
          lines: [
            { accountId: "acc-inactive", debit: 100, credit: 0 },
            { accountId: "acc-2", debit: 0, credit: 100 },
          ],
        },
        { userId: "user-1" },
      ),
    ).rejects.toBeInstanceOf(JournalAccountInactive);
  });

  // Failure mode declarado: current GREEN has zero-amount detection ONLY in
  // the transformation `map` via `LineSide.credit(Money.of(0))`, which runs
  // AFTER the accounts loop. With an input that has BOTH (a) line {0,0} AND
  // (b) account inactive, legacy emits JournalLineZeroAmount first
  // (`journal.service.ts:142` precedes the accounts loop), but the current
  // implementation hits `JournalAccountInactive` from the accounts loop.
  // RED surfaces this as `Expected JournalLineZeroAmount, received
  // JournalAccountInactive`. GREEN promotes the zero-amount check into the
  // pre-accounts loop alongside both-sides — parity of validation order with
  // legacy.
  it("rejects with zero-amount BEFORE inactive-account when both fail", async () => {
    const { service, accounts, periods, voucherTypes } = setup();
    accounts.accountsById.set("acc-inactive", {
      id: "acc-inactive",
      name: "Caja Vieja",
      isActive: false,
      isDetail: true,
      requiresContact: false,
    });
    accounts.accountsById.set("acc-2", {
      id: "acc-2",
      name: "Banco",
      isActive: true,
      isDetail: true,
      requiresContact: false,
    });
    periods.periodsById.set("period-1", {
      id: "period-1",
      status: "OPEN",
    });
    voucherTypes.voucherTypesById.set("voucher-1", { id: "voucher-1" });

    await expect(
      service.createEntry(
        "org-1",
        {
          date: new Date("2026-04-28"),
          description: "Test entry",
          periodId: "period-1",
          voucherTypeId: "voucher-1",
          createdById: "user-1",
          lines: [
            { accountId: "acc-inactive", debit: 0, credit: 0 },
            { accountId: "acc-2", debit: 0, credit: 100 },
          ],
        },
        { userId: "user-1" },
      ),
    ).rejects.toBeInstanceOf(JournalLineZeroAmount);
  });

  // Failure mode declarado: current GREEN does NOT inspect
  // `account.requiresContact` at all. With a line targeting an account where
  // `requiresContact: true` and the input line carries no `contactId`, the
  // use case falls through to Journal.create + persist. RED surfaces this as
  // `Expected JournalContactRequiredForAccount, received Journal`. GREEN adds
  // the requiresContact + no-contactId check inside the accounts loop after
  // the isDetail guard, parity with legacy `journal.service.ts:478-484`.
  it("rejects when requiresContact account line has no contactId (I4)", async () => {
    const { service, accounts, periods, voucherTypes } = setup();
    accounts.accountsById.set("acc-receivables", {
      id: "acc-receivables",
      name: "Cuentas por cobrar",
      isActive: true,
      isDetail: true,
      requiresContact: true,
    });
    accounts.accountsById.set("acc-2", {
      id: "acc-2",
      name: "Banco",
      isActive: true,
      isDetail: true,
      requiresContact: false,
    });
    periods.periodsById.set("period-1", {
      id: "period-1",
      status: "OPEN",
    });
    voucherTypes.voucherTypesById.set("voucher-1", { id: "voucher-1" });

    await expect(
      service.createEntry(
        "org-1",
        {
          date: new Date("2026-04-28"),
          description: "Test entry",
          periodId: "period-1",
          voucherTypeId: "voucher-1",
          createdById: "user-1",
          lines: [
            { accountId: "acc-receivables", debit: 100, credit: 0 },
            { accountId: "acc-2", debit: 0, credit: 100 },
          ],
        },
        { userId: "user-1" },
      ),
    ).rejects.toBeInstanceOf(JournalContactRequiredForAccount);
  });

  // Failure mode declarado: current GREEN guards against `requiresContact &&
  // !line.contactId` but does NOT verify that a provided `contactId` actually
  // resolves to an active contact. With an input where the line provides a
  // `contactId` that the `ContactsReadPort` rejects (missing or inactive),
  // the use case skips contact validation and persists. RED surfaces this as
  // `Expected the rejection thrown by ContactsReadPort, received Journal`.
  // GREEN inserts `await this.contacts.getActiveById(orgId, line.contactId)`
  // inside the requiresContact branch (parity with legacy
  // `journal.service.ts:486`).
  it("rejects when requiresContact account line has an inactive contactId (I4)", async () => {
    const { service, accounts, contacts, periods, voucherTypes } = setup();
    accounts.accountsById.set("acc-receivables", {
      id: "acc-receivables",
      name: "Cuentas por cobrar",
      isActive: true,
      isDetail: true,
      requiresContact: true,
    });
    accounts.accountsById.set("acc-2", {
      id: "acc-2",
      name: "Banco",
      isActive: true,
      isDetail: true,
      requiresContact: false,
    });
    periods.periodsById.set("period-1", {
      id: "period-1",
      status: "OPEN",
    });
    voucherTypes.voucherTypesById.set("voucher-1", { id: "voucher-1" });
    // contact-inactive is NOT added to activeContactIds → port throws.
    const sentinel = new Error("Contact contact-inactive is inactive");
    contacts.inactiveError = sentinel;

    await expect(
      service.createEntry(
        "org-1",
        {
          date: new Date("2026-04-28"),
          description: "Test entry",
          periodId: "period-1",
          voucherTypeId: "voucher-1",
          createdById: "user-1",
          lines: [
            {
              accountId: "acc-receivables",
              debit: 100,
              credit: 0,
              contactId: "contact-inactive",
            },
            { accountId: "acc-2", debit: 0, credit: 100 },
          ],
        },
        { userId: "user-1" },
      ),
    ).rejects.toBe(sentinel);
  });
});
