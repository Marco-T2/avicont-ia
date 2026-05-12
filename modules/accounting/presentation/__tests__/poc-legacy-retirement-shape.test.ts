import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "../../../..");

const LEDGER_PATH = resolve(REPO_ROOT, "features/accounting/ledger.service.ts");
const JOURNAL_PATH = resolve(REPO_ROOT, "features/accounting/journal.service.ts");
const REPO_PATH = resolve(REPO_ROOT, "features/accounting/accounts.repository.ts");
const SHIM_PATH = resolve(REPO_ROOT, "features/accounting/accounting.validation.ts");

const siblings = [
  { label: "ledger.service.ts", path: LEDGER_PATH },
  { label: "journal.service.ts", path: JOURNAL_PATH },
] as const;

// Block A — existence (2 PASS pre-GREEN — files already exist)
describe("α01–α02 Block A — Sibling file existence (REQ-001, REQ-002)", () => {
  for (const { label, path } of siblings) {
    it(`α: ${label} exists`, () => {
      expect(existsSync(path)).toBe(true);
    });
  }
});

// Block B — AccountsCrudPort import present (2 FAIL pre-GREEN)
describe("α03–α04 Block B — AccountsCrudPort hex import present (REQ-001, REQ-002)", () => {
  const HEX_PORT_IMPORT =
    /^import\s+(?:type\s+)?\{[^}]*\bAccountsCrudPort\b[^}]*\}\s+from\s+["']@\/modules\/accounting\/domain\/ports\/accounts-crud\.port["']/m;
  for (const { label, path } of siblings) {
    it(`α: ${label} imports AccountsCrudPort from hex port`, () => {
      const src = readFileSync(path, "utf-8");
      expect(src).toMatch(HEX_PORT_IMPORT);
    });
  }
});

// Block C — legacy ./accounts.repository import ABSENT (2 FAIL pre-GREEN)
describe("α05–α06 Block C — Legacy accounts.repository import absent (REQ-001, REQ-002)", () => {
  const LEGACY_IMPORT =
    /import\s*\{[^}]*\bAccountsRepository\b[^}]*\}\s*from\s*["']\.\/accounts\.repository["']/;
  for (const { label, path } of siblings) {
    it(`α: ${label} has NO legacy ./accounts.repository import`, () => {
      const src = readFileSync(path, "utf-8");
      expect(src).not.toMatch(LEGACY_IMPORT);
    });
  }
});

// Block D — new AccountsRepository() absent (2 FAIL pre-GREEN)
describe("α07–α08 Block D — new AccountsRepository() instantiation absent (REQ-001, REQ-002)", () => {
  const LEGACY_CTOR = /new\s+AccountsRepository\s*\(\s*\)/;
  for (const { label, path } of siblings) {
    it(`α: ${label} has NO new AccountsRepository() call`, () => {
      const src = readFileSync(path, "utf-8");
      expect(src).not.toMatch(LEGACY_CTOR);
    });
  }
});

// Block E — accounts.repository.ts physically deleted (1 FAIL pre-GREEN)
describe("α09 Block E — accounts.repository.ts deleted (REQ-003)", () => {
  it("α: features/accounting/accounts.repository.ts physically deleted", () => {
    expect(existsSync(REPO_PATH)).toBe(false);
  });
});

// Block F — SHIM re-export block removed (1 FAIL pre-GREEN)
describe("α10 Block F — SHIM re-export block removed from accounting.validation.ts (REQ-004)", () => {
  it("α: accounting.validation.ts has NO createAccountSchema/updateAccountSchema re-export block", () => {
    const src = readFileSync(SHIM_PATH, "utf-8");
    expect(src).not.toMatch(/export\s*\{[^}]*(?:createAccountSchema|updateAccountSchema)[^}]*\}/);
  });
});

// Block G — field type AccountsCrudPort in sibling class body (2 FAIL pre-GREEN)
describe("α11–α12 Block G — Field type AccountsCrudPort declared in class body (REQ-001, REQ-002)", () => {
  const FIELD_TYPE =
    /private\s+(?:readonly\s+)?\w+\s*:\s*AccountsCrudPort\b/;
  for (const { label, path } of siblings) {
    it(`α: ${label} field type is AccountsCrudPort`, () => {
      const src = readFileSync(path, "utf-8");
      expect(src).toMatch(FIELD_TYPE);
    });
  }
});
