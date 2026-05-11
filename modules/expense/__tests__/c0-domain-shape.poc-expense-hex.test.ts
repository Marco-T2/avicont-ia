import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const EXPENSE_ROOT = resolve(__dirname, "..");

function readExpenseFile(rel: string): string {
  return readFileSync(resolve(EXPENSE_ROOT, rel), "utf-8");
}

describe("C0 domain shape — Expense module (existence-only regex)", () => {
  // α1 — paired sister Lot α12 EXACT mirror
  it("Expense entity is exported from domain/expense.entity.ts", () => {
    const src = readExpenseFile("domain/expense.entity.ts");
    expect(src).toMatch(/^export class Expense\b/m);
  });

  // α2 — paired sister Lot α13 LOT_STATUSES EXACT mirror REDUCED (no parseExpenseCategory + no canTransition — no state transition semantics)
  // Hotfix evidence-supersedes-assumption-lock 54ma: D2 Opt B re-export Prisma enum SUPERSEDED por R5 absoluta domain ZERO Prisma imports (verificado textual modules/{lot,mortality,farm}/domain/ ZERO hits)
  it("EXPENSE_CATEGORIES const + ExpenseCategory type are exported from domain/value-objects/expense-category.ts (paired sister Lot LOT_STATUSES const array + type pattern EXACT mirror — R5 absoluta domain ZERO Prisma imports)", () => {
    const src = readExpenseFile("domain/value-objects/expense-category.ts");
    expect(src).toMatch(/^export const EXPENSE_CATEGORIES\b/m);
    expect(src).toMatch(/^export type ExpenseCategory\b/m);
  });

  // α3 — paired sister Lot α15 EXACT mirror
  it("ExpensesRepository type is exported from domain/expense.repository.ts (write-tx port R7 paired sister cementado)", () => {
    const src = readExpenseFile("domain/expense.repository.ts");
    expect(src).toMatch(/^export (interface|type) ExpensesRepository\b/m);
  });

  // α4 — paired sister Lot α16 EXACT mirror (D3 Opt A R7 read-non-tx separation)
  it("ExpensesInquiryPort + ExpenseSnapshot types are exported from domain/ports/expense-inquiry.port.ts (read-non-tx port R7 paired sister cementado)", () => {
    const src = readExpenseFile("domain/ports/expense-inquiry.port.ts");
    expect(src).toMatch(/^export (interface|type) ExpensesInquiryPort\b/m);
    expect(src).toMatch(/^export (interface|type) ExpenseSnapshot\b/m);
  });

  // α5 — paired sister Lot α17 REDUCED (2 errors, no transition errors — Expense doesn't transition states)
  it("ExpenseNotFoundError + ExpenseValidationError errors are exported from domain/errors/expense-errors.ts", () => {
    const src = readExpenseFile("domain/errors/expense-errors.ts");
    expect(src).toMatch(/^export class ExpenseNotFoundError\b/m);
    expect(src).toMatch(/^export class ExpenseValidationError\b/m);
  });

  // α6 — paired sister Lot α18 REDUCED (3 types, no CloseExpenseInput — no transition)
  it("CreateExpenseInput + ExpenseProps + ExpenseSnapshot are exported from domain/expense.entity.ts", () => {
    const src = readExpenseFile("domain/expense.entity.ts");
    expect(src).toMatch(/^export (interface|type) CreateExpenseInput\b/m);
    expect(src).toMatch(/^export (interface|type) ExpenseProps\b/m);
    expect(src).toMatch(/^export (interface|type) ExpenseSnapshot\b/m);
  });

  // α7 — paired sister Lot α19 EXACT mirror
  it("Expense.create + Expense.fromPersistence static factories exist in domain/expense.entity.ts", () => {
    const src = readExpenseFile("domain/expense.entity.ts");
    expect(src).toMatch(/static create\(/m);
    expect(src).toMatch(/static fromPersistence\(/m);
  });
});
