/**
 * T4.4a — REQ-DISPLAY-2: dispatch infrastructure helper
 * `modules/dispatch/infrastructure/dispatch-display-code.ts` deleted
 * wholesale. The helper was never imported by the service (service
 * uses an inline duplicate at L62 — retired in T4.4b); the only
 * consumer was the c2-infrastructure-shape POC test (SHAPE-LOCK
 * assertion retired with the helper).
 *
 * RED expected failure mode (declared per [[red_acceptance_failure_mode]]):
 *   `existsSync(...)` FAILS today.
 *
 * GREEN: delete the file + drop the getDisplayCode SHAPE-LOCK assertion
 *   in c2-infrastructure-shape.poc-dispatch-hex.test.ts. Per
 *   [[retirement_reinventory_gate]] classification: SHAPE-LOCK type →
 *   delete assertion or whole file if vacuous. Other 7 SHAPE-LOCK
 *   assertions in the file remain VALID (legacy adapters + Prisma
 *   repo + main mapper) so the file stays.
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..", "..", "..");

describe("T4.4a — dispatch-display-code.ts infrastructure file retirement (REQ-DISPLAY-2)", () => {
  it("modules/dispatch/infrastructure/dispatch-display-code.ts does NOT exist", () => {
    expect(
      existsSync(
        resolve(ROOT, "modules/dispatch/infrastructure/dispatch-display-code.ts"),
      ),
    ).toBe(false);
  });
});
