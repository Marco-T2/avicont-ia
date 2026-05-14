/**
 * POC nuevo A3-C6c — routes 3+4 atomic cutover purchase desde legacy
 * `new PurchaseService()` (`@/features/purchase/server`) hacia hex
 * `makePurchaseService()` (`@/modules/purchase/presentation/composition-root`).
 *
 * Axis: cutover 2 archivos cohesivos atomic single ciclo —
 * `app/api/organizations/[orgSlug]/purchases/[purchaseId]/route.ts` (GET +
 * PATCH + DELETE) + `app/api/organizations/[orgSlug]/purchases/[purchaseId]
 * /status/route.ts` (POST status POSTED|VOIDED). HEX `PurchaseService`
 * (modules/purchase/application) expone los mismos métodos consumidos
 * (`getById/getEditPreview/update/post/void/delete`) — cutover método-name
 * paridad EXACT, asimetrías solo en signature shape (object-DI vs positional).
 *
 * §13.AC-purchase variante 6 ASIMETRÍA legítima (Step 0 coherence gate
 * lección #13 1ra evidencia PROACTIVE): consumer real `purchase-form.tsx`
 * mutation handlers (`handleSubmit/handleCreateAndPost/handlePost/handleVoid
 * /handleDelete` líneas 472-629) NO consumen `response.json()` body — solo
 * `response.ok`. Routes mantienen `Response.json(purchase|result)` raw entity
 * preserved (mirror sale routes 3+4 precedent commit `adfcbd2` POC #11.0a
 * A4-a Ciclo 1 EXACT). Lección #12 runtime path coverage (null guard +
 * TYPE_PREFIXES + Promise.all 6 elementos) NO aplica este ciclo —
 * out-of-scope deliberadamente declared (asimetría legítima vs A3-C6a/C6b
 * page cutover que sí consumen mapper-applied data).
 *
 * Asimetrías signature legacy → HEX requieren caller adapter inline:
 *   - `getEditPreview(purchaseId, orgId, total)` (legacy positional) →
 *     `getEditPreview(orgId, purchaseId, total)` (HEX argument ORDER swap,
 *     mirror sale precedent EXACT)
 *   - `update(orgId, id, input, userId, role, justification)` (legacy 6
 *     positional) → `update(orgId, id, input, { userId, role, justification })`
 *     (HEX 4-args object-DI mirror sale precedent EXACT)
 *   - `void(orgId, id, userId, justification)` (legacy 4 positional) →
 *     `void(orgId, id, { userId, role, justification })` (HEX 3-args object-DI
 *     + role injection — gap status/route.ts:21 `requirePermission` destructure
 *     actualmente solo `{ session, orgId }`, expandir a `{ session, orgId,
 *     role }` mirror sale precedent EXACT)
 *   - `post(orgId, id, userId)` (paridad EXACT — NO adapter needed)
 *   - `getById(orgId, id)` + `delete(orgId, id)` (paridad EXACT — NO adapter)
 *
 * Marco locks heredados Q1-Q5 + Marco re-lock Step 0 coherence gate:
 *   - Q1-Q5 consolidated heredados (engram `poc-nuevo/a3/c6b/closed` cumulative)
 *   - Marco re-lock Step 0: reduce scope mirror sale routes 3+4 precedent EXACT
 *     post-coherence-gate detection bookmark heredado eco mecánico A3-C6b
 *     (lección #13 1ra evidencia PROACTIVE cementada engram
 *     `arch/lecciones/leccion-13-bookmark-precedent-verification`)
 *   - Marco lock D5 PATCH/POST handler mismatch (`status/route.ts:15` exporta
 *     POST, client `purchase-form.tsx:564,590` envía method PATCH) DEFER
 *     A3-C8 doc-only post-mortem o POC futuro — bug pre-existente compartido
 *     sale + purchase, fuera scope A3-C6c
 *
 * Expected failure cumulative (RED justificado, 8 assertions α 6 positive +
 * 2 negative — granularity reduced vs A3-C6a/C6b 12 assertions porque NO
 * null guard + NO mapper invocation + NO Promise.all 6 elementos axes):
 *   - Test 1 positive: `route.ts` importa `makePurchaseService` desde
 *     composition-root (caller 1 hex cutover)
 *   - Test 2 positive: `status/route.ts` importa `makePurchaseService` desde
 *     composition-root (caller 2 hex cutover)
 *   - Test 3 positive: `route.ts` invoca `purchaseService.getEditPreview(orgId,
 *     purchaseId, ...)` argument ORDER swap (asimetría legacy `(id, orgId,
 *     ...)` → HEX `(orgId, id, ...)` mirror sale precedent EXACT)
 *   - Test 4 positive: `route.ts` invoca `purchaseService.update(orgId,
 *     purchaseId, input, { userId, ...})` object-DI 4-args (asimetría legacy
 *     6 positional → HEX object-DI mirror sale precedent EXACT)
 *   - Test 5 positive: `status/route.ts` `requirePermission` destructure
 *     incluye `role` field (gap actual: `{ session, orgId }` → expand to
 *     `{ session, orgId, role }` para void context object-DI)
 *   - Test 6 positive: `status/route.ts` invoca `purchaseService.void(orgId,
 *     purchaseId, { userId, ...})` object-DI 3-args (asimetría legacy 4
 *     positional → HEX object-DI + role injection)
 *   - Test 7 negative: `route.ts` does NOT contain `new PurchaseService(`
 *     (legacy class instantiation absent post-cutover — implícitamente cubre
 *     `@/features/purchase/server` import absent compact)
 *   - Test 8 negative: `status/route.ts` does NOT contain `new PurchaseService(`
 *     (idem caller 2)
 *
 * Out-of-scope deliberadamente declared (mirror A3-C5 sale precedent EXACT):
 *   - NO null guard ternary assertion (lección #12 NO aplica routes mutation —
 *     consumer NO consume response body)
 *   - NO `TYPE_PREFIXES` import assertion (NO mapper invocation en routes)
 *   - NO Promise.all 6 elementos assertion (NO Prisma direct contact + payable
 *     + ivaPurchaseBook lookups en routes — esos son scope page detail
 *     A3-C6b, NO mutation routes)
 *   - NO `Response.json(purchaseWithDetails)` mapper-applied assertion (mantiene
 *     `Response.json(purchase|result)` raw entity preserved mirror sale)
 *   - NO `@/features/purchase/server` import ABSENT assertion (implícitamente
 *     cubierto por `new PurchaseService(` ABSENT — compact)
 *   - NO PATCH/POST handler bug fix (D5 defer A3-C8 doc-only post-mortem)
 *
 * GREEN A3-C6c single commit β atomic batch (mirror precedent sale routes
 * 3+4 commit `adfcbd2` POC #11.0a A4-a Ciclo 1 EXACT — 2 archivos cohesivos):
 *   - Modify `app/api/organizations/[orgSlug]/purchases/[purchaseId]/route.ts`
 *     (5 changes):
 *     · Line 3: replace `import { PurchaseService } from "@/features/purchase
 *       /server"` con `import { makePurchaseService } from "@/modules/purchase
 *       /presentation/composition-root"`
 *     · Line 7: replace `const purchaseService = new PurchaseService()` con
 *       `const purchaseService = makePurchaseService()`
 *     · Line 53/60: swap argument ORDER `getEditPreview(purchaseId, orgId,
 *       newTotal)` → `getEditPreview(orgId, purchaseId, newTotal)` (2
 *       callsites: dryRun path + confirmTrim path)
 *     · Line 68: replace `update(orgId, purchaseId, input, user.id, role,
 *       justification)` (6 positional) con `update(orgId, purchaseId, input,
 *       { userId: user.id, role, justification })` (4-args object-DI)
 *   - Modify `app/api/organizations/[orgSlug]/purchases/[purchaseId]/status
 *     /route.ts` (4 changes):
 *     · Line 5: replace `import { PurchaseService } from "@/features/purchase
 *       /server"` con `import { makePurchaseService } from "@/modules/purchase
 *       /presentation/composition-root"`
 *     · Line 8: replace `const purchaseService = new PurchaseService()` con
 *       `const purchaseService = makePurchaseService()`
 *     · Line 21: replace `const { session, orgId } = await requirePermission(
 *       ...)` con `const { session, orgId, role } = await requirePermission(
 *       ...)` (role injection)
 *     · Line 37: replace `void(orgId, purchaseId, user.id, justification)` (4
 *       positional) con `void(orgId, purchaseId, { userId: user.id, role,
 *       justification })` (3-args object-DI)
 *
 * `UsersService` legacy preserved both files (mirror sale precedent),
 * `Response.json(purchase|result)` raw entity preserved (NO mapper invocation
 * mirror sale precedent), POST handler signature preserved (D5 defer A3-C8).
 *
 * Self-contained future-proof check (lección A6 #5): shape test asserta paths
 * `app/api/organizations/[orgSlug]/purchases/[purchaseId]/route.ts` (Next.js
 * dynamic route persistente) + `app/api/organizations/[orgSlug]/purchases
 * /[purchaseId]/status/route.ts` (Next.js dynamic route persistente).
 * Self-contained vs future deletes A3-C7/C8 ✅ (A3 scope NO incluye purchase
 * routes wholesale delete, solo legacy `features/purchase/` wholesale).
 *
 * Cross-ref:
 * - architecture.md §13.7 lecciones operacionales 9 cementadas
 * - architecture.md §13.AC-purchase variante 6 (engram-only A3-C6c routes 3+4
 *   asimetría legítima vs page cutover variante 4-5)
 * - engram bookmark `poc-nuevo/a3/c6b/closed` (#1544) cumulative §13.AC-purchase
 *   variante 5 page detail
 * - engram bookmark `poc-nuevo/a3/c6a/closed` (#1541) cumulative §13.AC-purchase
 *   variante 4 page list
 * - engram bookmark `poc-nuevo/a3/c5/closed` (#1534) §13.AC HubService SubQ-β
 *   precedent atomic interdependence pattern
 * - engram bookmark `arch/lecciones/leccion-13-bookmark-precedent-verification`
 *   (cementada PROACTIVE 1ra evidencia explicit este turn — A3-C6c bookmark
 *   eco mecánico A3-C6b corrected pre-RED via Step 0 coherence gate)
 * - engram bookmark `arch/lecciones/leccion-12-runtime-path-coverage` (#1542)
 *   asimetría legítima out-of-scope routes mutation
 * - sale routes 3+4 precedent: `app/api/organizations/[orgSlug]/sales/[saleId]
 *   /route.ts` + `status/route.ts` post commit `adfcbd2` POC #11.0a A4-a
 *   Ciclo 1 (`Response.json(sale|result)` raw entity, object-DI signatures,
 *   `UsersService` legacy preserved)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

const PURCHASE_DETAIL_ROUTE_PATH = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/purchases/[purchaseId]/route.ts",
);
const PURCHASE_STATUS_ROUTE_PATH = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/purchases/[purchaseId]/status/route.ts",
);

describe("POC nuevo A3-C6c — routes 3+4 atomic cutover purchase shape", () => {
  // ── Tests 1-2 positive: hex makePurchaseService imports ambas routes ──

  it("Test 1: route.ts imports `makePurchaseService` from `@/modules/purchase/presentation/composition-root` (hex cutover caller 1)", () => {
    const source = fs.readFileSync(PURCHASE_DETAIL_ROUTE_PATH, "utf8");
    expect(source).toMatch(
      /import\s*\{[^}]*\bmakePurchaseService\b[^}]*\}\s*from\s*["']@\/modules\/purchase\/presentation\/composition-root["']/,
    );
  });

  it("Test 2: status/route.ts imports `makePurchaseService` from `@/modules/purchase/presentation/composition-root` (hex cutover caller 2)", () => {
    const source = fs.readFileSync(PURCHASE_STATUS_ROUTE_PATH, "utf8");
    expect(source).toMatch(
      /import\s*\{[^}]*\bmakePurchaseService\b[^}]*\}\s*from\s*["']@\/modules\/purchase\/presentation\/composition-root["']/,
    );
  });

  // ── Tests 3-4 positive: route.ts asimetrías signature getEditPreview + update ──

  it("Test 3: route.ts invoca `purchaseService.getEditPreview(orgId, purchaseId, ...)` argument ORDER swap (asimetría legacy `(id, orgId, ...)` → HEX `(orgId, id, ...)` mirror sale precedent EXACT)", () => {
    const source = fs.readFileSync(PURCHASE_DETAIL_ROUTE_PATH, "utf8");
    expect(source).toMatch(
      /purchaseService\.getEditPreview\s*\(\s*orgId\s*,\s*purchaseId\s*,/,
    );
  });

  it("Test 4: route.ts invoca `purchaseService.update(orgId, purchaseId, <input>, { userId, ...})` object-DI 4-args (asimetría legacy 6 positional → HEX object-DI mirror sale precedent EXACT)", () => {
    const source = fs.readFileSync(PURCHASE_DETAIL_ROUTE_PATH, "utf8");
    // 3rd arg may be `input` or a wrapping intermediate like `wrappedInput` — intent is 4-arg object-DI
    expect(source).toMatch(
      /purchaseService\.update\s*\(\s*orgId\s*,\s*purchaseId\s*,\s*\w+\s*,\s*\{\s*userId/,
    );
  });

  // ── Tests 5-6 positive: status/route.ts requirePermission role injection + void object-DI ──

  it("Test 5: status/route.ts `requirePermission` destructure incluye `role` field (gap actual `{ session, orgId }` → expand `{ session, orgId, role }` para void context object-DI)", () => {
    const source = fs.readFileSync(PURCHASE_STATUS_ROUTE_PATH, "utf8");
    expect(source).toMatch(
      /const\s*\{\s*session\s*,\s*orgId\s*,\s*role\s*\}\s*=\s*await\s+requirePermission/,
    );
  });

  it("Test 6: status/route.ts invoca `purchaseService.void(orgId, purchaseId, { userId, ...})` object-DI 3-args (asimetría legacy 4 positional → HEX object-DI + role injection mirror sale precedent EXACT)", () => {
    const source = fs.readFileSync(PURCHASE_STATUS_ROUTE_PATH, "utf8");
    expect(source).toMatch(
      /purchaseService\.void\s*\(\s*orgId\s*,\s*purchaseId\s*,\s*\{\s*userId/,
    );
  });

  // ── Tests 7-8 negative: legacy `new PurchaseService(` ausentes ambas routes ──

  it("Test 7: route.ts does NOT contain `new PurchaseService(` (legacy class instantiation absent post-cutover — implícitamente cubre `@/features/purchase/server` import absent compact)", () => {
    const source = fs.readFileSync(PURCHASE_DETAIL_ROUTE_PATH, "utf8");
    expect(source).not.toMatch(/new\s+PurchaseService\s*\(/);
  });

  it("Test 8: status/route.ts does NOT contain `new PurchaseService(` (legacy class instantiation absent post-cutover — implícitamente cubre `@/features/purchase/server` import absent compact)", () => {
    const source = fs.readFileSync(PURCHASE_STATUS_ROUTE_PATH, "utf8");
    expect(source).not.toMatch(/new\s+PurchaseService\s*\(/);
  });
});
