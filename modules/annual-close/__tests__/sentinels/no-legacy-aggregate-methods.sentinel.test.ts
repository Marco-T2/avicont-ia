/**
 * T-28 — D-6 legacy aggregate methods retirement sentinel.
 *
 * REQ refs: D-6 (proposal) + CAN-5.
 * Cross-ref: spec #2697 / design #2696 §Ports + §Infrastructure retire list.
 *
 * Greps production code (excluding __tests__/) for surviving CALLERS of the
 * retired aggregate methods:
 *   - aggregateBalanceSheetAccountsForCA (Phase E T-17 retired; method
 *     itself stays in port + adapter until Phase J cleanup; this sentinel
 *     ONLY catches NEW CALLERS, not the declarations)
 *   - aggregateResultAccountsByYear (same — only catches callers)
 *
 * Whitelist: declarations marked @deprecated, JSDoc/sentinel mentions, and
 * the lines that define the method (port interface + adapter impl).
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";

const ROOT = resolve(__dirname, "../../../..");
const SCAN_ROOTS = ["modules", "app", "components"];
const FORBIDDEN = [
  /aggregateBalanceSheetAccountsForCA\s*\(/,
  /aggregateResultAccountsByYear\s*\(/,
];

function listFilesRecursive(dir: string, acc: string[] = []): string[] {
  const entries = readdirSync(dir);
  for (const e of entries) {
    if (e.startsWith(".") || e === "node_modules" || e === "__tests__") continue;
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
  return (
    /@deprecated/i.test(line) ||
    /retired/i.test(line) ||
    /sentinel/i.test(line) ||
    /^\s*\*/.test(line) || // JSDoc body line
    /annual-close-canonical-flow/.test(line)
  );
}

describe("D-6 sentinel — legacy aggregate methods retired (no NEW callers)", () => {
  it("no production caller of aggregateBalanceSheetAccountsForCA or aggregateResultAccountsByYear", () => {
    const offenders: string[] = [];
    for (const root of SCAN_ROOTS) {
      const dir = join(ROOT, root);
      const files = listFilesRecursive(dir);
      for (const f of files) {
        const rel = f.replace(`${ROOT}${sep}`, "");
        const lines = readFileSync(f, "utf8").split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;
          if (lineIsWhitelisted(line)) continue;
          // Skip method DECLARATIONS (port interface + adapter impl signatures).
          // A declaration form is `methodName(` followed by typed params, OR
          // `async methodName(` for adapter; whitelist by signature-shape heuristic.
          if (
            /^\s*(async\s+)?(aggregateBalanceSheetAccountsForCA|aggregateResultAccountsByYear)\s*\(/.test(
              line,
            )
          ) {
            continue;
          }
          for (const pattern of FORBIDDEN) {
            if (pattern.test(line)) {
              offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
            }
          }
        }
      }
    }
    if (offenders.length > 0) {
      throw new Error(
        `D-6 sentinel found ${offenders.length} surviving caller(s):\n${offenders.join("\n")}`,
      );
    }
    expect(offenders).toEqual([]);
  });
});
