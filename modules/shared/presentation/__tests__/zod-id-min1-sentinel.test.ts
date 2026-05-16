/**
 * ── CANONICAL RULE: ZID-1 (Zod ID validator alignment) ───────────────────
 *
 * As of `poc-zod-id-validators-domain-alignment` archive (HEAD c1c6a62b),
 * the following invariants are CANONICAL for this repo:
 *
 * 1. Presentation-layer Zod validators for ID-shaped fields MUST use
 *    `z.string().min(1, "msg")`. Format-specific validators (`.cuid()`,
 *    `.uuid()`, `.cuid2()`, etc.) are FORBIDDEN on `z.string()` chains
 *    that validate IDs.
 *
 * 2. Domain entities are the SOURCE OF TRUTH for ID format. They generate
 *    IDs via `crypto.randomUUID()` (UUID v4, 36 chars with hyphens).
 *    Presentation MUST stay format-agnostic — accepts CUID (legacy seed),
 *    UUID (current domain), or any future generator the domain adopts.
 *
 * 3. ID format/existence validation happens at the FK boundary (Prisma
 *    lookup) — NOT at the Zod boundary. Trust the domain at presentation,
 *    validate existence downstream.
 *
 * Supersedes (REVOKED named rules):
 *   - α7  (route.confirm-create-expense): "lotId no-cuid → 400" — residual
 *         protection preserved as α7→ZID-1: empty lotId still → 400.
 *   - D5  (lot α13): farmId.cuid() EXACT legacy preservation.
 *   - C3  expense lock (α41, paired-sister of α13): lotId.cuid() EXACT.
 *
 * History preserved inline at the original revocation sites per
 * [[named_rule_immutability]].
 *
 * Enforcement: this sentinel asserts ZERO `.cuid(`/`.uuid(` occurrences on
 * `z.string()` chains in TARGETS (line-bound regex per
 * `feedback_sentinel_regex_line_bound`: `[^\n]*`, NOT `[^)]*`). To add new
 * presentation Zod validation files going forward, ADD THEM to TARGETS so
 * future drift is caught at this gate.
 *
 * Engram pointer: `decision/zid-1-canonical-rule-zod-id-validators`.
 * SDD archive: `sdd/poc-zod-id-validators-domain-alignment/archive-report`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "../../../..");

function readRepo(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), "utf-8");
}

const FORBIDDEN_CUID_RE = /\.\s*cuid\s*\([^\n]*\)/;
const FORBIDDEN_UUID_RE = /\.\s*uuid\s*\([^\n]*\)/;

const TARGETS = [
  // 7 files migrated in the ZID-1 SDD (were using .cuid()):
  "modules/accounting/presentation/validation.ts",
  "modules/ai-agent/domain/validation/agent.validation.ts",
  "modules/payment/presentation/validation.ts",
  "modules/expense/presentation/validation.ts",
  "modules/mortality/presentation/mortality.validation.ts",
  "modules/farm/presentation/validation.ts",
  "modules/lot/presentation/validation.ts",
  // 2 paired-sister precedent files (already aligned pre-SDD — included
  // here so the sentinel guards against REGRESSION, not just migration):
  "modules/sale/presentation/schemas/sale.schemas.ts",
  "modules/purchase/presentation/schemas/purchase.schemas.ts",
] as const;

describe("sentinel: zod id validators use .min(1), not .cuid()/.uuid()", () => {
  for (const target of TARGETS) {
    it(`${target} does NOT use z.string().cuid(...) on id fields`, () => {
      const src = readRepo(target);
      expect(src).not.toMatch(FORBIDDEN_CUID_RE);
    });

    it(`${target} does NOT use z.string().uuid(...) on id fields`, () => {
      const src = readRepo(target);
      expect(src).not.toMatch(FORBIDDEN_UUID_RE);
    });
  }
});
