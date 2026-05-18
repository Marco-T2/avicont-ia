import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Cementación 2/4 — LotStatus VO post-collapse shape (D-5).
 *
 * Anchored on REQ-202 (binary lifecycle). Regex-only file shape
 * check; companion to `lot-status.test.ts` (behaviour).
 */
const LOT_STATUS = resolve(__dirname, "..", "lot-status.ts");

function readSrc(): string {
  return readFileSync(LOT_STATUS, "utf-8");
}

describe("LotStatus VO — post-collapse shape (cementación 2/4, D-5)", () => {
  it("LOT_STATUSES is exactly [\"ACTIVE\", \"INACTIVE\"] (REQ-202 binary)", () => {
    const src = readSrc();
    expect(src).toMatch(
      /export const LOT_STATUSES\s*=\s*\[\s*"ACTIVE"\s*,\s*"INACTIVE"\s*\]\s*as const;/,
    );
  });

  it("does NOT mention legacy CLOSED|SOLD literals in the VO file (mapper translates)", () => {
    const src = readSrc();
    expect(src).not.toMatch(/^[^/\n]*"CLOSED"/m);
    expect(src).not.toMatch(/^[^/\n]*"SOLD"/m);
  });

  it("parseLotStatus narrows to ACTIVE|INACTIVE only", () => {
    const src = readSrc();
    expect(src).toMatch(
      /value === "ACTIVE"\s*\|\|\s*value === "INACTIVE"/,
    );
  });

  it("canTransitionLot allows only ACTIVE→INACTIVE", () => {
    const src = readSrc();
    expect(src).toMatch(
      /from === "ACTIVE"\s*&&\s*to === "INACTIVE"/,
    );
  });
});
