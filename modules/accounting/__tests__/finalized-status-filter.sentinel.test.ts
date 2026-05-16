// FIN-1 sentinel — forbids bare 'POSTED' literal filters in
// `modules/**/infrastructure/**`.
//
// Two regexes scan every infrastructure source file (excluding __tests__):
//
//   1. Raw SQL idiom: line-bound per [[sentinel_regex_line_bound]]
//      — uses `[^` + newline + `]` NOT `[^` + close-paren + `]` because raw
//      SQL lines contain nested parens.
//
//   2. Prisma ORM idiom: matches `status: "POSTED"` in `where` clauses.
//
// Exceptions:
//   - Per-line opt-out: any line containing `sentinel-allow:` (any suffix)
//     is skipped. Documented suffixes:
//       * `sentinel-allow:posted-only-write-path` — POSTED→LOCKED cascade
//       * `sentinel-allow:cc-freshness-read`     — annual-close CC freshness
//       * `sentinel-allow:annual-close-out-of-scope` — out-of-scope TODO site
//   - Hard allowlist (entire file skipped): see ALLOWLISTED_FILES below.
//
// Sentinel land order (REQ-4.1): LAST commit after all T-05..T-12 migrations.
// RED-by-construction note: this file is authored AFTER all migrations, so
// on first run it is GREEN (zero offenders). Were it landed pre-migration,
// it would fail listing >= 8 offending paths.
//
// Cross-refs: FIN-1, REQ-1.2, REQ-4.1, [[sentinel_regex_line_bound]],
//             [[named_rule_immutability]], [[red_acceptance_failure_mode]]
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

// __dirname = .../modules/accounting/__tests__ → up 3 hops to repo root.
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const MODULES_DIR = path.join(REPO_ROOT, "modules");

// Files entirely exempt from the sentinel scan (legitimate write-path or
// outside FIN-1 scope by design). Paths relative to REPO_ROOT.
const ALLOWLISTED_FILES: ReadonlyArray<string> = [
  // POSTED→LOCKED cascade write-path — the operation transitions only the
  // not-yet-locked rows; filtering on POSTED alone is REQUIRED.
  "modules/monthly-close/infrastructure/prisma-period-locking-writer.adapter.ts",
];

const RAW_SQL_REGEX = /je\d?\.status\s*=\s*['"]POSTED['"][^\n]*/g;
const PRISMA_WHERE_REGEX = /status\s*:\s*['"]POSTED['"]/g;
const ALLOW_COMMENT_PATTERN = /sentinel-allow:[\w-]+/;

function listInfrastructureTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      out.push(...listInfrastructureTsFiles(full));
    } else if (
      stat.isFile() &&
      full.endsWith(".ts") &&
      full.includes(`${path.sep}infrastructure${path.sep}`) &&
      !full.includes(`${path.sep}__tests__${path.sep}`)
    ) {
      out.push(full);
    }
  }
  return out;
}

function scan(file: string): string[] {
  const rel = path.relative(REPO_ROOT, file);
  if (ALLOWLISTED_FILES.includes(rel)) return [];
  const source = readFileSync(file, "utf8");
  const lines = source.split("\n");
  const offenders: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (ALLOW_COMMENT_PATTERN.test(line)) continue;
    if (RAW_SQL_REGEX.test(line) || PRISMA_WHERE_REGEX.test(line)) {
      offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
    }
    // Reset regex lastIndex (global flag → stateful between test() calls).
    RAW_SQL_REGEX.lastIndex = 0;
    PRISMA_WHERE_REGEX.lastIndex = 0;
  }
  return offenders;
}

describe("FIN-1 sentinel — forbid bare 'POSTED' filters in infrastructure", () => {
  const files = listInfrastructureTsFiles(MODULES_DIR);

  it("scan covers a non-trivial number of infrastructure files (smoke)", () => {
    // Guard against the scan accidentally finding zero files (e.g. typo in
    // the `infrastructure` segment). The repo has dozens of infra adapters.
    expect(files.length).toBeGreaterThan(10);
  });

  it("no infrastructure file contains bare POSTED filter (raw SQL or Prisma ORM)", () => {
    const offenders: string[] = [];
    for (const file of files) {
      offenders.push(...scan(file));
    }
    expect(offenders).toEqual([]);
  });
});
