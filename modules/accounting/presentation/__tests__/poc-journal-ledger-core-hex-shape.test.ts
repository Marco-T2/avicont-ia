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
//   This sentinel asserts the float arithmetic STRUCTURALLY on BOTH the
//   legacy source (snapshot anchor, PASS pre-GREEN) and the hex source
//   (parity, FAIL pre-GREEN — file absent).
describe("α13 Block C1 — LedgerService float money-math parity (DEV-1 / R-money)", () => {
  // Legacy snapshot: running-balance float accumulation, captured PRE-fold.
  const LEGACY_RUNNING_BALANCE = `let runningBalance = 0;`;
  const LEGACY_ACCUMULATION = `runningBalance += debit - credit;`;
  const LEGACY_NUMBER_COERCE_DEBIT = `const debit = Number(line.debit);`;
  const LEGACY_NUMBER_COERCE_CREDIT = `const credit = Number(line.credit);`;

  it("α13a: legacy ledger.service.ts still uses float `Number()` running-balance accumulation (snapshot anchor)", () => {
    const src = readFileSync(LEGACY_LEDGER_SERVICE, "utf-8");
    expect(src).toContain(LEGACY_RUNNING_BALANCE);
    expect(src).toContain(LEGACY_ACCUMULATION);
    expect(src).toContain(LEGACY_NUMBER_COERCE_DEBIT);
    expect(src).toContain(LEGACY_NUMBER_COERCE_CREDIT);
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
