/**
 * T-27 — CAN-5.2 ccExistsForYear retirement sentinel.
 *
 * REQ refs: CAN-5.2 + REQ-A.8.
 * Cross-ref: spec #2697 REQ-A.8 / design #2696 §Ports retire row.
 *
 * Greps production code (excluding __tests__/) for surviving references to
 * `ccExistsForYear`. Note: `reReadCcExistsForYearTx` on
 * YearAccountingReaderTxPort is RETAINED until Phase J T-30 cleanup —
 * sentinel allows the `reReadCcExistsForYearTx` form (Tx variant) for now,
 * fails only on the bare `ccExistsForYear` pre-TX-reader form.
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";

const ROOT = resolve(__dirname, "../../../..");
const SCAN_ROOTS = ["modules", "app", "components"];
const FORBIDDEN = /(?<!reRead)ccExistsForYear(?!Tx)/g;

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
    /retired/i.test(line) ||
    /@deprecated/i.test(line) ||
    /sentinel/i.test(line) ||
    /CAN-5\.2/.test(line) ||
    /annual-close-canonical-flow/.test(line)
  );
}

describe("CAN-5.2 sentinel — ccExistsForYear retired", () => {
  it("no production code references the pre-TX ccExistsForYear gate", () => {
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
          if (FORBIDDEN.test(line)) {
            offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
          }
          FORBIDDEN.lastIndex = 0;
        }
      }
    }
    if (offenders.length > 0) {
      throw new Error(
        `CAN-5.2 sentinel found ${offenders.length} surviving ccExistsForYear reference(s):\n${offenders.join("\n")}`,
      );
    }
    expect(offenders).toEqual([]);
  });
});
