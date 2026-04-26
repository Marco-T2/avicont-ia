/**
 * Tests del schema journalEntryAiInputSchema.
 *
 * El schema es el contrato Zod que el LLM debe respetar al llamar a la tool
 * parseAccountingOperationToSuggestion. Los lookups de DB (existencia, isDetail,
 * requiresContact, contactos) NO viven en el schema — corren en el builder y en
 * journal.service como defensa en profundidad.
 */

import { describe, it, expect } from "vitest";
import {
  journalEntryAiInputSchema,
  JOURNAL_ENTRY_AI_TEMPLATES,
  type JournalEntryAiInput,
} from "../agent.validation";

// ── Fixtures: cuids válidos para reusar ──

const ACC_EXPENSE = "clxx00000000000000000001";
const ACC_BANK = "clxx00000000000000000002";
const ACC_CASH = "clxx00000000000000000003";
const CONTACT = "clxx00000000000000000004";

function validBankPayment(overrides: Partial<JournalEntryAiInput> = {}) {
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

function validCashPayment(overrides: Partial<JournalEntryAiInput> = {}) {
  return {
    template: "expense_cash_payment" as const,
    date: "2026-04-26",
    description: "Compra de medicamentos",
    amount: 800,
    originalText: "pagué 800 en efectivo de medicamentos",
    expenseAccountId: ACC_EXPENSE,
    cashAccountId: ACC_CASH,
    ...overrides,
  };
}

function validBankDeposit(overrides: Partial<JournalEntryAiInput> = {}) {
  return {
    template: "bank_deposit" as const,
    date: "2026-04-26",
    description: "Depósito al banco BCP",
    amount: 10000,
    originalText: "deposité 10000 de caja al banco",
    bankAccountId: ACC_BANK,
    cashAccountId: ACC_CASH,
    ...overrides,
  };
}

// ── Constantes de templates ──

describe("JOURNAL_ENTRY_AI_TEMPLATES", () => {
  it("expone exactamente las tres plantillas v1", () => {
    expect(JOURNAL_ENTRY_AI_TEMPLATES).toEqual([
      "expense_bank_payment",
      "expense_cash_payment",
      "bank_deposit",
    ]);
  });
});

// ── Happy paths ──

describe("journalEntryAiInputSchema — happy paths", () => {
  it("acepta expense_bank_payment válido sin contacto", () => {
    const result = journalEntryAiInputSchema.safeParse(validBankPayment());
    expect(result.success).toBe(true);
  });

  it("acepta expense_bank_payment válido con contacto", () => {
    const result = journalEntryAiInputSchema.safeParse(
      validBankPayment({ contactId: CONTACT }),
    );
    expect(result.success).toBe(true);
  });

  it("acepta expense_cash_payment válido", () => {
    const result = journalEntryAiInputSchema.safeParse(validCashPayment());
    expect(result.success).toBe(true);
  });

  it("acepta bank_deposit válido", () => {
    const result = journalEntryAiInputSchema.safeParse(validBankDeposit());
    expect(result.success).toBe(true);
  });

  it("acepta date ISO completa con timezone", () => {
    const result = journalEntryAiInputSchema.safeParse(
      validBankPayment({ date: "2026-04-26T15:30:00.000Z" }),
    );
    expect(result.success).toBe(true);
  });
});

// ── Discriminator y campos extras ──

describe("journalEntryAiInputSchema — discriminator", () => {
  it("rechaza template desconocido", () => {
    const result = journalEntryAiInputSchema.safeParse({
      ...validBankPayment(),
      template: "unknown_template",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza bank_deposit con contactId (campo no permitido — strict)", () => {
    const result = journalEntryAiInputSchema.safeParse({
      ...validBankDeposit(),
      contactId: CONTACT,
    });
    expect(result.success).toBe(false);
  });

  it("rechaza expense_bank_payment con cashAccountId (campo no permitido — strict)", () => {
    const result = journalEntryAiInputSchema.safeParse({
      ...validBankPayment(),
      cashAccountId: ACC_CASH,
    });
    expect(result.success).toBe(false);
  });
});

// ── Refinamientos cross-field ──

describe("journalEntryAiInputSchema — refinamientos cross-field", () => {
  it("rechaza expense_bank_payment con expenseAccountId === bankAccountId", () => {
    const result = journalEntryAiInputSchema.safeParse(
      validBankPayment({ bankAccountId: ACC_EXPENSE }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join(" | ");
      expect(msg).toContain("no puede ser igual");
    }
  });

  it("rechaza expense_cash_payment con expenseAccountId === cashAccountId", () => {
    const result = journalEntryAiInputSchema.safeParse(
      validCashPayment({ cashAccountId: ACC_EXPENSE }),
    );
    expect(result.success).toBe(false);
  });

  it("rechaza bank_deposit con bankAccountId === cashAccountId", () => {
    const result = journalEntryAiInputSchema.safeParse(
      validBankDeposit({ cashAccountId: ACC_BANK }),
    );
    expect(result.success).toBe(false);
  });
});

// ── Validación de campos individuales ──

describe("journalEntryAiInputSchema — campos individuales", () => {
  it("rechaza monto cero", () => {
    const result = journalEntryAiInputSchema.safeParse(validBankPayment({ amount: 0 }));
    expect(result.success).toBe(false);
  });

  it("rechaza monto negativo", () => {
    const result = journalEntryAiInputSchema.safeParse(validBankPayment({ amount: -100 }));
    expect(result.success).toBe(false);
  });

  it("rechaza monto que excede el máximo", () => {
    const result = journalEntryAiInputSchema.safeParse(
      validBankPayment({ amount: 10_000_000_000 }),
    );
    expect(result.success).toBe(false);
  });

  it("rechaza description vacía o demasiado corta", () => {
    expect(journalEntryAiInputSchema.safeParse(validBankPayment({ description: "" })).success).toBe(false);
    expect(journalEntryAiInputSchema.safeParse(validBankPayment({ description: "ab" })).success).toBe(false);
  });

  it("rechaza description que excede 500 caracteres", () => {
    const result = journalEntryAiInputSchema.safeParse(
      validBankPayment({ description: "a".repeat(501) }),
    );
    expect(result.success).toBe(false);
  });

  it("rechaza originalText vacío", () => {
    const result = journalEntryAiInputSchema.safeParse(validBankPayment({ originalText: "" }));
    expect(result.success).toBe(false);
  });

  it("rechaza originalText que excede 2000 caracteres", () => {
    const result = journalEntryAiInputSchema.safeParse(
      validBankPayment({ originalText: "a".repeat(2001) }),
    );
    expect(result.success).toBe(false);
  });

  it("rechaza date inválida", () => {
    const result = journalEntryAiInputSchema.safeParse(validBankPayment({ date: "no-es-fecha" }));
    expect(result.success).toBe(false);
  });

  it("rechaza date vacía", () => {
    const result = journalEntryAiInputSchema.safeParse(validBankPayment({ date: "" }));
    expect(result.success).toBe(false);
  });

  it("rechaza expenseAccountId no-cuid", () => {
    const result = journalEntryAiInputSchema.safeParse(
      validBankPayment({ expenseAccountId: "not-a-cuid" }),
    );
    expect(result.success).toBe(false);
  });

  it("rechaza contactId no-cuid (cuando viene presente)", () => {
    const result = journalEntryAiInputSchema.safeParse(
      validBankPayment({ contactId: "not-a-cuid" }),
    );
    expect(result.success).toBe(false);
  });
});

// ── Inferencia de tipos (runtime check del discriminator) ──

describe("journalEntryAiInputSchema — type narrowing", () => {
  it("preserva el discriminator template en el output parseado", () => {
    const result = journalEntryAiInputSchema.safeParse(validCashPayment());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.template).toBe("expense_cash_payment");
      // type narrowing: cashAccountId solo existe en este branch
      if (result.data.template === "expense_cash_payment") {
        expect(result.data.cashAccountId).toBe(ACC_CASH);
      }
    }
  });
});
