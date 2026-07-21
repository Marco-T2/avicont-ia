/**
 * Cross-module infrastructure sentinel.
 *
 * THE RULE
 *   No file under `modules/<A>/` may import `@/modules/<B>/infrastructure/...`
 *   when B !== A. A module's infrastructure is ITS OWN wiring detail. Reaching
 *   into another module's adapters couples two bounded contexts through their
 *   most volatile layer, bypassing the port the consumer should have declared
 *   in its own `domain/`.
 *
 * WHY A SENTINEL AND NOT AN ESLINT RULE
 *   `eslint.config.mjs` exempts `modules/**\/presentation/composition-root.ts`
 *   from R4, and correctly so: the composition root IS the legitimate place to
 *   instantiate concrete infrastructure. But that exemption is TOTAL — inside a
 *   composition root ESLint sees nothing at all, including a module reaching
 *   into a FOREIGN module's infrastructure, which is never legitimate.
 *
 *   Two such leaks (`modules/ai-agent` and `modules/documents` both importing
 *   `@/modules/tags/infrastructure/prisma-tags.repository` directly) were fixed
 *   without the lint count moving at all — 138 before, 138 after — because the
 *   violation was invisible to the linter in BOTH states. Nothing but this file
 *   stops them coming back.
 *
 *   The rule cannot be expressed as `no-restricted-imports`, either. It is
 *   RELATIONAL: whether `@/modules/tags/infrastructure/x` is legal depends on
 *   where the IMPORTING file lives. A static pattern ban on the alias fires on
 *   ~95 sites here, the large majority legitimate (see EXCEPTIONS), and the
 *   gate would be born unusable. Membership has to be computed, so: a test.
 *
 *   Scope is ALL of `modules/**`, not just composition roots. Where ESLint
 *   already covers the ground the sentinel is harmlessly redundant; where
 *   ESLint is blind it is the only guard.
 *
 * MODULE IDENTITY — the load-bearing definition
 *   A module is the FIRST path segment under `modules/`. So
 *   `modules/accounting/worksheet/` and `modules/accounting/shared/` are the
 *   SAME module, `accounting`, and traffic between them is INTRA-module.
 *
 *   This is a deliberate call, not an oversight. `accounting` is a bounded
 *   context that internally decomposes into sub-contexts (trial-balance,
 *   worksheet, equity-statement, financial-statements, initial-balance), and
 *   `accounting/shared/infrastructure/*` exists precisely to serve them —
 *   ~30 call sites do exactly that today. Counting the sub-context as its own
 *   module would recast the intended shape of the context as ~30 violations
 *   and force an allowlist larger than the rule. The context boundary is at
 *   `accounting/`; what happens inside it is accounting's business.
 *
 * EXCEPTIONS — each verified against the tree, not assumed
 *   1. B === "shared" (47 sites). `modules/shared/infrastructure/*` is
 *      SYSTEM-WIDE infrastructure — base.repository, prisma-unit-of-work,
 *      audit-tx. It is shared by construction; consuming it is the design.
 *
 *   2. The importing file lives under `infrastructure/` (20 sites). That is
 *      R3 territory, and R3 is marked enforcement `Review`, NOT lint, by
 *      explicit decision at docs/architecture/03-rules-hard-rules.md:7. This
 *      sentinel respects that decision rather than quietly overriding it.
 *
 *   3. Test files (16 sites). Precedent and rationale are
 *      `__tests__/feature-boundaries.test.ts:171-180`: sentinels and fixtures
 *      legitimately name forbidden specifiers as DATA, and integration tests
 *      wire real adapters on purpose. Those must stay legal.
 *
 *   4. Per-line opt-out: any line containing `sentinel-allow:` (any suffix) is
 *      skipped. No suffix is in use today; document new ones here when added.
 *
 *   5. Hard allowlist, whole import site: ALLOWLISTED_IMPORTS below, one
 *      justification per entry.
 *
 * HAZARDS THIS FILE DELIBERATELY AVOIDS
 *   NEVER COMMENT-STRIP. `stripSourceComments()` is naive about string
 *   literals, so a `/*` inside a glob string opens a phantom block comment
 *   that deletes an arbitrary span — measured at 911 of 2055 chars on
 *   vitest.config.ts — and the assertion then passes over a hole while
 *   reporting GREEN. See feature-boundaries.test.ts:30-59.
 *
 *   ASSERT ON TOKENS, NOT ON TEXT. This file never regexes raw source for an
 *   import. `importSpecifiers()` is a single-pass scanner that tracks line
 *   comments, block comments and string/template literals, and emits a string
 *   literal ONLY when the preceding significant code is `from`, `import`,
 *   `import(` or `require(`. A forbidden path written in PROSE inside a
 *   comment is therefore not a match — a comment is not an import — and it is
 *   also not a place a match can hide. Both properties hold BY CONSTRUCTION.
 *   Three rounds of regex escalation on one assertion is the signal that the
 *   assertion is being made against the wrong text; this one is made against
 *   specifiers.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..");
const MODULES_DIR = path.join(REPO_ROOT, "modules");

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
 * Import sites exempt from the rule. Format: `<relative path>:<specifier>`.
 * Line numbers are deliberately NOT part of the key — an entry must survive an
 * unrelated edit above it, and must NOT survive the import being repointed at
 * a different module.
 *
 * Every entry here is REAL ARCHITECTURAL DEBT, not a rule carve-out: each one
 * is a module wiring another context's concrete adapter instead of declaring a
 * port in its own domain/ and having that context supply an implementation.
 * They are frozen so the count can only go DOWN. Do not add to this list to
 * make a new import pass.
 */
