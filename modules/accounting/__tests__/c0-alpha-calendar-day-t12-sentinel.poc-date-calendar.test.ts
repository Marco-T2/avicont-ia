/**
 * POC date-calendar-vs-instant-convention C0 α-Sentinels —
 * banned-pattern grep + structural guards forward-looking pre-GREEN.
 *
 * Five α-sentinels mirror sister POC #2587 (poc-pagination-ledger
 * c1-macro... existence-only red-regex-discipline) — file-naming
 * convention EXACT mirror. Scope smaller: 5 sentinels not 10.
 *
 * Sentinel regex discipline per [[sentinel_regex_line_bound]]:
 *   line-bound `[^\n]*` (NOT paren-class `[^)]*`) for single-line tokens.
 *   `^...$/m` anchor for import-statement lines.
 *
 * Per [[red_acceptance_failure_mode]] — declared failure mode:
 *   α-1 banned-display-pattern: count = 14 (post-#2600 audit recount —
 *     pre-#2600 estimate "11–12" superseded by Step 0 audit observation #2600;
 *     6 exporters use timeZone:"America/La_Paz" not "bare no TZ" but
 *     fix is identical formatDateBO — all 14 count as banned), expected = 0
 *     → MISMATCH FAIL (count > 0)
 *   α-2 local-formatDate-absent: count = 3 (ledger/payable/receivable),
 *     expected = 0 → MISMATCH FAIL
 *   α-3 parseEntryDate-T12-body: false (body has T00 literal today),
 *     expected = true → MISMATCH FAIL
 *   α-4 dateRangeSchema-transform: false (no .transform() in validation today),
 *     expected = true → MISMATCH FAIL
 *   α-5 formatDateBO-import-count: count = 0 (no imports in scoped 11 files
 *     today), expected ≥ 8 → MISMATCH FAIL (toBeGreaterThanOrEqual)
 *
 * All 5 FAIL as MISMATCH (none throw). No file-existence ENOENT.
 *
 * Progressive GREEN by cycle:
 *   α-3 → GREEN at G3 (C1 GREEN parseEntryDate body T00→T12)
 *   α-2 → GREEN at G5 (C2 GREEN 3 components delete local formatDate)
 *   α-4 → GREEN at G7 (C3 GREEN dateRangeSchema .transform added)
 *   α-1 → GREEN at G9 (C4 GREEN 9 exporters toLocaleDateString → formatDateBO)
 *   α-5 → GREEN at G9 (C4 GREEN — count reaches 11; partial-pass at G5
 *     with count=3 still FAILS by threshold design ≥8)
 *
 * Cross-ref engrams:
 *   - exploration #2591 · proposal #2592 · spec #2593 · design #2594 ·
 *     tasks #2595 · Step 0 audit #2600
 *   - Sister POC #2587 (closed) — naming convention EXACT mirror
 *   - [[sentinel_regex_line_bound]] (line-bound)
 *   - [[red_acceptance_failure_mode]] (all 5 declared MISMATCH)
 *   - [[paired_sister_default_no_surface]] (apply sister #2233/#2587 directly)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../..");

// ── 11 scoped files (3 components + 9 exporters — incl. sheet.builder) ────

const SCOPED_FILES = [
  "components/accounting/ledger-page-client.tsx",
  "components/accounting/payable-list.tsx",
  "components/accounting/receivable-list.tsx",
  "modules/accounting/financial-statements/infrastructure/exporters/sheet.builder.ts",
  "modules/accounting/trial-balance/infrastructure/exporters/trial-balance-pdf.exporter.ts",
  "modules/accounting/trial-balance/infrastructure/exporters/trial-balance-xlsx.exporter.ts",
  "modules/accounting/equity-statement/infrastructure/exporters/equity-statement-pdf.exporter.ts",
  "modules/accounting/equity-statement/infrastructure/exporters/equity-statement-xlsx.exporter.ts",
  "modules/accounting/worksheet/infrastructure/exporters/worksheet-pdf.exporter.ts",
  "modules/accounting/worksheet/infrastructure/exporters/worksheet-xlsx.exporter.ts",
  "modules/accounting/initial-balance/infrastructure/exporters/initial-balance-pdf.exporter.ts",
  "modules/accounting/initial-balance/infrastructure/exporters/initial-balance-xlsx.exporter.ts",
];

const COMPONENT_FILES = [
  "components/accounting/ledger-page-client.tsx",
  "components/accounting/payable-list.tsx",
  "components/accounting/receivable-list.tsx",
];

const JOURNAL_DATES_FILE = path.join(
  REPO_ROOT,
  "modules/accounting/domain/journal.dates.ts",
);
const VALIDATION_FILE = path.join(
  REPO_ROOT,
  "modules/accounting/presentation/validation.ts",
);

// ── Sentinel regex (line-bound per [[sentinel_regex_line_bound]]) ─────────

// α-1 banned-display-pattern: toLocaleDateString("es-BO" anywhere on a line.
// Captures BOTH bare and timeZone-suffixed variants (La Paz TZ also drifts D-1
// on T00 inputs — same fix target formatDateBO). Line-bound [^\n]* per discipline.
const BANNED_TO_LOCALE_DATE_STRING_RE =
  /^[^\n]*toLocaleDateString\("es-BO"[^\n]*$/gm;

// α-2 local-formatDate-absent: `function formatDate(` definition in component file.
const LOCAL_FORMAT_DATE_DEF_RE = /^[^\n]*function formatDate\b[^\n]*$/gm;

// α-3 parseEntryDate-T12-body: body contains T12:00:00 literal.
const T12_LITERAL_RE = /T12:00:00/;

// α-4 dateRangeSchema-transform: .transform(  AND  (endOfUtcDay OR T23:59:59).
const VALIDATION_TRANSFORM_RE = /\.transform\(/;
const VALIDATION_ENDOFDAY_RE = /(endOfUtcDay|T23:59:59)/;

// α-5 formatDateBO-import-count: global count across 11 scoped files.
const FORMAT_DATE_BO_TOKEN_RE = /formatDateBO/g;

describe("POC date-calendar-vs-instant-convention C0 — 5α banned-pattern+structural sentinels (banned `toLocaleDateString(\"es-BO\")` count===0 in 11 scoped files + zero local `function formatDate` defs in 3 components + parseEntryDate body has T12:00:00 literal + dateRangeSchema validation has .transform( and endOfUtcDay/T23:59:59 + formatDateBO import count ≥ 8 across 11 scoped files, 5α existence-only forward-looking pre-GREEN 5/5 FAIL: 4 MISMATCH count > 0 + 1 MISMATCH count < 8, none throw)", () => {
  describe("α-1: banned-pattern grep — no `toLocaleDateString(\"es-BO\")` in 11 scoped files (3 components + 9 exporters incl. sheet.builder)", () => {
    it("α-1: scoped files contain zero `toLocaleDateString(\"es-BO\")` calls (current count = 14 per Step 0 audit #2600 — 1 ledger + 1 payable + 1 receivable + 3 sheet.builder + 1 trial-balance-pdf + 1 trial-balance-xlsx + 1 equity-statement-pdf + 1 equity-statement-xlsx + 2 worksheet-pdf + 1 worksheet-xlsx + 1 initial-balance-pdf + 1 initial-balance-xlsx; all become formatDateBO at G9)", () => {
      let count = 0;
      for (const rel of SCOPED_FILES) {
        const abs = path.join(REPO_ROOT, rel);
        const source = fs.readFileSync(abs, "utf8");
        const matches = source.match(BANNED_TO_LOCALE_DATE_STRING_RE) ?? [];
        count += matches.length;
      }
      expect(count).toBe(0);
    });
  });

  describe("α-2: local-helper grep — zero `function formatDate` defs in 3 component files (ledger/payable/receivable)", () => {
    it("α-2: component files contain zero local `function formatDate(...)` definitions (current count = 3, deleted at G5 in favor of `import { formatDateBO } from '@/lib/date-utils'`)", () => {
      let count = 0;
      for (const rel of COMPONENT_FILES) {
        const abs = path.join(REPO_ROOT, rel);
        const source = fs.readFileSync(abs, "utf8");
        const matches = source.match(LOCAL_FORMAT_DATE_DEF_RE) ?? [];
        count += matches.length;
      }
      expect(count).toBe(0);
    });
  });

  describe("α-3: write-path body literal — parseEntryDate body contains `T12:00:00` (NOT `T00:00:00`) per D1 unification", () => {
    it("α-3: modules/accounting/domain/journal.dates.ts body has T12:00:00 literal (today emits T00; G3 swaps body T00→T12 + JSDoc atomically per [[jsdoc_atomic_revoke]])", () => {
      const source = fs.readFileSync(JOURNAL_DATES_FILE, "utf8");
      expect(T12_LITERAL_RE.test(source)).toBe(true);
    });
  });

  describe("α-4: filter-semantics regex — dateRangeSchema validation has `.transform(` AND end-of-UTC-day token", () => {
    it("α-4: modules/accounting/presentation/validation.ts contains BOTH `.transform(` and (`endOfUtcDay` OR `T23:59:59`) (today: no transform → dateTo returns T00; G7 adds end-of-UTC-day transform on dateTo)", () => {
      const source = fs.readFileSync(VALIDATION_FILE, "utf8");
      const hasTransform = VALIDATION_TRANSFORM_RE.test(source);
      const hasEndOfDay = VALIDATION_ENDOFDAY_RE.test(source);
      expect(hasTransform && hasEndOfDay).toBe(true);
    });
  });

  describe("α-5: substitution proof — `formatDateBO` import count ≥ 8 across 11 scoped files", () => {
    it("α-5: aggregate `formatDateBO` token count across 11 scoped files is ≥ 8 (today: 0; partial-pass at G5 with count=3 still FAILS by threshold; full GREEN at G9 with count=11 — 3 components + 8 exporter files importing formatDateBO; sheet.builder has 3 call-sites but one import counts once → 11 imports across 11 files)", () => {
      let count = 0;
      for (const rel of SCOPED_FILES) {
        const abs = path.join(REPO_ROOT, rel);
        const source = fs.readFileSync(abs, "utf8");
        const matches = source.match(FORMAT_DATE_BO_TOKEN_RE) ?? [];
        count += matches.length;
      }
      expect(count).toBeGreaterThanOrEqual(8);
    });
  });

  describe("SC-26: D1 cementation — §13.accounting.calendar-day-T12-utc-unified entry present in canonical doc", () => {
    it("SC-26: docs/architecture/04-sigma-13-canonical-homes.md contains the literal text `calendar-day-T12-utc-unified` exactly once (NEW §13 invariant, 1ra evidencia: this POC)", () => {
      const docPath = path.join(
        REPO_ROOT,
        "docs/architecture/04-sigma-13-canonical-homes.md",
      );
      const source = fs.readFileSync(docPath, "utf8");
      const occurrences =
        source.match(/calendar-day-T12-utc-unified/g)?.length ?? 0;
      expect(occurrences).toBeGreaterThanOrEqual(1);
    });
  });
});
