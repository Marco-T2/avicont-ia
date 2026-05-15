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

// Block B — UPDATED at POC #7 OLEADA 6 sub-POC 7/8 C5 B2a.
//
// Original intent (poc-accounting-legacy-retirement, 20dce277): assert the
// legacy `journal.service.ts`/`ledger.service.ts` reach accounts data through
// the HEX `AccountsCrudPort`, not the retired legacy `accounts.repository`.
// C5 B2a converts both files into thin delegating SHIMs over the hex
// `JournalsService`/`LedgerService` — they no longer hold an `accountsRepo`
// field at all; the hex owns the port. The retirement invariant this block
// protected (NO legacy `accounts.repository` import / NO `new
// AccountsRepository()`) is STILL enforced — STRONGER — by Blocks C/D/E,
// which keep passing against the shims. Block B's POSITIVE "imports
// AccountsCrudPort" assertion is now obsolete: a thin shim that delegates
// EVERYTHING (including accounts access) to the hex does not import the port.
// Honest prior-cycle sentinel collision per [[invariant_collision_elevation]],
// updated in the C5 GREEN that causes it (cannot ship a red suite).
describe("α03–α04 Block B — sibling files delegate to the hex (C5 B2a — no direct AccountsCrudPort)", () => {
  const HEX_SERVICE_IMPORT =
    /from\s+["']@\/modules\/accounting\/presentation\/server["']/;
  for (const { label, path } of siblings) {
    it(`α: ${label} imports the hex accounting service surface (delegating shim)`, () => {
      const src = readFileSync(path, "utf-8");
      expect(src).toMatch(HEX_SERVICE_IMPORT);
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

// Block G — UPDATED at POC #7 OLEADA 6 sub-POC 7/8 C5 B2a.
//
// Original intent: the legacy sibling classes hold an `AccountsCrudPort`-typed
// field (the hex port, post-retirement of the legacy `accounts.repository`).
// C5 B2a converts both into thin delegating SHIMs — they hold only a lazily
// resolved hex-service reference and NO `accountsCrudPort` field. The shim
// does not touch accounts data directly; the hex `JournalsService` /
// `LedgerService` own that. Block G now asserts the shim shape: the class
// body declares no legacy repository field and delegates through the hex.
// Honest prior-cycle sentinel collision per [[invariant_collision_elevation]].
describe("α11–α12 Block G — sibling classes are delegating shims (C5 B2a — no AccountsCrudPort field)", () => {
  const LEGACY_REPO_FIELD =
    /private\s+(?:readonly\s+)?\w+\s*:\s*(?:AccountsCrudPort|AccountsRepository|JournalRepository)\b/;
  for (const { label, path } of siblings) {
    it(`α: ${label} class body holds NO legacy repository field (delegates to the hex)`, () => {
      const src = readFileSync(path, "utf-8");
      expect(src).not.toMatch(LEGACY_REPO_FIELD);
    });
  }
});
