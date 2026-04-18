/**
 * PR6.2 RED → GREEN — Contract grep: ZERO sync `.parse(` on members-validation
 * schemas anywhere outside __tests__/.
 *
 * Why this test exists:
 *   The PR6.1 factory returns a schema with an async Zod refine. Calling
 *   `.parse(body)` (sync) on such a schema throws at runtime. Therefore any
 *   caller that still uses `.parse()` is a REGRESSION — silent bypass or
 *   runtime 500s depending on the path.
 *
 *   This test scans the two surfaces that the task identifies as the real
 *   validation call sites (route handlers + members service) and asserts no
 *   sync `.parse(` remains. It is the risk-flag mitigation.
 *
 *   If this test fails: fix the offending file to use `await schema.parseAsync(body)`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../..");

const CALL_SITES = [
  "app/api/organizations/[orgSlug]/members/route.ts",
  "app/api/organizations/[orgSlug]/members/[memberId]/route.ts",
  "features/organizations/members.service.ts",
];

/**
 * Match the sync `.parse(` call on any of the members-validation schema names.
 * Does NOT match `.parseAsync(` — that is the intended call.
 */
const BANNED_PATTERNS = [
  /addMemberSchema\.parse\(/,
  /updateRoleSchema\.parse\(/,
  /buildAddMemberSchema\([^)]*\)\.parse\(/,
  /buildUpdateMemberRoleSchema\([^)]*\)\.parse\(/,
];

describe("PR6.2 contract — ZERO sync .parse() on members-validation schemas (prod path)", () => {
  for (const relPath of CALL_SITES) {
    it(`${relPath} uses parseAsync (not sync .parse) on members schemas`, () => {
      const abs = resolve(ROOT, relPath);
      expect(existsSync(abs), `expected to find ${relPath}`).toBe(true);
      const source = readFileSync(abs, "utf8");

      for (const pattern of BANNED_PATTERNS) {
        const match = source.match(pattern);
        expect(
          match,
          `FOUND banned sync .parse on members schema in ${relPath}:\n  pattern: ${pattern}\n  match:   ${match?.[0]}\n\nFIX: change ".parse(body)" → "await schema.parseAsync(body)".`,
        ).toBeNull();
      }
    });
  }
});
