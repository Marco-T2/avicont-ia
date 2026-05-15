/**
 * POC: poc-dispatch-retirement-into-sales — Cycle C2 RED
 *
 * 3α sentinels asserting the component is moved + renamed from
 * `components/dispatches/dispatch-list.tsx` to
 * `components/sales/transactions-list.tsx` with 3-type source discriminator.
 *
 * Failure modes declared (per [[red_acceptance_failure_mode]]):
 *  α-C2-dispatch-list-absent     dispatch-list.tsx still EXISTS → FAIL ✓
 *  α-C2-transactions-list-exists  transactions-list.tsx does NOT yet exist → FAIL ✓
 *  α-C2-discriminator             transactions-list.tsx is absent so the
 *                                  source-text regex fails → FAIL ✓
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..", "..", "..");

describe("POC dispatch-retirement-into-sales C2 — dispatch-list → transactions-list move/rename (RED)", () => {
  it("α-C2-dispatch-list-absent: components/dispatches/dispatch-list.tsx is deleted/moved", () => {
    expect(
      existsSync(resolve(ROOT, "components/dispatches/dispatch-list.tsx")),
    ).toBe(false);
  });

  it("α-C2-transactions-list-exists: components/sales/transactions-list.tsx exists", () => {
    expect(
      existsSync(resolve(ROOT, "components/sales/transactions-list.tsx")),
    ).toBe(true);
  });

  it("α-C2-discriminator: transactions-list.tsx declares source discriminator (sale|dispatch)", () => {
    const path = resolve(ROOT, "components/sales/transactions-list.tsx");
    if (!existsSync(path)) {
      // sentinel will fail on α-C2-transactions-list-exists; assert as
      // ergonomic dependency
      throw new Error("transactions-list.tsx absent");
    }
    const src = readFileSync(path, "utf8");
    expect(src).toMatch(/source:\s*"sale"/);
    expect(src).toMatch(/source:\s*"dispatch"/);
  });
});
