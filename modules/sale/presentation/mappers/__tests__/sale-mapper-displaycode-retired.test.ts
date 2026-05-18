/**
 * T4.2 — REQ-DISPLAY-2 wholesale: sale-to-with-details.mapper drops
 * computeDisplayCode + SALE_PREFIX + displayCode field. The mapper
 * itself + DTO + all consumer fixtures must be clean.
 *
 * RED expected failure mode (declared per [[red_acceptance_failure_mode]]):
 *   grep `computeDisplayCode|SALE_PREFIX` over `modules/sale/` returns
 *   ZERO; today both exist at sale-to-with-details.mapper.ts L129-138.
 *   DTO `SaleWithDetails.displayCode?: string` field must be absent.
 *
 * GREEN: delete the const SALE_PREFIX (L129) + function
 *   computeDisplayCode (L131-138) + JSDoc invariant block (L110-128) +
 *   `displayCode?` optional field from ToSaleWithDetailsDeps interface
 *   + `displayCode?: string` from SaleWithDetails DTO + fixture
 *   cleanup in 9 sale-form / sale-mapper test files.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..", "..", "..", "..", "..");
const MAPPER = resolve(
  ROOT,
  "modules/sale/presentation/mappers/sale-to-with-details.mapper.ts",
);
const DTO = resolve(
  ROOT,
  "modules/sale/presentation/dto/sale-with-details.ts",
);

describe("T4.2 — sale mapper wholesale displayCode helpers retirement (REQ-DISPLAY-2)", () => {
  it("sale-to-with-details.mapper.ts does NOT export computeDisplayCode | SALE_PREFIX", () => {
    const src = readFileSync(MAPPER, "utf8");
    expect(src).not.toMatch(/export\s+(?:const|function)\s+computeDisplayCode\b/);
    expect(src).not.toMatch(/export\s+const\s+SALE_PREFIX\b/);
  });

  it("ToSaleWithDetailsDeps does NOT declare displayCode field", () => {
    const src = readFileSync(MAPPER, "utf8");
    // Extract the ToSaleWithDetailsDeps interface and assert no displayCode key
    const m = src.match(/export interface ToSaleWithDetailsDeps\s*\{[\s\S]*?\n\}/);
    expect(m).not.toBeNull();
    expect(m![0]).not.toMatch(/\bdisplayCode\b/);
  });

  it("SaleWithDetails DTO does NOT declare displayCode field", () => {
    const src = readFileSync(DTO, "utf8");
    const m = src.match(/export interface SaleWithDetails[\s\S]*?\n\}/);
    expect(m).not.toBeNull();
    expect(m![0]).not.toMatch(/\bdisplayCode\b/);
  });
});
