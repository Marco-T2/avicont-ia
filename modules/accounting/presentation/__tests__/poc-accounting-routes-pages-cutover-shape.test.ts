/**
 * RED test — POC #3d: poc-accounting-routes-pages-cutover structural shape assertions.
 *
 * 38α total declarations. Expected failure mode pre-GREEN:
 *   31 FAIL (Blocks B–H: hex import + legacy absent + new-instance absent +
 *            Zod hex route imports + validation.ts + SHIM + W-sweep).
 *    7 PASS (Block A: existsSync for 7 already-existing consumer files — vacuous).
 *
 * Post-GREEN: all 38α PASS (cutover complete, Zod migrated, SHIM applied, W-sweep done).
 *
 * Cumulative on top of POC #3c (#3a 31α + #3b 33α + #3c ~40α + #3d 38α). Paired-sister
 * precedent: poc-accounting-accounts-service-shape.test.ts (POC #3c).
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "../../../..");

// ── Consumer file paths (7) — D8 lock ────────────────────────────────────────

const CONSUMER_FILES = [
  {
    label: "route accounts/route.ts",
    path: resolve(REPO_ROOT, "app/api/organizations/[orgSlug]/accounts/route.ts"),
  },
  {
    label: "route accounts/[accountId]/route.ts",
    path: resolve(REPO_ROOT, "app/api/organizations/[orgSlug]/accounts/[accountId]/route.ts"),
  },
  {
    label: "page accounting/accounts/page.tsx",
    path: resolve(REPO_ROOT, "app/(dashboard)/[orgSlug]/accounting/accounts/page.tsx"),
  },
  {
    label: "page accounting/journal/new/page.tsx",
    path: resolve(REPO_ROOT, "app/(dashboard)/[orgSlug]/accounting/journal/new/page.tsx"),
  },
  {
    label: "page accounting/journal/[entryId]/edit/page.tsx",
    path: resolve(REPO_ROOT, "app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/edit/page.tsx"),
  },
  {
    label: "page accounting/ledger/page.tsx",
    path: resolve(REPO_ROOT, "app/(dashboard)/[orgSlug]/accounting/ledger/page.tsx"),
  },
  {
    label: "page sales/new/page.tsx",
    path: resolve(REPO_ROOT, "app/(dashboard)/[orgSlug]/sales/new/page.tsx"),
  },
] as const;

const ROUTE_FILES = CONSUMER_FILES.slice(0, 2); // 2 routes

const HEX_VALIDATION_PATH = resolve(
  REPO_ROOT,
  "modules/accounting/presentation/validation.ts",
);

const LEGACY_VALIDATION_PATH = resolve(
  REPO_ROOT,
  "features/accounting/accounting.validation.ts",
);

const ADAPTER_PATH = resolve(
  REPO_ROOT,
  "modules/accounting/infrastructure/prisma-accounts.repo.ts",
);

const SERVICE_PATH = resolve(
  REPO_ROOT,
  "modules/accounting/application/accounts.service.ts",
);

// ── Block A — α01-α07: consumer file existence (vacuous PASS pre-GREEN) ──────

describe("α01–α07 Block A consumer file existence (REQ-004/REQ-005)", () => {
  it.each(CONSUMER_FILES.map((f) => [f.label, f.path] as [string, string]))(
    "α: %s exists",
    (_label, path) => {
      expect(existsSync(path)).toBe(true);
    },
  );
});

// ── Block B — α08-α14: hex makeAccountsService import present ────────────────

describe("α08–α14 Block B hex makeAccountsService import present (REQ-004/REQ-005)", () => {
  it.each(CONSUMER_FILES.map((f) => [f.label, f.path] as [string, string]))(
    "α: %s imports makeAccountsService from @/modules/accounting/presentation/server",
    (_label, path) => {
      const src = readFileSync(path, "utf-8");
      expect(src).toMatch(
        /^import\s+\{[^}]*\bmakeAccountsService\b[^}]*\}\s+from\s+["']@\/modules\/accounting\/presentation\/server["']/m,
      );
    },
  );
});

// ── Block C — α15-α21: legacy AccountsService import absent ──────────────────

describe("α15–α21 Block C legacy AccountsService named-import absent (REQ-004/REQ-005)", () => {
  it.each(CONSUMER_FILES.map((f) => [f.label, f.path] as [string, string]))(
    "α: %s does NOT import AccountsService from @/features/accounting/server",
    (_label, path) => {
      const src = readFileSync(path, "utf-8");
      expect(src).not.toMatch(
        /import\s*\{[^}]*\bAccountsService\b[^}]*\}\s*from\s*["']@\/features\/accounting\/server["']/,
      );
    },
  );
});

// ── Block D — α22-α28: `new AccountsService()` absent ────────────────────────

describe("α22–α28 Block D `new AccountsService()` absent (REQ-010)", () => {
  it.each(CONSUMER_FILES.map((f) => [f.label, f.path] as [string, string]))(
    "α: %s contains zero `new AccountsService()`",
    (_label, path) => {
      const src = readFileSync(path, "utf-8");
      expect(src).not.toMatch(/new\s+AccountsService\s*\(\s*\)/);
    },
  );
});

// ── Block E — α29-α30: routes import Zod from hex validation ─────────────────

describe("α29–α30 Block E routes import Zod from hex validation (REQ-004)", () => {
  it.each(ROUTE_FILES.map((f) => [f.label, f.path] as [string, string]))(
    "α: %s imports schema from @/modules/accounting/presentation/validation",
    (_label, path) => {
      const src = readFileSync(path, "utf-8");
      expect(src).toMatch(
        /^import\s+\{[^}]*Schema[^}]*\}\s+from\s+["']@\/modules\/accounting\/presentation\/validation["']/m,
      );
    },
  );
});

// ── Block F — α31-α33: hex validation.ts NEW file ────────────────────────────

describe("α31–α33 Block F hex validation.ts (REQ-001)", () => {
  it("α31: modules/accounting/presentation/validation.ts exists", () => {
    expect(existsSync(HEX_VALIDATION_PATH)).toBe(true);
  });

  it("α32: hex validation.ts exports createAccountSchema", () => {
    if (!existsSync(HEX_VALIDATION_PATH)) {
      expect(existsSync(HEX_VALIDATION_PATH)).toBe(true);
      return;
    }
    const src = readFileSync(HEX_VALIDATION_PATH, "utf-8");
    expect(src).toMatch(/export\s+const\s+createAccountSchema\b/);
  });

  it("α33: hex validation.ts exports updateAccountSchema", () => {
    if (!existsSync(HEX_VALIDATION_PATH)) {
      expect(existsSync(HEX_VALIDATION_PATH)).toBe(true);
      return;
    }
    const src = readFileSync(HEX_VALIDATION_PATH, "utf-8");
    expect(src).toMatch(/export\s+const\s+updateAccountSchema\b/);
  });
});

// ── Block G — α34-α36: SHIM in legacy validation ─────────────────────────────

describe("α34–α36 Block G legacy validation SHIM (REQ-003)", () => {
  it("α34: legacy validation re-exports createAccountSchema from hex", () => {
    const src = readFileSync(LEGACY_VALIDATION_PATH, "utf-8");
    expect(src).toMatch(
      /export\s*\{[^}]*\bcreateAccountSchema\b[^}]*\}\s*from\s*["']@\/modules\/accounting\/presentation\/validation["']/,
    );
  });

  it("α35: legacy validation re-exports updateAccountSchema from hex", () => {
    const src = readFileSync(LEGACY_VALIDATION_PATH, "utf-8");
    expect(src).toMatch(
      /export\s*\{[^}]*\bupdateAccountSchema\b[^}]*\}\s*from\s*["']@\/modules\/accounting\/presentation\/validation["']/,
    );
  });

  it("α36: legacy validation no longer declares inline createAccountSchema = z[.object|\\n.object]", () => {
    const src = readFileSync(LEGACY_VALIDATION_PATH, "utf-8");
    // Catches both inline `z.object` and multiline `z\n  .object` (current legacy shape).
    expect(src).not.toMatch(/createAccountSchema\s*=\s*z[\s\S]{0,10}\.object\(/);
  });
});

// ── Block H — α37-α38: W-sweep applied ───────────────────────────────────────

describe("α37–α38 Block H W-sweep applied (REQ-007)", () => {
  it("α37: adapter L7 JSDoc no longer contains 'excluded from port'", () => {
    const src = readFileSync(ADAPTER_PATH, "utf-8");
    expect(src).not.toMatch(/excluded from port/);
  });

  it("α38: service body has zero `as unknown` in tx-cast region", () => {
    const src = readFileSync(SERVICE_PATH, "utf-8");
    const lines = src.split("\n");
    // Region: L195-L215 (1-indexed)
    const region = lines.slice(194, 215).join("\n");
    expect(region).not.toMatch(/as\s+unknown/);
  });
});
