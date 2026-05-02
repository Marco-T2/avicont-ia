/**
 * POC nuevo A3-C4b — cutover sales/[saleId]/page.tsx detail view shape
 * (`new SaleService()` → `makeSaleService()` + Prisma direct deps lookups +
 * map toSaleWithDetails caller-passes-deps).
 *
 * Axis: cutover 1 caller `app/(dashboard)/[orgSlug]/sales/[saleId]/page.tsx:24`
 * desde legacy `new SaleService().getById(orgId, saleId)` retornando
 * `SaleWithDetails` directo a hex `makeSaleService().getById(orgId, saleId)`
 * retornando `Sale` domain entity + Prisma direct deps lookups (contact +
 * receivable+allocations+payment + ivaSalesBook) + map
 * `toSaleWithDetails(sale, deps)`.
 *
 * §13.X resolution applied: hex Receivable entity NO expone allocations+payment
 * shape. Marco lock Q2 (a) Prisma direct caller responsibility — bypass hex
 * extension scope creep. Coherent caller-passes-deps philosophy A3-C3 GREEN
 * JSDoc design.
 *
 * Marco locks heredados Q1-Q8 + SubQ-α-ζ A3-C4b:
 *   - Q2 (a) Prisma direct query receivable+allocations en page (caller responsibility)
 *   - Q3 (a) Prisma direct ivaSalesBook lookup
 *   - Q4 page batch lookup pattern Prisma direct + Promise.all paralelo
 *   - Q5 (b) split A3-C4a (page 1 list) + A3-C4b (page 2 detail) por complejidad asimétrica
 *   - SubQ-α Prisma direct contact lookup via sale.contactId — existing
 *     contactsService.list(orgId, {type:"CLIENTE",isActive:true}) filter
 *     puede excluir contacto desactivado post-sale; Prisma direct safer
 *   - SubQ-β reuse existing `periods` list `periods.find(p => p.id === sale.periodId)!`
 *     — list returns ALL periods orgId, no extra query needed
 *   - SubQ-γ Prisma direct receivable+allocations+payment via sale.receivableId
 *     (null si DRAFT) mirror legacy saleDetailInclude.receivable shape
 *   - SubQ-δ Prisma direct ivaSalesBook via saleId @unique — full record
 *     compatible IvaSalesBookDTO
 *   - SubQ-ε Promise.all post-sale 3 Prisma queries paralelo
 *   - SubQ-ζ 6 assertions α mirror A3-C4a precedent (3 positive + 3 negative)
 *
 * R5 banPrismaInPresentation scope verified ESTRICTAMENTE
 * `modules/{module}/presentation/...` (NO incluye `app/**`). Pages
 * `app/(dashboard)/...` legacy presentation territory NO sujeto R5. Precedent
 * established A3-C4a + audit/page.tsx + monthly-close/close-event/page.tsx.
 *
 * Expected failure cumulative (RED justificado, 6 assertions α source-shape
 * mirror A3-C4a precedent 3+3):
 *   - Test 1 positive: `makeSaleService` import desde composition-root
 *   - Test 2 positive: `toSaleWithDetails` import desde mappers
 *   - Test 3 positive: `prisma` import desde `@/lib/prisma`
 *   - Test 4 negative: `new SaleService()` ABSENT
 *   - Test 5 negative: `@/features/sale/server` ABSENT
 *   - Test 6 negative: `@/features/sale` exact root barrel ABSENT (regex
 *     anchored — preserva imports legítimos deep paths future-proof)
 *
 * GREEN A3-C4b single commit β (mirror precedent A3-C4a + A3-C2 atomic batch):
 *   - Modify `app/(dashboard)/[orgSlug]/sales/[saleId]/page.tsx`:
 *     · Replace `new SaleService()` con `makeSaleService()`
 *     · Keep existing legacy contactsService/periodsService/accountsService.list calls
 *     · Add Prisma direct deps lookups paralelo Promise.all (contact +
 *       conditional receivable + ivaSalesBook)
 *     · Map `sale → toSaleWithDetails(sale, deps)` con period reuse desde
 *       periods list
 *     · Drop `import { SaleService } from "@/features/sale/server"`
 *     · Add hex + mapper + prisma imports
 *
 * Self-contained future-proof check (lección A6 #5): shape test asserta path
 * `app/(dashboard)/[orgSlug]/sales/[saleId]/page.tsx` (Next.js page persistente).
 * NO toca `features/{sale,purchase}/...` que A3-C7/C8 borran wholesale.
 * Self-contained vs future deletes ✅.
 *
 * Cross-ref:
 * - architecture.md §13.T DTO shape divergence Sale entity vs SaleWithDetails
 * - architecture.md §13.W (engram-only) drop createdBy unused dep
 * - architecture.md §13.X (engram-only) hex Receivable NO allocations Prisma direct
 * - architecture.md §13.7 lecciones operacionales 9 cementadas
 * - engram bookmark `poc-nuevo/a3/c4b/locked` Marco locks SubQ-α-ζ
 * - engram bookmark `poc-nuevo/a3/c4a/closed` A3-C4a precedent cutover shape
 * - engram bookmark `poc-nuevo/a3/c3-5/closed` A3-C3.5 §13.W resolved
 * - features/sale/sale.repository.ts:60-90 (legacy saleDetailInclude shape source)
 * - app/(dashboard)/[orgSlug]/sales/page.tsx (A3-C4a precedent established)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

const SALE_DETAIL_PAGE_PATH = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/sales/[saleId]/page.tsx",
);

describe("POC nuevo A3-C4b — cutover sales/[saleId]/page.tsx detail view shape", () => {
  // ── Tests 1-3 positive: hex imports + mapper + Prisma ───────────────────────

  it("Test 1: sales/[saleId]/page.tsx imports `makeSaleService` from `@/modules/sale/presentation/composition-root` (hex cutover)", () => {
    const source = fs.readFileSync(SALE_DETAIL_PAGE_PATH, "utf8");
    expect(source).toMatch(
      /import\s*\{[^}]*\bmakeSaleService\b[^}]*\}\s*from\s*["']@\/modules\/sale\/presentation\/composition-root["']/,
    );
  });

  it("Test 2: sales/[saleId]/page.tsx imports `toSaleWithDetails` from mappers presentation (caller-passes-deps bridge)", () => {
    const source = fs.readFileSync(SALE_DETAIL_PAGE_PATH, "utf8");
    expect(source).toMatch(
      /import\s*\{[^}]*\btoSaleWithDetails\b[^}]*\}\s*from\s*["']@\/modules\/sale\/presentation\/mappers\/sale-to-with-details\.mapper["']/,
    );
  });

  it("Test 3: sales/[saleId]/page.tsx imports `prisma` from `@/lib/prisma` (Prisma direct deps lookups Q4)", () => {
    const source = fs.readFileSync(SALE_DETAIL_PAGE_PATH, "utf8");
    expect(source).toMatch(
      /import\s*\{[^}]*\bprisma\b[^}]*\}\s*from\s*["']@\/lib\/prisma["']/,
    );
  });

  // ── Tests 4-6 negative: legacy ausentes ─────────────────────────────────────

  it("Test 4: sales/[saleId]/page.tsx does NOT contain `new SaleService()` (legacy class instantiation absent)", () => {
    const source = fs.readFileSync(SALE_DETAIL_PAGE_PATH, "utf8");
    expect(source).not.toMatch(/new\s+SaleService\s*\(/);
  });

  it("Test 5: sales/[saleId]/page.tsx does NOT import from `@/features/sale/server` (legacy barrel server absent)", () => {
    const source = fs.readFileSync(SALE_DETAIL_PAGE_PATH, "utf8");
    expect(source).not.toMatch(/from\s*["']@\/features\/sale\/server["']/);
  });

  it("Test 6: sales/[saleId]/page.tsx does NOT import from exact `@/features/sale` root barrel (regex anchored — preserves deep paths future-proof)", () => {
    const source = fs.readFileSync(SALE_DETAIL_PAGE_PATH, "utf8");
    expect(source).not.toMatch(/from\s*["']@\/features\/sale["']/);
  });
});
