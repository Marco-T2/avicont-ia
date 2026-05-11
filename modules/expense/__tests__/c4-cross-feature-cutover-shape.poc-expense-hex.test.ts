import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "../../..");

function readRepoFile(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), "utf-8");
}

// ── Regex patterns ──
const IMPORT_MAKE_EXPENSE_SERVICE_HEX_RE =
  /^import\s*\{[^}]*\bmakeExpenseService\b[^}]*\}\s*from\s*["']@\/modules\/expense\/presentation\/server["']/m;
const IMPORT_EXPENSE_SNAPSHOT_HEX_RE =
  /^import\s+(?:type\s+)?\{[^}]*\bExpenseSnapshot\b[^}]*\}\s*from\s*["']@\/modules\/expense\/presentation\/server["']/m;
const LEGACY_FEATURES_EXPENSES_IMPORT_RE =
  /from\s+["']@\/features\/expenses(?:\/server)?["']/;
const TO_SNAPSHOT_RE = /\.toSnapshot\(\)/;
const NEW_EXPENSES_SERVICE_CTOR_RE = /new\s+ExpensesService\s*\(/;
const VI_MOCK_HEX_RE =
  /vi\.mock\(\s*["']@\/modules\/expense\/presentation\/server["']/;
const VI_MOCK_LEGACY_RE = /vi\.mock\(\s*["']@\/features\/expenses\/server["']/;

describe("POC expense hex C4 — cross-feature cutover shape (paired sister farms+lots C5+C6 combined EXACT mirror reduced single-aggregate)", () => {
  // ── A: lots/[lotId]/page.tsx cutover ──
  // α46
  it("α46: lots/[lotId]/page.tsx imports makeExpenseService hex + NO legacy + .toSnapshot() + NO new ExpensesService(", () => {
    const src = readRepoFile("app/(dashboard)/[orgSlug]/lots/[lotId]/page.tsx");
    expect(src).toMatch(IMPORT_MAKE_EXPENSE_SERVICE_HEX_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_EXPENSES_IMPORT_RE);
    expect(src).toMatch(TO_SNAPSHOT_RE);
    expect(src).not.toMatch(NEW_EXPENSES_SERVICE_CTOR_RE);
  });

  // α47
  it("α47: lot-detail-client.tsx imports ExpenseSnapshot hex + NO legacy ExpenseWithRelations features/expenses", () => {
    const src = readRepoFile(
      "app/(dashboard)/[orgSlug]/lots/[lotId]/lot-detail-client.tsx",
    );
    expect(src).toMatch(IMPORT_EXPENSE_SNAPSHOT_HEX_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_EXPENSES_IMPORT_RE);
  });

  // ── B: farms/[farmId]/page.tsx cutover (POC #1 cementado preserved) ──
  // α48
  it("α48: farms/[farmId]/page.tsx imports makeExpenseService hex + NO legacy + .toSnapshot() + NO new ExpensesService(", () => {
    const src = readRepoFile(
      "app/(dashboard)/[orgSlug]/farms/[farmId]/page.tsx",
    );
    expect(src).toMatch(IMPORT_MAKE_EXPENSE_SERVICE_HEX_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_EXPENSES_IMPORT_RE);
    expect(src).toMatch(TO_SNAPSHOT_RE);
    expect(src).not.toMatch(NEW_EXPENSES_SERVICE_CTOR_RE);
  });

  // α49
  it("α49: farm-detail-client.tsx imports ExpenseSnapshot hex + NO legacy ExpenseWithRelations features/expenses", () => {
    const src = readRepoFile(
      "app/(dashboard)/[orgSlug]/farms/[farmId]/farm-detail-client.tsx",
    );
    expect(src).toMatch(IMPORT_EXPENSE_SNAPSHOT_HEX_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_EXPENSES_IMPORT_RE);
  });

  // ── C: API routes cutover ──
  // α50
  it("α50: api/expenses/route.ts imports makeExpenseService hex + NO legacy + NO new ExpensesService(", () => {
    const src = readRepoFile(
      "app/api/organizations/[orgSlug]/expenses/route.ts",
    );
    expect(src).toMatch(IMPORT_MAKE_EXPENSE_SERVICE_HEX_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_EXPENSES_IMPORT_RE);
    expect(src).not.toMatch(NEW_EXPENSES_SERVICE_CTOR_RE);
  });

  // α51
  it("α51: api/expenses/[expenseId]/route.ts imports makeExpenseService hex + NO legacy + NO new ExpensesService(", () => {
    const src = readRepoFile(
      "app/api/organizations/[orgSlug]/expenses/[expenseId]/route.ts",
    );
    expect(src).toMatch(IMPORT_MAKE_EXPENSE_SERVICE_HEX_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_EXPENSES_IMPORT_RE);
    expect(src).not.toMatch(NEW_EXPENSES_SERVICE_CTOR_RE);
  });

  // α52
  it("α52: api/agent/route.ts imports makeExpenseService hex + NO legacy + NO new ExpensesService(", () => {
    const src = readRepoFile(
      "app/api/organizations/[orgSlug]/agent/route.ts",
    );
    expect(src).toMatch(IMPORT_MAKE_EXPENSE_SERVICE_HEX_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_EXPENSES_IMPORT_RE);
    expect(src).not.toMatch(NEW_EXPENSES_SERVICE_CTOR_RE);
  });

  // ── D: Cross-module pricing.service.ts cutover ──
  // α53
  it("α53: features/pricing/pricing.service.ts imports from hex + NO legacy + NO new ExpensesService(", () => {
    const src = readRepoFile("features/pricing/pricing.service.ts");
    expect(src).toMatch(IMPORT_MAKE_EXPENSE_SERVICE_HEX_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_EXPENSES_IMPORT_RE);
    expect(src).not.toMatch(NEW_EXPENSES_SERVICE_CTOR_RE);
  });

  // ── E: 3× route.confirm-*.test.ts vi.mock migration ──
  // α54
  it("α54: route.confirm-create-expense.test.ts vi.mock path migrated hex (NO legacy features/expenses)", () => {
    const src = readRepoFile(
      "app/api/organizations/[orgSlug]/agent/__tests__/route.confirm-create-expense.test.ts",
    );
    expect(src).toMatch(VI_MOCK_HEX_RE);
    expect(src).not.toMatch(VI_MOCK_LEGACY_RE);
  });

  // α55
  it("α55: route.confirm-log-mortality.test.ts vi.mock path migrated hex (NO legacy features/expenses)", () => {
    const src = readRepoFile(
      "app/api/organizations/[orgSlug]/agent/__tests__/route.confirm-log-mortality.test.ts",
    );
    expect(src).toMatch(VI_MOCK_HEX_RE);
    expect(src).not.toMatch(VI_MOCK_LEGACY_RE);
  });

  // α56
  it("α56: route.confirm-journal-entry.test.ts vi.mock path migrated hex (NO legacy features/expenses)", () => {
    const src = readRepoFile(
      "app/api/organizations/[orgSlug]/agent/__tests__/route.confirm-journal-entry.test.ts",
    );
    expect(src).toMatch(VI_MOCK_HEX_RE);
    expect(src).not.toMatch(VI_MOCK_LEGACY_RE);
  });
});
