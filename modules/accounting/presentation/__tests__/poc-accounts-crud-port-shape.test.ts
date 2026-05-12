/**
 * RED test — POC #3a: poc-accounting-accounts-crud-port structural shape assertions.
 *
 * ~31α declarations. Expected failure mode pre-GREEN:
 *   ~20 FAIL (port file non-existent: α01–α23, α25).
 *   ~7 PASS  (α24 vacuous no-Prisma.TC, α26–α30 sentinels ×5, α31 vacuous no-server-only).
 *
 * First port-creation POC in hex chain (no paired-sister for "port-only POC").
 * Shape mirrors poc-account-subtype-to-hex-shape.test.ts conventions.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PORTS_DIR = resolve(
  __dirname,
  "../../../../modules/accounting/domain/ports",
);
const PORT_FILE = resolve(PORTS_DIR, "accounts-crud.port.ts");
const TESTS_DIR = resolve(__dirname, ".");

// ── Helper: read port file or return "" (for vacuous-PASS assertions) ────────

function readPort(): string {
  if (!existsSync(PORT_FILE)) return "";
  return readFileSync(PORT_FILE, "utf-8");
}

// ── α01: Port file exists ────────────────────────────────────────────────────

describe("α01 REQ-001 port file exists", () => {
  it("α01: modules/accounting/domain/ports/accounts-crud.port.ts exists", () => {
    expect(existsSync(PORT_FILE)).toBe(true);
  });
});

// ── α02: export interface AccountsCrudPort ───────────────────────────────────

describe("α02 REQ-002 exports AccountsCrudPort interface", () => {
  it("α02: port file contains ^export interface AccountsCrudPort", () => {
    const content = readFileSync(PORT_FILE, "utf-8");
    expect(content).toMatch(/^export interface AccountsCrudPort/m);
  });
});

// ── α03–α19: REQ-003 method signatures ──────────────────────────────────────

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
];

describe("α03–α17 REQ-003 all 15 method names present (it.each)", () => {
  it.each(METHOD_NAMES)(
    "method %s declared in AccountsCrudPort",
    (name) => {
      const content = readFileSync(PORT_FILE, "utf-8");
      expect(content).toMatch(new RegExp(`\\b${name}\\s*\\(`));
    },
  );
});

describe("α18 REQ-003 findSiblings returns Pick<Account, code>[]", () => {
  it("α18: findSiblings return type is Pick<Account, \"code\">[]", () => {
    const content = readFileSync(PORT_FILE, "utf-8");
    expect(content).toMatch(/findSiblings[^;]+Pick<Account,\s*["']code["']>\[\]/);
  });
});

describe("α19 REQ-003 seedChartOfAccounts uses readonly AccountDef[]", () => {
  it("α19: seedChartOfAccounts parameter uses readonly AccountDef[]", () => {
    const content = readFileSync(PORT_FILE, "utf-8");
    expect(content).toMatch(/seedChartOfAccounts[^;]+readonly AccountDef\[\]/);
  });
});

// ── α20–α23: REQ-004 type imports ───────────────────────────────────────────

describe("α20–α23 REQ-004 required type imports declared", () => {
  it("α20: Account imported from @/generated/prisma/client", () => {
    const content = readFileSync(PORT_FILE, "utf-8");
    expect(content).toMatch(
      /^import type \{[^}]*\bAccount\b[^}]*\} from ["']@\/generated\/prisma\/client["']/m,
    );
  });

  it("α21: AccountType imported from @/generated/prisma/client", () => {
    const content = readFileSync(PORT_FILE, "utf-8");
    // AccountType must appear in the prisma/client import line
    expect(content).toMatch(
      /^import type \{[^}]*\bAccountType\b[^}]*\} from ["']@\/generated\/prisma\/client["']/m,
    );
  });

  it("α22: hex DTO types imported from presentation/dto/accounts.types", () => {
    const content = readFileSync(PORT_FILE, "utf-8");
    expect(content).toMatch(/from ["'].*presentation\/dto\/accounts\.types["']/m);
    expect(content).toMatch(/\bAccountListFilters\b/);
    expect(content).toMatch(/\bResolvedCreateAccountData\b/);
    expect(content).toMatch(/\bUpdateAccountInput\b/);
    expect(content).toMatch(/\bAccountWithChildren\b/);
  });

  it("α23: AccountDef imported from @/prisma/seeds/chart-of-accounts", () => {
    const content = readFileSync(PORT_FILE, "utf-8");
    expect(content).toMatch(/from ["']@\/prisma\/seeds\/chart-of-accounts["']/m);
    expect(content).toMatch(/\bAccountDef\b/);
  });
});

// ── α24: REQ-005 no Prisma.TransactionClient (vacuous PASS pre-GREEN) ────────

describe("α24 REQ-005 no Prisma.TransactionClient leak", () => {
  it("α24: port file does NOT contain Prisma.TransactionClient", () => {
    const content = readPort();
    expect(content).not.toMatch(/Prisma\.TransactionClient/);
  });
});

// ── α25: REQ-006 countJournalLines AccountUsagePort TODO comment ─────────────

describe("α25 REQ-006 countJournalLines TODO comment present", () => {
  it("α25: port file contains TODO move to AccountUsagePort when journal hex migrates", () => {
    const content = readFileSync(PORT_FILE, "utf-8");
    expect(content).toMatch(/\/\/.*TODO.*AccountUsagePort/);
  });
});

// ── α26–α30: REQ-007 POC sentinels ×5 ───────────────────────────────────────

const SENTINEL_PATHS = [
  "poc-hex-public-barrels-shape.test.ts",
  "poc-types-to-hex-shape.test.ts",
  "poc-utils-to-hex-shape.test.ts",
  "poc-journal-ui-to-hex-shape.test.ts",
  "poc-account-subtype-to-hex-shape.test.ts",
];

describe("α26–α30 REQ-007 POC sentinels #1/#2a/#2b/#2c/#2d preserved", () => {
  it.each(SENTINEL_PATHS)(
    "sentinel %s exists",
    (filename) => {
      expect(existsSync(resolve(TESTS_DIR, filename))).toBe(true);
    },
  );
});

// ── α31: REQ-008 no server-only import (vacuous PASS pre-GREEN) ──────────────

describe("α31 REQ-008 no server-only in port file", () => {
  it("α31: port file does NOT contain import 'server-only'", () => {
    const content = readPort();
    expect(content).not.toMatch(/import\s+["']server-only["']/);
  });
});
