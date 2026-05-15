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

  it("α04a: legacy journal.repository.ts still declares MAX_CONTENTION_ATTEMPTS = 5 (snapshot anchor)", () => {
    const src = readFileSync(LEGACY_JOURNAL_REPO, "utf-8");
    const m = src.match(/const\s+MAX_CONTENTION_ATTEMPTS\s*=\s*(\d+)/);
    expect(m?.[1]).toBe(String(LEGACY_MAX_CONTENTION));
  });

  it("α04b: legacy journal.repository.ts still declares the journalIncludeLines shape (snapshot anchor)", () => {
    const src = readFileSync(LEGACY_JOURNAL_REPO, "utf-8");
    expect(src).toContain(LEGACY_INCLUDE_LINES_SHAPE);
  });

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

  // α13a — INVERTED at C5 B2a. This was a C1 snapshot anchor asserting the
  // legacy `ledger.service.ts` STILL carried the float `Number()`
  // running-balance accumulation (it did, through C1–C4 — additive cutover).
  // C5 B2a converts `ledger.service.ts` into a thin delegating shim over the
  // hex, so the float math no longer lives in the legacy file — it delegates.
  // The parity anchor moved to α13b (hex source) which is unchanged and still
  // asserts the float arithmetic verbatim. Honest same-file prior-cycle
  // sentinel collision per [[invariant_collision_elevation]] — surfaced and
  // inverted in the C5 GREEN that causes it (cannot ship C5 GREEN with a red
  // suite).
  it("α13a: legacy ledger.service.ts is a shim — no longer carries the float running-balance accumulation (C5 B2a)", () => {
    const src = readFileSync(LEGACY_LEDGER_SERVICE, "utf-8");
    expect(src).not.toContain(LEGACY_ACCUMULATION);
    expect(src).not.toContain(LEGACY_RUNNING_BALANCE);
    // It delegates to the hex LedgerService instead.
    expect(src).toMatch(/makeLedgerService|LedgerService/);
  });

  it("α13b: hex ledger.service.ts preserves the SAME float `Number()` running-balance accumulation post-fold", () => {
    const src = readFileSync(HEX_LEDGER_SERVICE, "utf-8");
    expect(src).toContain(LEGACY_RUNNING_BALANCE);
    expect(src).toContain(LEGACY_ACCUMULATION);
    expect(src).toContain(LEGACY_NUMBER_COERCE_DEBIT);
    expect(src).toContain(LEGACY_NUMBER_COERCE_CREDIT);
  });

  it("α13c: hex ledger.service.ts does NOT converge to Decimal `sumDecimals`/`eq` money invariant (DEV-1 / R-money)", () => {
    const src = readFileSync(HEX_LEDGER_SERVICE, "utf-8");
    // Match a real IMPORT of money.utils or a CALL to sumDecimals( — NOT the
    // tokens appearing inside the DEV-1 / R-money JSDoc prose that documents
    // the deliberate non-convergence.
    expect(src).not.toMatch(
      /from\s+["'][^"']*shared\/domain\/money\.utils["']/,
    );
    expect(src).not.toMatch(/\bsumDecimals\s*\(/);
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

// ── Block C5 — legacy journal/ledger services → thin delegating shims ────────
//
// C5 FINAL scope = Option B2a (Marco-approved after THREE escalations,
// supersedes design #2405's "wholesale-delete"). The C5 PRE-CN re-inventory
// gate surfaced three jointly-unsatisfiable constraints in the literal
// "wholesale-delete" scope (engram `c5-blocker` / `c5-blocker-2` /
// `c5-blocker-3`):
//   #1 — legacy `JournalService`/`LedgerService` are FULL live classes; the
//        `server.ts` barrel re-exports them by name; the hex exposes a
//        `JournalsService` factory with no name+shape-compatible drop-in.
//   #2 — a pure `Journal → JournalEntryWithLines` mapper is impossible (the
//        aggregate carries no joined account/contact/voucherType relations);
//        the hex `CreateJournalEntryInput` dropped `sourceType`/`aiOriginalText`.
//   #3 — shim-ifying the subject orphans ~27 legacy tests coupled to the
//        class's internal impl logic.
// B2a disposition: KEEP `journal.service.ts`/`ledger.service.ts` as thin
// delegating SHIMs over the hex (NOT deleted — barrel + ~10 app/ consumers
// stay, sub-POC 8); fold `sourceType`/`aiOriginalText` into the hex input
// contract; shim `createEntry` = `hex.createEntry()` then `hex.getById()`
// (byte-identical DB write + byte-identical re-hydrated DTO); delete the 5
// orphaned legacy test files as test-cementación (hex `__tests__/` cover the
// behavior — per the coverage-disposition table); KEEP `journal.repository.ts`
// (barrel re-export + live test consumers — blocker-3 Finding C).

const LEGACY_JOURNAL_DUP_IMPL = [
  // Tokens that can ONLY appear if the legacy class still carries its own
  // implementation logic. A thin delegating shim has none of these.
  /\bMath\.round\s*\(/, // balance / money-math cents comparison
  /\bwithAuditTx\s*\(/, // audit-tx orchestration
  /\bvalidateLockedEdit\s*\(/, // LOCKED-edit enforcement
  /\bcanTransition\s*\(/, // status-transition table check
  /\bnew\s+Map<string,\s*Account>\s*\(/, // the account-cache loop
] as const;

// α21 — legacy journal.service.ts EXISTS but is a thin delegating shim over
// the hex (imports `makeJournalsService`/`JournalsService`, carries NO
// duplicated implementation logic, small LOC).
//   Expected FAIL pre-GREEN: journal.service.ts is the FULL legacy class
//   (~661 LOC, contains Math.round / withAuditTx / validateLockedEdit /
//   canTransition / the account-cache Map loop) and imports the legacy
//   JournalRepository, not the hex factory.
describe("α21 Block C5 — legacy journal.service.ts is a thin delegating shim", () => {
  it("α21: journal.service.ts still EXISTS (B2a keeps it — barrel + app/ consumers, sub-POC 8)", () => {
    expect(existsSync(LEGACY_JOURNAL_SERVICE)).toBe(true);
  });
  it("α21: journal.service.ts imports the hex JournalsService surface (makeJournalsService / JournalsService)", () => {
    const src = readFileSync(LEGACY_JOURNAL_SERVICE, "utf-8");
    expect(src).toMatch(
      /\b(makeJournalsService|JournalsService)\b[\s\S]*from\s+["']@\/modules\/accounting\/(presentation\/server|presentation\/composition-root|application\/journals\.service)["']/,
    );
  });
  it("α21: journal.service.ts carries NO duplicated implementation logic", () => {
    const src = readFileSync(LEGACY_JOURNAL_SERVICE, "utf-8");
    for (const dupToken of LEGACY_JOURNAL_DUP_IMPL) {
      expect(src).not.toMatch(dupToken);
    }
  });
  it("α21: journal.service.ts is small (< 200 LOC incl. JSDoc — a shim, not the 661-LOC class)", () => {
    const loc = readFileSync(LEGACY_JOURNAL_SERVICE, "utf-8").split("\n").length;
    expect(loc).toBeLessThan(200);
  });
});

// α22 — legacy ledger.service.ts EXISTS but is a thin delegating shim over the
// hex `makeLedgerService` / `LedgerService` (the hex LedgerService has
// IDENTICAL public method signatures, so the shim is a pure pass-through).
//   Expected FAIL pre-GREEN: ledger.service.ts is the FULL legacy class
//   (~113 LOC, contains the `runningBalance` float accumulation + the
//   `aggregateByAccount` fallback loop) and imports the legacy
//   JournalRepository.
describe("α22 Block C5 — legacy ledger.service.ts is a thin delegating shim", () => {
  it("α22: ledger.service.ts still EXISTS (B2a keeps it — barrel + app/ consumers, sub-POC 8)", () => {
    expect(existsSync(LEGACY_LEDGER_SERVICE)).toBe(true);
  });
  it("α22: ledger.service.ts imports the hex LedgerService surface (makeLedgerService / LedgerService)", () => {
    const src = readFileSync(LEGACY_LEDGER_SERVICE, "utf-8");
    expect(src).toMatch(
      /\b(makeLedgerService|LedgerService)\b[\s\S]*from\s+["']@\/modules\/accounting\/(presentation\/server|presentation\/composition-root|application\/ledger\.service)["']/,
    );
  });
  it("α22: ledger.service.ts carries NO duplicated implementation logic (no runningBalance accumulation)", () => {
    const src = readFileSync(LEGACY_LEDGER_SERVICE, "utf-8");
    expect(src).not.toMatch(/runningBalance\s*\+=/);
    expect(src).not.toMatch(/from\s+["']\.\/journal\.repository["']/);
  });
  it("α22: ledger.service.ts is small (< 90 LOC incl. JSDoc — a shim, not the 113-LOC class)", () => {
    const loc = readFileSync(LEGACY_LEDGER_SERVICE, "utf-8").split("\n").length;
    expect(loc).toBeLessThan(90);
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

// α24 — the shim `createEntry` re-hydrates the full DTO via `getById` after
// the hex `createEntry` persists. A pure `Journal → JournalEntryWithLines`
// mapper is impossible (the aggregate has no joined relations); the
// behavior-preserving equivalent is `hex.createEntry()` then `hex.getById()`
// (byte-identical DB write + byte-identical re-hydrated DTO via the same
// `journalIncludeLines` include).
//   Expected FAIL pre-GREEN: journal.service.ts createEntry is the full
//   legacy implementation — it calls `this.repo.create(...)`, never the hex
//   `getById` re-hydration.
describe("α24 Block C5 — shim createEntry re-hydrates via getById", () => {
  it("α24: journal.service.ts createEntry calls the hex createEntry then getById", () => {
    const src = readFileSync(LEGACY_JOURNAL_SERVICE, "utf-8");
    // Anchor on the METHOD declaration `async createEntry(` — not the first
    // bare "createEntry" token (which appears in the file-level JSDoc).
    const methodStart = src.search(/async\s+createEntry\s*\(/);
    expect(methodStart).toBeGreaterThan(-1);
    const fn = src.slice(methodStart, methodStart + 400);
    expect(fn).toMatch(/\.createEntry\s*\(/);
    expect(fn).toMatch(/\.getById\s*\(/);
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

// α26 — journal.repository.ts is KEPT (blocker-3 Finding C — barrel re-export
// + live test consumers, not genuinely dead; barrel retirement is sub-POC 8).
//   This guards against an over-eager delete; it PASSES pre-GREEN (the file
//   exists today) and MUST keep passing post-GREEN — B2a does not touch it.
describe("α26 Block C5 — journal.repository.ts retained", () => {
  it("α26: features/accounting/journal.repository.ts still EXISTS", () => {
    expect(existsSync(LEGACY_JOURNAL_REPO)).toBe(true);
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

// α27 — the `server.ts` barrel still re-exports `JournalService` /
// `LedgerService` (out-of-scope guard — barrel + ~10 app/ consumers are
// sub-POC 8; the shims keep the barrel surface byte-stable).
//   PASSES pre-GREEN and MUST keep passing post-GREEN.
describe("α27 Block C5 — server.ts barrel surface intact (out-of-scope guard)", () => {
  const BARREL = resolve(REPO_ROOT, "features/accounting/server.ts");
  it("α27: server.ts still re-exports JournalService", () => {
    const src = readFileSync(BARREL, "utf-8");
    expect(src).toMatch(/export\s*\{\s*JournalService\s*\}\s*from\s+["']\.\/journal\.service["']/);
  });
  it("α27: server.ts still re-exports LedgerService", () => {
    const src = readFileSync(BARREL, "utf-8");
    expect(src).toMatch(/export\s*\{\s*LedgerService\s*\}\s*from\s+["']\.\/ledger\.service["']/);
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
