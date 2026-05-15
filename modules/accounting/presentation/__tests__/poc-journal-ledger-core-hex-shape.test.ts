import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Shape sentinel for OLEADA 6 sub-POC 7/8 — poc-accounting-journal-ledger-core-hex.
 * Per-cycle α blocks. Mirrors `poc-legacy-retirement-shape.test.ts` regex
 * conventions (readFileSync + anchored import regex). Cutover-completion POC:
 * folds the legacy journal/ledger core into the pre-existing hex
 * `modules/accounting/` (4-layer). See design #2405 / tasks #2406.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");

const HEX_INFRA_DIR = resolve(REPO_ROOT, "modules/accounting/infrastructure");
const HEX_DOMAIN_DOC_LIFECYCLE = resolve(
  REPO_ROOT,
  "modules/accounting/domain/document-lifecycle.ts",
);
const LEGACY_JOURNAL_SERVICE = resolve(
  REPO_ROOT,
  "features/accounting/journal.service.ts",
);
const LEGACY_DOC_LIFECYCLE = resolve(
  REPO_ROOT,
  "features/accounting/document-lifecycle.service.ts",
);
const LEGACY_JOURNAL_REPO = resolve(
  REPO_ROOT,
  "features/accounting/journal.repository.ts",
);
const HEX_JOURNAL_ENTRIES_REPO = resolve(
  HEX_INFRA_DIR,
  "prisma-journal-entries.repo.ts",
);
const HEX_JOURNALS_SERVICE = resolve(
  REPO_ROOT,
  "modules/accounting/application/journals.service.ts",
);
const HEX_LEDGER_SERVICE = resolve(
  REPO_ROOT,
  "modules/accounting/application/ledger.service.ts",
);
const HEX_JOURNAL_LEDGER_QUERY_PORT = resolve(
  REPO_ROOT,
  "modules/accounting/domain/ports/journal-ledger-query.port.ts",
);
const LEGACY_LEDGER_SERVICE = resolve(
  REPO_ROOT,
  "features/accounting/ledger.service.ts",
);
const LEGACY_ACCOUNTING_VALIDATION = resolve(
  REPO_ROOT,
  "features/accounting/accounting.validation.ts",
);
const HEX_AUTO_ENTRY_GENERATOR = resolve(
  REPO_ROOT,
  "modules/accounting/application/auto-entry-generator.ts",
);
const LEGACY_AUTO_ENTRY_GENERATOR = resolve(
  REPO_ROOT,
  "features/accounting/auto-entry-generator.ts",
);
const SALE_JOURNAL_ENTRY_FACTORY_ADAPTER = resolve(
  REPO_ROOT,
  "modules/sale/infrastructure/prisma-journal-entry-factory.adapter.ts",
);
const PURCHASE_UNIT_OF_WORK = resolve(
  REPO_ROOT,
  "modules/purchase/infrastructure/prisma-purchase-unit-of-work.ts",
);
const HEX_EXPORTERS_DIR = resolve(
  REPO_ROOT,
  "modules/accounting/infrastructure/exporters",
);
const LEGACY_EXPORTERS_DIR = resolve(
  REPO_ROOT,
  "features/accounting/exporters",
);
const HEX_VALIDATION = resolve(
  REPO_ROOT,
  "modules/accounting/presentation/validation.ts",
);
const LEGACY_ACCOUNTING_TESTS_DIR = resolve(
  REPO_ROOT,
  "features/accounting/__tests__",
);

/** Collect every `.ts` file directly under `modules/accounting/infrastructure/`
 *  (non-recursive — `__tests__/` excluded; the un-wrap target is the adapters). */
function hexInfraSourceFiles(): { label: string; path: string }[] {
  return readdirSync(HEX_INFRA_DIR, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".ts"))
    .map((e) => ({ label: e.name, path: resolve(HEX_INFRA_DIR, e.name) }));
}

// ── Block C0 — un-wrap circular fold + document-lifecycle + enum ────────────

