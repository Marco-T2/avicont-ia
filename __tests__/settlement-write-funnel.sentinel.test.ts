/**
 * α-sentinel: settlement WRITE FUNNEL (unified-comprobante-source-of-truth,
 * D1/D2 — Phase 6 cementación).
 *
 * THE INVARIANT
 *   No Receivable/Payable status write may bypass `syncJournalEntrySettlement`.
 *   Every mutation of `accountsReceivable` / `accountsPayable` rows funnels
 *   through EXACTLY two repositories, and inside those repositories every
 *   write-method stamps the linked JournalEntry's `paymentStatus` (+ dueDate
 *   where applicable) in the same client/tx. A write anywhere else — or an
 *   unpaired write inside the repos — silently de-synchronizes
 *   JE.paymentStatus from the aux row (settlement drift, the exact defect
 *   class H2 closed).
 *
 * TWO CHECKS
 *   1. PROJECT-SCAN (funnel): walk `modules/`, `app/`, `lib/` and flag
 *      a) delegate writes `accountsReceivable|accountsPayable .create/
 *         createMany/update/updateMany/upsert(` outside the explicit
 *         ALLOWLISTED_WRITE_FILES below;
 *      b) nested relation WRITES `receivables:`/`payables:` followed by a
 *         Prisma write operation (create/update/upsert/connect/set/delete…)
 *         anywhere — the repos themselves must use delegate writes, never
 *         nested ones (`{ some: … }` filters are reads and do not match);
 *      c) raw SQL: any file whose source contains `$executeRaw`/`$queryRaw`
 *         (incl. Unsafe variants) AND mentions the aux tables
 *         (accounts_receivable / accountsReceivable, payable analogues).
 *         File-level co-occurrence is deliberately CONSERVATIVE: raw SQL
 *         templates are multi-line and may arrive via variables, so pairing
 *         the call token with the table name at file granularity cannot
 *         under-match. Verified clean today — a false RED names the file and
 *         is triaged by a human, a silent MISS is not.
 *   2. INTRA-FILE PAIRING: inside each allowlisted repository, every method
 *      containing an aux-table write must also call
 *      `this.syncJournalEntrySettlement(` in the same method body
 *      (6 write-methods per repo today: save, update, createTx, voidTx,
 *      applyAllocationTx, revertAllocationTx).
 *
 * EXCEPTIONS
 *   - Test files (`__tests__`, `__mocks__`, *.test/spec/fixtures) are exempt:
 *     integration suites legitimately seed, mutate and clean aux rows to
 *     simulate states (precedent: cross-module-infrastructure sentinel,
 *     exception 3 / feature-boundaries.test.ts:171-180).
 *   - The two repositories are the EXPLICIT allowlist — any new write site
 *     must either move into them or extend this list consciously, in review.
 *
 * HAZARDS AVOIDED
 *   - NEVER COMMENT-STRIP with a span-based stripper (see
 *     cross-module-infrastructure.sentinel.test.ts:69-74 — a `/*` inside a
 *     string literal deletes an arbitrary span and the sentinel passes over a
 *     hole). This file only BLANKS whole lines whose trimmed form starts with
 *     a comment marker — a line-local operation that cannot delete code.
 *   - Per [[sentinel_regex_line_bound]] no regex here uses a paren-class
 *     (`[^)]*`); within-line spans are `[^\n]*` and structural whitespace is
 *     `\s*` (bounded by literal anchors, not greedy any-char classes).
 *
 * Declared failure mode: BORN-GREEN by design — this is a cementación
 * sentinel pinning an invariant already implemented (P3/P4/P5). RED-ability
 * proven by mandatory mutation-check at ship time:
 *   (a) stray `accountsReceivable.update(…)` added in a non-repo file →
 *       PROJECT-SCAN RED naming that file; reverted.
 *   (b) `syncJournalEntrySettlement` call renamed inside one repo
 *       write-method → INTRA-FILE PAIRING RED naming the method; reverted.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..");

/** Roots walked by the project scan. */
const SCAN_ROOTS = ["modules", "app", "lib"] as const;

/** Directories never walked — vendored, generated, or build output. */
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "coverage",
  "dist",
  "build",
  ".turbo",
  ".vercel",
]);

/**
 * The ONLY files allowed to issue delegate writes against the aux tables.
 * Explicit so a violation's failure output names both the offender and the
 * two legitimate homes. Do NOT add entries to make a new write pass — route
 * the write through these repositories instead (that is the invariant).
 */
