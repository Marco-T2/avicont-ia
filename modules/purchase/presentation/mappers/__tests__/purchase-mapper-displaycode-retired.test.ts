/**
 * T4.3 — REQ-DISPLAY-2 wholesale: purchase-to-with-details.mapper drops
 * computeDisplayCode + TYPE_PREFIXES + displayCode field. Mirror sister
 * T4.2 sale-mapper retirement.
 *
 * RED expected failure mode (declared per [[red_acceptance_failure_mode]]):
 *   grep `computeDisplayCode|TYPE_PREFIXES` over the mapper file returns
 *   ZERO; today both exist at purchase-to-with-details.mapper.ts L153-172.
 *
 * GREEN: delete the `TYPE_PREFIXES` Record (L153-160) + function
 *   computeDisplayCode (L162-172) + JSDoc invariant block (L130-152) +
 *   `displayCode?` optional field from ToPurchaseWithDetailsDeps +
 *   `displayCode?: string` from PurchaseWithDetails DTO + fixture cleanup.
 *
 * NOTE: modules/purchase/application/purchase.service.ts L52 also defines
 *   a local TYPE_PREFIXES const used by journalDescription templates — that
 *   retirement ships with T5.2 (bundled with template strip).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..", "..", "..", "..", "..");
const MAPPER = resolve(
  ROOT,
  "modules/purchase/presentation/mappers/purchase-to-with-details.mapper.ts",
);
const DTO = resolve(
  ROOT,
  "modules/purchase/presentation/dto/purchase-with-details.ts",
);

describe("T4.3 — purchase mapper wholesale displayCode helpers retirement (REQ-DISPLAY-2)", () => {
  it("purchase-to-with-details.mapper.ts does NOT export computeDisplayCode | TYPE_PREFIXES", () => {
    const src = readFileSync(MAPPER, "utf8");
    expect(src).not.toMatch(/export\s+(?:const|function)\s+computeDisplayCode\b/);
    expect(src).not.toMatch(/export\s+const\s+TYPE_PREFIXES\b/);
  });

  it("ToPurchaseWithDetailsDeps does NOT declare displayCode field", () => {
    const src = readFileSync(MAPPER, "utf8");
    const m = src.match(/export interface ToPurchaseWithDetailsDeps\s*\{[\s\S]*?\n\}/);
    expect(m).not.toBeNull();
    expect(m![0]).not.toMatch(/\bdisplayCode\b/);
  });

  it("PurchaseWithDetails DTO does NOT declare displayCode field", () => {
    const src = readFileSync(DTO, "utf8");
    const m = src.match(/export interface PurchaseWithDetails[\s\S]*?\n\}/);
    expect(m).not.toBeNull();
    expect(m![0]).not.toMatch(/\bdisplayCode\b/);
  });
});
