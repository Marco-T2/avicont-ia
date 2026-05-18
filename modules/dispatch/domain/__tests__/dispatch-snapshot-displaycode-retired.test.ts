/**
 * T4.4c — REQ-DISPLAY-2: dispatch.entity.toSnapshot() drops the
 * `displayCode` field. DispatchSnapshot interface field also removed.
 *
 * RED expected failure mode (declared per [[red_acceptance_failure_mode]]):
 *   grep `displayCode` over dispatch.entity.ts returns ZERO; today the
 *   field exists at L87 (interface) + L386-387 + L394 (computation +
 *   spread in toSnapshot()).
 *
 * GREEN: drop `displayCode: string` from DispatchSnapshot interface
 *   + drop the inline `prefix.padStart`-style construction at L386-387
 *   + drop `displayCode` key from the toSnapshot() return.
 *
 * T2.6 (already shipped) migrated dispatch-form away from
 * `existingDispatch.displayCode` to `sequenceNumber + contact.name`
 * format — so consumer is clean before this cycle runs.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..", "..", "..", "..");
const ENTITY = resolve(ROOT, "modules/dispatch/domain/dispatch.entity.ts");

describe("T4.4c — dispatch.entity displayCode retirement (REQ-DISPLAY-2)", () => {
  it("dispatch.entity.ts does NOT contain displayCode anywhere", () => {
    const src = readFileSync(ENTITY, "utf8");
    expect(src).not.toMatch(/\bdisplayCode\b/);
  });
});