const ALLOWLISTED_WRITE_FILES: ReadonlyArray<string> = [
  "modules/receivables/infrastructure/prisma-receivables.repository.ts",
  "modules/payables/infrastructure/prisma-payables.repository.ts",
];

/** Delegate write on either aux table. `\s*` tolerates prettier line-wraps. */
const AUX_DELEGATE_WRITE_RE =
  /\b(?:accountsReceivable|accountsPayable)\s*\.\s*(?:create|createMany|update|updateMany|upsert)\s*\(/g;

/**
 * `receivables:`/`payables:` object head — the FIRST inner key decides
 * whether it is a write (nested write op) or a read (`some`/`none`/`every`
 * filter, `select`/`include` projection). Computed then filtered, so read
 * shapes can never false-positive.
 */
const NESTED_RELATION_HEAD_RE =
  /\b(?:receivables|payables)\s*:\s*\{\s*([A-Za-z_$][\w$]*)\s*:/g;

const NESTED_WRITE_OPS = new Set([
  "create",
  "createMany",
  "update",
  "updateMany",
  "upsert",
  "connect",
  "connectOrCreate",
  "disconnect",
  "set",
  "delete",
  "deleteMany",
]);

const RAW_SQL_CALL_RE =
  /\$(?:executeRaw|queryRaw|executeRawUnsafe|queryRawUnsafe)\b/;

/** Aux tables in either identifier convention (Prisma model or pg table). */
const AUX_TABLE_MENTION_RE = /accounts_?receivable|accounts_?payable/i;

const SYNC_CALL_RE = /\bthis\s*\.\s*syncJournalEntrySettlement\s*\(/;

/** Write-methods each repository must pair today (vacuity floor). */
const MIN_WRITE_METHODS_PER_REPO = 6;

/**
 * Mirrors `__tests__/feature-boundaries.test.ts:171-180` and the
 * cross-module sentinel so all sentinels agree on what "a test file" means.
 */
function isTestFile(relPath: string): boolean {
  const segments = relPath.split(path.sep);
  if (segments.includes("__tests__") || segments.includes("__mocks__")) return true;
  const base = segments[segments.length - 1];
  return /\.(test|spec)\.tsx?$/.test(base) || /\.fixtures?\.tsx?$/.test(base);
}

/**
 * Blank whole comment lines (trimmed form starts with `//`, `*` or `/*`)
 * while PRESERVING line count, so match indices still map to real line
 * numbers. Line-local by construction — cannot delete code spans (see
 * HAZARDS in the header). Trailing same-line comments are NOT stripped:
 * a forbidden pattern there fails loudly instead of hiding.
 */
function blankCommentLines(src: string): string {
  return src
    .split("\n")
    .map((line) => {
      const trimmed = line.trimStart();
      return trimmed.startsWith("//") ||
        trimmed.startsWith("*") ||
        trimmed.startsWith("/*")
        ? ""
        : line;
    })
    .join("\n");
}

function lineOfIndex(src: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) if (src[i] === "\n") line++;
  return line;
}

function listSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      listSourceFiles(path.join(dir, entry.name), acc);
      continue;
    }
    if (entry.isFile() && /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      acc.push(path.join(dir, entry.name));
    }
  }
  return acc;
}

interface ScannedFile {
  readonly rel: string;
  readonly code: string; // comment-blanked source
  readonly lines: string[]; // raw lines, for offender display
}

const scannedFiles: ScannedFile[] = SCAN_ROOTS.flatMap((root) =>
  listSourceFiles(path.join(REPO_ROOT, root)),
)
  .map((abs) => path.relative(REPO_ROOT, abs))
  .filter((rel) => !isTestFile(rel))
  .map((rel) => {
    const raw = readFileSync(path.join(REPO_ROOT, rel), "utf8");
    return { rel, code: blankCommentLines(raw), lines: raw.split("\n") };
  });

function offendersOf(
  file: ScannedFile,
  re: RegExp,
  keep: (match: RegExpExecArray) => boolean = () => true,
): string[] {
  const out: string[] = [];
  re.lastIndex = 0;
  for (let m = re.exec(file.code); m !== null; m = re.exec(file.code)) {
    if (!keep(m)) continue;
    const line = lineOfIndex(file.code, m.index);
    out.push(`${file.rel}:${line}: ${(file.lines[line - 1] ?? "").trim()}`);
  }
  return out;
}