// α01 — hex→legacy circular wrap eliminated (FAIL pre-GREEN: 2 adapters import legacy repo)
describe("α01 Block C0 — hex infrastructure has NO legacy journal.repository import", () => {
  const LEGACY_REPO_IMPORT =
    /from\s+["']@\/features\/accounting\/journal\.repository["']/;
  it("α01: no file in modules/accounting/infrastructure/ imports @/features/accounting/journal.repository", () => {
    const offenders = hexInfraSourceFiles().filter(({ path }) =>
      LEGACY_REPO_IMPORT.test(readFileSync(path, "utf-8")),
    );
    expect(offenders.map((o) => o.label)).toEqual([]);
  });
});

// α02 — document-lifecycle relocated to hex domain (FAIL pre-GREEN: file absent)
describe("α02 Block C0 — document-lifecycle relocated to modules/accounting/domain/", () => {
  it("α02: modules/accounting/domain/document-lifecycle.ts exists", () => {
    expect(existsSync(HEX_DOMAIN_DOC_LIFECYCLE)).toBe(true);
  });
});

// α03 — VALID_TRANSITIONS consolidated: 2 legacy accounting dupes deleted
//        (FAIL pre-GREEN: both journal.service.ts and document-lifecycle.service.ts
//         still declare `const VALID_TRANSITIONS`). Canonical lives in
//         domain/value-objects/journal-entry-status.ts as `ALLOWED` (design #2405).
describe("α03 Block C0 — no duplicate VALID_TRANSITIONS in legacy accounting", () => {
  const VALID_TRANSITIONS_DEF = /const\s+VALID_TRANSITIONS\s*[:=]/;
  const legacyAccountingFiles = [
    { label: "journal.service.ts", path: LEGACY_JOURNAL_SERVICE },
    { label: "document-lifecycle.service.ts", path: LEGACY_DOC_LIFECYCLE },
  ];
  it("α03: no `const VALID_TRANSITIONS` definition remains in legacy accounting files", () => {
    const offenders = legacyAccountingFiles.filter(
      ({ path }) =>
        existsSync(path) && VALID_TRANSITIONS_DEF.test(readFileSync(path, "utf-8")),
    );
    expect(offenders.map((o) => o.label)).toEqual([]);
  });
});

// α04 — behavioral snapshot: MAX_CONTENTION_ATTEMPTS + journalIncludeLines shape.
//        Captured from LEGACY journal.repository.ts PRE-fold so the parity gate
//        is meaningful. Asserts the SAME values resolve from the hex repo file
//        post-fold. Pre-GREEN: hex repo file has neither symbol → FAIL.
describe("α04 Block C0 — repo behavioral parity: MAX_CONTENTION_ATTEMPTS + journalIncludeLines", () => {
  // ── Legacy snapshot (source of truth, captured PRE-fold) ──
  const LEGACY_MAX_CONTENTION = 5;
  // journalIncludeLines: lines{include account+contact, orderBy order asc}, contact, voucherType
  const LEGACY_INCLUDE_LINES_SHAPE = `lines: {
    include: { account: true, contact: true },
    orderBy: { order: "asc" as const },
  },
  contact: true,
  voucherType: true,`;

  // α04a + α04b RETIRED (poc-payment-journal-repo-cutover — OLEADA 7 POC #1/2).
  //   file-content snapshot anchors on now-deleted features/accounting/journal.repository.ts;
  //   hex-side α04c + α04d below retain the snapshot anchor. Spec R-03 · Design #2436.

  it("α04c: hex prisma-journal-entries.repo.ts declares MAX_CONTENTION_ATTEMPTS = 5 post-fold", () => {
    const src = readFileSync(HEX_JOURNAL_ENTRIES_REPO, "utf-8");
    const m = src.match(/const\s+MAX_CONTENTION_ATTEMPTS\s*=\s*(\d+)/);
    expect(m?.[1]).toBe(String(LEGACY_MAX_CONTENTION));
  });

  it("α04d: hex prisma-journal-entries.repo.ts declares the journalIncludeLines shape post-fold", () => {
    const src = readFileSync(HEX_JOURNAL_ENTRIES_REPO, "utf-8");
    expect(src).toContain(LEGACY_INCLUDE_LINES_SHAPE);
  });
});

// ── Block C1 — 5 read use cases on JournalsService + LedgerService migration ─
//
// SCOPE NOTE (divergence from tasks #2406 α-numbering — surfaced honestly):
// tasks C1.1 reads "α05–α10 the 6 use cases exist on JournalsService". But the
// design #2405 cycle map + spec #2404 cycle→REQ map both scope `exportVoucherPdf`
// to C3 (it is coupled to the exporters/ git-mv — task C3.2 builds it). C1 is
// therefore the FIVE read/utility use cases: list, getById, getCorrelationAudit,
// getLastReferenceNumber, getNextNumber. α-allocation here:
//   α05–α09 — the 5 C1 read use cases on JournalsService
//   α10     — LedgerService exposes getAccountLedger + getTrialBalance
//   α11     — application/ledger.service.ts exists  (tasks α11, unchanged)
//   α12     — domain/ports/journal-ledger-query.port.ts exists (tasks α12, unchanged)
//   α13     — behavioral float-math parity on LedgerService running-balance
//             (tasks α13, unchanged) — DEV-1 / R-money named deviation gate.

// α05–α09 — the 5 read use cases exist on hex JournalsService.
//   Expected FAIL pre-GREEN: JournalsService currently exposes only the 4
//   write use cases (createEntry/createAndPost/transitionStatus/updateEntry).
describe("α05–α09 Block C1 — 5 read use cases declared on JournalsService", () => {
  const readUseCases = [
    "list",
    "getById",
    "getCorrelationAudit",
    "getLastReferenceNumber",
    "getNextNumber",
  ] as const;
  for (const method of readUseCases) {
    it(`α: journals.service.ts declares \`async ${method}(\``, () => {
      const src = readFileSync(HEX_JOURNALS_SERVICE, "utf-8");
      const decl = new RegExp(`async\\s+${method}\\s*\\(`);
      expect(src).toMatch(decl);
    });
  }
});

// α10 — LedgerService exposes both libro-mayor use cases.
//   Expected FAIL pre-GREEN: modules/accounting/application/ledger.service.ts
//   does not exist yet → readFileSync throws ENOENT.
describe("α10 Block C1 — LedgerService exposes getAccountLedger + getTrialBalance", () => {
  const ledgerUseCases = ["getAccountLedger", "getTrialBalance"] as const;
  for (const method of ledgerUseCases) {
    it(`α10: ledger.service.ts declares \`async ${method}(\``, () => {
      const src = readFileSync(HEX_LEDGER_SERVICE, "utf-8");
      const decl = new RegExp(`async\\s+${method}\\s*\\(`);
      expect(src).toMatch(decl);
    });
  }
});

// α11 — LedgerService migrated into hex application layer.
//   Expected FAIL pre-GREEN: file absent (zero hex equivalent today).
describe("α11 Block C1 — LedgerService migrated to modules/accounting/application/", () => {
  it("α11: modules/accounting/application/ledger.service.ts exists", () => {
    expect(existsSync(HEX_LEDGER_SERVICE)).toBe(true);
  });
});

// α12 — JournalLedgerQueryPort created in hex domain ports.
//   Expected FAIL pre-GREEN: port file absent.
describe("α12 Block C1 — JournalLedgerQueryPort created in domain/ports/", () => {
  it("α12: modules/accounting/domain/ports/journal-ledger-query.port.ts exists", () => {
    expect(existsSync(HEX_JOURNAL_LEDGER_QUERY_PORT)).toBe(true);
  });
  it("α12: port file declares `interface JournalLedgerQueryPort`", () => {
    const src = readFileSync(HEX_JOURNAL_LEDGER_QUERY_PORT, "utf-8");
    expect(src).toMatch(/interface\s+JournalLedgerQueryPort\b/);
  });
});

// α13 — DEV-1 / R-money behavioral parity gate. The hex LedgerService
//   running-balance MUST preserve legacy float `Number()` accumulation
//   (`runningBalance += debit - credit`) — byte-identical to legacy
//   `ledger.service.ts:43-57`. It MUST NOT converge to the canonical
//   `shared/domain/money.utils.ts` Decimal `sumDecimals`/`eq` invariant.
//   α13b (hex source, parity) + α13c (no Decimal convergence) are the live
//   anchors. α13a was a C1 legacy-source snapshot anchor — INVERTED at C5
//   B2a (the legacy file is now a thin shim; the float math lives only in
//   the hex). See α13a inline note.
describe("α13 Block C1 — LedgerService float money-math parity (DEV-1 / R-money)", () => {
  // Legacy snapshot: running-balance float accumulation, captured PRE-fold.
  const LEGACY_RUNNING_BALANCE = `let runningBalance = 0;`;
  const LEGACY_ACCUMULATION = `runningBalance += debit - credit;`;
  const LEGACY_NUMBER_COERCE_DEBIT = `const debit = Number(line.debit);`;
  const LEGACY_NUMBER_COERCE_CREDIT = `const credit = Number(line.credit);`;

  // α13a — RE-INVERTED at sub-POC 8/8 C4 (poc-accounting-shim-retirement).
  // Genealogy: a C1 snapshot anchor (legacy `ledger.service.ts` STILL carries
  // the float `Number()` accumulation), then INVERTED at sub-POC 7 C5 B2a to
  // "legacy file is a thin shim — no float math". C4 DELETES the shim outright
  // — `readFileSync(LEGACY_LEDGER_SERVICE)` would now throw ENOENT, so the
  // anchor must track the deletion. Drift not enumerated in the C4 task plan
  // (the plan scoped α21/α22/α24/α25/α27); surfaced honestly per
  // [[cross_cycle_red_test_cementacion_gate]] — α13a is a same-file sentinel
  // that reads a retiring file, so it re-inverts in the same C4 GREEN that
  // deletes it (cannot ship a red suite). The float-math parity anchor stays
  // on α13b (hex source) — unchanged, still asserts the arithmetic verbatim.
  it("α13a: legacy ledger.service.ts DELETED (sub-POC 8/8 C4 shim retirement — float-math parity now sole-anchored on α13b hex source)", () => {
    expect(existsSync(LEGACY_LEDGER_SERVICE)).toBe(false);
  });

  // α13b — INVERTED at poc-money-math-decimal-convergence C1 GREEN (OLEADA 7
  // POC #2). The hex LedgerService now converges to Decimal arithmetic
  // (sumDecimals + new Prisma.Decimal); the legacy float Number() running-balance
  // tokens are GONE. R-money textually discharged.
  it("α13b: hex ledger.service.ts converged to Decimal arithmetic — legacy float tokens GONE (DEV-1 / R-money DISCHARGED)", () => {
    const src = readFileSync(HEX_LEDGER_SERVICE, "utf-8");
    expect(src).not.toContain(LEGACY_RUNNING_BALANCE);
    expect(src).not.toContain(LEGACY_ACCUMULATION);
    expect(src).not.toContain(LEGACY_NUMBER_COERCE_DEBIT);
    expect(src).not.toContain(LEGACY_NUMBER_COERCE_CREDIT);
    expect(src).toMatch(/sumDecimals|new\s+Prisma\.Decimal/m);
  });

  // α13c — INVERTED at poc-money-math-decimal-convergence C1 GREEN. The hex
  // LedgerService now imports money.utils canonical helpers and calls sumDecimals.
  it("α13c: hex ledger.service.ts IMPORTS shared/domain/money.utils and calls sumDecimals (DEV-1 / R-money DISCHARGED)", () => {
    const src = readFileSync(HEX_LEDGER_SERVICE, "utf-8");
    expect(src).toMatch(
      /from\s+["'][^"']*shared\/domain\/money\.utils["']/m,
    );
    expect(src).toMatch(/\bsumDecimals\s*\(/);
  });

  // α13d — ADDED at poc-money-math-decimal-convergence C2 RED (OLEADA 7 POC #2).
  // AEG balance-check converges to sumDecimals + eq from shared/domain/money.utils;
  // legacy Math.round(*100) cents-comparison RETIRED. Mirrors α13c shape per
  // [[paired_sister_default_no_surface]] / [[red_regex_discipline]].
  it("α13d: hex auto-entry-generator.ts converged to Decimal balance-check — IMPORTS shared/domain/money.utils, calls sumDecimals+eq, NO Math.round(*100)", () => {
    const src = readFileSync(HEX_AUTO_ENTRY_GENERATOR, "utf-8");
    expect(src).toMatch(
      /from\s+["'][^"']*shared\/domain\/money\.utils["']/m,
    );
    expect(src).toMatch(/\bsumDecimals\s*\(/);
    expect(src).toMatch(/\beq\s*\(/);
    expect(src).not.toMatch(/Math\.round\([^)]*\*\s*100\)/);
  });
});

// ── Block C2 — auto-entry-generator migration + sale/purchase repoint ────────
//
// C2 relocates `auto-entry-generator.ts` into the hex `application/` layer
// (resolved open question — it orchestrates JournalRepository + accounts/
// voucher-types ports, so it belongs in application). ALL direct cross-module
// runtime consumers of the legacy `@/features/accounting/auto-entry-generator`
// path repoint atomically in the C2 GREEN commit (sale + purchase; payment +
// dispatch go through the `server.ts` barrel — untouched, sub-POC 8 scope).
// No `vi.mock` of the legacy path exists — affected integration tests use
// DIRECT `AutoEntryGenerator` imports, so C2 does import-target REWRITES.

// α14 — auto-entry-generator relocated to hex application layer.
//   Expected FAIL pre-GREEN: file still at features/accounting/, hex path absent
//   → existsSync(HEX) === false.
describe("α14 Block C2 — auto-entry-generator relocated to modules/accounting/application/", () => {
  it("α14: modules/accounting/application/auto-entry-generator.ts exists", () => {
    expect(existsSync(HEX_AUTO_ENTRY_GENERATOR)).toBe(true);
  });
  it("α14: features/accounting/auto-entry-generator.ts no longer exists", () => {
    expect(existsSync(LEGACY_AUTO_ENTRY_GENERATOR)).toBe(false);
  });
});

// α15 — sale prisma-journal-entry-factory.adapter.ts imports the hex path.
//   Expected FAIL pre-GREEN: still imports the legacy
//   `@/features/accounting/auto-entry-generator` path.
describe("α15 Block C2 — sale journal-entry-factory adapter imports hex auto-entry-generator", () => {
  const LEGACY_AEG_IMPORT =
    /from\s+["']@\/features\/accounting\/auto-entry-generator["']/;
  const HEX_AEG_IMPORT =
    /from\s+["']@\/modules\/accounting\/application\/auto-entry-generator["']/;
  it("α15: prisma-journal-entry-factory.adapter.ts imports the hex auto-entry-generator path", () => {
    const src = readFileSync(SALE_JOURNAL_ENTRY_FACTORY_ADAPTER, "utf-8");
    expect(src).toMatch(HEX_AEG_IMPORT);
  });
  it("α15: prisma-journal-entry-factory.adapter.ts no longer imports the legacy path", () => {
    const src = readFileSync(SALE_JOURNAL_ENTRY_FACTORY_ADAPTER, "utf-8");
    expect(src).not.toMatch(LEGACY_AEG_IMPORT);
  });
});

// α16 — purchase prisma-purchase-unit-of-work.ts imports the hex path.
//   Expected FAIL pre-GREEN: still imports the legacy path (type-only import).
describe("α16 Block C2 — purchase unit-of-work imports hex auto-entry-generator", () => {
  const LEGACY_AEG_IMPORT =
    /from\s+["']@\/features\/accounting\/auto-entry-generator["']/;
  const HEX_AEG_IMPORT =
    /from\s+["']@\/modules\/accounting\/application\/auto-entry-generator["']/;
  it("α16: prisma-purchase-unit-of-work.ts imports the hex auto-entry-generator path", () => {
    const src = readFileSync(PURCHASE_UNIT_OF_WORK, "utf-8");
    expect(src).toMatch(HEX_AEG_IMPORT);
  });
  it("α16: prisma-purchase-unit-of-work.ts no longer imports the legacy path", () => {
    const src = readFileSync(PURCHASE_UNIT_OF_WORK, "utf-8");
    expect(src).not.toMatch(LEGACY_AEG_IMPORT);
  });
});

// ── Block C3 — exporters/ git-mv + exportVoucherPdf use case ─────────────────
//
// C3 `git mv`s the whole `features/accounting/exporters/` directory (voucher-pdf
// .{exporter,composer,types}, logo-fetcher, amount-to-words + __tests__) into
// `modules/accounting/infrastructure/exporters/` (history preserved, realizes
// EX-D7), and completes the 6th journal use case `exportVoucherPdf` on the hex
// `JournalsService`. Org-profile + document-signature-config + fiscal-periods
// services are injected via composition-root ctor — mirror legacy
// `journal.service.ts:67-87` (resolved open question — NO new ports).

// α17 — exporters/ relocated to hex infrastructure (FAIL pre-GREEN: dir absent).
describe("α17 Block C3 — exporters/ relocated to modules/accounting/infrastructure/", () => {
  it("α17: modules/accounting/infrastructure/exporters/ exists with the exporter files", () => {
    expect(existsSync(HEX_EXPORTERS_DIR)).toBe(true);
    const files = readdirSync(HEX_EXPORTERS_DIR)
      .filter((n) => n.endsWith(".ts"))
      .sort();
    expect(files).toEqual([
      "amount-to-words.ts",
      "logo-fetcher.ts",
      "voucher-pdf.composer.ts",
      "voucher-pdf.exporter.ts",
      "voucher-pdf.types.ts",
    ]);
  });
});

// α18 — legacy exporters/ dir gone (FAIL pre-GREEN: still at features/accounting/).
describe("α18 Block C3 — features/accounting/exporters/ no longer exists", () => {
  it("α18: features/accounting/exporters/ directory removed by the git mv", () => {
    expect(existsSync(LEGACY_EXPORTERS_DIR)).toBe(false);
  });
});

// α19 — exportVoucherPdf use case declared on hex JournalsService.
//   Expected FAIL pre-GREEN: JournalsService has the 5 C1 read use cases + 4
//   write use cases — but NOT exportVoucherPdf (the 6th read, C3 scope).
describe("α19 Block C3 — exportVoucherPdf use case declared on JournalsService", () => {
  it("α19: journals.service.ts declares `async exportVoucherPdf(`", () => {
    const src = readFileSync(HEX_JOURNALS_SERVICE, "utf-8");
    expect(src).toMatch(/async\s+exportVoucherPdf\s*\(/);
  });
});

// ── Block C4 — accounting.validation merged into hex presentation ────────────
//
// C4 merges the 8 journal/ledger zod schemas from legacy
// `features/accounting/accounting.validation.ts` into the hex
// `modules/accounting/presentation/validation.ts` (currently account-only:
// createAccountSchema + updateAccountSchema). No naming collision — account
// schemas vs journal/ledger schemas are disjoint. The legacy file becomes a
// thin `export *` re-export shim (deleted in C5; barrel `server.ts` keeps
// working through it — same shim pattern C2 used for journal.types).

// α20 — the 8 journal/ledger zod schemas are exported from hex validation.ts.
//   Expected FAIL pre-GREEN: hex validation.ts declares ONLY createAccountSchema
//   + updateAccountSchema — none of the 8 journal/ledger schemas exist there yet.
describe("α20 Block C4 — journal/ledger zod schemas merged into hex presentation/validation.ts", () => {
  const journalLedgerSchemas = [
    "createJournalEntrySchema",
    "updateJournalEntrySchema",
    "statusTransitionSchema",
    "journalFiltersSchema",
    "dateRangeSchema",
    "lastReferenceQuerySchema",
    "correlationAuditQuerySchema",
    "exportVoucherQuerySchema",
  ] as const;
  for (const schema of journalLedgerSchemas) {
    it(`α20: hex validation.ts exports \`const ${schema}\``, () => {
      const src = readFileSync(HEX_VALIDATION, "utf-8");
      const decl = new RegExp(`export\\s+const\\s+${schema}\\b`);
      expect(src).toMatch(decl);
    });
  }
});

// ── Block C4 (sub-POC 8/8) — legacy journal/ledger/validation shims RETIRED ──
//
// poc-accounting-shim-retirement C4 is the DELETION cycle. Genealogy: sub-POC
// 7 C5 Option B2a (Marco-approved after THREE escalations) converted
// `journal.service.ts`/`ledger.service.ts` from FULL legacy classes into thin
// delegating SHIMs over the hex `JournalsService`/`LedgerService`, keeping the
// `features/accounting/server.ts` barrel surface byte-stable so the ~10 `app/`
// runtime consumers stayed put — their repoint to the hex factory was scoped
// to sub-POC 8. sub-POC 8 C0–C3 repointed all of them
// (`makeJournalsService()` / `makeLedgerService()` at the consumer leaves).
// C4 now retires the three shims: `journal.service.ts`, `ledger.service.ts`,
// and the thin `accounting.validation.ts` re-export — the
// `features/accounting/server.ts` barrel drops all three re-exports in the
// SAME C4 GREEN. `journal.repository.ts` is RETAINED (design #2422 invariant
// collision — live payment-adapter consumer + test consumers + α26 guard).
// The C4.1 PROJECT-scope re-inventory grep gate confirmed zero non-shim
// importers of the three retiring files before any `git rm`.

// α21 — INVERTED at sub-POC 8/8 C4 (poc-accounting-shim-retirement). The
// legacy `journal.service.ts` shim is DELETED outright: all ~10 `app/` runtime
// consumers were repointed to the hex factory `makeJournalsService()` across
// C0–C2, the C4.1 re-inventory grep gate confirmed zero non-shim importers,
// and the `features/accounting/server.ts` barrel drops its re-export in the
// same C4 GREEN (see α27). Genealogy: sub-POC 7 C5 B2a converted this file
// from the full legacy class into a thin delegating shim; C4 retires the shim.
//   Expected FAIL pre-GREEN: journal.service.ts still EXISTS (the shim) →
//   existsSync === true → toBe(false) FAILS.
describe("α21 Block C4 (sub-POC 8) — legacy journal.service.ts shim DELETED", () => {
  it("α21: features/accounting/journal.service.ts physically deleted (shim retired — consumers on hex factory)", () => {
    expect(existsSync(LEGACY_JOURNAL_SERVICE)).toBe(false);
  });
});

// α22 — INVERTED at sub-POC 8/8 C4. The legacy `ledger.service.ts` shim is
// DELETED outright: the sole runtime consumer (`app/api/.../ledger/route.ts`)
// was repointed to `makeLedgerService()` in C3, the C4.1 re-inventory grep
// gate confirmed zero non-shim importers, and the barrel drops its re-export
// in the same C4 GREEN (see α27).
//   Expected FAIL pre-GREEN: ledger.service.ts still EXISTS (the shim) →
//   existsSync === true → toBe(false) FAILS.
describe("α22 Block C4 (sub-POC 8) — legacy ledger.service.ts shim DELETED", () => {
  it("α22: features/accounting/ledger.service.ts physically deleted (shim retired — consumer on hex factory)", () => {
    expect(existsSync(LEGACY_LEDGER_SERVICE)).toBe(false);
  });
});

// α23 — the hex `CreateJournalEntryInput` now carries `sourceType` +
// `aiOriginalText` (B2a step-1 fold — closes the use-case input-contract gap;
// the aggregate + DTO + repo already threaded them).
//   Expected FAIL pre-GREEN: the hex `CreateJournalEntryInput` interface in
//   journals.service.ts has only date/description/periodId/voucherTypeId/
//   createdById/contactId/referenceNumber/lines — no AI-origin fields.
describe("α23 Block C5 — hex CreateJournalEntryInput carries sourceType + aiOriginalText", () => {
  // Slice from the interface keyword to its closing brace — robust against
  // inline JSDoc comments between the fields.
  function createInputInterface(): string {
    const src = readFileSync(HEX_JOURNALS_SERVICE, "utf-8");
    const start = src.indexOf("interface CreateJournalEntryInput");
    const end = src.indexOf("}", start);
    return src.slice(start, end + 1);
  }
  it("α23: journals.service.ts CreateJournalEntryInput declares `sourceType`", () => {
    expect(createInputInterface()).toMatch(/^\s*sourceType\?:/m);
  });
  it("α23: journals.service.ts CreateJournalEntryInput declares `aiOriginalText`", () => {
    expect(createInputInterface()).toMatch(/^\s*aiOriginalText\?:/m);
  });
  it("α23: validateAndCreateDraft forwards sourceType + aiOriginalText to Journal.create", () => {
    const src = readFileSync(HEX_JOURNALS_SERVICE, "utf-8");
    const fn = src.slice(src.indexOf("validateAndCreateDraft"));
    expect(fn).toMatch(/sourceType:\s*input\.sourceType/);
    expect(fn).toMatch(/aiOriginalText:\s*input\.aiOriginalText/);
  });
});

// α24 — INVERTED at sub-POC 8/8 C4. α24 previously asserted the shim
// `createEntry` re-hydration path (`hex.createEntry()` then `hex.getById()`)
// inside `journal.service.ts`; with the shim DELETED that anchor is obsolete
// — the re-hydration logic never existed in the hex itself (the shim added it
// to bridge the aggregate→DTO gap for the legacy barrel surface; the repointed
// `app/` consumers consume the `Journal` aggregate directly via `.toSnapshot()`
// per C2). α24 is re-purposed to the third retiring file: the thin
// `accounting.validation.ts` re-export shim. It was an `export *` pass-through
// to the hex `presentation/validation.ts` (sub-POC 7 C4 merged the 8
// journal/ledger zod schemas there). C4 deletes it and the barrel drops the
// `export * from "./accounting.validation"` re-export (see α27). NOTE: this
// re-purposing diverges from the C4 task plan, which referenced α23 for the
// "accounting.validation deleted" assertion — α23 is occupied by the
// sourceType/aiOriginalText hex-input-contract sentinel (sub-POC 7 C5, still
// TRUE post-C4) and MUST NOT be touched; α24 is the honest home for the third
// file's deletion sentinel.
//   Expected FAIL pre-GREEN: accounting.validation.ts still EXISTS (the
//   re-export shim) → existsSync === true → toBe(false) FAILS.
describe("α24 Block C4 (sub-POC 8) — legacy accounting.validation.ts re-export shim DELETED", () => {
  it("α24: features/accounting/accounting.validation.ts physically deleted (re-export shim retired — schemas live in hex presentation/validation.ts)", () => {
    expect(existsSync(LEGACY_ACCOUNTING_VALIDATION)).toBe(false);
  });
});

// α25 — the 5 orphaned legacy test files are deleted as B2a test-cementación.
// They construct `new JournalService(mockRepo, ...)` and assert the legacy
// class's INTERNAL impl logic — once the class is a shim that logic lives in
// the hex, where the equivalent behavior is already covered (see the
// coverage-disposition table; 3 assertions ported to the hex test).
//   Expected FAIL pre-GREEN: all 5 files still exist under
//   features/accounting/__tests__/.
describe("α25 Block C5 — orphaned legacy JournalService test suites removed (test-cementación)", () => {
  const orphanedLegacyTests = [
    "journal.service.void-guard.test.ts",
    "journal.service.audit.test.ts",
    "journal.service.locked-edit.test.ts",
    "journal.service.exportVoucherPdf.test.ts",
    "journal-canpost-async.test.ts",
  ] as const;
  for (const file of orphanedLegacyTests) {
    it(`α25: features/accounting/__tests__/${file} deleted`, () => {
      expect(existsSync(resolve(LEGACY_ACCOUNTING_TESTS_DIR, file))).toBe(false);
    });
  }
});

// α26 — journal.repository.ts DELETED (poc-payment-journal-repo-cutover —
//   OLEADA 7 POC #1/2). Adapter `legacy-accounting.adapter.ts` repointed to
//   hex `prisma-journal-entries.repo`; barrel `server.ts` dropped re-export;
//   3 mocked-Prisma tests moved to hex `__tests__/`. α04a + α04b retired
//   atomically (file-content snapshot anchors on now-deleted legacy file —
//   hex-side α04c + α04d retain the snapshot anchor). Spec #2435 · Design #2436.
describe("α26 Block C5 — journal.repository.ts DELETED", () => {
  it("α26: features/accounting/journal.repository.ts DELETED (payment-adapter repointed to hex)", () => {
    expect(existsSync(LEGACY_JOURNAL_REPO)).toBe(false);
  });
});

// ADAPTER-IMPORT-HEX — payment-adapter consumes JournalRepository from the hex
//   path post-cutover. Mirrors α01 `^...m` import-anchor regex convention
//   (line 100-108) per [[red_regex_discipline]]. Spec R-01 · Design #2436.
describe("ADAPTER-IMPORT-HEX Block C5 — legacy-accounting.adapter.ts imports JournalRepository from hex path", () => {
  const LEGACY_ACCOUNTING_ADAPTER = resolve(
    REPO_ROOT,
    "modules/payment/infrastructure/adapters/legacy-accounting.adapter.ts",
  );
  it("ADAPTER-IMPORT-HEX: legacy-accounting.adapter.ts imports JournalRepository from prisma-journal-entries.repo", () => {
    const src = readFileSync(LEGACY_ACCOUNTING_ADAPTER, "utf-8");
    expect(src).toMatch(
      /^import[^;]+JournalRepository[^;]+prisma-journal-entries\.repo/m,
    );
  });
});

// ── Block C0 (sub-POC 8) — accounting pages repoint to hex factory ──────────
//
// C0 is the first cycle of poc-accounting-shim-retirement (OLEADA 6 sub-POC
// 8/8). The 4 `app/.../accounting/**/*.tsx` pages that call `new
// JournalService()` must be repointed to `makeJournalsService()` from the hex
// `@/modules/accounting/presentation/server` surface. After GREEN:
//   - No page in the 4-page scope imports `JournalService` from the features barrel.
//   - All 4 pages import `makeJournalsService` from the hex barrel.
//   - All 4 sibling test files' `vi.mock` targets rewrite to the hex path
//     (bundled atomically per [[cross_module_boundary_mock_target_rewrite]]).

const ACCOUNTING_PAGES = [
  {
    label: "accounting/page.tsx",
    path: resolve(REPO_ROOT, "app/(dashboard)/[orgSlug]/accounting/page.tsx"),
  },
  {
    label: "accounting/journal/page.tsx",
    path: resolve(
      REPO_ROOT,
      "app/(dashboard)/[orgSlug]/accounting/journal/page.tsx",
    ),
  },
  {
    label: "accounting/journal/[entryId]/page.tsx",
    path: resolve(
      REPO_ROOT,
      "app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/page.tsx",
    ),
  },
  {
    label: "accounting/journal/[entryId]/edit/page.tsx",
    path: resolve(
      REPO_ROOT,
      "app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/edit/page.tsx",
    ),
  },
] as const;

// α28 — none of the 4 accounting pages imports `JournalService` from the
//   features barrel.
//   Expected FAIL pre-GREEN: all 4 pages still import `JournalService` from
//   `@/features/accounting/server` → grep finds 4 offenders.
describe("α28 Block C0 (sub-POC 8) — 4 accounting pages no longer import JournalService from features barrel", () => {
  const LEGACY_JOURNAL_SERVICE_IMPORT =
    /from\s+["']@\/features\/accounting\/server["'][\s\S]*?JournalService|JournalService[\s\S]*?from\s+["']@\/features\/accounting\/server["']/;
  it("α28: no accounting page imports JournalService from @/features/accounting/server", () => {
    const offenders = ACCOUNTING_PAGES.filter(({ path }) =>
      LEGACY_JOURNAL_SERVICE_IMPORT.test(readFileSync(path, "utf-8")),
    );
    expect(offenders.map((o) => o.label)).toEqual([]);
  });
});

// α29 — all 4 accounting pages import `makeJournalsService` from the hex
//   barrel `@/modules/accounting/presentation/server`.
//   Expected FAIL pre-GREEN: none of the 4 pages import `makeJournalsService`
//   from the hex path → grep finds 0 matches per page.
describe("α29 Block C0 (sub-POC 8) — 4 accounting pages import makeJournalsService from hex barrel", () => {
  const HEX_FACTORY_IMPORT =
    /from\s+["']@\/modules\/accounting\/presentation\/server["']/;
  const MAKE_JOURNALS_SERVICE_TOKEN = /\bmakeJournalsService\b/;
  it("α29: all 4 accounting pages import makeJournalsService from @/modules/accounting/presentation/server", () => {
    const missing = ACCOUNTING_PAGES.filter(({ path }) => {
      const src = readFileSync(path, "utf-8");
      return !(
        HEX_FACTORY_IMPORT.test(src) && MAKE_JOURNALS_SERVICE_TOKEN.test(src)
      );
    });
    expect(missing.map((o) => o.label)).toEqual([]);
  });
});

// α30 — mock-target rewrite: the 4 sibling test files' `vi.mock` call for the
//   accounting barrel must point at the hex path, not the features barrel.
//   Expected FAIL pre-GREEN: vi.mock targets still point at
//   `@/features/accounting/server` → grep finds 4 offenders.
const ACCOUNTING_PAGE_TESTS = [
  {
    label: "journal/__tests__/page.test.ts",
    path: resolve(
      REPO_ROOT,
      "app/(dashboard)/[orgSlug]/accounting/journal/__tests__/page.test.ts",
    ),
  },
  {
    label: "journal/[entryId]/edit/__tests__/page.test.ts",
    path: resolve(
      REPO_ROOT,
      "app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/edit/__tests__/page.test.ts",
    ),
  },
  {
    label: "journal/[entryId]/__tests__/page-rbac.test.ts",
    path: resolve(
      REPO_ROOT,
      "app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/__tests__/page-rbac.test.ts",
    ),
  },
  {
    label: "journal/[entryId]/edit/__tests__/page-rbac.test.ts",
    path: resolve(
      REPO_ROOT,
      "app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/edit/__tests__/page-rbac.test.ts",
    ),
  },
] as const;

describe("α30 Block C0 (sub-POC 8) — page test files vi.mock target rewritten to hex path", () => {
  const LEGACY_MOCK_TARGET =
    /vi\.mock\s*\(\s*["']@\/features\/accounting\/server["']/;
  it("α30: no page test file vi.mocks @/features/accounting/server", () => {
    const offenders = ACCOUNTING_PAGE_TESTS.filter(({ path }) =>
      LEGACY_MOCK_TARGET.test(readFileSync(path, "utf-8")),
    );
    expect(offenders.map((o) => o.label)).toEqual([]);
  });
});

// α27 — INVERTED at sub-POC 8/8 C4. The `features/accounting/server.ts` barrel
// is SLIMMED in the same C4 GREEN that deletes the three shim files: it drops
// `export { JournalService } from "./journal.service"`,
// `export { LedgerService } from "./ledger.service"`, and
// `export * from "./accounting.validation"`. The barrel RETAINS everything
// else — `JournalRepository`, `journal.types`, `parseEntryDate`
// (`journal.dates`), `AutoEntryGenerator` / `EntryLineTemplate`,
// `accounting-helpers`, the `document-lifecycle` re-exports (incl.
// `validateLockedEdit` + `TrimPreviewItem` for payment/dispatch/sales
// consumers), and `correlative.utils` — those have live cross-module
// consumers and are NOT in C4 scope.
//   Expected FAIL pre-GREEN: server.ts still re-exports all three (the shims
//   keep the barrel surface byte-stable through C0–C3) → the `.not.toMatch`
//   assertions FAIL.
describe("α27 Block C4 (sub-POC 8) — server.ts barrel slimmed: 3 shim re-exports dropped", () => {
  const BARREL = resolve(REPO_ROOT, "features/accounting/server.ts");
  it("α27: server.ts no longer re-exports JournalService from ./journal.service", () => {
    const src = readFileSync(BARREL, "utf-8");
    expect(src).not.toMatch(/from\s+["']\.\/journal\.service["']/);
  });
  it("α27: server.ts no longer re-exports LedgerService from ./ledger.service", () => {
    const src = readFileSync(BARREL, "utf-8");
    expect(src).not.toMatch(/from\s+["']\.\/ledger\.service["']/);
  });
  it("α27: server.ts no longer re-exports * from ./accounting.validation", () => {
    const src = readFileSync(BARREL, "utf-8");
    expect(src).not.toMatch(/from\s+["']\.\/accounting\.validation["']/);
  });
  // POC #1 OLEADA 7 (poc-payment-journal-repo-cutover) DROPS the
  //   `export { JournalRepository } from "./journal.repository"` re-export
  //   (spec R-02, design #2436). The retention list shrinks by one entry —
  //   journal.types, journal.dates, document-lifecycle, correlative.utils
  //   remain. α26 above asserts the underlying file is DELETED.
  it("α27: server.ts RETAINS the non-shim re-exports (journal.types, journal.dates, document-lifecycle, correlative.utils)", () => {
    const src = readFileSync(BARREL, "utf-8");
    expect(src).toMatch(/from\s+["']\.\/journal\.types["']/);
    expect(src).toMatch(/from\s+["']\.\/journal\.dates["']/);
    expect(src).toMatch(/from\s+["']\.\/correlative\.utils["']/);
    expect(src).toMatch(/document-lifecycle/);
  });
});

// ── Block C1 (sub-POC 8) — journal API routes repoint to hex factory + schemas ─
//
// C1 repoints 5 journal API route files away from `new JournalService()` /
// features-barrel schema imports toward `makeJournalsService()` + schemas from
// the hex `@/modules/accounting/presentation/server` surface. Also adds
// `export * from './validation'` to the hex server.ts so the schema surface
// is accessible from the single hex barrel.
//
// Expected FAIL pre-GREEN (C1 RED):
//   α31: journal routes still import JournalService from @/features/accounting/server → FAILS
//   α32: journal routes + status route still import schemas from @/features/accounting/server → FAILS
//   α33: hex server.ts does not yet re-export validation → FAILS
//   α34: route test files vi.mock targets still point at features barrel or composition-root → FAILS

const JOURNAL_API_ROUTES = [
  {
    label: "journal/route.ts",
    path: resolve(
      REPO_ROOT,
      "app/api/organizations/[orgSlug]/journal/route.ts",
    ),
  },
  {
    label: "journal/[entryId]/route.ts",
    path: resolve(
      REPO_ROOT,
      "app/api/organizations/[orgSlug]/journal/[entryId]/route.ts",
    ),
  },
  {
    label: "journal/last-reference/route.ts",
    path: resolve(
      REPO_ROOT,
      "app/api/organizations/[orgSlug]/journal/last-reference/route.ts",
    ),
  },
  {
    label: "accounting/correlation-audit/route.ts",
    path: resolve(
      REPO_ROOT,
      "app/api/organizations/[orgSlug]/accounting/correlation-audit/route.ts",
    ),
  },
] as const;

const JOURNAL_STATUS_ROUTE = resolve(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/journal/[entryId]/status/route.ts",
);

const HEX_SERVER_PATH = resolve(
  REPO_ROOT,
  "modules/accounting/presentation/server.ts",
);

// α31 — none of the 4 factory-swap routes imports `JournalService` from the
//   features barrel.
//   Expected FAIL pre-GREEN: routes still import JournalService.
describe("α31 Block C1 (sub-POC 8) — journal API routes no longer import JournalService from features barrel", () => {
  const LEGACY_JS_IMPORT =
    /\bJournalService\b[\s\S]*?from\s+["']@\/features\/accounting\/server["']|from\s+["']@\/features\/accounting\/server["'][\s\S]*?\bJournalService\b/;
  it("α31: no journal API route imports JournalService from @/features/accounting/server", () => {
    const offenders = JOURNAL_API_ROUTES.filter(({ path }) =>
      LEGACY_JS_IMPORT.test(readFileSync(path, "utf-8")),
    );
    expect(offenders.map((o) => o.label)).toEqual([]);
  });
});

// α32 — all 5 routes import makeJournalsService (or schema) from the hex barrel.
//   Expected FAIL pre-GREEN: routes still import from features barrel or composition-root only.
describe("α32 Block C1 (sub-POC 8) — journal API routes import from hex barrel @/modules/accounting/presentation/server", () => {
  const HEX_BARREL_IMPORT =
    /from\s+["']@\/modules\/accounting\/presentation\/server["']/;
  it("α32: all 4 factory-swap routes import from hex barrel", () => {
    const missing = JOURNAL_API_ROUTES.filter(({ path }) =>
      !HEX_BARREL_IMPORT.test(readFileSync(path, "utf-8")),
    );
    expect(missing.map((o) => o.label)).toEqual([]);
  });
  it("α32: status/route.ts imports statusTransitionSchema from hex barrel (not features barrel)", () => {
    const src = readFileSync(JOURNAL_STATUS_ROUTE, "utf-8");
    // Must import from hex barrel
    expect(src).toMatch(HEX_BARREL_IMPORT);
    // Must NOT import statusTransitionSchema from features barrel
    expect(src).not.toMatch(
      /statusTransitionSchema[\s\S]*?from\s+["']@\/features\/accounting\/server["']|from\s+["']@\/features\/accounting\/server["'][\s\S]*?statusTransitionSchema/,
    );
  });
});

// α33 — hex server.ts re-exports the validation schemas so that the single
//   `@/modules/accounting/presentation/server` barrel is sufficient.
//   Expected FAIL pre-GREEN: server.ts has no `export * from './validation'`.
describe("α33 Block C1 (sub-POC 8) — hex server.ts re-exports validation schemas", () => {
  it("α33: modules/accounting/presentation/server.ts exports * from validation", () => {
    const src = readFileSync(HEX_SERVER_PATH, "utf-8");
    expect(src).toMatch(/export\s*\*\s*from\s+["']\.\/validation["']/);
  });
  it("α33: hex server.ts surface exports lastReferenceQuerySchema (via validation re-export)", () => {
    const src = readFileSync(HEX_SERVER_PATH, "utf-8");
    // Either directly or via the re-export token
    const exportsValidation = /export\s*\*\s*from\s+["']\.\/validation["']/.test(src);
    expect(exportsValidation).toBe(true);
  });
});

// α34 — route test files vi.mock targets rewritten to hex barrel.
//   Expected FAIL pre-GREEN: test files still vi.mock @/features/accounting/server
//   or @/modules/accounting/presentation/composition-root as the primary barrel.
const JOURNAL_API_ROUTE_TESTS = [
  {
    label: "journal/__tests__/route.create.test.ts",
    path: resolve(
      REPO_ROOT,
      "app/api/organizations/[orgSlug]/journal/__tests__/route.create.test.ts",
    ),
  },
  {
    label: "journal/[entryId]/__tests__/route.update.test.ts",
    path: resolve(
      REPO_ROOT,
      "app/api/organizations/[orgSlug]/journal/[entryId]/__tests__/route.update.test.ts",
    ),
  },
  {
    label: "journal/[entryId]/__tests__/route.pdf.test.ts",
    path: resolve(
      REPO_ROOT,
      "app/api/organizations/[orgSlug]/journal/[entryId]/__tests__/route.pdf.test.ts",
    ),
  },
  {
    label: "journal/[entryId]/status/__tests__/route.void-guard.test.ts",
    path: resolve(
      REPO_ROOT,
      "app/api/organizations/[orgSlug]/journal/[entryId]/status/__tests__/route.void-guard.test.ts",
    ),
  },
] as const;

describe("α34 Block C1 (sub-POC 8) — route test files vi.mock target rewritten to hex barrel", () => {
  const LEGACY_MOCK_TARGET =
    /vi\.mock\s*\(\s*["']@\/features\/accounting\/server["']/;
  it("α34: no journal API route test vi.mocks @/features/accounting/server", () => {
    const offenders = JOURNAL_API_ROUTE_TESTS.filter(({ path }) =>
      LEGACY_MOCK_TARGET.test(readFileSync(path, "utf-8")),
    );
    expect(offenders.map((o) => o.label)).toEqual([]);
  });
});

// ── Block C2 (sub-POC 8) — agent/route.ts repoint + aggregate-shape adaptation ─
//
// C2 is the DELICATE cycle. `app/api/organizations/[orgSlug]/agent/route.ts`
// instantiates `new JournalService()` from the features barrel and, in
// `handleCreateJournalEntryConfirm`, builds the HTTP response as
// `{ ...entry, displayNumber }`. The shim's `createEntry` re-hydrates a plain
// `JournalEntryWithLines` DTO, so the spread works today. The hex
// `makeJournalsService().createEntry()` returns a `Journal` AGGREGATE — a class
// instance whose fields live behind non-enumerable getters over a private
// `props`. Spreading it (`{ ...entry }`) yields an EMPTY object. The
// design-locked adaptation (design #2422 D2) is `{ ...entry.toSnapshot(),
// displayNumber }` — NO `getById()` re-hydration helper. After GREEN:
//   - agent/route.ts imports `makeJournalsService` from the hex barrel.
//   - agent/route.ts imports `parseEntryDate` + `formatCorrelativeNumber` from
//     the hex barrel (re-exported via domain/journal.dates + correlative.utils).
//   - the response data spread uses `.toSnapshot()` (NOT a bare `{ ...entry }`).
//   - the sibling test's `vi.mock` target rewrites to the hex path
//     (bundled atomically per [[cross_module_boundary_mock_target_rewrite]]).

const AGENT_ROUTE = resolve(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/agent/route.ts",
);

// α35 — agent/route.ts no longer imports JournalService from the features
//   barrel and instead imports makeJournalsService from the hex barrel.
//   Expected FAIL pre-GREEN: route still imports `JournalService` from
//   `@/features/accounting/server` → both assertions fail.
describe("α35 Block C2 (sub-POC 8) — agent/route.ts repoints to hex makeJournalsService", () => {
  const LEGACY_JS_IMPORT =
    /\bJournalService\b[\s\S]*?from\s+["']@\/features\/accounting\/server["']|from\s+["']@\/features\/accounting\/server["'][\s\S]*?\bJournalService\b/;
  const HEX_BARREL_IMPORT =
    /from\s+["']@\/modules\/accounting\/presentation\/server["']/;
  it("α35: agent/route.ts does not import JournalService from @/features/accounting/server", () => {
    const src = readFileSync(AGENT_ROUTE, "utf-8");
    expect(LEGACY_JS_IMPORT.test(src)).toBe(false);
  });
  it("α35: agent/route.ts imports makeJournalsService from @/modules/accounting/presentation/server", () => {
    const src = readFileSync(AGENT_ROUTE, "utf-8");
    expect(src).toMatch(HEX_BARREL_IMPORT);
    expect(src).toMatch(/\bmakeJournalsService\b/);
  });
  it("α35: agent/route.ts imports parseEntryDate + formatCorrelativeNumber from the hex barrel", () => {
    const src = readFileSync(AGENT_ROUTE, "utf-8");
    // Neither util may be imported from the legacy features barrel anymore.
    expect(src).not.toMatch(
      /parseEntryDate[\s\S]*?from\s+["']@\/features\/accounting\/server["']|from\s+["']@\/features\/accounting\/server["'][\s\S]*?parseEntryDate/,
    );
    expect(src).not.toMatch(
      /formatCorrelativeNumber[\s\S]*?from\s+["']@\/features\/accounting\/server["']|from\s+["']@\/features\/accounting\/server["'][\s\S]*?formatCorrelativeNumber/,
    );
  });
});

// α36 — the agent/route.ts response data spread adapts the Journal aggregate
//   via `.toSnapshot()` and carries NO bare `{ ...entry }` spread of the
//   aggregate instance.
//   Expected FAIL pre-GREEN: route does `data: { ...entry, displayNumber }`
//   over the raw value — `.toSnapshot()` token is absent in the response build.
describe("α36 Block C2 (sub-POC 8) — agent/route.ts adapts the Journal aggregate via toSnapshot()", () => {
  it("α36: agent/route.ts builds the response data with `...entry.toSnapshot()`", () => {
    const src = readFileSync(AGENT_ROUTE, "utf-8");
    expect(src).toMatch(/\.\.\.\s*entry\.toSnapshot\s*\(\s*\)/);
  });
  it("α36: agent/route.ts does NOT spread the raw aggregate instance (`...entry,`)", () => {
    const src = readFileSync(AGENT_ROUTE, "utf-8");
    // A bare `{ ...entry, displayNumber }` over the class instance yields an
    // empty object — the C2 break. Post-GREEN it must be `...entry.toSnapshot()`.
    expect(src).not.toMatch(/\{\s*\.\.\.\s*entry\s*,/);
  });
});

// α37 — the agent route sibling test's `vi.mock` target rewrites to the hex
//   barrel (bundled atomically with the C2 GREEN repoint).
//   Expected FAIL pre-GREEN: route.confirm-journal-entry.test.ts still
//   `vi.mock`s `@/features/accounting/server`.
describe("α37 Block C2 (sub-POC 8) — agent route test vi.mock target rewritten to hex barrel", () => {
  const AGENT_CONFIRM_TEST = resolve(
    REPO_ROOT,
    "app/api/organizations/[orgSlug]/agent/__tests__/route.confirm-journal-entry.test.ts",
  );
  const LEGACY_MOCK_TARGET =
    /vi\.mock\s*\(\s*["']@\/features\/accounting\/server["']/;
  it("α37: route.confirm-journal-entry.test.ts does not vi.mock @/features/accounting/server", () => {
    const src = readFileSync(AGENT_CONFIRM_TEST, "utf-8");
    expect(LEGACY_MOCK_TARGET.test(src)).toBe(false);
  });
});

// ── Block C3 (sub-POC 8/8) — ledger/route.ts repoints to hex ─────────────────
//
// After GREEN C3:
//   - ledger/route.ts imports `makeLedgerService` from the hex barrel.
//   - ledger/route.ts imports `dateRangeSchema` from the hex barrel.
//   - No `vi.mock` rewrite needed — ledger/route.ts has no sibling test file.
//
// Expected FAIL pre-GREEN:
//   - α38a: route still imports `LedgerService` from `@/features/accounting/server`
//     → LEGACY_LS_IMPORT regex matches → toBe(false) FAILS.
//   - α38b: route does not yet import `makeLedgerService` from the hex barrel
//     → HEX_BARREL_IMPORT does not match → toMatch FAILS.
//   - α38c: route still imports `dateRangeSchema` from the legacy features barrel
//     → LEGACY_DATE_RANGE_IMPORT matches → toBe(false) FAILS.

const LEDGER_ROUTE = resolve(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/ledger/route.ts",
);

describe("α38 Block C3 (sub-POC 8) — ledger/route.ts repoints to hex makeLedgerService + dateRangeSchema", () => {
  const LEGACY_LS_IMPORT =
    /\bLedgerService\b[\s\S]*?from\s+["']@\/features\/accounting\/server["']|from\s+["']@\/features\/accounting\/server["'][\s\S]*?\bLedgerService\b/;
  const HEX_BARREL_IMPORT =
    /from\s+["']@\/modules\/accounting\/presentation\/server["']/;
  const LEGACY_DATE_RANGE_IMPORT =
    /\bdateRangeSchema\b[\s\S]*?from\s+["']@\/features\/accounting\/server["']|from\s+["']@\/features\/accounting\/server["'][\s\S]*?\bdateRangeSchema\b/;

  it("α38a: ledger/route.ts does not import LedgerService from @/features/accounting/server", () => {
    const src = readFileSync(LEDGER_ROUTE, "utf-8");
    expect(LEGACY_LS_IMPORT.test(src)).toBe(false);
  });
  it("α38b: ledger/route.ts imports makeLedgerService from @/modules/accounting/presentation/server", () => {
    const src = readFileSync(LEDGER_ROUTE, "utf-8");
    expect(src).toMatch(HEX_BARREL_IMPORT);
    expect(src).toMatch(/\bmakeLedgerService\b/);
  });
  it("α38c: ledger/route.ts does not import dateRangeSchema from @/features/accounting/server", () => {
    const src = readFileSync(LEDGER_ROUTE, "utf-8");
    expect(LEGACY_DATE_RANGE_IMPORT.test(src)).toBe(false);
  });
});
