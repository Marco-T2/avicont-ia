/**
 * RED test — POC #3c: poc-accounting-accounts-service structural shape assertions.
 *
 * ~40α declarations. Expected failure mode pre-GREEN:
 *   ~29 FAIL (service file non-existent: α01–α24, α32+ composition-root sentinels).
 *   ~11 PASS (α20 vacuous no-legacy-import, α21 vacuous no-server-only, α25-α31 POC sentinels ×7).
 *
 * Cumulative on top of POC #3b 33α — adds service + composition-root + new POC sentinel.
 * Paired-sister precedent: poc-prisma-accounts-repo-shape.test.ts (POC #3b).
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SERVICE_PATH = resolve(
  __dirname,
  "../../application/accounts.service.ts",
);

const COMP_ROOT_PATH = resolve(
  __dirname,
  "../composition-root.ts",
);

const METHOD_NAMES = [
  "list",
  "getTree",
  "getById",
  "seedChartOfAccounts",
  "create",
  "update",
  "deactivate",
] as const;

const IMPORT_SENTINELS = [
  {
    label: "errors barrel (NotFoundError)",
    regex: /^import\s+\{[^}]*NotFoundError[^}]*\}\s+from\s+"@\/features\/shared\/errors"/m,
  },
  {
    label: "getNextCode from domain",
    regex: /^import\s+\{\s*getNextCode\s*\}\s+from\s+"@\/modules\/accounting\/domain\/account-code\.utils"/m,
  },
  {
    label: "resolveAccountSubtype from domain",
    regex: /^import\s+\{\s*resolveAccountSubtype\s*\}\s+from\s+"@\/modules\/accounting\/domain\/account-subtype\.resolve"/m,
  },
  {
    label: "ACCOUNTS from seeds",
    regex: /^import\s+\{\s*ACCOUNTS\s*\}\s+from\s+"@\/prisma\/seeds\/chart-of-accounts"/m,
  },
  {
    label: "AccountsCrudPort from domain port",
    regex: /^import\s+type\s+\{\s*AccountsCrudPort\s*\}\s+from\s+"\.\.\/domain\/ports\/accounts-crud\.port"/m,
  },
  {
    label: "DTO types from hex presentation (CreateAccountInput)",
    regex: /^import\s+type\s+\{[^}]*CreateAccountInput[^}]*\}\s+from\s+"@\/modules\/accounting\/presentation\/dto\/accounts\.types"/m,
  },
] as const;

// Sentinel filenames relative to the same __tests__ directory (mirror #3b pattern).
const TESTS_DIR = resolve(__dirname, ".");

const POC_SENTINELS = [
  { label: "POC #1 poc-hex-public-barrels-shape", filename: "poc-hex-public-barrels-shape.test.ts" },
  { label: "POC #2a poc-types-to-hex-shape", filename: "poc-types-to-hex-shape.test.ts" },
  { label: "POC #2b poc-utils-to-hex-shape", filename: "poc-utils-to-hex-shape.test.ts" },
  { label: "POC #2c poc-account-subtype-to-hex-shape", filename: "poc-account-subtype-to-hex-shape.test.ts" },
  { label: "POC #2d poc-journal-ui-to-hex-shape", filename: "poc-journal-ui-to-hex-shape.test.ts" },
  { label: "POC #3a poc-accounts-crud-port-shape", filename: "poc-accounts-crud-port-shape.test.ts" },
  { label: "POC #3b poc-prisma-accounts-repo-shape", filename: "poc-prisma-accounts-repo-shape.test.ts" },
] as const;

// ── α01: file exists ──────────────────────────────────────────────────────────

describe("α01 REQ-001 service file exists", () => {
  it("α01: modules/accounting/application/accounts.service.ts exists", () => {
    expect(existsSync(SERVICE_PATH)).toBe(true);
  });
});

// ── α02–α06: class + interface declaration ────────────────────────────────────

describe("α02–α06 REQ-002 class and interface declaration", () => {
  it("α02: exports class AccountsService", () => {
    const src = readFileSync(SERVICE_PATH, "utf-8");
    expect(src).toMatch(/^export class AccountsService/m);
  });

  it("α03: does NOT extend any base class", () => {
    const src = readFileSync(SERVICE_PATH, "utf-8");
    expect(src).not.toMatch(/class AccountsService\s+extends\s+\w+/);
  });

  it("α04: does NOT implement any interface", () => {
    const src = readFileSync(SERVICE_PATH, "utf-8");
    expect(src).not.toMatch(/class AccountsService[^{]*implements\s+\w+/);
  });

  it("α05: constructor receives deps: AccountsServiceDeps", () => {
    const src = readFileSync(SERVICE_PATH, "utf-8");
    expect(src).toMatch(/constructor\s*\(\s*deps\s*:\s*AccountsServiceDeps\s*\)/);
  });

  it("α06: exports interface AccountsServiceDeps", () => {
    const src = readFileSync(SERVICE_PATH, "utf-8");
    expect(src).toMatch(/export interface AccountsServiceDeps/);
  });
});

// ── α07–α13: REQ-003 method declarations (7) ─────────────────────────────────

describe("α07–α13 REQ-003 all 7 method names declared as async (it.each)", () => {
  it.each(METHOD_NAMES.map((m) => [m] as [string]))(
    "α method %s declared as async",
    (name) => {
      const src = readFileSync(SERVICE_PATH, "utf-8");
      expect(src).toMatch(new RegExp(`async\\s+${name}\\s*\\(`));
    },
  );
});

// ── α14–α19: REQ-004 import sentinels ────────────────────────────────────────

describe("α14–α19 REQ-004 required imports declared", () => {
  it.each(IMPORT_SENTINELS.map((s) => [s.label, s.regex] as [string, RegExp]))(
    "import: %s",
    (_label, regex) => {
      const src = readFileSync(SERVICE_PATH, "utf-8");
      expect(src).toMatch(regex);
    },
  );
});

// ── α20: REQ-005 no legacy import (vacuous PASS pre-GREEN) ───────────────────

describe("α20 REQ-005 S-01 does NOT import from legacy AccountsRepository", () => {
  it("α20: service does NOT import from @/features/accounting/accounts.repository", () => {
    if (!existsSync(SERVICE_PATH)) return; // vacuous pre-GREEN
    const src = readFileSync(SERVICE_PATH, "utf-8");
    expect(src).not.toMatch(/from\s+"@\/features\/accounting\/accounts\.repository"/);
  });
});

// ── α21: REQ-006 no server-only import (vacuous PASS pre-GREEN) ──────────────

describe("α21 REQ-006 does NOT import server-only", () => {
  it("α21: service does NOT import 'server-only'", () => {
    if (!existsSync(SERVICE_PATH)) return; // vacuous pre-GREEN
    const src = readFileSync(SERVICE_PATH, "utf-8");
    expect(src).not.toMatch(/^import\s+["']server-only["']/m);
  });
});

// ── α22–α24: REQ-007 composition root factory ────────────────────────────────

describe("α22–α24 REQ-007 composition-root exports makeAccountsService and wires deps", () => {
  it("α22: composition-root exports makeAccountsService function", () => {
    const src = readFileSync(COMP_ROOT_PATH, "utf-8");
    expect(src).toMatch(/export function makeAccountsService/);
  });

  it("α23: composition-root imports AccountsService from application/accounts.service", () => {
    const src = readFileSync(COMP_ROOT_PATH, "utf-8");
    expect(src).toMatch(
      /^import\s+\{[^}]*AccountsService[^}]*\}\s+from\s+"\.\.\/application\/accounts\.service"/m,
    );
  });

  it("α24: composition-root imports PrismaAccountsRepo", () => {
    const src = readFileSync(COMP_ROOT_PATH, "utf-8");
    expect(src).toMatch(/PrismaAccountsRepo/);
  });
});

// ── α25–α31: REQ-008 POC sentinels ×7 ───────────────────────────────────────

describe("α25–α31 REQ-008 POC sentinels #1/#2a/#2b/#2c/#2d/#3a/#3b preserved", () => {
  it.each(POC_SENTINELS.map((s) => [s.label, s.filename] as [string, string]))(
    "sentinel %s exists",
    (_label, filename) => {
      expect(existsSync(resolve(TESTS_DIR, filename))).toBe(true);
    },
  );
});
