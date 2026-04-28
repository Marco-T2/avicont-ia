import { describe, expect, it } from "vitest";
import {
  ForbiddenError,
  NotFoundError,
  POST_NOT_ALLOWED_FOR_ROLE,
} from "@/features/shared/errors";
import {
  JournalAccountInactive,
  JournalAccountNotPostable,
  JournalContactRequiredForAccount,
  JournalFiscalPeriodClosed,
  JournalLineBothSides,
  JournalLineZeroAmount,
  JournalNotBalanced,
} from "../../domain/errors/journal-errors";
import { JournalsService } from "../journals.service";
import {
  InMemoryAccountingUnitOfWork,
  InMemoryAccountsReadPort,
  InMemoryContactsReadPort,
  InMemoryFiscalPeriodsReadPort,
  InMemoryPermissionsPort,
  InMemoryVoucherTypesReadPort,
} from "./fakes/in-memory-accounting-uow";

describe("JournalsService.createEntry", () => {
  function setup() {
    const uow = new InMemoryAccountingUnitOfWork();
    const accounts = new InMemoryAccountsReadPort();
    const contacts = new InMemoryContactsReadPort();
    const periods = new InMemoryFiscalPeriodsReadPort();
    const voucherTypes = new InMemoryVoucherTypesReadPort();
    const permissions = new InMemoryPermissionsPort();
    const service = new JournalsService(
      uow,
      accounts,
      contacts,
      periods,
      voucherTypes,
      permissions,
    );
    return {
      service,
      uow,
      accounts,
      contacts,
      periods,
      voucherTypes,
      permissions,
    };
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

describe("JournalsService.createAndPost", () => {
  function setup() {
    const uow = new InMemoryAccountingUnitOfWork();
    const accounts = new InMemoryAccountsReadPort();
    const contacts = new InMemoryContactsReadPort();
    const periods = new InMemoryFiscalPeriodsReadPort();
    const voucherTypes = new InMemoryVoucherTypesReadPort();
    const permissions = new InMemoryPermissionsPort();
    const service = new JournalsService(
      uow,
      accounts,
      contacts,
      periods,
      voucherTypes,
      permissions,
    );
    return {
      service,
      uow,
      accounts,
      contacts,
      periods,
      voucherTypes,
      permissions,
    };
  }

  // Failure mode declarado: the stub throws Error("JournalsService.createAndPost
  // not implemented") before any read/write happens. RED surfaces this as
  // `Expected resolution { journal, correlationId }, received throw 'not
  // implemented'`. GREEN implements Plan B (parity pre-tx, aggregate-driven):
  // canPost RBAC pre-tx → period/voucherType reads → both-sides/zero pre-loop
  // → accounts/contacts loop → Journal.create({...}) (I2) → draft.post()
  // (validates I1 with Money.equals bit-perfect) PRE-tx → uow.run(
  // scope.journalEntries.create(posted) + scope.accountBalances.applyPost(
  // persisted)) → return { journal: result, correlationId }.
  it("happy path: persists POSTED with balances applied and correlationId emitted", async () => {
    const { service, uow, accounts, periods, voucherTypes, permissions } =
      setup();
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
    permissions.allowedKeys.add("admin:journal:org-1");

    const { journal, correlationId } = await service.createAndPost(
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
      { userId: "user-1", role: "admin" },
    );

    expect(journal.status).toBe("POSTED");
    expect(journal.number).toBe(1);
    expect(journal.lines).toHaveLength(2);
    expect(uow.runCount).toBe(1);
    expect(uow.journalEntries.created).toHaveLength(1);
    expect(uow.accountBalances.applyPostCalls).toHaveLength(1);
    expect(uow.accountBalances.applyPostCalls[0].id).toBe(journal.id);
    expect(typeof correlationId).toBe("string");
    expect(correlationId.length).toBeGreaterThan(0);
  });

  // Failure mode declarado: current GREEN ignores permissions.canPost — the
  // use case never consults the port. With `role: "viewer"` and `allowedKeys`
  // empty, the flow proceeds to Journal.create + post + uow.run and resolves
  // with a valid `{ journal, correlationId }`. RED surfaces this as `Expected
  // ForbiddenError, received resolved value`. GREEN inserts the canPost
  // check at the START of the use case (parity legacy l199-204): if !canPost
  // throw ForbiddenError(message, POST_NOT_ALLOWED_FOR_ROLE) — PRE-tx, above
  // any read or uow.run.
  it("rejects with ForbiddenError when role is not allowed to post (RBAC)", async () => {
    const { service, accounts, periods, voucherTypes } = setup();
    // permissions.allowedKeys stays empty → canPost returns false for any role.
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
    periods.periodsById.set("period-1", { id: "period-1", status: "OPEN" });
    voucherTypes.voucherTypesById.set("voucher-1", { id: "voucher-1" });

    const err = await service
      .createAndPost(
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
        { userId: "user-1", role: "viewer" },
      )
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ForbiddenError);
    expect((err as { code?: string }).code).toBe(POST_NOT_ALLOWED_FOR_ROLE);
  });

  // Failure mode declarado: REGRESSION HARNESS, not RED→GREEN. Plan B delegates
  // I1 (partida doble) enforcement to `Journal.post()` (aggregate), which calls
  // `assertBalanced` with `Money.equals` bit-perfect — already tested in C1 at
  // the aggregate level. The current GREEN of `createAndPost` invokes
  // `draft.post()` PRE-tx, so an unbalanced input throws `JournalNotBalanced`
  // without any extra delta in the use case. This test passes de una, BUT
  // catches a regression if a future refactor bypasses `draft.post()` (e.g.,
  // implements a manual transition path). Cost is one O(1) test — value is
  // explicit aggregate↔use case integration coverage.
  it("rejects with JournalNotBalanced when debits do not equal credits (I1, regression)", async () => {
    const { service, accounts, periods, voucherTypes, permissions } = setup();
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
    periods.periodsById.set("period-1", { id: "period-1", status: "OPEN" });
    voucherTypes.voucherTypesById.set("voucher-1", { id: "voucher-1" });
    permissions.allowedKeys.add("admin:journal:org-1");

    await expect(
      service.createAndPost(
        "org-1",
        {
          date: new Date("2026-04-28"),
          description: "Unbalanced entry",
          periodId: "period-1",
          voucherTypeId: "voucher-1",
          createdById: "user-1",
          lines: [
            { accountId: "acc-1", debit: 100, credit: 0 },
            { accountId: "acc-2", debit: 0, credit: 50 },
          ],
        },
        { userId: "user-1", role: "admin" },
      ),
    ).rejects.toBeInstanceOf(JournalNotBalanced);
  });

  // Failure mode declarado: current GREEN never calls `periods.getById`. With
  // a CLOSED period primed for the input, the use case skips the read and
  // proceeds straight to draft construction + Journal.create + post + uow.run,
  // resolving with a valid `{ journal, correlationId }`. RED surfaces this as
  // `Expected JournalFiscalPeriodClosed, received resolved value`. GREEN
  // inserts the period read + status guard right after the canPost check
  // (parity legacy l210-216).
  it("rejects when fiscal period is CLOSED (I6)", async () => {
    const { service, accounts, periods, voucherTypes, permissions } = setup();
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
    permissions.allowedKeys.add("admin:journal:org-1");

    await expect(
      service.createAndPost(
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
        { userId: "user-1", role: "admin" },
      ),
    ).rejects.toBeInstanceOf(JournalFiscalPeriodClosed);
  });

  // Failure mode declarado: current GREEN never calls `voucherTypes.getById`.
  // With a `voucherTypeId` that the fake port has NOT primed, the use case
  // skips the read and proceeds to draft construction + Journal.create + post
  // + uow.run, resolving with a valid `{ journal, correlationId }`. The fake
  // throws `Error("Voucher type X not found")` when asked for an unprimed id;
  // RED surfaces this as `Expected throw of voucher-type-not-found, received
  // resolved value`. GREEN inserts the `voucherTypes.getById` call right after
  // the period check (parity legacy l219).
  it("rejects when voucher type is missing for the organization", async () => {
    const { service, accounts, periods, permissions } = setup();
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
    periods.periodsById.set("period-1", { id: "period-1", status: "OPEN" });
    // voucher-missing intentionally NOT primed → fake throws on getById.
    permissions.allowedKeys.add("admin:journal:org-1");

    await expect(
      service.createAndPost(
        "org-1",
        {
          date: new Date("2026-04-28"),
          description: "Test entry",
          periodId: "period-1",
          voucherTypeId: "voucher-missing",
          createdById: "user-1",
          lines: [
            { accountId: "acc-1", debit: 100, credit: 0 },
            { accountId: "acc-2", debit: 0, credit: 100 },
          ],
        },
        { userId: "user-1", role: "admin" },
      ),
    ).rejects.toThrow(/Voucher type voucher-missing not found/);
  });

  // Failure mode declarado: current GREEN map uses
  // `line.debit > 0 ? LineSide.debit(...) : LineSide.credit(...)`. With
  // `{debit: 50, credit: 50}`, the ternary enters the debit branch IGNORING
  // `credit`, builds `LineSide.debit(Money.of(50))`, and the aggregate
  // persists a debit-only line. RED surfaces this as `Expected
  // JournalLineBothSides, received resolved value`. GREEN inserts the
  // both-sides guard in a pre-map loop (parity legacy l229-236, same shape as
  // createEntry).
  it("rejects when a line carries both debit and credit > 0 (I10 both-sides)", async () => {
    const { service, accounts, periods, voucherTypes, permissions } = setup();
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
    periods.periodsById.set("period-1", { id: "period-1", status: "OPEN" });
    voucherTypes.voucherTypesById.set("voucher-1", { id: "voucher-1" });
    permissions.allowedKeys.add("admin:journal:org-1");

    await expect(
      service.createAndPost(
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
        { userId: "user-1", role: "admin" },
      ),
    ).rejects.toBeInstanceOf(JournalLineBothSides);
  });

  // Failure mode declarado: current GREEN has no accounts loop. With a line
  // targeting `acc-missing` (not primed in the fake), the use case never
  // consults accounts.findById — the map proceeds with `LineSide.debit(
  // Money.of(100))`, the aggregate constructs and persists. RED surfaces this
  // as `Expected NotFoundError, received resolved value`. GREEN inserts the
  // accounts loop with `findById` + null-check throwing
  // `NotFoundError("Cuenta {id}")` (parity legacy l248-251, same shape as
  // createEntry).
  it("rejects with NotFoundError when a line targets a missing account", async () => {
    const { service, accounts, periods, voucherTypes, permissions } = setup();
    accounts.accountsById.set("acc-2", {
      id: "acc-2",
      name: "Banco",
      isActive: true,
      isDetail: true,
      requiresContact: false,
    });
    periods.periodsById.set("period-1", { id: "period-1", status: "OPEN" });
    voucherTypes.voucherTypesById.set("voucher-1", { id: "voucher-1" });
    permissions.allowedKeys.add("admin:journal:org-1");

    await expect(
      service.createAndPost(
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
        { userId: "user-1", role: "admin" },
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  // Failure mode declarado: current accounts loop only validates existence
  // (`!account`). With a line targeting `acc-inactive` (`isActive: false`,
  // `isDetail: true`), the loop completes (account exists), the flow proceeds
  // to map + Journal.create + post + uow.run, resolving OK. RED surfaces this
  // as `Expected JournalAccountInactive, received resolved value`. GREEN
  // inserts `if (!account.isActive) throw new JournalAccountInactive(
  // account.name)` right after the null-check, BEFORE isDetail (parity legacy
  // l252-254, where isActive precedes isDetail). NOTE: emitted without code
  // (parity legacy `code === undefined`) — second occurrence of the "errores
  // legacy sin code" pattern, contador now 2/3 (createEntry was 1/3).
  it("rejects when a line targets an inactive account", async () => {
    const { service, accounts, periods, voucherTypes, permissions } = setup();
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
    periods.periodsById.set("period-1", { id: "period-1", status: "OPEN" });
    voucherTypes.voucherTypesById.set("voucher-1", { id: "voucher-1" });
    permissions.allowedKeys.add("admin:journal:org-1");

    await expect(
      service.createAndPost(
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
        { userId: "user-1", role: "admin" },
      ),
    ).rejects.toBeInstanceOf(JournalAccountInactive);
  });

  // Failure mode declarado: current accounts loop validates findById + null
  // + isActive, NOT isDetail. With a line targeting `acc-summary` (`isActive:
  // true, isDetail: false`), the loop completes (active account, exists), the
  // flow proceeds to map + Journal.create + post + uow.run, resolving OK. RED
  // surfaces this as `Expected JournalAccountNotPostable, received resolved
  // value`. GREEN adds `if (!account.isDetail) throw new
  // JournalAccountNotPostable()` after the isActive check (parity legacy
  // l255-260).
  it("rejects when a line targets a non-detail account (I3)", async () => {
    const { service, accounts, periods, voucherTypes, permissions } = setup();
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
    periods.periodsById.set("period-1", { id: "period-1", status: "OPEN" });
    voucherTypes.voucherTypesById.set("voucher-1", { id: "voucher-1" });
    permissions.allowedKeys.add("admin:journal:org-1");

    await expect(
      service.createAndPost(
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
        { userId: "user-1", role: "admin" },
      ),
    ).rejects.toBeInstanceOf(JournalAccountNotPostable);
  });

  // Failure mode declarado: current GREEN runs `both-sides` pre-loop and then
  // the accounts loop with isActive/isDetail. Zero-amount detection lives
  // implicitly in `LineSide.credit(Money.of(0))` during the map — which only
  // runs AFTER the accounts loop. With an input where line {debit:0,credit:0}
  // targets `acc-inactive`, the accounts loop trips first and throws
  // `JournalAccountInactive` before zero is ever surfaced. RED surfaces this
  // as `Expected JournalLineZeroAmount, received JournalAccountInactive`.
  // GREEN adds the zero-amount guard to the pre-aggregate loop alongside
  // both-sides — parity with legacy l237-242 where zero is checked PRE
  // accounts loop.
  it("rejects with zero-amount BEFORE inactive-account when both fail", async () => {
    const { service, accounts, periods, voucherTypes, permissions } = setup();
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
    periods.periodsById.set("period-1", { id: "period-1", status: "OPEN" });
    voucherTypes.voucherTypesById.set("voucher-1", { id: "voucher-1" });
    permissions.allowedKeys.add("admin:journal:org-1");

    await expect(
      service.createAndPost(
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
        { userId: "user-1", role: "admin" },
      ),
    ).rejects.toBeInstanceOf(JournalLineZeroAmount);
  });

  // Failure mode declarado: current accounts loop validates findById/null/
  // isActive/isDetail but does NOT inspect `requiresContact`. With a line
  // targeting `acc-receivables` (`requiresContact: true`) and the input
  // omitting `contactId`, the loop completes (active + detail), the flow
  // proceeds to map + Journal.create + post + uow.run, resolving OK. RED
  // surfaces this as `Expected JournalContactRequiredForAccount, received
  // resolved value`. GREEN adds the requiresContact + missing-contactId check
  // inside the accounts loop after isDetail (parity legacy createEntry).
  it("rejects when requiresContact account line has no contactId (I4)", async () => {
    const { service, accounts, periods, voucherTypes, permissions } = setup();
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
    periods.periodsById.set("period-1", { id: "period-1", status: "OPEN" });
    voucherTypes.voucherTypesById.set("voucher-1", { id: "voucher-1" });
    permissions.allowedKeys.add("admin:journal:org-1");

    await expect(
      service.createAndPost(
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
        { userId: "user-1", role: "admin" },
      ),
    ).rejects.toBeInstanceOf(JournalContactRequiredForAccount);
  });

  // Failure mode declarado: current loop guards `requiresContact &&
  // !line.contactId` but does NOT verify that a provided `contactId` actually
  // resolves to an active contact. With `acc-receivables` (`requiresContact:
  // true`) and `contactId: "contact-inactive"` (NOT primed in
  // activeContactIds), the use case skips contact validation and resolves OK.
  // RED surfaces this as `Expected the rejection thrown by ContactsReadPort,
  // received resolved value`. GREEN inserts `await this.contacts.getActiveById
  // (orgId, line.contactId)` inside the requiresContact branch (parity
  // legacy).
  it("rejects when requiresContact account line has an inactive contactId (I4)", async () => {
    const { service, accounts, contacts, periods, voucherTypes, permissions } =
      setup();
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
    periods.periodsById.set("period-1", { id: "period-1", status: "OPEN" });
    voucherTypes.voucherTypesById.set("voucher-1", { id: "voucher-1" });
    permissions.allowedKeys.add("admin:journal:org-1");
    // contact-inactive intentionally NOT in activeContactIds → port throws.
    const sentinel = new Error("Contact contact-inactive is inactive");
    contacts.inactiveError = sentinel;

    await expect(
      service.createAndPost(
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
        { userId: "user-1", role: "admin" },
      ),
    ).rejects.toBe(sentinel);
  });
});
