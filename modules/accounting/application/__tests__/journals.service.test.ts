import { describe, expect, it } from "vitest";
import {
  ForbiddenError,
  NotFoundError,
  POST_NOT_ALLOWED_FOR_ROLE,
} from "@/features/shared/errors";
import {
  CannotModifyVoidedJournal,
  InvalidJournalStatusTransition,
  JournalAccountInactive,
  JournalAccountNotPostable,
  JournalAutoEntryVoidForbidden,
  JournalContactRequiredForAccount,
  JournalFiscalPeriodClosed,
  JournalLineBothSides,
  JournalLineZeroAmount,
  JournalNotBalanced,
} from "../../domain/errors/journal-errors";
import {
  AUTO_ENTRY_VOID_FORBIDDEN,
  LOCKED_EDIT_REQUIRES_JUSTIFICATION,
} from "@/features/shared/errors";
import { Journal } from "../../domain/journal.entity";
import { LineSide } from "../../domain/value-objects/line-side";
import { Money } from "@/modules/shared/domain/value-objects/money";
import { JournalsService } from "../journals.service";
import {
  InMemoryAccountingUnitOfWork,
  InMemoryAccountsReadPort,
  InMemoryContactsReadPort,
  InMemoryFiscalPeriodsReadPort,
  InMemoryJournalEntriesReadPort,
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
    const journalEntriesRead = new InMemoryJournalEntriesReadPort();
    const service = new JournalsService(
      uow,
      accounts,
      contacts,
      periods,
      voucherTypes,
      permissions,
      journalEntriesRead,
    );
    return {
      service,
      uow,
      accounts,
      contacts,
      periods,
      voucherTypes,
      permissions,
      journalEntriesRead,
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
    const journalEntriesRead = new InMemoryJournalEntriesReadPort();
    const service = new JournalsService(
      uow,
      accounts,
      contacts,
      periods,
      voucherTypes,
      permissions,
      journalEntriesRead,
    );
    return {
      service,
      uow,
      accounts,
      contacts,
      periods,
      voucherTypes,
      permissions,
      journalEntriesRead,
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

describe("JournalsService.transitionStatus", () => {
  function setup() {
    const uow = new InMemoryAccountingUnitOfWork();
    const accounts = new InMemoryAccountsReadPort();
    const contacts = new InMemoryContactsReadPort();
    const periods = new InMemoryFiscalPeriodsReadPort();
    const voucherTypes = new InMemoryVoucherTypesReadPort();
    const permissions = new InMemoryPermissionsPort();
    const journalEntriesRead = new InMemoryJournalEntriesReadPort();
    const service = new JournalsService(
      uow,
      accounts,
      contacts,
      periods,
      voucherTypes,
      permissions,
      journalEntriesRead,
    );
    return {
      service,
      uow,
      accounts,
      contacts,
      periods,
      voucherTypes,
      permissions,
      journalEntriesRead,
    };
  }

  // Helper — builds a balanced DRAFT Journal aggregate suitable for priming
  // the read port. Lives inside this describe (not promoted) to keep the test
  // file self-contained; promotes only if a third describe needs it.
  function makeDraft(overrides: Partial<{
    organizationId: string;
    periodId: string;
    voucherTypeId: string;
  }> = {}): Journal {
    return Journal.create({
      organizationId: overrides.organizationId ?? "org-1",
      date: new Date("2026-04-28"),
      description: "Existing entry",
      periodId: overrides.periodId ?? "period-1",
      voucherTypeId: overrides.voucherTypeId ?? "voucher-1",
      createdById: "user-creator",
      lines: [
        { accountId: "acc-1", side: LineSide.debit(Money.of(100)) },
        { accountId: "acc-2", side: LineSide.credit(Money.of(100)) },
      ],
    });
  }

  // Failure mode declarado: the stub throws Error("JournalsService.
  // transitionStatus not implemented") before any read/write happens. RED
  // surfaces this as `Expected resolution { journal, correlationId },
  // received throw 'not implemented'`. GREEN implements Plan B (aggregate-
  // driven, parity pre-tx): journalEntriesRead.findById → current.post()
  // (delegates I1/I5/I7 to aggregate via assertBalanced + canTransition) →
  // uow.run(scope.journalEntries.updateStatus(transitioned, ctx.userId) +
  // scope.accountBalances.applyPost(persisted)) → return { journal: result,
  // correlationId }. NotFound, AUTO_ENTRY_VOID, period CLOSED, I8 and
  // LOCKED/VOIDED branches all defer to their respective ciclos.
  it("happy DRAFT → POSTED: persists POSTED + applyPost called + correlationId emitted", async () => {
    const { service, uow, periods, journalEntriesRead } = setup();
    const draft = makeDraft();
    journalEntriesRead.entriesById.set(draft.id, draft);
    periods.periodsById.set("period-1", { id: "period-1", status: "OPEN" });

    const { journal, correlationId } = await service.transitionStatus(
      "org-1",
      draft.id,
      "POSTED",
      { userId: "user-1", role: "admin" },
    );

    expect(journal.status).toBe("POSTED");
    expect(journal.id).toBe(draft.id);
    expect(uow.runCount).toBe(1);
    expect(uow.journalEntries.updateStatusCalls).toHaveLength(1);
    expect(uow.journalEntries.updateStatusCalls[0].userId).toBe("user-1");
    expect(uow.journalEntries.updateStatusCalls[0].journal.status).toBe(
      "POSTED",
    );
    expect(uow.accountBalances.applyPostCalls).toHaveLength(1);
    expect(uow.accountBalances.applyPostCalls[0].id).toBe(draft.id);
    expect(typeof correlationId).toBe("string");
    expect(correlationId.length).toBeGreaterThan(0);
  });

  // Failure mode declarado: current GREEN reads `current = await
  // journalEntriesRead.findById(...)` but does NOT null-check. With an
  // unprimed entryId, `current` is null and `current!.post()` throws
  // `TypeError: Cannot read properties of null (reading 'post')`. RED
  // surfaces this as `Expected NotFoundError, received TypeError`. GREEN
  // inserts `if (!current) throw new NotFoundError("Asiento contable")`
  // immediately after findById, BEFORE any uow.run (parity legacy
  // `journal.service.ts:558`). The pre-tx assertion `runCount === 0`
  // guarantees the UoW is NOT opened — this is the "Plan B parity pre-tx"
  // contract: no Postgres tx, no audit ctx for an entry that does not exist.
  it("rejects with NotFoundError pre-tx when entry does not exist", async () => {
    const { service, uow } = setup();
    // entriesById intentionally NOT primed → findById returns null.

    await expect(
      service.transitionStatus("org-1", "entry-missing", "POSTED", {
        userId: "user-1",
        role: "admin",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(uow.runCount).toBe(0);
  });

  // Failure mode declarado: current GREEN does NOT inspect `current.sourceType`
  // and does NOT branch on `target` — it hardcodes `current.post()`. With a
  // primed POSTED auto-entry (sourceType='sale') and target='VOIDED', the use
  // case calls `current.post()`, which delegates to `Journal.transitionTo
  // ('POSTED')`. The aggregate sees POSTED→POSTED and throws
  // `InvalidJournalStatusTransition`. RED surfaces this as `Expected
  // JournalAutoEntryVoidForbidden, received InvalidJournalStatusTransition`.
  // GREEN inserts the auto-void guard pre-tx (parity legacy l563-568): if
  // target='VOIDED' && current.sourceType !== null throw new
  // JournalAutoEntryVoidForbidden(). The guard runs BEFORE any aggregate
  // transition because it depends on target+sourceType from the use-case
  // context. uow.runCount remains 0 — pre-tx contract.
  //
  // I9 in the aggregate (`assertMutable`) does NOT fire here because
  // `transitionTo` does NOT call `assertMutable` — auto-entries can transition
  // freely via post/lock/void at the aggregate level. The auto-void guard
  // lives ONLY in the use case (parity legacy: a use-case-only invariant).
  it("rejects with JournalAutoEntryVoidForbidden when auto-entry target is VOIDED", async () => {
    const { service, uow, journalEntriesRead } = setup();
    const auto = Journal.create({
      organizationId: "org-1",
      date: new Date("2026-04-28"),
      description: "Auto entry",
      periodId: "period-1",
      voucherTypeId: "voucher-1",
      createdById: "user-creator",
      sourceType: "sale",
      sourceId: "sale-001",
      lines: [
        { accountId: "acc-1", side: LineSide.debit(Money.of(100)) },
        { accountId: "acc-2", side: LineSide.credit(Money.of(100)) },
      ],
    }).post();
    journalEntriesRead.entriesById.set(auto.id, auto);

    const err = await service
      .transitionStatus("org-1", auto.id, "VOIDED", {
        userId: "user-1",
        role: "admin",
      })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(JournalAutoEntryVoidForbidden);
    expect((err as { code?: string }).code).toBe(AUTO_ENTRY_VOID_FORBIDDEN);
    expect(uow.runCount).toBe(0);
  });

  // Failure mode declarado: REGRESSION HARNESS, not RED→GREEN. The aggregate
  // `Journal.transitionTo` already rejects every transition out of VOIDED via
  // `CannotModifyVoidedJournal` (`journal.entity.ts:289-291`). The current
  // GREEN of `transitionStatus` invokes `current.post()` for target=POSTED,
  // which delegates to `transitionTo("POSTED")` and throws
  // CannotModifyVoidedJournal without any extra delta in the use case. This
  // test passes de una, BUT catches a regression if a future refactor bypasses
  // the aggregate (e.g., implements a manual transition path). Marco's
  // directive: "ciclos 4, 5, 7 son regression harness — si tenés que agregar
  // lógica en GREEN, algo está mal". Cost is one O(1) test — value is
  // explicit aggregate↔use case integration coverage.
  it("rejects with CannotModifyVoidedJournal when current is VOIDED (I7, regression)", async () => {
    const { service, uow, periods, journalEntriesRead } = setup();
    const voided = makeDraft().post().void();
    journalEntriesRead.entriesById.set(voided.id, voided);
    periods.periodsById.set("period-1", { id: "period-1", status: "OPEN" });

    await expect(
      service.transitionStatus("org-1", voided.id, "POSTED", {
        userId: "user-1",
        role: "admin",
      }),
    ).rejects.toBeInstanceOf(CannotModifyVoidedJournal);

    expect(uow.runCount).toBe(0);
  });

  // Failure mode declarado: REGRESSION HARNESS. The aggregate
  // `Journal.transitionTo("LOCKED")` rejects DRAFT → LOCKED via
  // `canTransition` (returns false because `VALID_TRANSITIONS[DRAFT] =
  // ["POSTED"]`) → throws `InvalidJournalStatusTransition('DRAFT', 'LOCKED')`
  // (`journal.entity.ts:292-294`). Current GREEN calls `current.lock()` for
  // target=LOCKED, which delegates to the aggregate. Test passes without
  // GREEN delta. uow.runCount === 0 — pre-tx contract preserved because the
  // aggregate throws before `uow.run` is called. Marco's directive: "regression
  // harness — si tenés que agregar lógica en GREEN, algo está mal".
  it("rejects with InvalidJournalStatusTransition when DRAFT → LOCKED (I5, regression)", async () => {
    const { service, uow, journalEntriesRead } = setup();
    const draft = makeDraft();
    journalEntriesRead.entriesById.set(draft.id, draft);

    await expect(
      service.transitionStatus("org-1", draft.id, "LOCKED", {
        userId: "user-1",
        role: "admin",
      }),
    ).rejects.toBeInstanceOf(InvalidJournalStatusTransition);

    expect(uow.runCount).toBe(0);
  });

  // Failure mode declarado: current GREEN does NOT call `periods.getById` and
  // does NOT inspect period status. With a DRAFT entry whose periodId points
  // to a CLOSED period and target=POSTED, the use case proceeds to
  // `current.post()` (which only validates I1/I5/I7 in the aggregate; period
  // status is collaboration-required, not aggregate-intrinsic), then enters
  // `uow.run` and calls `updateStatus + applyPost`. RED surfaces this as
  // `Expected JournalFiscalPeriodClosed, received resolved value`. GREEN
  // inserts the period read + status guard for target=POSTED pre-tx (parity
  // legacy l597-604): if target='POSTED' { const period = await
  // this.periods.getById(orgId, current.periodId); if (period.status !==
  // 'OPEN') throw new JournalFiscalPeriodClosed(); }. The guard runs after
  // the auto-void check and BEFORE `current.post()` so the period is
  // validated before the aggregate transitions; uow.runCount stays at 0 in
  // the failure path — pre-tx contract preserved.
  it("rejects with JournalFiscalPeriodClosed when target POSTED and period CLOSED (I6)", async () => {
    const { service, uow, periods, journalEntriesRead } = setup();
    const draft = makeDraft({ periodId: "period-closed" });
    journalEntriesRead.entriesById.set(draft.id, draft);
    periods.periodsById.set("period-closed", {
      id: "period-closed",
      status: "CLOSED",
    });

    await expect(
      service.transitionStatus("org-1", draft.id, "POSTED", {
        userId: "user-1",
        role: "admin",
      }),
    ).rejects.toBeInstanceOf(JournalFiscalPeriodClosed);

    expect(uow.runCount).toBe(0);
  });

  // Failure mode declarado: REGRESSION HARNESS. The aggregate
  // `Journal.transitionTo("POSTED")` calls `assertBalanced` (`journal.entity
  // .ts:298-320`) which throws `JournalNotBalanced` when sum(debits) !==
  // sum(credits) using `Money.equals` bit-perfect (divergence vs legacy
  // `Math.round(*100)`, declared in C2-B). Current GREEN flow for
  // target=POSTED: period read OPEN → current.post() → aggregate throws
  // BEFORE uow.run is called. Test passes without GREEN delta in the use
  // case. uow.runCount === 0 — pre-tx contract preserved. Marco's directive
  // for ciclos 4, 5, 7: "regression harness, sin código nuevo en GREEN".
  it("rejects with JournalNotBalanced when DRAFT desbalanceado → POSTED (I1, regression)", async () => {
    const { service, uow, periods, journalEntriesRead } = setup();
    const draft = Journal.create({
      organizationId: "org-1",
      date: new Date("2026-04-28"),
      description: "Unbalanced",
      periodId: "period-1",
      voucherTypeId: "voucher-1",
      createdById: "user-creator",
      lines: [
        { accountId: "acc-1", side: LineSide.debit(Money.of(100)) },
        { accountId: "acc-2", side: LineSide.credit(Money.of(50)) },
      ],
    });
    journalEntriesRead.entriesById.set(draft.id, draft);
    periods.periodsById.set("period-1", { id: "period-1", status: "OPEN" });

    await expect(
      service.transitionStatus("org-1", draft.id, "POSTED", {
        userId: "user-1",
        role: "admin",
      }),
    ).rejects.toBeInstanceOf(JournalNotBalanced);

    expect(uow.runCount).toBe(0);
  });

  // Failure mode declarado: current GREEN inside `uow.run` always calls
  // `scope.accountBalances.applyPost(persisted)` — does NOT branch on
  // `target`. With a primed POSTED manual entry (sourceType=null) and
  // target=VOIDED, the use case skips the auto-void guard (sourceType=null),
  // skips the period guard (target=VOIDED, period read gated to POSTED),
  // calls `current.void()` (POSTED→VOIDED is in canTransition), enters
  // `uow.run` and calls `scope.accountBalances.applyPost(persisted)` instead
  // of `applyVoid`. RED surfaces this as `Expected applyVoidCalls.length === 1
  // && applyPostCalls.length === 0, received applyVoidCalls.length === 0 &&
  // applyPostCalls.length === 1`. GREEN branches on target inside `uow.run`:
  // if target=POSTED applyPost, else if target=VOIDED applyVoid, else (LOCKED)
  // no balance side-effect. uow.runCount === 1 (happy path), period.getById
  // NOT called for target=VOIDED (no period read primed in setup → would
  // throw if called).
  it("happy POSTED → VOIDED (manual): applyVoid called, applyPost NOT, no period read", async () => {
    const { service, uow, journalEntriesRead } = setup();
    // periods intentionally NOT primed → fake throws on getById, so any
    // call would surface as `Fiscal period period-1 not found`. The test
    // assertion proves the use case did NOT read the period for VOIDED.
    const posted = makeDraft().post();
    journalEntriesRead.entriesById.set(posted.id, posted);

    const { journal, correlationId } = await service.transitionStatus(
      "org-1",
      posted.id,
      "VOIDED",
      { userId: "user-1", role: "admin" },
    );

    expect(journal.status).toBe("VOIDED");
    expect(uow.runCount).toBe(1);
    expect(uow.journalEntries.updateStatusCalls).toHaveLength(1);
    expect(uow.journalEntries.updateStatusCalls[0].journal.status).toBe(
      "VOIDED",
    );
    expect(uow.accountBalances.applyVoidCalls).toHaveLength(1);
    expect(uow.accountBalances.applyVoidCalls[0].id).toBe(posted.id);
    expect(uow.accountBalances.applyPostCalls).toHaveLength(0);
    expect(typeof correlationId).toBe("string");
    expect(correlationId.length).toBeGreaterThan(0);
  });

  // Failure mode declarado: current GREEN already handles LOCKED implicitly —
  // the auto-void guard skips (target !== VOIDED), the period read is gated
  // to target=POSTED (skip), the ternary picks `current.lock()` (POSTED→LOCKED
  // is in canTransition), `uow.run` calls `updateStatus` + the if/else branches
  // pick NEITHER applyPost nor applyVoid for LOCKED (no balance side-effect).
  // Test passes de una WITHOUT GREEN delta. Value: pins the LOCKED contract
  // explicitly — no balance side-effect, no period read, no RBAC required for
  // POSTED→LOCKED (parity legacy: RBAC only fires for LOCKED→VOIDED via
  // validateLockedEdit, ciclos 10-11). Catches regression if a future change
  // adds RBAC or balance side-effect to POSTED→LOCKED by accident.
  it("happy POSTED → LOCKED: persists LOCKED + no balance side-effect + no period read", async () => {
    const { service, uow, journalEntriesRead } = setup();
    // periods intentionally NOT primed — any period read would throw.
    const posted = makeDraft().post();
    journalEntriesRead.entriesById.set(posted.id, posted);

    const { journal, correlationId } = await service.transitionStatus(
      "org-1",
      posted.id,
      "LOCKED",
      { userId: "user-1", role: "member" },
    );

    expect(journal.status).toBe("LOCKED");
    expect(uow.runCount).toBe(1);
    expect(uow.journalEntries.updateStatusCalls).toHaveLength(1);
    expect(uow.journalEntries.updateStatusCalls[0].journal.status).toBe(
      "LOCKED",
    );
    expect(uow.accountBalances.applyPostCalls).toHaveLength(0);
    expect(uow.accountBalances.applyVoidCalls).toHaveLength(0);
    expect(typeof correlationId).toBe("string");
    expect(correlationId.length).toBeGreaterThan(0);
  });

  // Failure mode declarado: current GREEN does NOT invoke `validateLockedEdit`
  // anywhere. With a primed LOCKED entry (sourceType=null), target=VOIDED,
  // role=admin, justification omitted, the use case skips the auto-void guard
  // (sourceType=null), skips the period guard (target=VOIDED, period read
  // gated to POSTED), calls `current.void()` (LOCKED→VOIDED is in
  // canTransition), enters `uow.run`, applyVoid is called, resolves OK. RED
  // surfaces this as `Expected ValidationError code
  // LOCKED_EDIT_REQUIRES_JUSTIFICATION, received resolved value`. GREEN
  // inserts the I8 guard pre-tx for `current.status === 'LOCKED' && target
  // === 'VOIDED'` (parity legacy `journal.service.ts:586-594`): read the
  // period and call `validateLockedEdit(current.status, ctx.role,
  // period.status, ctx.justification)` which throws ValidationError code
  // LOCKED_EDIT_REQUIRES_JUSTIFICATION when justification is missing or
  // shorter than the period-conditional minimum (10 chars OPEN / 50 chars
  // CLOSED). uow.runCount === 0 — pre-tx contract preserved.
  it("rejects with LOCKED_EDIT_REQUIRES_JUSTIFICATION when LOCKED → VOIDED missing justification (I8)", async () => {
    const { service, uow, periods, journalEntriesRead } = setup();
    const locked = makeDraft().post().lock();
    journalEntriesRead.entriesById.set(locked.id, locked);
    periods.periodsById.set("period-1", { id: "period-1", status: "OPEN" });

    const err = await service
      .transitionStatus("org-1", locked.id, "VOIDED", {
        userId: "user-1",
        role: "admin",
        // justification intentionally omitted → LOCKED edit guard fires.
      })
      .catch((e: unknown) => e);

    expect((err as { code?: string }).code).toBe(
      LOCKED_EDIT_REQUIRES_JUSTIFICATION,
    );
    expect(uow.runCount).toBe(0);
  });

  // Failure mode declarado: REGRESSION-LIKE / EXPLICIT COVERAGE — current
  // GREEN already calls validateLockedEdit (added in ciclo 10), and the helper
  // checks role BEFORE justification (`document-lifecycle.service.ts:104-106`).
  // With role='member' (not owner/admin) the helper throws ForbiddenError
  // without code (parity legacy — second occurrence of "errores legacy sin
  // code", contador 3/3). Test passes de una WITHOUT GREEN delta. Cost: pins
  // the role-denial path explicitly so a future change to validateLockedEdit
  // semantics surfaces here. uow.runCount === 0 — pre-tx contract preserved.
  it("rejects with ForbiddenError when LOCKED → VOIDED with denied role (I8)", async () => {
    const { service, uow, periods, journalEntriesRead } = setup();
    const locked = makeDraft().post().lock();
    journalEntriesRead.entriesById.set(locked.id, locked);
    periods.periodsById.set("period-1", { id: "period-1", status: "OPEN" });

    await expect(
      service.transitionStatus("org-1", locked.id, "VOIDED", {
        userId: "user-1",
        role: "member",
        justification:
          "razón válida con suficiente longitud para período abierto",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(uow.runCount).toBe(0);
  });

  // Failure mode declarado: current GREEN handles LOCKED → VOIDED happy path
  // implicitly. With LOCKED entry, role=admin, justification ≥ 10 chars and
  // period OPEN, validateLockedEdit succeeds (role OK, justification length
  // OK for OPEN period). Then `current.void()` (LOCKED→VOIDED is in
  // canTransition), `uow.run` calls `updateStatus` + `applyVoid` (target=
  // VOIDED branch), resolves with { journal: VOIDED, correlationId }. Test
  // passes de una WITHOUT GREEN delta. Pins the LOCKED → VOIDED admin happy
  // path: applyVoid invoked, applyPost NOT, period read once for the I8
  // guard.
  it("happy LOCKED → VOIDED (admin + justification + period OPEN): applyVoid called", async () => {
    const { service, uow, periods, journalEntriesRead } = setup();
    const locked = makeDraft().post().lock();
    journalEntriesRead.entriesById.set(locked.id, locked);
    periods.periodsById.set("period-1", { id: "period-1", status: "OPEN" });

    const { journal, correlationId } = await service.transitionStatus(
      "org-1",
      locked.id,
      "VOIDED",
      {
        userId: "user-1",
        role: "admin",
        justification:
          "Justificación con longitud suficiente para período OPEN",
      },
    );

    expect(journal.status).toBe("VOIDED");
    expect(uow.runCount).toBe(1);
    expect(uow.journalEntries.updateStatusCalls).toHaveLength(1);
    expect(uow.journalEntries.updateStatusCalls[0].journal.status).toBe(
      "VOIDED",
    );
    expect(uow.accountBalances.applyVoidCalls).toHaveLength(1);
    expect(uow.accountBalances.applyVoidCalls[0].id).toBe(locked.id);
    expect(uow.accountBalances.applyPostCalls).toHaveLength(0);
    expect(typeof correlationId).toBe("string");
    expect(correlationId.length).toBeGreaterThan(0);
  });
});
