/**
 * POC nuevo A3-C6b — purchase detail cutover + null guard pattern desde inicio shape.
 *
 * Axis: cutover `app/(dashboard)/[orgSlug]/purchases/[purchaseId]/page.tsx` desde
 * legacy `new PurchaseService()` a hex `makePurchaseService()` + Prisma direct
 * lookups contact + payable conditional + ivaPurchaseBook + `toPurchaseWithDetails`
 * caller-passes-deps invocation con null guard ternary mirror A3-C4b.5 sale detail
 * precedent EXACT. Plus aplicar (b3) caller-passes-displayCode null guard pattern
 * desde inicio (mirror A3-C6a list precedent — purchase aplica directo PROACTIVE
 * porque mapper ya refactored A3-C6a + cero remaining production callers todavía).
 *
 * Sub-§13.AC-purchase resolution APPLIED variante 5 page detail (engram-only inline
 * absorption — NO formal cementación, mirror A3-C4b.5 sub-§13 in-flight precedent):
 * legacy `purchase.repository.ts:144-159 findById()` NO mandatory status filter →
 * DRAFT purchases (sequenceNumber=null) llegan al mapper → mapper post-refactor
 * A3-C6a consume `deps.displayCode` (NO compute internal) → caller responsibility
 * null guard ternary + `${TYPE_PREFIXES[purchaseType]}-DRAFT` fallback polymorphic
 * per purchaseType discriminator.
 *
 * Combined scope axes (Marco lock 12 assertions intra-A3-C6 simetría con C6a):
 * 1. Page cutover (mirror A3-C4b sale detail): makePurchaseService +
 *    toPurchaseWithDetails + TYPE_PREFIXES/computeDisplayCode + prisma imports
 * 2. Page Prisma direct lookups (mirror A3-C4b.5 sale detail Promise.all expand):
 *    accountsPayable.findUnique conditional + ivaPurchaseBook.findUnique
 *    (asimetría purchase vs sale: AccountsPayable vs AccountsReceivable model
 *    name; ivaPurchaseBook.purchaseId @unique vs ivaSalesBook.saleId @unique)
 * 3. Page null guard (mirror A3-C6a list PROACTIVE): toPurchaseWithDetails(purchase,)
 *    invocation + null guard ternary + `${TYPE_PREFIXES[...]}-DRAFT` polymorphic
 *
 * Sub-§13 in-flight surface expected absorbed inline GREEN (NO formal — engram-only,
 * mirror A3-C4b.5 page-rbac mock factory expansion precedent):
 * `app/(dashboard)/[orgSlug]/purchases/[purchaseId]/__tests__/page-rbac.test.ts:30-35`
 * mock `@/features/purchase/server` STALE post-cutover. GREEN scope expand mirror
 * A3-C4b.5 `sales/[saleId]/__tests__/page-rbac.test.ts` mock anomaly absorption
 * pattern (engram poc-nuevo/a3/c4b-5/closed): replace stale legacy mock con
 * composition-root makePurchaseService + Prisma mocks (contact + accountsPayable
 * + ivaPurchaseBook findUnique stubs) + mapper mocks (TYPE_PREFIXES + computeDisplayCode
 * + toPurchaseWithDetails stubs).
 *
 * Cross-ref:
 * - A3-C6a list precedent (intra-A3-C6 simetría): engram `poc-nuevo/a3/c6a/closed` (#1541)
 * - A3-C4b sale detail cutover precedent (mirror EXACT shape pattern): engram `poc-nuevo/a3/c4b/closed` (#1532)
 * - A3-C4b.5 sale detail null guard paired (compact pattern): engram `poc-nuevo/a3/c4b-5/closed` (#1540)
 * - A3-C4a.5 sale list null guard paired (b3 caller-passes refactor): engram `poc-nuevo/a3/c4a-5/closed` (#1539)
 * - A3-C5 §13.AC HubService SubQ-β precedent: engram `poc-nuevo/a3/c5/closed` (#1534)
 * - A3-C5.5 atomic build purchase mapper: engram `poc-nuevo/a3/c5-5/closed` (#1537)
 * - SubQ-d fail-fast lock cementación: engram `poc-nuevo/a3/c3/closed` (#1525)
 * - Lección #12 cementada formal 3 evidencias: engram `arch/lecciones/leccion-12-runtime-path-coverage` (#1542)
 * - Mapper file (signature post-A3-C6a): modules/purchase/presentation/mappers/purchase-to-with-details.mapper.ts
 * - Page file: app/(dashboard)/[orgSlug]/purchases/[purchaseId]/page.tsx
 * - Sale detail mirror precedent: app/(dashboard)/[orgSlug]/sales/[saleId]/page.tsx
 * - features/purchase/purchase.repository.ts:144-159 findById() NO mandatory status filter (H1 source)
 *
 * Lección #11 8va evidencia maturation refinement: pre-recon comprehensive grep
 * callers + verify mapper unit test existence (NO purchase mapper unit test
 * exists confirmed) + page test mocks audit ANTES RED scope lock. NO mapper
 * fixture impact A3-C6b porque mapper unit test purchase NO exists.
 *
 * Lección #12 4ta evidencia formal cumulative reinforcement validated PROACTIVE:
 * "Cutover RED scope debe incluir runtime path coverage (status enums + null
 * branches), NO solo `__tests__` paths (lección #11) ni shape source (lección
 * #10)". A3-C6b aplicación PROACTIVE desde inicio (NO retroactive paired
 * follow-up) — pattern preventiva validada empirically forward 2da PROACTIVE
 * evidencia post A3-C6a. PurchaseStatus enum DRAFT/POSTED/LOCKED/VOIDED — DRAFT
 * (sequenceNumber=null) branch coverage requerido caller responsibility null
 * guard ternary mirror §13.AC HubService A3-C5 SubQ-β.
 *
 * Expected RED failure mode (verify pre-GREEN):
 * - 9 positive FAIL: page imports makePurchaseService + toPurchaseWithDetails +
 *   TYPE_PREFIXES/computeDisplayCode + prisma + Prisma direct accountsPayable
 *   findUnique + Prisma direct ivaPurchaseBook findUnique + toPurchaseWithDetails
 *   invocation + null guard ternary sequenceNumber !==/=== null + template
 *   literal `${TYPE_PREFIXES[...]}-DRAFT`
 * - 3 page negative FAIL: NO `new PurchaseService()` (currently línea 27
 *   present → fails pre-GREEN) + NO import @/features/purchase/server (currently
 *   línea 3 present → fails pre-GREEN) + NO `purchase={JSON.parse(JSON.stringify(purchase))}`
 *   raw passing to PurchaseForm (currently línea 63 present → fails pre-GREEN —
 *   post-GREEN must pass purchaseWithDetails)
 *
 * Total expected RED: 12/12 fail. Post-GREEN: 12/12 pass (+12 net suite delta).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(
  __dirname,
  "../../../../app/(dashboard)/[orgSlug]/purchases/[purchaseId]/page.tsx",
);

const pageSource = readFileSync(PAGE_PATH, "utf-8");

describe("A3-C6b RED purchase detail cutover + null guard shape — combined axes", () => {
  // ── Page cutover imports positive (4 assertions mirror A3-C4b sale detail) ──

  it("Test 1: page imports makePurchaseService from composition-root (hex cutover)", () => {
    expect(pageSource).toMatch(
      /import\s*\{[^}]*\bmakePurchaseService\b[^}]*\}\s*from\s*["']@\/modules\/purchase\/presentation\/composition-root["']/,
    );
  });

  it("Test 2: page imports toPurchaseWithDetails from mapper (caller-passes-deps bridge)", () => {
    expect(pageSource).toMatch(
      /import\s*\{[^\}]*\btoPurchaseWithDetails\b[^\}]*\}\s*from\s*["']@\/modules\/purchase\/presentation\/mappers\/purchase-to-with-details\.mapper["']/,
    );
  });

  it("Test 3: page imports TYPE_PREFIXES + computeDisplayCode from mapper (null guard caller responsibility)", () => {
    expect(pageSource).toMatch(/TYPE_PREFIXES/);
    expect(pageSource).toMatch(/computeDisplayCode/);
    expect(pageSource).toMatch(
      /from\s+["']@\/modules\/purchase\/presentation\/mappers\/purchase-to-with-details\.mapper["']/,
    );
  });

  it("Test 4: page imports prisma from @/lib/prisma (Prisma direct lookups)", () => {
    expect(pageSource).toMatch(
      /import\s*\{[^}]*\bprisma\b[^}]*\}\s*from\s*["']@\/lib\/prisma["']/,
    );
  });

  // ── Page Prisma direct lookups + invocation positive (3 mirror A3-C4b.5) ────

  it("Test 5: page contains prisma.accountsPayable.findUnique (Prisma direct payable conditional lookup)", () => {
    expect(pageSource).toMatch(/prisma\.accountsPayable\.findUnique/);
  });

  it("Test 6: page contains prisma.ivaPurchaseBook.findUnique (Prisma direct ivaPurchaseBook lookup)", () => {
    expect(pageSource).toMatch(/prisma\.ivaPurchaseBook\.findUnique/);
  });

  it("Test 7: page invokes toPurchaseWithDetails(purchase, deps) caller-passes-deps invocation", () => {
    expect(pageSource).toMatch(/toPurchaseWithDetails\s*\(\s*purchase\s*,/);
  });

  // ── Page null guard pattern positive (2 mirror A3-C6a + lección #12) ────────

  it("Test 8: page contains null guard ternary pattern sequenceNumber !== null o === null", () => {
    expect(pageSource).toMatch(/sequenceNumber\s*(!==|===)\s*null/);
  });

  it("Test 9: page contains template literal `${TYPE_PREFIXES[...]}-DRAFT` polymorphic fallback", () => {
    expect(pageSource).toMatch(/\$\{TYPE_PREFIXES\[[^\]]+\]\}-DRAFT/);
  });

  // ── Page legacy ABSENT (3 negative assertions future-proof + form prop) ─────

  it("Test 10: page does NOT contain `new PurchaseService()` (legacy instantiation removed post-cutover)", () => {
    expect(pageSource).not.toMatch(/new\s+PurchaseService\s*\(/);
  });

  it("Test 11: page does NOT import from `@/features/purchase/server` (legacy barrel future-proof)", () => {
    expect(pageSource).not.toMatch(
      /from\s+["']@\/features\/purchase\/server["']/,
    );
  });

  it("Test 12: page does NOT pass raw purchase={JSON.parse(JSON.stringify(purchase))} (must pass purchaseWithDetails post-cutover)", () => {
    expect(pageSource).not.toMatch(
      /purchase=\{JSON\.parse\(JSON\.stringify\(purchase\)\)\}/,
    );
  });
});