/**
 * Class-body method slices: header = identifier at exactly 2-space indent
 * (optionally `private` / `async`), body = source until the next header.
 * Nested callbacks (e.g. the `atomically` arrow) are indented deeper and
 * stay inside their owning method's slice — exactly what pairing needs.
 */
function methodSlices(code: string): Array<{ name: string; body: string }> {
  const headerRe = /^ {2}(?:private\s+)?(?:async\s+)?([A-Za-z_$][\w$]*)\s*[(<]/gm;
  const headers: Array<{ name: string; index: number }> = [];
  for (let m = headerRe.exec(code); m !== null; m = headerRe.exec(code)) {
    headers.push({ name: m[1], index: m.index });
  }
  return headers.map((h, i) => ({
    name: h.name,
    body: code.slice(h.index, headers[i + 1]?.index ?? code.length),
  }));
}

const repoFiles = ALLOWLISTED_WRITE_FILES.map((rel) => {
  const file = scannedFiles.find((f) => f.rel === rel);
  if (!file) throw new Error(`allowlisted repo file missing from scan: ${rel}`);
  return file;
});

describe("α-sentinel — settlement write funnel (D1/D2)", () => {
  it("scan covers a non-trivial number of non-test source files (smoke)", () => {
    // Guards against a typo in SCAN_ROOTS or the walk silently making the
    // suite vacuous by scanning zero files. The tree has ~850 today.
    expect(scannedFiles.length).toBeGreaterThan(500);
  });

  it("the scanner detects the known writes inside both repositories (smoke)", () => {
    // Stricter vacuity guard: if the write regex or comment-blanking broke,
    // the funnel assertion would pass on an empty set. Each repo has 6
    // write-methods today (save/update/createTx/voidTx/apply/revert).
    for (const file of repoFiles) {
      const writes = offendersOf(file, AUX_DELEGATE_WRITE_RE);
      expect(
        writes.length,
        `${file.rel} should contain detectable aux-table writes`,
      ).toBeGreaterThanOrEqual(MIN_WRITE_METHODS_PER_REPO);
    }
  });

  it("FUNNEL: no accountsReceivable/accountsPayable delegate write outside the 2 repositories", () => {
    const offenders = scannedFiles
      .filter((f) => !ALLOWLISTED_WRITE_FILES.includes(f.rel))
      .flatMap((f) => offendersOf(f, AUX_DELEGATE_WRITE_RE));
    // A non-empty diff here NAMES the offending file:line. Route the write
    // through PrismaReceivablesRepository / PrismaPayablesRepository (which
    // pair it with syncJournalEntrySettlement) — do NOT extend the allowlist.
    expect(offenders).toEqual([]);
  });

  it("FUNNEL: no nested receivables:/payables: relation WRITE anywhere (repos use delegate writes)", () => {
    const offenders = scannedFiles.flatMap((f) =>
      offendersOf(f, NESTED_RELATION_HEAD_RE, (m) => NESTED_WRITE_OPS.has(m[1])),
    );
    expect(offenders).toEqual([]);
  });

  it("FUNNEL: no raw SQL co-located with the aux tables (file-level, conservative)", () => {
    const offenders = scannedFiles
      .filter((f) => RAW_SQL_CALL_RE.test(f.code) && AUX_TABLE_MENTION_RE.test(f.code))
      .map((f) => f.rel);
    expect(offenders).toEqual([]);
  });

  for (const rel of ALLOWLISTED_WRITE_FILES) {
    it(`PAIRING: every write-method in ${path.basename(rel)} calls syncJournalEntrySettlement`, () => {
      const file = repoFiles.find((f) => f.rel === rel)!;
      const writeMethods = methodSlices(file.code).filter((s) => {
        AUX_DELEGATE_WRITE_RE.lastIndex = 0;
        return AUX_DELEGATE_WRITE_RE.test(s.body);
      });
      // Vacuity floor: method slicing gone wrong must fail loudly, not pass
      // an empty pairing check.
      expect(
        writeMethods.map((s) => s.name).length,
        `${rel}: write-method slicing found too few methods`,
      ).toBeGreaterThanOrEqual(MIN_WRITE_METHODS_PER_REPO);

      const unpaired = writeMethods
        .filter((s) => !SYNC_CALL_RE.test(s.body))
        .map((s) => `${rel} :: ${s.name}`);
      expect(unpaired).toEqual([]);
    });
  }
});
