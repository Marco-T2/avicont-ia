/**
 * T1.2 — REQ-DISPLAY-2 sentinel: orphan `sale-list.tsx` + its co-located
 * date-format test MUST be deleted.
 *
 * RED expected failure mode (declared per [[red_acceptance_failure_mode]]):
 *   both `existsSync(...)` assertions FAIL because both files currently exist
 *   on disk.
 *
 * GREEN: delete `components/sales/sale-list.tsx` +
 *   `components/sales/__tests__/sale-list-date-format.test.tsx`. Verified
 *   orphan — no production import (grep across app/, components/, features/,
 *   modules/ returns only JSDoc comment references). Cleanup goes in same
 *   commit as the sentinel.
 *
 * This sentinel itself should be deleted after T1.2 GREEN ships (it becomes
 * vacuous — there's nothing left to assert non-existence of meaningfully).
 * Keep it here as a guard against accidental re-introduction during apply.
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..", "..", "..");

describe("T1.2 — orphan sale-list.tsx + date-format test retirement (REQ-DISPLAY-2)", () => {
  it("components/sales/sale-list.tsx does NOT exist", () => {
    expect(existsSync(resolve(ROOT, "components/sales/sale-list.tsx"))).toBe(
      false,
    );
  });

  it("components/sales/__tests__/sale-list-date-format.test.tsx does NOT exist", () => {
    expect(
      existsSync(
        resolve(ROOT, "components/sales/__tests__/sale-list-date-format.test.tsx"),
      ),
    ).toBe(false);
  });
});
