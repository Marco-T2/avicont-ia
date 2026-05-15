import { existsSync } from "node:fs";
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

// Block A — INVERTED at sub-POC 8/8 C4. Originally asserted the sibling shim
// files EXIST; C4 deletes both, so Block A re-inverts to assert deletion.
// (Drift not enumerated in the C4 task plan — which named only Block B α03–04
// + Block G α11–12 — but Blocks A/C/D/F all read the retiring files and so
// must track the deletion too; surfaced honestly per
// [[cross_cycle_red_test_cementacion_gate]].)
describe("α01–α02 Block A — sibling shim files DELETED (sub-POC 8/8 C4)", () => {
  for (const { label, path } of siblings) {
    it(`α: ${label} physically deleted (shim retired)`, () => {
      expect(existsSync(path)).toBe(false);
    });
  }
});

// Block B — INVERTED at POC #8 OLEADA 6 sub-POC 8/8 C4 (poc-accounting-shim-
// retirement).
//
// Genealogy: original intent (poc-accounting-legacy-retirement, 20dce277)
// asserted the legacy `journal.service.ts`/`ledger.service.ts` reach accounts
// data through the HEX `AccountsCrudPort`; sub-POC 7 C5 B2a updated it to
// "sibling files delegate to the hex (delegating shim)" once both became thin
// shims. sub-POC 8 C4 now DELETES both shims outright — every `app/` consumer
// was repointed to the hex factory (`makeJournalsService()` /
// `makeLedgerService()`) across C0–C3, and the `features/accounting/server.ts`
// barrel drops its re-exports in the same C4 GREEN. `readFileSync` on a
// deleted file throws ENOENT, so Block B re-inverts to assert the deletion.
// Honest prior-cycle sentinel collision per [[invariant_collision_elevation]],
// re-inverted in the C4 GREEN that causes it (cannot ship a red suite).
describe("α03–α04 Block B — sibling shims DELETED (sub-POC 8/8 C4 — consumers on hex factory)", () => {
  for (const { label, path } of siblings) {
    it(`α: ${label} physically deleted (shim retired)`, () => {
      expect(existsSync(path)).toBe(false);
    });
  }
});

// Block C — INVERTED at sub-POC 8/8 C4. Originally asserted the sibling shims
// carry NO legacy `./accounts.repository` import. C4 deletes the shims, so the
// invariant is vacuously satisfied — the assertion re-inverts to confirm the
// file is gone (a deleted file trivially has no such import). Same drift class
// as Block A; surfaced honestly per [[cross_cycle_red_test_cementacion_gate]].
describe("α05–α06 Block C — sibling shims DELETED → legacy accounts.repository import vacuously absent (sub-POC 8/8 C4)", () => {
  for (const { label, path } of siblings) {
    it(`α: ${label} physically deleted — no legacy ./accounts.repository import possible`, () => {
      expect(existsSync(path)).toBe(false);
    });
  }
});

// Block D — INVERTED at sub-POC 8/8 C4. Originally asserted the sibling shims
// carry NO `new AccountsRepository()` call. C4 deletes the shims, so the
// invariant is vacuously satisfied. Same drift class as Block A/C.
describe("α07–α08 Block D — sibling shims DELETED → new AccountsRepository() vacuously absent (sub-POC 8/8 C4)", () => {
  for (const { label, path } of siblings) {
    it(`α: ${label} physically deleted — no new AccountsRepository() call possible`, () => {
      expect(existsSync(path)).toBe(false);
    });
  }
});

// Block E — accounts.repository.ts physically deleted (1 FAIL pre-GREEN)
describe("α09 Block E — accounts.repository.ts deleted (REQ-003)", () => {
  it("α: features/accounting/accounts.repository.ts physically deleted", () => {
    expect(existsSync(REPO_PATH)).toBe(false);
  });
});

// Block F — INVERTED at sub-POC 8/8 C4. Originally asserted the
// `accounting.validation.ts` SHIM had its account-schema re-export block
// removed (the schemas were folded into the hex `presentation/validation.ts`).
// C4 deletes the `accounting.validation.ts` re-export shim outright — the
// `features/accounting/server.ts` barrel drops its `export * from
// "./accounting.validation"` in the same C4 GREEN. `readFileSync` on a deleted
// file throws ENOENT, so Block F re-inverts to assert the deletion. Drift not
// enumerated in the C4 task plan; surfaced honestly per
// [[cross_cycle_red_test_cementacion_gate]].
describe("α10 Block F — accounting.validation.ts re-export shim DELETED (sub-POC 8/8 C4)", () => {
  it("α: features/accounting/accounting.validation.ts physically deleted (re-export shim retired — schemas live in hex presentation/validation.ts)", () => {
    expect(existsSync(SHIM_PATH)).toBe(false);
  });
});

// Block G — INVERTED at sub-POC 8/8 C4.
//
// Genealogy: original intent asserted the legacy sibling classes hold an
// `AccountsCrudPort`-typed field; sub-POC 7 C5 B2a updated it to "delegating
// shim — no legacy repository field" once both became thin shims. sub-POC 8
// C4 DELETES both shims outright (consumers repointed to the hex factory
// across C0–C3, barrel re-exports dropped in the same C4 GREEN). `readFileSync`
// on a deleted file throws ENOENT, so Block G re-inverts to assert the
// deletion. Honest prior-cycle sentinel collision per
// [[invariant_collision_elevation]], re-inverted in the C4 GREEN that causes it.
describe("α11–α12 Block G — sibling shims DELETED → no legacy repository field possible (sub-POC 8/8 C4)", () => {
  for (const { label, path } of siblings) {
    it(`α: ${label} physically deleted — class body gone, no legacy repository field possible`, () => {
      expect(existsSync(path)).toBe(false);
    });
  }
});