const ALLOWLISTED_IMPORTS: ReadonlyArray<string> = [
  // annual-close reads monthly-close draft documents to block a year-end close
  // while drafts remain. Needs a `DraftDocumentsReader` port in
  // annual-close/domain, implemented by monthly-close.
  "modules/annual-close/presentation/composition-root.ts:@/modules/monthly-close/infrastructure/prisma-draft-documents-reader.adapter",

  // purchase.service reaches for accounting's document-type code constants.
  // This one is ALSO an R2 violation (application/ -> infrastructure/) and is
  // already counted in the ESLint baseline; it is listed here so this sentinel
  // does not double-report a known, separately-tracked offender.
  "modules/purchase/application/purchase.service.ts:@/modules/accounting/shared/infrastructure/document-type-codes",

  // purchase composition root wires accounting/contacts/org-settings adapters
  // directly. Purchase needs its own ports for account lookup, fiscal-period
  // status, journal-entry reads, contact reads and legacy account mapping.
  "modules/purchase/presentation/composition-root.ts:@/modules/accounting/infrastructure/prisma-accounts.repo",
  "modules/purchase/presentation/composition-root.ts:@/modules/accounting/infrastructure/fiscal-periods-read.adapter",
  "modules/purchase/presentation/composition-root.ts:@/modules/accounting/infrastructure/prisma-journal-entries-read.adapter",
  "modules/purchase/presentation/composition-root.ts:@/modules/contacts/infrastructure/prisma-contact.repository",
  "modules/purchase/presentation/composition-root.ts:@/modules/org-settings/infrastructure/legacy-account-lookup.adapter",

  // sale composition root mirrors purchase exactly — same five couplings, same
  // fix. Whatever ports resolve the purchase entries resolve these too.
  "modules/sale/presentation/composition-root.ts:@/modules/accounting/infrastructure/prisma-accounts.repo",
  "modules/sale/presentation/composition-root.ts:@/modules/accounting/infrastructure/fiscal-periods-read.adapter",
  "modules/sale/presentation/composition-root.ts:@/modules/accounting/infrastructure/prisma-journal-entries-read.adapter",
  "modules/sale/presentation/composition-root.ts:@/modules/contacts/infrastructure/prisma-contact.repository",
  "modules/sale/presentation/composition-root.ts:@/modules/org-settings/infrastructure/legacy-account-lookup.adapter",
];

const ALLOW_COMMENT_PATTERN = /sentinel-allow:[\w-]+/;

/** `@/modules/<B>/<rest>` — captures the target module and the rest of path. */
const MODULE_ALIAS = /^@\/modules\/([^/]+)\/(.+)$/;

/** True when any path segment of `rest` is exactly `infrastructure`. */
function targetsInfrastructure(rest: string): boolean {
  return rest.split("/").includes("infrastructure");
}

/**
 * See `__tests__/feature-boundaries.test.ts:171-180` for the rationale — this
 * mirrors it so both sentinels agree on what "a test file" means.
 */
function isTestFile(relPath: string): boolean {
  const segments = relPath.split(path.sep);
  if (segments.includes("__tests__") || segments.includes("__mocks__")) return true;
  const base = segments[segments.length - 1];
  return /\.(test|spec)\.tsx?$/.test(base) || /\.fixtures?\.tsx?$/.test(base);
}

interface Specifier {
  readonly value: string;
  readonly line: number;
}

/**
 * Single-pass scanner returning MODULE SPECIFIERS ONLY.
 *
 * Tracks line comments, block comments, and single/double/template string
 * literals, so nothing inside a comment is ever emitted. A literal is emitted
 * only when the immediately preceding significant code is `from`, `import`,
 * `import(` or `require(` — i.e. only when it is structurally a specifier, not
 * merely a string that looks like a path.
 *
 * Regex-vs-division is not disambiguated: a `/` in code position is treated as
 * a division operator. The consequence is that a regex literal's BODY is
 * scanned as code, so a stray quote or backtick inside one could open a phantom
 * literal. That phantom can only cause a MISS if it swallows a real import
 * statement, and it cannot cause a false RED, because the emitted phantom would
 * not be preceded by an import keyword. Accepted: reaching it requires a regex
 * containing an unpaired quote sitting directly above an import, which no
 * module source here does.
 */
