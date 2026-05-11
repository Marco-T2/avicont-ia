import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const EXPENSE_ROOT = resolve(__dirname, "..", "..");

function readExpenseFile(rel: string): string {
  return readFileSync(resolve(EXPENSE_ROOT, rel), "utf-8");
}

describe("C3 presentation shape — Expense module (existence-only regex)", () => {
  // α38 — paired sister Lot α9 EXACT mirror
  it("composition-root.ts exports makeExpenseService factory", () => {
    const src = readExpenseFile("presentation/composition-root.ts");
    expect(src).toMatch(/^export function makeExpenseService\(/m);
  });

  // α39 — paired sister Lot α10 EXACT mirror (factory wires repo único no adapter)
  it("composition-root.ts factory wires PrismaExpensesRepository único (no adapter)", () => {
    const src = readExpenseFile("presentation/composition-root.ts");
    expect(src).toMatch(/new PrismaExpensesRepository\(/);
    expect(src).not.toMatch(/new LocalExpensesInquiryAdapter\(/);
  });

  // α40 — paired sister Lot α11 EXACT mirror
  it("validation.ts exports createExpenseSchema (Zod)", () => {
    const src = readExpenseFile("presentation/validation.ts");
    expect(src).toMatch(/^export const createExpenseSchema\s*=\s*z\.object\(/m);
  });

  // α41 — paired sister Lot α13 EXACT mirror (lotId.cuid validation preserved)
  it("validation.ts preserves lotId.cuid() validation EXACT legacy", () => {
    const src = readExpenseFile("presentation/validation.ts");
    expect(src).toMatch(/lotId:\s*z\.string\(\)\.cuid\(/);
  });

  // α42 — paired sister Lot α14 EXACT mirror
  it("server.ts barrel re-exports makeExpenseService from composition-root", () => {
    const src = readExpenseFile("presentation/server.ts");
    expect(src).toMatch(
      /^export\s*\{\s*makeExpenseService\b[\s\S]*?\}\s*from\s*["']\.\/composition-root["']/m,
    );
  });

  // α43 — paired sister Lot α15 EXACT mirror REDUCED (no closeExpenseSchema — no transition)
  it("server.ts barrel re-exports createExpenseSchema from validation", () => {
    const src = readExpenseFile("presentation/server.ts");
    expect(src).toMatch(
      /^export\s*\{\s*createExpenseSchema\b[\s\S]*?\}\s*from\s*["']\.\/validation["']/m,
    );
  });

  // α44 — paired sister Lot α16 EXACT mirror REDUCED (no ExpenseWithRelationsSnapshot + no ExpenseSummary VO)
  it("server.ts barrel re-exports ExpenseSnapshot + ExpensesInquiryPort + ExpensesRepository types", () => {
    const src = readExpenseFile("presentation/server.ts");
    expect(src).toMatch(/\bExpenseSnapshot\b/);
    expect(src).toMatch(/\bExpensesInquiryPort\b/);
    expect(src).toMatch(/\bExpensesRepository\b/);
  });

  // α45 — paired sister Lot α17 EXACT mirror
  it("server.ts barrel re-exports Expense entity + ExpenseService + ExpenseCategory", () => {
    const src = readExpenseFile("presentation/server.ts");
    expect(src).toMatch(/\bExpense\b[\s\S]*?from\s*["']\.\.\/domain\/expense\.entity["']/);
    expect(src).toMatch(/\bExpenseService\b[\s\S]*?from\s*["']\.\.\/application\/expense\.service["']/);
    expect(src).toMatch(/\bExpenseCategory\b/);
  });
});
