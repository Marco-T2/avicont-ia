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
