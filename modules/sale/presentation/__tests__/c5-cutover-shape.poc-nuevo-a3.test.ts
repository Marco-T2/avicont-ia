/**
 * POC nuevo A3-C5 — cutover 2 HubService deps + refactor `SaleServiceForHub`
 * interface (a) inline (drop `displayCode` + nested `contact` + mapping inside
 * `HubService` con `computeDisplayCode` mapper reuse + Prisma direct contact
 * batch lookup).
 *
 * Axis: cutover 2 callers `app/(dashboard)/[orgSlug]/dispatches/page.tsx:29` +
 * `app/api/organizations/[orgSlug]/dispatches-hub/route.ts:17` desde legacy
 * `new SaleService()` (legacy `features/sale/server`) hacia hex
 * `makeSaleService()` (modules/sale presentation composition-root).
 * Refactor `SaleServiceForHub` interface paired (a) inline: drop `displayCode`
 * + nested `contact: {id,name,type}` campos del shape + mapping inline INSIDE
 * `HubService.listHub()` accediendo a `computeDisplayCode` (DRY A3-C3 SubQ-d
 * lock) + Prisma direct `contact.findMany` batch lookup (mirror A3-C4a Map<id,
 * name> pattern).
 *
 * §13.AA RIESGO BAJO: `HubService` vive en `features/dispatch/` (legacy
 * territory). Legacy → modules import (computeDisplayCode mapper reuse) NO
 * viola hex purity — bridges-teardown solo prohíbe modules → legacy. R5
 * banPrismaInPresentation NO aplica (scope estrictamente
 * `modules/{module}/presentation/...`, NO incluye `features/**`).
 *
 * §13.AB RESUELTO MATERIAL (Marco lock SubQ-α (a) extend hex `SaleFilters`):
 * legacy `SaleService.list` soporta filtro `periodId` (sale.repository.ts:102
 * `where.periodId = filters.periodId`); hex `SaleFilters` (modules/sale/domain
 * /ports/sale.repository.ts) NO incluye `periodId`. Cutover sin extender hex
 * = pérdida funcionalidad filter periodId en hub. Resolution: extend hex
 * `SaleFilters` interface + `PrismaSaleRepository.findAll` passthrough mirror
 * legacy parity (regla #1 fidelidad bit-exact). Scope cohesivo A3-C5 GREEN
 * atomic batch.
 *
 * §13.AC RESUELTO MATERIAL (Marco lock SubQ-β (a) caller responsibility null
 * guard + literal `"VG-DRAFT"`): hex `computeDisplayCode(null)` THROWS por
 * A3-C3 SubQ-d fail-fast lock; legacy `getDisplayCode(null as any)` retorna
 * silent ugly `"VG-null"`. HubService consume DRAFT sales (sequenceNumber
 * null). Resolution: HubService inline guard
 * `sale.sequenceNumber !== null ? computeDisplayCode(seq) : "VG-DRAFT"` —
 * mantiene A3-C3 invariant intacto + mirror precedent A3-C4b receivable null
 * guard pattern. Literal `"VG-DRAFT"` visible al usuario en hub UI = surface
 * real bug si DRAFT no debería estar listed.
 *
 * Marco locks heredados Q1-Q8 + SubQ-α-δ A3-C5:
 *   - Q1-Q8 consolidated heredados (engram `poc-nuevo/a3/c4b/closed` cumulative)
 *   - SubQ-α (a) extend hex `SaleFilters` periodId — modify
 *     `modules/sale/domain/ports/sale.repository.ts` interface +
 *     `PrismaSaleRepository.findAll` passthrough
 *   - SubQ-β (a) caller responsibility null guard literal `"VG-DRAFT"` —
 *     HubService inline, mantiene A3-C3 mapper fail-fast invariant
 *   - SubQ-γ (a) Prisma direct `contact.findMany` batch lookup mirror A3-C4a
 *     Map<id, name> pattern — coherent legacy presentation territory + cero
 *     hex extension scope creep
 *   - SubQ-δ (a) atomic single A3-C5 ciclo — refactor interface + cutover 2
 *     callers son interdependientes (interface change forces caller change),
 *     split solo agrega ceremonia sin valor bisect real
 *
 * Expected failure cumulative (RED justificado, 6 assertions α source-shape
 * mirror A3-C4a/A3-C4b precedent 3+3):
 *   - Test 1 positive: `dispatches/page.tsx` importa `makeSaleService` desde
 *     composition-root
 *   - Test 2 positive: `dispatches-hub/route.ts` importa `makeSaleService`
 *     desde composition-root
 *   - Test 3 positive: `hub.service.ts` importa `computeDisplayCode` desde
 *     mappers presentation (refactor inline driver DRY A3-C3 SubQ-d)
 *   - Test 4 negative: `dispatches/page.tsx` does NOT match `new SaleService(`
 *   - Test 5 negative: `dispatches-hub/route.ts` does NOT match `new SaleService(`
 *   - Test 6 negative: `hub.service.ts` `SaleServiceForHub` interface block
 *     does NOT contain `displayCode` field literal (drop axis verify refactor
 *     (a) inline). Regex extracta interface block via match con terminator
 *     `\n}` para evitar false-positive sobre `DispatchServiceForHub` interface
 *     paralela (out of scope A3 — mantiene `displayCode`)
 *
 * GREEN A3-C5 single commit β atomic batch (mirror precedent A3-C4a + A3-C4b):
 *   - Modify `modules/sale/domain/ports/sale.repository.ts`:
 *     · Extend `SaleFilters` interface + `periodId?: string` (§13.AB)
 *   - Modify `modules/sale/infrastructure/prisma-sale.repository.ts`:
 *     · `findAll` passthrough `if (filters?.periodId) where.periodId = filters.periodId`
 *       (mirror legacy sale.repository.ts:102)
 *   - Modify `features/dispatch/hub.service.ts`:
 *     · Drop `displayCode` + `contact: {...}` fields del `SaleServiceForHub`
 *       interface; replace shape con `Promise<Sale[]>` import hex `Sale`
 *     · Add `import { computeDisplayCode } from "@/modules/sale/presentation/mappers/sale-to-with-details.mapper"`
 *     · Add `import { prisma } from "@/lib/prisma"`
 *     · Add `import type { Sale } from "@/modules/sale/domain/sale.entity"`
 *     · Refactor `HubService.listHub()` mapping inline:
 *       1. Cargar sales hex via `this.sales.list(orgId, filters)`
 *       2. Si `saleItems` non-empty: Prisma direct `contact.findMany({where:
 *          {organizationId: orgId, id: {in: saleContactIds}}, select: {id, name}})`
 *          batch + Map<id, name> lookup
 *       3. Map `sales → toHubItemSale(sale, contactName, displayCode)` con null
 *          guard `sale.sequenceNumber !== null ? computeDisplayCode(seq) : "VG-DRAFT"`
 *     · Update `toHubItemSale` signature: receive `Sale` hex entity + contactName
 *       + displayCode args separados (drop `Awaited<ReturnType>` derived shape)
 *   - Modify `app/(dashboard)/[orgSlug]/dispatches/page.tsx`:
 *     · Replace `import { SaleService } from "@/features/sale/server"` con
 *       `import { makeSaleService } from "@/modules/sale/presentation/composition-root"`
 *     · Replace `new HubService(new SaleService(), new DispatchService())` con
 *       `new HubService(makeSaleService(), new DispatchService())`
 *   - Modify `app/api/organizations/[orgSlug]/dispatches-hub/route.ts`:
 *     · Replace `import { SaleService } from "@/features/sale/server"` con
 *       `import { makeSaleService } from "@/modules/sale/presentation/composition-root"`
 *     · Replace `new SaleService()` argumento con `makeSaleService()`
 *   - Modify `features/dispatch/__tests__/hub.service.test.ts`:
 *     · Update `makeSale` fixture shape (hex `Sale` entity getters mock con
 *       MonetaryAmount.value extraction) — anticipated stale fixtures lección
 *       #11 evidence cumulative #3 detected pre-RED
 *
 * Self-contained future-proof check (lección A6 #5): shape test asserta paths
 * `app/(dashboard)/[orgSlug]/dispatches/page.tsx` (Next.js page persistente) +
 * `app/api/organizations/[orgSlug]/dispatches-hub/route.ts` (Next.js API route
 * persistente) + `features/dispatch/hub.service.ts` (legacy persiste — A3
 * scope NO incluye dispatch wholesale delete, solo sale). Self-contained vs
 * future deletes A3-C7/C8 ✅.
 *
 * Cross-ref:
 * - architecture.md §13.7 lecciones operacionales 9 cementadas
 * - architecture.md §13.T DTO shape divergence Sale entity vs SaleWithDetails
 * - architecture.md §13.AB (engram-only) extend hex SaleFilters periodId
 * - architecture.md §13.AC (engram-only) computeDisplayCode null DRAFT guard
 * - engram bookmark `poc-nuevo/a3/c5/locked` Marco locks SubQ-α-δ
 * - engram bookmark `poc-nuevo/a3/c4b/closed` cumulative §13.X precedent
 * - engram bookmark `poc-nuevo/a3/c4a/closed` Map<id, X> pattern precedent
 * - engram bookmark `poc-nuevo/a3/c3-5/closed` paired §13.W resolution
 * - features/sale/sale.repository.ts:102 (legacy periodId filter source)
 * - features/sale/sale.utils.ts:37 (legacy getDisplayCode silent null behavior)
 * - modules/sale/presentation/mappers/sale-to-with-details.mapper.ts:114
 *   (computeDisplayCode export A3-C3 SubQ-d fail-fast lock)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

const DISPATCHES_PAGE_PATH = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/dispatches/page.tsx",
);
const DISPATCHES_HUB_ROUTE_PATH = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/dispatches-hub/route.ts",
);
const HUB_SERVICE_PATH = path.join(
  REPO_ROOT,
  "features/dispatch/hub.service.ts",
);

describe("POC nuevo A3-C5 — cutover 2 HubService deps + refactor SaleServiceForHub interface (a) inline shape", () => {
  // ── Tests 1-3 positive: hex makeSaleService imports + computeDisplayCode mapper reuse ──

  it("Test 1: dispatches/page.tsx imports `makeSaleService` from `@/modules/sale/presentation/composition-root` (hex cutover caller 1)", () => {
    const source = fs.readFileSync(DISPATCHES_PAGE_PATH, "utf8");
    expect(source).toMatch(
      /import\s*\{[^}]*\bmakeSaleService\b[^}]*\}\s*from\s*["']@\/modules\/sale\/presentation\/composition-root["']/,
    );
  });

  it("Test 2: dispatches-hub/route.ts imports `makeSaleService` from `@/modules/sale/presentation/composition-root` (hex cutover caller 2)", () => {
    const source = fs.readFileSync(DISPATCHES_HUB_ROUTE_PATH, "utf8");
    expect(source).toMatch(
      /import\s*\{[^}]*\bmakeSaleService\b[^}]*\}\s*from\s*["']@\/modules\/sale\/presentation\/composition-root["']/,
    );
  });

  it("Test 3: hub.service.ts imports `computeDisplayCode` from mappers presentation (refactor (a) inline DRY A3-C3 SubQ-d driver)", () => {
    const source = fs.readFileSync(HUB_SERVICE_PATH, "utf8");
    expect(source).toMatch(
      /import\s*\{[^}]*\bcomputeDisplayCode\b[^}]*\}\s*from\s*["']@\/modules\/sale\/presentation\/mappers\/sale-to-with-details\.mapper["']/,
    );
  });

  // ── Tests 4-6 negative: legacy `new SaleService()` ausentes + interface drop displayCode ──

  it("Test 4: dispatches/page.tsx does NOT contain `new SaleService(` (legacy class instantiation absent — replaced por makeSaleService())", () => {
    const source = fs.readFileSync(DISPATCHES_PAGE_PATH, "utf8");
    expect(source).not.toMatch(/new\s+SaleService\s*\(/);
  });

  it("Test 5: dispatches-hub/route.ts does NOT contain `new SaleService(` (legacy class instantiation absent — replaced por makeSaleService())", () => {
    const source = fs.readFileSync(DISPATCHES_HUB_ROUTE_PATH, "utf8");
    expect(source).not.toMatch(/new\s+SaleService\s*\(/);
  });

  it("Test 6: hub.service.ts `SaleServiceForHub` interface block does NOT contain `displayCode` field literal (drop axis refactor (a) inline — DispatchServiceForHub paralelo mantiene displayCode out of scope A3)", () => {
    const source = fs.readFileSync(HUB_SERVICE_PATH, "utf8");
    const saleInterfaceMatch = source.match(
      /export interface SaleServiceForHub\s*\{[\s\S]*?\n\}/,
    );
    expect(saleInterfaceMatch).not.toBeNull();
    expect(saleInterfaceMatch![0]).not.toMatch(/\bdisplayCode\b/);
  });
});
