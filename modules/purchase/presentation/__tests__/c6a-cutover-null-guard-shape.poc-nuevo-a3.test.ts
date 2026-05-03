/**
 * POC nuevo A3-C6a — purchase list cutover + null guard pattern desde inicio shape.
 *
 * Axis: cutover `app/(dashboard)/[orgSlug]/purchases/page.tsx` desde legacy
 * `new PurchaseService()` a hex `makePurchaseService()` + Prisma direct batch
 * lookups contacts+periods + `purchases.map(toPurchaseWithDetails(p, deps))`
 * caller-passes-deps mirror A3-C4a sale list precedent EXACT. Plus aplicar
 * (b3) caller-passes-displayCode null guard pattern desde inicio (mirror
 * A3-C4a.5 sale paired follow-up — purchase aplica directo sin paired follow-up
 * porque mapper recién built A3-C5.5 + cero production callers todavía).
 *
 * Sub-§13.AC-purchase resolution APPLIED (variante 4 después variante 3
 * sale-paged A3-C4a.5+C4b.5 closed): legacy `purchase.repository.ts:116-136
 * findAll()` NO mandatory status filter (H1 verified pre-recon) → DRAFT
 * purchases (sequenceNumber=null) llegan al mapper → mapper post-refactor
 * consume `deps.displayCode` (NO compute internal) → caller responsibility
 * null guard ternary + `${TYPE_PREFIXES[purchaseType]}-DRAFT` fallback
 * polymorphic per purchaseType discriminator (FL/PF/CG/SV asimetría purchase
 * vs sale fixed prefix VG).
 *
 * Combined scope axes (Marco lock single file 12 assertions):
 * 1. Mapper signature refactor (mirror A3-C4a.5 b3): TYPE_PREFIXES export +
 *    ToPurchaseWithDetailsDeps.displayCode field + body deps.displayCode +
 *    body NO internal computeDisplayCode call (atomic JSDoc revoke)
 * 2. Page cutover (mirror A3-C4a): makePurchaseService + toPurchaseWithDetails
 *    + prisma imports + remove new PurchaseService() + future-proof negative
 *    @/features/purchase/server import ABSENT
 * 3. Page null guard (mirror A3-C4a.5): TYPE_PREFIXES + computeDisplayCode
 *    imports + null guard ternary + template literal `${TYPE_PREFIXES[...]}-DRAFT`
 *
 * Sub-§13 in-flight surface expected absorbed inline GREEN (NO formal —
 * engram-only): `app/(dashboard)/[orgSlug]/purchases/__tests__/page.test.ts:20`
 * mock `@/features/purchase/server` STALE post-cutover. GREEN scope expand
 * mirror A3-C4a.5 `sales/__tests__/page.test.ts` mock anomaly absorption
 * pattern (engram poc-nuevo/a3/c4a-5/closed).
 *
 * Cross-ref:
 * - A3-C4a sale list cutover precedent: engram `poc-nuevo/a3/c4a/closed` (#1530)
 * - A3-C4a.5 sale list null guard paired (b3) refactor pattern: engram `poc-nuevo/a3/c4a-5/closed`
 * - A3-C4b.5 sale detail null guard paired compact: engram `poc-nuevo/a3/c4b-5/closed`
 * - A3-C5 §13.AC HubService precedent SubQ-β: engram `poc-nuevo/a3/c5/closed` (#1534)
 * - A3-C5.5 atomic build purchase mapper + §13.W-purchase resolution: engram `poc-nuevo/a3/c5-5/closed` (#1537)
 * - SubQ-d fail-fast lock cementación: engram `poc-nuevo/a3/c3/closed` (#1525)
 * - Mapper file: modules/purchase/presentation/mappers/purchase-to-with-details.mapper.ts
 * - Page file: app/(dashboard)/[orgSlug]/purchases/page.tsx
 * - features/purchase/purchase.repository.ts:116-136 findAll() NO mandatory status filter (H1 source)
 *
 * Lección #11 7ma evidencia maturation: pre-recon comprehensive grep callers
 * + verify mapper unit test existence + page test mocks audit ANTES RED scope
 * lock. NO purchase mapper unit test exists confirmado pre-recon → simplifica
 * scope vs sale precedent.
 *
 * Lección #12 candidate 3ra evidencia formal cumulative reinforcement:
 * "Cutover RED scope debe incluir runtime path coverage (status enums + null
 * branches), NO solo `__tests__` paths (lección #11) ni shape source (lección
 * #10)". Aplicación PROACTIVE A3-C6a desde inicio (NO retroactive paired
 * follow-up) — pattern preventiva validada empirically forward.
 *
 * Expected RED failure mode (verify pre-GREEN):
 * - 8 positive FAIL: mapper TYPE_PREFIXES export + ToPurchaseWithDetailsDeps.displayCode
 *   field + body deps.displayCode + page imports makePurchaseService + page
 *   imports toPurchaseWithDetails + page imports TYPE_PREFIXES/computeDisplayCode
 *   + page imports prisma + page null guard ternary + page template literal
 *   `${TYPE_PREFIXES[...]}-DRAFT`
 * - 2 mapper negative: body NO computeDisplayCode internal call (currently
 *   present línea 249 → assertion fails pre-GREEN)
 * - 2 page negative: NO new PurchaseService() (currently línea 21 present
 *   → fails pre-GREEN) + NO import @/features/purchase/server (currently
 *   línea 3 present → fails pre-GREEN)
 *
 * Total expected RED: 12/12 fail. Post-GREEN: 12/12 pass (+12 net suite delta).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MAPPER_PATH = resolve(
  __dirname,
  "../mappers/purchase-to-with-details.mapper.ts",
);
const PAGE_PATH = resolve(
  __dirname,
  "../../../../app/(dashboard)/[orgSlug]/purchases/page.tsx",
);

const mapperSource = readFileSync(MAPPER_PATH, "utf-8");
const pageSource = readFileSync(PAGE_PATH, "utf-8");

describe("A3-C6a RED purchase list cutover + null guard shape — combined axes", () => {
  // ── Mapper changes (positive — 3 assertions mirror A3-C4a.5 b3 refactor) ──

  it("Test 1: mapper exports TYPE_PREFIXES const (post b3 refactor caller responsibility)", () => {
    expect(mapperSource).toMatch(
      /export const TYPE_PREFIXES\s*:\s*Record<PurchaseType,\s*string>/,
    );
  });

  it("Test 2: ToPurchaseWithDetailsDeps interface declares displayCode: string field", () => {
    const interfaceMatch = mapperSource.match(
      /export interface ToPurchaseWithDetailsDeps\s*\{[\s\S]*?\n\}/,
    );
    expect(interfaceMatch).not.toBeNull();
    expect(interfaceMatch![0]).toMatch(/displayCode\s*:\s*string/);
  });

  it("Test 3: mapper toPurchaseWithDetails body assigns displayCode from deps.displayCode", () => {
    expect(mapperSource).toMatch(/displayCode\s*:\s*deps\.displayCode/);
  });

  // ── Mapper internal compute removed (negative — 1 assertion) ────────────────

  it("Test 4: mapper toPurchaseWithDetails body does NOT call internal computeDisplayCode (caller responsibility now)", () => {
    const fnMatch = mapperSource.match(
      /export function toPurchaseWithDetails\([\s\S]*?\n\}/,
    );
    expect(fnMatch).not.toBeNull();
    expect(fnMatch![0]).not.toMatch(/computeDisplayCode\s*\(/);
  });

  // ── Page cutover positive (3 assertions mirror A3-C4a) ──────────────────────

  it("Test 5: page imports makePurchaseService from composition-root (hex cutover)", () => {
    expect(pageSource).toMatch(
      /import\s*\{[^}]*\bmakePurchaseService\b[^}]*\}\s*from\s*["']@\/modules\/purchase\/presentation\/composition-root["']/,
    );
  });

  it("Test 6: page imports toPurchaseWithDetails from mapper (caller-passes-deps bridge)", () => {
    expect(pageSource).toMatch(
      /import\s*\{[^}]*\btoPurchaseWithDetails\b[^}]*\}\s*from\s*["']@\/modules\/purchase\/presentation\/mappers\/purchase-to-with-details\.mapper["']/,
    );
  });

  it("Test 7: page imports prisma from @/lib/prisma (Prisma direct batch lookups)", () => {
    expect(pageSource).toMatch(
      /import\s*\{[^}]*\bprisma\b[^}]*\}\s*from\s*["']@\/lib\/prisma["']/,
    );
  });

  // ── Page null guard positive (3 assertions mirror A3-C4a.5) ─────────────────

  it("Test 8: page imports TYPE_PREFIXES + computeDisplayCode from mapper (null guard caller responsibility)", () => {
    expect(pageSource).toMatch(/TYPE_PREFIXES/);
    expect(pageSource).toMatch(/computeDisplayCode/);
    expect(pageSource).toMatch(
      /from\s+["']@\/modules\/purchase\/presentation\/mappers\/purchase-to-with-details\.mapper["']/,
    );
  });

  it("Test 9: page contains null guard ternary pattern sequenceNumber !== null o === null", () => {
    expect(pageSource).toMatch(/sequenceNumber\s*(!==|===)\s*null/);
  });

  it("Test 10: page contains template literal `${TYPE_PREFIXES[...]}-DRAFT` polymorphic fallback", () => {
    expect(pageSource).toMatch(/\$\{TYPE_PREFIXES\[[^\]]+\]\}-DRAFT/);
  });

  // ── Page legacy ABSENT (2 negative assertions future-proof) ────────────────

  it("Test 11: page does NOT contain `new PurchaseService()` (legacy instantiation removed post-cutover)", () => {
    expect(pageSource).not.toMatch(/new\s+PurchaseService\s*\(/);
  });

  it("Test 12: page does NOT import from `@/features/purchase/server` (legacy barrel future-proof)", () => {
    expect(pageSource).not.toMatch(
      /from\s+["']@\/features\/purchase\/server["']/,
    );
  });
});
