/**
 * POC nuevo A3-C4a.5 — sale list null guard paired follow-up shape (§13.AC-sale-paged).
 *
 * Axis: paired faithful follow-up A3-C4a sale list cutover. §13.AC-sale-paged
 * latent bug surface — DRAFT sales (sequenceNumber=null) llegan al mapper desde
 * `saleService.list(orgId)` (legacy `sale.repository.ts:92-115 findAll()` NO
 * mandatory status filter — H2 verified). Mapper internal `computeDisplayCode(null)`
 * THROWS at SubQ-d fail-fast invariant cementado A3-C3+C5.5. Production runtime:
 * cualquier render de list page con DRAFT sales crashea. Tests A3-C4a empty
 * fixture (`mockList.mockResolvedValue([])`) + mock anomaly mascararon bug.
 *
 * Resolution Marco lock Q-DRAFT-handling (b) caller inline null guard mirror
 * §13.AC HubService precedent A3-C5 SubQ-β. Implementation (b3): refactor
 * mapper signature `displayCode: string` en ToSaleWithDetailsDeps + remove
 * internal `computeDisplayCode` call línea 203 + caller responsibility con
 * null guard ternary + fallback string `${SALE_PREFIX}-DRAFT`. Pattern
 * reusable cross sale+purchase via SALE_PREFIX export sale mapper +
 * TYPE_PREFIXES export purchase mapper (paired A3-C6a apply desde inicio).
 *
 * SubQ-d fail-fast invariant standalone PRESERVED: `computeDisplayCode` sigue
 * exportado y throws on null cuando caller invoca con null path. Caller
 * responsabilidad null guard absorber throw vía ternary fallback.
 *
 * Mock anomaly absorbed inline GREEN sub-§13 in-flight surface (NO formal):
 * `sales/__tests__/page.test.ts:20` mock `@/features/sale/server` STALE
 * post A3-C4a cutover. Test passes 2/2 isolated pero mascara bug porque
 * data path NO ejerce realmente (RBAC-only paths). GREEN scope expand:
 * replace stale mock con composition-root + Prisma mocks mirror A3-C4b
 * page-rbac precedent (engram #1532 sub-§13).
 *
 * Cross-ref:
 * - A3-C5 §13.AC HubService precedent: engram `poc-nuevo/a3/c5/closed` (#1534)
 * - A3-C4a sale list cutover (latent bug introduction): engram `poc-nuevo/a3/c4a/closed` (#1530)
 * - A3-C4b sale detail (paired follow-up A3-C4b.5 deferred Step 2): engram `poc-nuevo/a3/c4b/closed` (#1532)
 * - SubQ-d fail-fast lock cementación: engram `poc-nuevo/a3/c3/closed` (#1525)
 * - features/sale/sale.repository.ts:92-115 findAll() NO mandatory status filter (H2 source)
 * - features/purchase/purchase.repository.ts:116-136 findAll() identical pattern (H1 verified)
 * - Mapper file: modules/sale/presentation/mappers/sale-to-with-details.mapper.ts
 * - Page file: app/(dashboard)/[orgSlug]/sales/page.tsx
 *
 * Lección #11 PROACTIVE 5ta evidencia: pre-recon detected stale mock pre-RED
 * + DRAFT runtime path coverage absent — pattern matures cross-axis tests.
 *
 * Lección #12 candidate 1ra evidencia formal: "Cutover RED scope debe incluir
 * runtime path coverage (status enums + null branches), NO solo `__tests__`
 * paths (lección #11) ni shape source (lección #10)". Cementación engram
 * post-A3-C4a.5 GREEN ciclo (Marco lock Q-LECCIÓN-#12 (e)).
 *
 * Expected RED failure mode (verify pre-GREEN):
 * - 6 positive FAIL: SALE_PREFIX export + ToSaleWithDetailsDeps.displayCode
 *   field + mapper body uses deps.displayCode + page imports
 *   SALE_PREFIX/computeDisplayCode + page null guard ternary + page template
 *   literal `${SALE_PREFIX}-DRAFT`
 * - 1 negative FAIL: mapper `toSaleWithDetails` body contains
 *   `computeDisplayCode(` call línea 203 currently → assertion expecting
 *   absence FAILS pre-GREEN
 *
 * Total expected RED: 7/7 fail. Post-GREEN: 7/7 pass (+7 net suite delta).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MAPPER_PATH = resolve(
  __dirname,
  "../mappers/sale-to-with-details.mapper.ts",
);
const PAGE_PATH = resolve(
  __dirname,
  "../../../../app/(dashboard)/[orgSlug]/sales/page.tsx",
);

const mapperSource = readFileSync(MAPPER_PATH, "utf-8");
const pageSource = readFileSync(PAGE_PATH, "utf-8");

describe("A3-C4a.5 RED null guard shape — sale list paired §13.AC-sale-paged", () => {
  // ── Mapper changes (positive — 3 assertions) ────────────────────────────────

  it("Test 1: mapper exports SALE_PREFIX const = 'VG'", () => {
    expect(mapperSource).toMatch(/export const SALE_PREFIX\s*=\s*["']VG["']/);
  });

  it("Test 2: ToSaleWithDetailsDeps interface declares displayCode: string field", () => {
    const interfaceMatch = mapperSource.match(
      /export interface ToSaleWithDetailsDeps\s*\{[\s\S]*?\n\}/,
    );
    expect(interfaceMatch).not.toBeNull();
    expect(interfaceMatch![0]).toMatch(/displayCode\s*:\s*string/);
  });

  it("Test 3: mapper toSaleWithDetails body assigns displayCode from deps.displayCode", () => {
    expect(mapperSource).toMatch(/displayCode\s*:\s*deps\.displayCode/);
  });

  // ── Page caller changes (positive — 3 assertions) ──────────────────────────

  it("Test 4: page imports SALE_PREFIX + computeDisplayCode from mapper module", () => {
    expect(pageSource).toMatch(/SALE_PREFIX/);
    expect(pageSource).toMatch(/computeDisplayCode/);
    expect(pageSource).toMatch(
      /from\s+["']@\/modules\/sale\/presentation\/mappers\/sale-to-with-details\.mapper["']/,
    );
  });

  it("Test 5: page contains null guard ternary pattern sequenceNumber !== null o === null", () => {
    expect(pageSource).toMatch(/sequenceNumber\s*(!==|===)\s*null/);
  });

  it("Test 6: page contains template literal `${SALE_PREFIX}-DRAFT` fallback", () => {
    expect(pageSource).toMatch(/\$\{SALE_PREFIX\}-DRAFT/);
  });

  // ── Mapper internal compute removed (negative — 1 assertion) ────────────────

  it("Test 7: mapper toSaleWithDetails body does NOT call internal computeDisplayCode (caller responsibility now)", () => {
    const fnMatch = mapperSource.match(
      /export function toSaleWithDetails\([\s\S]*?\n\}/,
    );
    expect(fnMatch).not.toBeNull();
    expect(fnMatch![0]).not.toMatch(/computeDisplayCode\s*\(/);
  });
});
