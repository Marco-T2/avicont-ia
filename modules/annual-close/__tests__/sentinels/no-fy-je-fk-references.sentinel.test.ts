/**
 * T-26 — CAN-5.6 FK retirement sentinel.
 *
 * REQ refs: CAN-5.6 + REQ-A.9 + REQ-1.1.
 * Cross-ref: spec #2697 CAN-5.6 / design #2696 §Schema + Invariants.
 *
 * Greps `modules/`, `app/`, and `components/` for any surviving reference
 * to the RETIRED FiscalYear FK columns/relations:
 *   - closingEntryId / openingEntryId (columns on fiscal_years)
 *   - closingEntry / openingEntry (Prisma relations on FiscalYear)
 *   - closingForFiscalYear / openingForFiscalYear (inverse Prisma relations
 *     on JournalEntry)
 *
 * Allowed surfaces (excluded from grep):
 *   - prisma/migrations/ — schema-history; the retire-migration itself names them.
 *   - This sentinel file (string literals are the patterns themselves).
 *   - JSDoc + commit-body retirement notes: those are *intentional* historical
 *     references. The sentinel allows lines containing 'RETIRED' or 'retired'
 *     or '@deprecated' (case-insensitive) to whitelist them.
 *
 * Fails if any non-whitelisted match is found in non-excluded files.
 *
 * Status: green at HEAD 787f22bf (CAN-5.6 retire completed in Phase A T-01
 * GREEN edb6a634). This sentinel locks the invariant for future commits.
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";

const ROOT = resolve(__dirname, "../../../..");
const SCAN_ROOTS = ["modules", "app", "components"];
const FORBIDDEN_PATTERNS = [
  /\bclosingEntryId\b/,
  /\bopeningEntryId\b/,
  /\bclosingEntry\b/,
  /\bopeningEntry\b/,
  /\bclosingForFiscalYear\b/,
  /\bopeningForFiscalYear\b/,
];

const SELF_PATH = resolve(
  __dirname,
  "no-fy-je-fk-references.sentinel.test.ts",
);

function listFilesRecursive(dir: string, acc: string[] = []): string[] {
  const entries = readdirSync(dir);
  for (const e of entries) {
    if (e.startsWith(".") || e === "node_modules") continue;
    // Skip __tests__/ subtree — test files legitimately reference retired
    // names to assert retirement (e.g. `expect(snap.closingEntryId).toBeUndefined()`)
    // or to test result-shape backward-compat fields (`result.closingEntryId`,
    // which is an entry-ID alias, NOT the FK column).
    if (e === "__tests__") continue;
    const full = join(dir, e);
    const s = statSync(full);
    if (s.isDirectory()) {
      listFilesRecursive(full, acc);
    } else if (/\.(tsx?|jsx?)$/.test(e)) {
      acc.push(full);
    }
  }
  return acc;
}

function lineIsWhitelisted(line: string): boolean {
  // Allow lines that intentionally reference the retired names:
  // - JSDoc / commit-context / sentinel patterns
  // - The backward-compat AnnualCloseResult fields (asiento #4 / #5 entry IDs,
  //   NOT FK columns — the field names happen to match the retired columns).
  //   Documented via D-2 carve-out. Marker: presence of `string | null` type
  //   annotation, or assignment from `closingEntries.balance/.apertura`, or
  //   test-fixture literal pattern (`"je-cc-..." | "je-ca-..."`).
  return (
    /retired/i.test(line) ||
    /@deprecated/i.test(line) ||
    /sentinel/i.test(line) ||
    /CAN-5\.6/.test(line) ||
    /annual-close-canonical-flow/.test(line) ||
    /Backward-compat/.test(line) ||
    /Preserved-shape/.test(line) ||
    /closingEntries\.(balance|apertura)/.test(line) ||
    /:\s*string \| null/.test(line) ||
    /"je-(cc|ca)-/i.test(line)
  );
}

describe("CAN-5.6 sentinel — no surviving FiscalYear↔JournalEntry FK references", () => {
  it("no production code references the retired FK columns/relations", () => {
    const offenders: string[] = [];
    for (const root of SCAN_ROOTS) {
      const dir = join(ROOT, root);
      const files = listFilesRecursive(dir);
      for (const f of files) {
        if (f === SELF_PATH) continue;
        const rel = f.replace(`${ROOT}${sep}`, "");
        const content = readFileSync(f, "utf8");
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;
          if (lineIsWhitelisted(line)) continue;
          for (const pattern of FORBIDDEN_PATTERNS) {
            if (pattern.test(line)) {
              offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
            }
          }
        }
      }
    }
    if (offenders.length > 0) {
      throw new Error(
        `CAN-5.6 sentinel found ${offenders.length} surviving FK reference(s):\n${offenders.join("\n")}`,
      );
    }
    expect(offenders).toEqual([]);
  });
});
