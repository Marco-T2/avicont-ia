/**
 * RED test — POC #3e: poc-accounting-cross-module-retire structural shape assertions.
 *
 * 51α total declarations. Expected failure mode pre-GREEN:
 *   12 PASS — Block A: existsSync for 12 already-existing consumer files (vacuous).
 *   39 FAIL — Blocks B–F:
 *      B (12 FAIL) hex import present (split B1 service / B2 repo)
 *      C (12 FAIL) legacy import absent
 *      D (12 FAIL) legacy `new AccountsRepository()` / `new AccountsService()` absent
 *      E (2 FAIL)  barrel exports `AccountsRepository` / `AccountsService` absent
 *      F (1 FAIL)  `features/accounting/accounts.service.ts` physically deleted
 *
 * Post-GREEN: all 51α PASS (12 cutovers + barrel shrink + accounts.service.ts deletion).
 *
 * Cumulative on top of POC #3a 31α + #3b 33α + #3c ~40α + #3d 38α + #3e 51α. Paired-sister
 * precedent: poc-accounting-routes-pages-cutover-shape.test.ts (POC #3d).
 *
 * Block D regex alternation longest-first per [[red_regex_discipline]] D9.13:
 * `(AccountsRepository|AccountsService)` — 18 chars before 15 chars.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "../../../..");

// ── Consumer file paths (12) — D2 lock ───────────────────────────────────────

const SERVICE_CONSUMER_FILES = [
  {
    label: "page sales/[saleId]/page.tsx",
    path: resolve(REPO_ROOT, "app/(dashboard)/[orgSlug]/sales/[saleId]/page.tsx"),
  },
  {
    label: "adapter organizations/legacy-account-seed.adapter.ts",
    path: resolve(
      REPO_ROOT,
      "modules/organizations/infrastructure/adapters/legacy-account-seed.adapter.ts",
    ),
  },
] as const;

const REPO_CONSUMER_FILES = [
  {
    label: "comp-root modules/sale/presentation/composition-root.ts",
    path: resolve(REPO_ROOT, "modules/sale/presentation/composition-root.ts"),
  },
  {
    label: "comp-root modules/purchase/presentation/composition-root.ts",
    path: resolve(REPO_ROOT, "modules/purchase/presentation/composition-root.ts"),
  },
  {
    label: "adapter dispatch/legacy-journal-entry-factory.adapter.ts",
    path: resolve(
      REPO_ROOT,
      "modules/dispatch/infrastructure/legacy-journal-entry-factory.adapter.ts",
    ),
  },
  {
    label: "adapter org-settings/legacy-account-lookup.adapter.ts",
    path: resolve(
      REPO_ROOT,
      "modules/org-settings/infrastructure/legacy-account-lookup.adapter.ts",
    ),
  },
  {
    label: "adapter payment/legacy-accounting.adapter.ts",
    path: resolve(
      REPO_ROOT,
      "modules/payment/infrastructure/adapters/legacy-accounting.adapter.ts",
    ),
  },
  {
    label: "adapter accounting/legacy-accounts-read.adapter.ts",
    path: resolve(
      REPO_ROOT,
      "modules/accounting/infrastructure/legacy-accounts-read.adapter.ts",
    ),
  },
  // NOTE: find-accounts.ts and parse-operation.ts were moved from features/ai-agent/tools/
  // to modules/ai-agent/application/tools/ at poc-ai-agent-hex C5. The NEW files use
  // AccountsLookupPort (REQ-004 insulation) instead of importing PrismaAccountsRepo directly.
  // The insulation adapter is modules/ai-agent/infrastructure/legacy-accounts.adapter.ts.
  // These files are no longer "direct repo consumers" — removed from REPO_CONSUMER_FILES.
  {
    label: "adapter ai-agent/legacy-accounts.adapter.ts",
    path: resolve(REPO_ROOT, "modules/ai-agent/infrastructure/legacy-accounts.adapter.ts"),
  },
  {
    label: "page payments/new/page.tsx",
    path: resolve(REPO_ROOT, "app/(dashboard)/[orgSlug]/payments/new/page.tsx"),
  },
  {
    label: "page payments/[paymentId]/page.tsx",
    path: resolve(REPO_ROOT, "app/(dashboard)/[orgSlug]/payments/[paymentId]/page.tsx"),
  },
] as const;

const ALL_CONSUMER_FILES = [...SERVICE_CONSUMER_FILES, ...REPO_CONSUMER_FILES];

const BARREL_PATH = resolve(REPO_ROOT, "features/accounting/server.ts");
const ACCOUNTS_SERVICE_PATH = resolve(
  REPO_ROOT,
  "features/accounting/accounts.service.ts",
);

// ── Block A — α01-α12: consumer file existence (vacuous PASS pre-GREEN) ──────

describe("α01–α12 Block A consumer file existence (REQ-001, REQ-002)", () => {
  it.each(
    ALL_CONSUMER_FILES.map((f) => [f.label, f.path] as [string, string]),
  )("α: %s exists", (_label, path) => {
    expect(existsSync(path)).toBe(true);
  });
});

// ── Block B1 — α13-α14: service consumers import makeAccountsService ─────────

describe("α13–α14 Block B1 service consumers import makeAccountsService (REQ-001/ScenarioA)", () => {
  it.each(
    SERVICE_CONSUMER_FILES.map((f) => [f.label, f.path] as [string, string]),
  )(
    "α: %s imports makeAccountsService from @/modules/accounting/presentation/server",
    (_label, path) => {
      const src = readFileSync(path, "utf-8");
      expect(src).toMatch(
        /^import\s+\{[^}]*\bmakeAccountsService\b[^}]*\}\s+from\s+["']@\/modules\/accounting\/presentation\/server["']/m,
      );
    },
  );
});

// ── Block B2 — α15-α24: repo consumers import PrismaAccountsRepo ─────────────

describe("α15–α24 Block B2 repo consumers import PrismaAccountsRepo (REQ-001/ScenarioB)", () => {
  it.each(
    REPO_CONSUMER_FILES.map((f) => [f.label, f.path] as [string, string]),
  )(
    "α: %s imports PrismaAccountsRepo from @/modules/accounting/infrastructure/prisma-accounts.repo",
    (_label, path) => {
      const src = readFileSync(path, "utf-8");
      expect(src).toMatch(
        /^import\s+.*\bPrismaAccountsRepo\b.*from\s+["']@\/modules\/accounting\/infrastructure\/prisma-accounts\.repo["']/m,
      );
    },
  );
});

// ── Block C — α25-α36: legacy named-import absent (12 files) ─────────────────

describe("α25–α36 Block C legacy AccountsService/AccountsRepository named-import absent (REQ-002)", () => {
  it.each(
    ALL_CONSUMER_FILES.map((f) => [f.label, f.path] as [string, string]),
  )(
    "α: %s does NOT import AccountsService/AccountsRepository from @/features/accounting",
    (_label, path) => {
      const src = readFileSync(path, "utf-8");
      expect(src).not.toMatch(
        /import\s*\{[^}]*\b(AccountsRepository|AccountsService)\b[^}]*\}\s*from\s*["']@\/features\/accounting\//,
      );
    },
  );
});

// ── Block D — α37-α48: legacy `new AccountsRepository()` / `new AccountsService()` absent

describe("α37–α48 Block D legacy `new AccountsRepository()` / `new AccountsService()` absent (REQ-002)", () => {
  it.each(
    ALL_CONSUMER_FILES.map((f) => [f.label, f.path] as [string, string]),
  )(
    "α: %s contains zero `new AccountsRepository()` / `new AccountsService()`",
    (_label, path) => {
      const src = readFileSync(path, "utf-8");
      expect(src).not.toMatch(
        /new\s+(AccountsRepository|AccountsService)\s*\(\s*\)/,
      );
    },
  );
});

// ── Block E — α49-α50: barrel exports AccountsRepository + AccountsService absent

describe("α49–α50 Block E barrel exports AccountsRepository/AccountsService absent (REQ-003)", () => {
  it("α49: features/accounting/server.ts does NOT export AccountsRepository", () => {
    const src = readFileSync(BARREL_PATH, "utf-8");
    expect(src).not.toMatch(/export\s*\{[^}]*\bAccountsRepository\b/);
  });

  it("α50: features/accounting/server.ts does NOT export AccountsService", () => {
    const src = readFileSync(BARREL_PATH, "utf-8");
    expect(src).not.toMatch(/export\s*\{[^}]*\bAccountsService\b/);
  });
});

// ── Block F — α51: accounts.service.ts physically deleted ────────────────────

describe("α51 Block F features/accounting/accounts.service.ts physically deleted (REQ-005)", () => {
  it("α51: features/accounting/accounts.service.ts does NOT exist", () => {
    expect(existsSync(ACCOUNTS_SERVICE_PATH)).toBe(false);
  });
});
