/**
 * Phase 6.3 RED — legacy `getInitialBalanceFromCA` MUST narrow to MOST-RECENT
 * CA voucher only (breaking semantic change per spec REQ-6.0).
 *
 * Per spec REQ-6.0 scenario "Multiple CAs — legacy method returns most recent
 * CA only" + design rev 2 §9: the legacy method must NOT aggregate across all
 * CAs. The narrowing is implemented via an `ORDER BY je.date DESC LIMIT 1`
 * subquery (or equivalent — IN/EXISTS clause selecting only the most-recent CA).
 *
 * **Test layer**: SQL contract grep — the source of
 * `prisma-initial-balance.repo.ts` MUST contain a narrowing clause in the
 * `getInitialBalanceFromCA` method body. This is a structural test (mirrors
 * the DEC-1 sentinel + W-6 pattern from annual-close). Real SQL behavior is
 * exercised in Phase 8 integration tests + the existing Phase 6.2 contract
 * tests for the year-scoped variant (which already proves the year-filter
 * narrowing works against real Postgres in the E2E phase).
 *
 * Declared failure mode (pre-GREEN):
 *   - Legacy method aggregates across ALL CAs (no narrowing clause). The
 *     regex looking for the narrowing predicate (`ORDER BY je.date DESC LIMIT 1`
 *     OR `(je.date) IN (...most-recent...)` OR `EXISTS ... most-recent` pattern)
 *     does NOT match the legacy body → assertion FAILS.
 *
 * GREEN flips at Phase 6.4 once the legacy SQL is narrowed.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_PATH = resolve(
  __dirname,
  "../infrastructure/prisma-initial-balance.repo.ts",
);

function readMethodBody(src: string, methodName: string): string {
  // Crude single-method extractor: from `async ${methodName}(` to the next
  // `^  }$` (4-space-indent close brace at the class member level — fine
  // because the file is consistently 2-space indented inside the class).
  const startIdx = src.indexOf(`async ${methodName}(`);
  if (startIdx === -1) {
    throw new Error(`Method ${methodName} not found in repo source`);
  }
  // Walk forward to the matching close brace using a brace counter — start
  // from the `{` that opens the function body.
  const openBraceIdx = src.indexOf("{", startIdx);
  let depth = 1;
  let i = openBraceIdx + 1;
  while (i < src.length && depth > 0) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") depth--;
    i++;
  }
  return src.slice(openBraceIdx, i);
}

describe("Phase 6.3 RED — legacy getInitialBalanceFromCA narrowing (REQ-6.0)", () => {
  const src = readFileSync(REPO_PATH, "utf-8");
  const legacyBody = readMethodBody(src, "getInitialBalanceFromCA");

  it("legacy getInitialBalanceFromCA SQL narrows to MOST-RECENT CA only", () => {
    // Accept any of the canonical narrowing shapes:
    //   (a) ORDER BY je.date DESC LIMIT 1 (direct subquery on date)
    //   (b) je.id IN (SELECT ... ORDER BY ... LIMIT 1) (subquery on id)
    //   (c) WHERE je.id = (SELECT ... ORDER BY je.date DESC ... LIMIT 1) (scalar)
    //   (d) WHERE je.date = (SELECT MAX(je2.date) FROM ... vt2.code='CA' ...)
    //       (max-date narrowing — picks the latest CA date, equivalent to
    //        LIMIT 1 when only one CA exists per date)
    const narrowingPatterns: RegExp[] = [
      /ORDER\s+BY\s+je\.date\s+DESC[\s\S]*?LIMIT\s+1/i,
      /je\.id\s*=\s*\(\s*SELECT[\s\S]*?ORDER\s+BY[\s\S]*?LIMIT\s+1/i,
      /je\.id\s+IN\s*\(\s*SELECT[\s\S]*?ORDER\s+BY[\s\S]*?LIMIT\s+1/i,
      /je\.date\s*=\s*\(\s*SELECT\s+MAX\s*\(/i,
    ];
    const matches = narrowingPatterns.some((re) => re.test(legacyBody));
    expect(matches).toBe(true);
  });

  it("legacy method JSDoc documents the breaking-behavior change", () => {
    // Find the JSDoc block immediately preceding `async getInitialBalanceFromCA(`.
    const idx = src.indexOf("async getInitialBalanceFromCA(");
    expect(idx).toBeGreaterThan(-1);
    const preceding = src.slice(Math.max(0, idx - 1500), idx);
    // Accept any of: "most recent", "most-recent", "latest CA", or "MOST RECENT".
    expect(preceding).toMatch(/most[-\s]?recent|latest CA|MOST[-\s]?RECENT/i);
  });
});
