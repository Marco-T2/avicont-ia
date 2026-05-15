/**
 * Sentinel: presentation-layer Zod ID validators MUST use `z.string().min(1)`
 * and MUST NOT use `.cuid()` or `.uuid()` on id-shaped fields.
 *
 * Rationale: domain entities generate IDs via `crypto.randomUUID()` (UUID v4).
 * Format-specific validators like `.cuid()` reject domain-generated IDs at the
 * presentation boundary, causing "Datos inválidos" 400 responses for records
 * created via the UI path. Sales/purchase already established the
 * format-agnostic precedent (`z.string().min(1, "msg")`) — this sentinel
 * locks that convention across the remaining presentation validation files.
 *
 * Line-bound regex per `feedback_sentinel_regex_line_bound` ([^\n]*, NOT [^)]*).
 *
 * SDD: sdd/poc-zod-id-validators-domain-alignment/spec
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
  "modules/accounting/presentation/validation.ts",
  "modules/ai-agent/domain/validation/agent.validation.ts",
  "modules/payment/presentation/validation.ts",
  "modules/expense/presentation/validation.ts",
  "modules/mortality/presentation/mortality.validation.ts",
  "modules/farm/presentation/validation.ts",
  "modules/lot/presentation/validation.ts",
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
