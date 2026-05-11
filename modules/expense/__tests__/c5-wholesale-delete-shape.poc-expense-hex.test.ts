import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../..");

// ── C5 RED paths expense single-aggregate (6 source file existence transition, dir absorbed) ──

const EXPENSES_SERVER_PATH = path.join(REPO_ROOT, "features/expenses/server.ts");
const EXPENSES_INDEX_PATH = path.join(REPO_ROOT, "features/expenses/index.ts");
const EXPENSES_TYPES_PATH = path.join(REPO_ROOT, "features/expenses/expenses.types.ts");
const EXPENSES_VALIDATION_PATH = path.join(REPO_ROOT, "features/expenses/expenses.validation.ts");
const EXPENSES_SERVICE_PATH = path.join(REPO_ROOT, "features/expenses/expenses.service.ts");
const EXPENSES_REPOSITORY_PATH = path.join(REPO_ROOT, "features/expenses/expenses.repository.ts");

// ── PROJECT-scope absence regex (safety net consumer reintroducción) ──

const LEGACY_SERVER_IMPORT_RE = /from\s*["']@\/features\/expenses\/server["']/;
const LEGACY_BARREL_IMPORT_RE = /from\s*["']@\/features\/expenses["']/;

const PRODUCTION_SCAN_DIRS = ["app", "features", "modules"];

function walkProductionSources(dir: string): string[] {
  const collected: string[] = [];
  if (!fs.existsSync(dir)) return collected;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === ".next" ||
        entry.name === ".turbo" ||
        entry.name === "__tests__"
      ) {
        continue;
      }
      collected.push(...walkProductionSources(full));
    } else if (
      entry.isFile() &&
      /\.(ts|tsx)$/.test(entry.name) &&
      !/\.(test|spec)\.tsx?$/.test(entry.name)
    ) {
      collected.push(full);
    }
  }
  return collected;
}

function findFilesMatchingImport(re: RegExp): string[] {
  const matches: string[] = [];
  for (const subdir of PRODUCTION_SCAN_DIRS) {
    const root = path.join(REPO_ROOT, subdir);
    const files = walkProductionSources(root);
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      if (re.test(source)) {
        matches.push(path.relative(REPO_ROOT, file));
      }
    }
  }
  return matches;
}

describe("POC expense hex C5 — atomic delete features/expenses/ wholesale shape (paired sister farms+lots C7 EXACT mirror reduced single-aggregate)", () => {
  // ── Tests α57-α62: source files no longer exist (legacy wholesale deletion) ──

  // α57
  it("α57: features/expenses/server.ts no longer exists (legacy barrel re-export deletion — ExpensesService + ExpensesRepository resolved canonical home @/modules/expense/presentation/server post-cutover C0-C4 cumulative)", () => {
    expect(fs.existsSync(EXPENSES_SERVER_PATH)).toBe(false);
  });

  // α58
  it("α58: features/expenses/index.ts no longer exists (legacy re-export barrel deletion — schemas zod + types absorbed canonical home @/modules/expense/presentation/{server,validation} post C0-C4)", () => {
    expect(fs.existsSync(EXPENSES_INDEX_PATH)).toBe(false);
  });

  // α59
  it("α59: features/expenses/expenses.types.ts no longer exists (legacy types module deletion — ExpenseWithRelations absorbed canonical home @/modules/expense/presentation/server (ExpenseSnapshot) post-C4 cutover cumulative)", () => {
    expect(fs.existsSync(EXPENSES_TYPES_PATH)).toBe(false);
  });

  // α60
  it("α60: features/expenses/expenses.validation.ts no longer exists (legacy zod schemas deletion — createExpenseSchema + expenseIdSchema canonical home @/modules/expense/presentation/validation consumed direct post-C4)", () => {
    expect(fs.existsSync(EXPENSES_VALIDATION_PATH)).toBe(false);
  });

  // α61
  it("α61: features/expenses/expenses.service.ts no longer exists (legacy ExpensesService class deletion — factory hex makeExpenseService() consumed via composition-root post-cutover, cross-feature consumers ai-agent + pricing DI absorbed C4)", () => {
    expect(fs.existsSync(EXPENSES_SERVICE_PATH)).toBe(false);
  });

  // α62
  it("α62: features/expenses/expenses.repository.ts no longer exists (legacy ExpensesRepository class deletion — canonical home @/modules/expense/infrastructure/prisma-expenses.repository (PrismaExpensesRepository) consumed direct post-cutover cumulative C2-C4)", () => {
    expect(fs.existsSync(EXPENSES_REPOSITORY_PATH)).toBe(false);
  });

  // ── Tests α63-α64: PROJECT-scope absence safety net (PASS pre-GREEN — divergence justified) ──
  // Forward-looking safety net contra reintroducción post-C5 GREEN.
  // Pre-GREEN PASS por retirement gate ZERO CONSUMER PROD verified post-C4 cutover cumulative.

  // α63
  it("α63: zero production source imports `from \"@/features/expenses/server\"` (PROJECT-scope safety net consumer reintroducción)", () => {
    const matches = findFilesMatchingImport(LEGACY_SERVER_IMPORT_RE);
    expect(matches).toEqual([]);
  });

  // α64
  it("α64: zero production source imports `from \"@/features/expenses\"` exact barrel (PROJECT-scope safety net consumer reintroducción)", () => {
    const matches = findFilesMatchingImport(LEGACY_BARREL_IMPORT_RE);
    expect(matches).toEqual([]);
  });
});