function importSpecifiers(src: string): Specifier[] {
  const out: Specifier[] = [];
  const n = src.length;
  let i = 0;
  let line = 1;
  // Trailing window of significant CODE (comments and literals excluded),
  // capped so the scan stays linear.
  let code = "";
  const pushCode = (ch: string): void => {
    code += ch;
    if (code.length > 200) code = code.slice(-100);
  };

  while (i < n) {
    const c = src[i];
    const d = src[i + 1];

    if (c === "\n") {
      line++;
      i++;
      pushCode(" ");
      continue;
    }
    if (c === "/" && d === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && d === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) {
        if (src[i] === "\n") line++;
        i++;
      }
      i += 2;
      pushCode(" ");
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      const startLine = line;
      let value = "";
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === "\\") {
          value += src[i + 1] ?? "";
          i += 2;
          continue;
        }
        if (src[i] === "\n") {
          line++;
          // Non-template literals cannot span lines; bail so an unterminated
          // quote stays bounded to its own line.
          if (quote !== "`") break;
        }
        value += src[i];
        i++;
      }
      i++;
      const tail = code.replace(/\s+$/, "");
      if (/\bfrom$/.test(tail) || /\bimport$/.test(tail) || /\b(?:import|require)\($/.test(tail)) {
        out.push({ value, line: startLine });
      }
      pushCode(" ");
      continue;
    }

    pushCode(c);
    i++;
  }
  return out;
}

function listModuleSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      listModuleSourceFiles(path.join(dir, entry.name), acc);
      continue;
    }
    if (entry.isFile() && /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      acc.push(path.join(dir, entry.name));
    }
  }
  return acc;
}

function scan(file: string): string[] {
  const rel = path.relative(REPO_ROOT, file);
  const segments = rel.split(path.sep);
  // segments[0] === "modules", segments[1] === owning module.
  const owner = segments[1];
  if (!owner) return [];

  // Exception 3 — test files.
  if (isTestFile(rel)) return [];
  // Exception 2 — R3 territory, enforcement `Review` by explicit decision.
  if (segments.includes("infrastructure")) return [];

  const source = readFileSync(file, "utf8");
  const lines = source.split("\n");
  const offenders: string[] = [];

  for (const spec of importSpecifiers(source)) {
    const match = MODULE_ALIAS.exec(spec.value);
    if (!match) continue;
    const [, target, rest] = match;

    if (target === owner) continue; // intra-module — see MODULE IDENTITY above.
    if (target === "shared") continue; // Exception 1 — system-wide infra.
    if (!targetsInfrastructure(rest)) continue;

    // Exception 4 — per-line opt-out.
    const lineText = lines[spec.line - 1] ?? "";
    if (ALLOW_COMMENT_PATTERN.test(lineText)) continue;
    // Exception 5 — hard allowlist, keyed on path + specifier.
    if (ALLOWLISTED_IMPORTS.includes(`${rel}:${spec.value}`)) continue;

    offenders.push(`${rel}:${spec.line}: ${lineText.trim()}`);
  }
  return offenders;
}

describe("cross-module infrastructure sentinel", () => {
  const files = listModuleSourceFiles(MODULES_DIR);

  it("scan covers a non-trivial number of module source files (smoke)", () => {
    // Guards against a typo in the walk or the `modules` path silently making
    // the whole suite vacuous by scanning zero files. The tree has >1000.
    expect(files.length).toBeGreaterThan(500);
  });

  it("the scanner actually finds imports in the files it walks (smoke)", () => {
    // A stricter vacuity guard than file count: if `importSpecifiers()` were
    // broken and returned nothing, the rule assertion would pass on an empty
    // set while the file count smoke test stayed green.
    const total = files.reduce(
      (sum, file) => sum + importSpecifiers(readFileSync(file, "utf8")).length,
      0,
    );
    expect(total).toBeGreaterThan(1000);
  });

  it("every allowlisted import still exists (allowlist does not rot)", () => {
    // Without this, a stale entry silently pre-authorizes a path that no longer
    // exists, and the allowlist stops reflecting the real debt.
    const live = new Set<string>();
    for (const file of files) {
      const rel = path.relative(REPO_ROOT, file);
      if (isTestFile(rel) || rel.split(path.sep).includes("infrastructure")) continue;
      for (const spec of importSpecifiers(readFileSync(file, "utf8"))) {
        live.add(`${rel}:${spec.value}`);
      }
    }
    const stale = ALLOWLISTED_IMPORTS.filter((entry) => !live.has(entry));
    expect(stale).toEqual([]);
  });

  it("no module imports another module's infrastructure", () => {
    const offenders: string[] = [];
    for (const file of files) {
      offenders.push(...scan(file));
    }
    expect(offenders).toEqual([]);
  });
});
