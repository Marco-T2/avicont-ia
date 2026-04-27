/**
 * Tests del executor parseAccountingOperationToSuggestion (builder).
 *
 * Cubre validación Zod, lookups de cuentas, requiresContact, contacto resuelto,
 * construcción de lines según template y output shape de CreateJournalEntrySuggestion.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "test-key-for-vitest";
});

import { executeParseAccountingOperation } from "../tools/parse-operation";
import type { AccountsRepository } from "@/features/accounting/accounts.repository";
import type { ContactsService } from "@/features/contacts/server";
import type { Account, Contact, ContactType } from "@/generated/prisma/client";
import { NotFoundError, CONTACT_NOT_FOUND } from "@/features/shared/errors";

// ── Fixtures ──

const ACC_EXPENSE = "clxx00000000000000000001";
const ACC_BANK = "clxx00000000000000000002";
const ACC_CASH = "clxx00000000000000000003";
const CONTACT = "clxx00000000000000000004";

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "acc-1",
    code: "5.1.2",
    name: "Alimento Balanceado",
    type: "GASTO",
    nature: "DEUDORA",
    subtype: "GASTO_OPERATIVO",
    parentId: null,
    level: 3,
    isDetail: true,
    requiresContact: false,
    description: null,
    isActive: true,
    isContraAccount: false,
    organizationId: "org-1",
    ...overrides,
  };
}

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: CONTACT,
    organizationId: "org-1",
    type: "PROVEEDOR" as ContactType,
    name: "Granos del Sur",
    nit: "1234567",
    email: null,
    phone: null,
    address: null,
    paymentTermsDays: 30,
    creditLimit: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeDeps(opts?: {
  accounts?: Account[];
  contact?: Contact | null; // null = throw NotFoundError
}) {
  const accounts = opts?.accounts ?? [];
  const accountsRepo = {
    findManyByIds: vi.fn(async (_orgId: string, ids: string[]) =>
      accounts.filter((a) => ids.includes(a.id)),
    ),
  } as unknown as AccountsRepository;

  const contactsService = {
    getActiveById: vi.fn(async (_orgId: string, _id: string) => {
      if (opts?.contact === null) {
        throw new NotFoundError("Contacto", CONTACT_NOT_FOUND);
      }
      return opts?.contact ?? makeContact();
    }),
  } as unknown as ContactsService;

  return { accountsRepo, contactsService };
}

// Inputs válidos de referencia:

function bankPaymentInput(overrides: Record<string, unknown> = {}) {
  return {
    template: "expense_bank_payment" as const,
    date: "2026-04-26",
    description: "Compra de alimento balanceado",
    amount: 5000,
    originalText: "compra de alimento por 5000 al banco",
    expenseAccountId: ACC_EXPENSE,
    bankAccountId: ACC_BANK,
    ...overrides,
  };
}

function cashPaymentInput(overrides: Record<string, unknown> = {}) {
  return {
    template: "expense_cash_payment" as const,
    date: "2026-04-26",
    description: "Compra de medicamentos",
    amount: 800,
    originalText: "pagué 800 en efectivo",
    expenseAccountId: ACC_EXPENSE,
    cashAccountId: ACC_CASH,
    ...overrides,
  };
}

function bankDepositInput(overrides: Record<string, unknown> = {}) {
  return {
    template: "bank_deposit" as const,
    date: "2026-04-26",
    description: "Depósito al banco",
    amount: 10000,
    originalText: "deposité 10000 al banco",
    bankAccountId: ACC_BANK,
    cashAccountId: ACC_CASH,
    ...overrides,
  };
}

// ── Validación Zod (defensa en profundidad) ──

describe("parseAccountingOperation — validación Zod", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rechaza input con monto negativo", async () => {
    await expect(
      executeParseAccountingOperation("org-1", bankPaymentInput({ amount: -1 }), makeDeps()),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it("rechaza input con expenseAccountId === bankAccountId (cross-field)", async () => {
    await expect(
      executeParseAccountingOperation(
        "org-1",
        bankPaymentInput({ bankAccountId: ACC_EXPENSE }),
        makeDeps(),
      ),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it("rechaza template desconocido", async () => {
    await expect(
      executeParseAccountingOperation(
        "org-1",
        { ...bankPaymentInput(), template: "bogus" },
        makeDeps(),
      ),
    ).rejects.toMatchObject({ statusCode: 422 });
  });
});

// ── Lookup de cuentas ──

describe("parseAccountingOperation — lookup de cuentas", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rechaza si una cuenta no existe en la org", async () => {
    const expense = makeAccount({ id: ACC_EXPENSE, code: "5.1.2" });
    // bank account no está en la lista (no existe)
    const deps = makeDeps({ accounts: [expense] });

    await expect(
      executeParseAccountingOperation("org-1", bankPaymentInput(), deps),
    ).rejects.toMatchObject({
      code: "JOURNAL_AI_ACCOUNT_NOT_FOUND",
      details: { missing: [ACC_BANK] },
    });
  });

  it("rechaza si una cuenta es no-detail con ACCOUNT_NOT_POSTABLE", async () => {
    const expense = makeAccount({ id: ACC_EXPENSE, code: "5.1.2", isDetail: true });
    const bank = makeAccount({ id: ACC_BANK, code: "1.1.3", isDetail: false });
    const deps = makeDeps({ accounts: [expense, bank] });

    await expect(
      executeParseAccountingOperation("org-1", bankPaymentInput(), deps),
    ).rejects.toMatchObject({ code: "ACCOUNT_NOT_POSTABLE" });
  });

  it("rechaza si una cuenta está inactiva con ACCOUNT_NOT_POSTABLE", async () => {
    const expense = makeAccount({ id: ACC_EXPENSE, code: "5.1.2" });
    const bank = makeAccount({ id: ACC_BANK, code: "1.1.3.1", isActive: false });
    const deps = makeDeps({ accounts: [expense, bank] });

    await expect(
      executeParseAccountingOperation("org-1", bankPaymentInput(), deps),
    ).rejects.toMatchObject({ code: "ACCOUNT_NOT_POSTABLE" });
  });
});

// ── Contacto requerido ──

describe("parseAccountingOperation — contacto requerido", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rechaza con CONTACT_REQUIRED_FOR_ACCOUNT cuando expense.requiresContact=true y no hay contactId", async () => {
    const expense = makeAccount({ id: ACC_EXPENSE, code: "5.1.3", requiresContact: true });
    const bank = makeAccount({ id: ACC_BANK, code: "1.1.3.1" });
    const deps = makeDeps({ accounts: [expense, bank] });

    await expect(
      executeParseAccountingOperation("org-1", bankPaymentInput(), deps),
    ).rejects.toMatchObject({ code: "CONTACT_REQUIRED_FOR_ACCOUNT" });
  });

  it("acepta cuando expense.requiresContact=true y se proveyó contactId válido", async () => {
    const expense = makeAccount({ id: ACC_EXPENSE, code: "5.1.3", requiresContact: true });
    const bank = makeAccount({ id: ACC_BANK, code: "1.1.3.1" });
    const deps = makeDeps({ accounts: [expense, bank], contact: makeContact() });

    const result = await executeParseAccountingOperation(
      "org-1",
      bankPaymentInput({ contactId: CONTACT }),
      deps,
    );

    expect(result.data.contactId).toBe(CONTACT);
    expect(result.data.resolvedContact).toEqual({
      id: CONTACT,
      name: "Granos del Sur",
      nit: "1234567",
    });
  });

  it("rechaza con JOURNAL_AI_CONTACT_NOT_FOUND si contactId no existe", async () => {
    const expense = makeAccount({ id: ACC_EXPENSE, code: "5.1.2" });
    const bank = makeAccount({ id: ACC_BANK, code: "1.1.3.1" });
    const deps = makeDeps({ accounts: [expense, bank], contact: null });

    await expect(
      executeParseAccountingOperation(
        "org-1",
        bankPaymentInput({ contactId: CONTACT }),
        deps,
      ),
    ).rejects.toMatchObject({
      code: "JOURNAL_AI_CONTACT_NOT_FOUND",
      details: { contactId: CONTACT },
    });
  });

  it("bank_deposit no necesita contacto aunque cuentas tuvieran requiresContact=true", async () => {
    // Caso defensivo: bank_deposit no admite contactId en el schema, así que el flow
    // simplemente nunca verifica requiresContact (el input no lleva contactId).
    const bank = makeAccount({ id: ACC_BANK, code: "1.1.3.1", requiresContact: true });
    const cash = makeAccount({ id: ACC_CASH, code: "1.1.1.1" });
    const deps = makeDeps({ accounts: [bank, cash] });

    const result = await executeParseAccountingOperation("org-1", bankDepositInput(), deps);

    expect(result.data.template).toBe("bank_deposit");
    expect(result.data.contactId).toBeUndefined();
  });
});

// ── Construcción del asiento ──

describe("parseAccountingOperation — construcción de líneas", () => {
  beforeEach(() => vi.clearAllMocks());

  it("expense_bank_payment: débito en gasto, haber en banco", async () => {
    const expense = makeAccount({ id: ACC_EXPENSE, code: "5.1.2" });
    const bank = makeAccount({ id: ACC_BANK, code: "1.1.3.1" });
    const deps = makeDeps({ accounts: [expense, bank] });

    const result = await executeParseAccountingOperation("org-1", bankPaymentInput(), deps);

    expect(result.data.lines).toEqual([
      { accountId: ACC_EXPENSE, debit: 5000, credit: 0 },
      { accountId: ACC_BANK, debit: 0, credit: 5000 },
    ]);
    expect(result.data.voucherTypeCode).toBe("CE");
  });

  it("expense_cash_payment: débito en gasto, haber en caja", async () => {
    const expense = makeAccount({ id: ACC_EXPENSE, code: "5.1.3" });
    const cash = makeAccount({ id: ACC_CASH, code: "1.1.1.1" });
    const deps = makeDeps({ accounts: [expense, cash] });

    const result = await executeParseAccountingOperation("org-1", cashPaymentInput(), deps);

    expect(result.data.lines).toEqual([
      { accountId: ACC_EXPENSE, debit: 800, credit: 0 },
      { accountId: ACC_CASH, debit: 0, credit: 800 },
    ]);
    expect(result.data.voucherTypeCode).toBe("CE");
  });

  it("bank_deposit: débito en banco, haber en caja", async () => {
    const bank = makeAccount({ id: ACC_BANK, code: "1.1.3.1" });
    const cash = makeAccount({ id: ACC_CASH, code: "1.1.1.1" });
    const deps = makeDeps({ accounts: [bank, cash] });

    const result = await executeParseAccountingOperation("org-1", bankDepositInput(), deps);

    expect(result.data.lines).toEqual([
      { accountId: ACC_BANK, debit: 10000, credit: 0 },
      { accountId: ACC_CASH, debit: 0, credit: 10000 },
    ]);
    expect(result.data.voucherTypeCode).toBe("CI");
  });
});

// ── Output shape ──

describe("parseAccountingOperation — shape del CreateJournalEntrySuggestion", () => {
  beforeEach(() => vi.clearAllMocks());

  it("incluye action='createJournalEntry' + originalText + resolvedAccounts mapeo plano", async () => {
    const expense = makeAccount({
      id: ACC_EXPENSE,
      code: "5.1.2",
      name: "Alimento Balanceado",
      requiresContact: false,
    });
    const bank = makeAccount({
      id: ACC_BANK,
      code: "1.1.3.1",
      name: "Banco BCP",
      requiresContact: false,
    });
    const deps = makeDeps({ accounts: [expense, bank] });

    const result = await executeParseAccountingOperation("org-1", bankPaymentInput(), deps);

    expect(result.action).toBe("createJournalEntry");
    expect(result.data.originalText).toBe("compra de alimento por 5000 al banco");
    expect(result.data.resolvedAccounts).toEqual({
      [ACC_EXPENSE]: { code: "5.1.2", name: "Alimento Balanceado", requiresContact: false },
      [ACC_BANK]: { code: "1.1.3.1", name: "Banco BCP", requiresContact: false },
    });
  });
});
