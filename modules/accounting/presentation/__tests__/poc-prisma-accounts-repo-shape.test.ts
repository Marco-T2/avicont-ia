/**
 * RED test — POC #3b: poc-accounting-prisma-accounts-repo structural shape assertions.
 *
 * ~34α declarations. Expected failure mode pre-GREEN:
 *   ~25 FAIL (adapter file non-existent: α01–α05, α06-α20 method each, α21-α25 import sentinels).
 *   ~8  PASS (α26 vacuous no-legacy-import, α27 vacuous no-server-only, α28-α33 POC sentinels ×6).
 *
 * Paired-sister precedent: poc-accounts-crud-port-shape.test.ts (POC #3a).
 * Shape mirrors prior POC shape test conventions.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ADAPTER_PATH = resolve(
  __dirname,
  "../../infrastructure/prisma-accounts.repo.ts",
);

const METHOD_NAMES = [
  "findAll",
  "findById",
  "findByCode",
  "findManyByIds",
  "findTree",
  "findByType",
  "findSiblings",
  "findDetailAccounts",
  "findDetailChildrenByParentCodes",
  "findActiveChildren",
  "create",
  "update",
  "seedChartOfAccounts",
  "deactivate",
  "countJournalLines",
] as const;

const IMPORT_SENTINELS = [
  {
    label: "Prisma/PrismaClient/Account/AccountType from generated",
    regex: /^import\s+\{[^}]*Prisma[^}]*\}\s+from\s+"@\/generated\/prisma\/client"/m,
  },
  {
    label: "deriveNature + AccountDef from seeds",
    regex: /^import\s+\{[^}]*deriveNature[^}]*\}\s+from\s+"@\/prisma\/seeds\/chart-of-accounts"/m,
  },
  {
    // NOTE (hex R1/R2 debt paydown): accounts.types moved from presentation/dto
    // to domain/ (it describes domain shapes, consumed inward). Sentinel updated
    // to the new domain/ location.
    label: "DTO types from hex domain",
    regex: /^import\s+type\s+\{[^}]*AccountListFilters[^}]*\}\s+from\s+"@\/modules\/accounting\/domain\/accounts\.types"/m,
  },
  {
    label: "AccountsCrudPort from domain",
    regex: /^import\s+type\s+\{\s*AccountsCrudPort\s*\}\s+from\s+"\.\.\/domain\/ports\/accounts-crud\.port"/m,
  },
  {
    label: "prisma from @/lib/prisma",
    regex: /^import\s+\{\s*prisma\s*\}\s+from\s+"@\/lib\/prisma"/m,
  },
] as const;

// ── α01: file exists ──────────────────────────────────────────────────────────

describe("α01 REQ-001 adapter file exists", () => {
  it("α01: modules/accounting/infrastructure/prisma-accounts.repo.ts exists", () => {
    expect(existsSync(ADAPTER_PATH)).toBe(true);
  });
});

// ── α02–α05: class declaration ────────────────────────────────────────────────

describe("α02–α05 REQ-002 class declaration", () => {
  it("α02: exports class PrismaAccountsRepo", () => {
    const src = readFileSync(ADAPTER_PATH, "utf-8");
    expect(src).toMatch(/^export class PrismaAccountsRepo/m);
  });

  it("α03: implements AccountsCrudPort", () => {
    const src = readFileSync(ADAPTER_PATH, "utf-8");
    expect(src).toMatch(/implements AccountsCrudPort/);
  });

  it("α04: constructor has db: DbClient = prisma default", () => {
    const src = readFileSync(ADAPTER_PATH, "utf-8");
    expect(src).toMatch(/constructor\s*\([^)]*db[^)]*DbClient[^)]*=\s*prisma[^)]*\)/);
  });

  it("α05: does NOT extend any base class", () => {
    const src = readFileSync(ADAPTER_PATH, "utf-8");
    expect(src).not.toMatch(/class PrismaAccountsRepo\s+extends\s+\w+/);
  });
});

// ── α06–α20: REQ-003 method declarations (15) ────────────────────────────────

describe("α06–α20 REQ-003 all 15 method names declared as async (it.each)", () => {
  it.each(METHOD_NAMES.map((m) => [m] as [string]))(
    "α method %s declared as async",
    (name) => {
      const src = readFileSync(ADAPTER_PATH, "utf-8");
      expect(src).toMatch(new RegExp(`async\\s+${name}\\s*\\(`));
    },
  );
});

// ── α21–α25: REQ-004 import sentinels ────────────────────────────────────────

describe("α21–α25 REQ-004 required imports declared", () => {
  it.each(IMPORT_SENTINELS.map((s) => [s.label, s.regex] as [string, RegExp]))(
    "import: %s",
    (_label, regex) => {
      const src = readFileSync(ADAPTER_PATH, "utf-8");
      expect(src).toMatch(regex);
    },
  );
});

// ── α26: REQ-005 no legacy import (vacuous PASS pre-GREEN) ───────────────────

describe("α26 REQ-005 S-01 does NOT import from legacy AccountsRepository", () => {
  it("α26: adapter does NOT import from @/features/accounting/accounts.repository", () => {
    if (!existsSync(ADAPTER_PATH)) return; // vacuous pre-GREEN
    const src = readFileSync(ADAPTER_PATH, "utf-8");
    expect(src).not.toMatch(/from\s+"@\/features\/accounting\/accounts\.repository"/);
  });
});

// ── α27: REQ-006 no server-only import (vacuous PASS pre-GREEN) ──────────────

describe("α27 REQ-006 does NOT import server-only", () => {
  it("α27: adapter does NOT import 'server-only'", () => {
    if (!existsSync(ADAPTER_PATH)) return; // vacuous pre-GREEN
    const src = readFileSync(ADAPTER_PATH, "utf-8");
    expect(src).not.toMatch(/import\s+["']server-only["']/);
  });
});

// α28–α33 retired (POC SHIM-SHAPE / POC #1, #2a–#2d, #3a derivative): the
// asserted POC files were wholesale-deleted as their migration contract
// was consumed by the features/accounting shim retirement (debt #14a).
// Per [[named_rule_immutability]], assertion block deleted, regex NEVER
// mutated.
