import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Cementación 3/4 — LotService post-collapse shape (D-5).
 *
 * Anchored on REQ-200/201/203/205. Regex-only file shape check;
 * companion to `lot.service.test.ts` (behaviour).
 */
const SVC = resolve(__dirname, "..", "lot.service.ts");

function readSrc(): string {
  return readFileSync(SVC, "utf-8");
}

describe("LotService — post-collapse shape (cementación 3/4, D-5)", () => {
  it("exposes async deactivate(orgId, id, input) — REQ-203, D-4 step 2/3", () => {
    const src = readSrc();
    expect(src).toMatch(/^\s*async deactivate\(\s*$/m);
    expect(src).toMatch(/DeactivateLotServiceInput/);
  });

  it("does NOT declare async listByFarm (REQ-205, T7)", () => {
    const src = readSrc();
    expect(src).not.toMatch(/^\s*async listByFarm\(/m);
  });

  it("does NOT declare async close (REQ-203, D-4 rename)", () => {
    const src = readSrc();
    expect(src).not.toMatch(/^\s*async close\(\s*$/m);
  });

  it("CreateLotServiceInput derived from CreateLotInput minus organizationId (memberId still required via REQ-201)", () => {
    const src = readSrc();
    expect(src).toMatch(
      /CreateLotServiceInput\s*=\s*Omit<CreateLotInput,\s*"organizationId">/,
    );
  });
});
