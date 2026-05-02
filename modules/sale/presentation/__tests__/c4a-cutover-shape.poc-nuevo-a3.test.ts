/**
 * POC nuevo A3-C4a — cutover sales/page.tsx list view shape (`new SaleService()`
 * → `makeSaleService()` + batch lookups Prisma direct + map toSaleWithDetails).
 *
 * Axis: cutover 1 caller `app/(dashboard)/[orgSlug]/sales/page.tsx:21` desde
 * legacy `new SaleService().list(orgId)` retornando `SaleWithDetails[]` directo
 * a hex `makeSaleService().list(orgId)` retornando `Sale[]` domain entity +
 * batch deps lookups via Prisma direct (`prisma.contact.findMany` +
 * `prisma.fiscalPeriod.findMany`) + map `sales.map(s => toSaleWithDetails(s, deps))`.
 *
 * §13.T resolution applied: hex `SaleService.list()` retorna `Sale[]` (domain
 * entity) vs legacy `SaleWithDetails[]`. Mapper presentation `toSaleWithDetails`
 * caller-passes-deps cementado A3-C3 + A3-C3.5 (§13.W resolved drop createdBy)
 * bridges asymmetry.
 *
 * Marco locks heredados Q1-Q8 + SubQ-α-δ A3-C4a:
 *   - Q2 (a) Prisma direct query receivable en page (caller responsibility)
 *   - Q3 (a) Prisma direct ivaSalesBook lookup
 *   - Q4 page 1 batch lookup pattern Prisma direct findMany + Promise.all paralelo
 *   - Q5 (b) split A3-C4a (page 1 list) + A3-C4b (page 2 detail) por complejidad asimétrica
 *   - SubQ-α (lean) ivaSalesBook: null skip batch query — SaleList NO consume
 *     ivaSalesBook (D1 verified). §14 minimal scope. Mirror precedent A3-C3.5
 *     §13.W drop createdBy unused dep pattern.
 *   - SubQ-β receivable: null para list view — legacy include NO carga receivable
 *     en list view (D9 sale.repository.ts:30-58 saleInclude shape verified)
 *   - SubQ-γ 6 assertions α (3 positive hex + 3 negative legacy ausentes)
 *   - SubQ-δ import path `@/modules/sale/presentation/composition-root` precedent
 *     established (existing routes app/api/organizations/[orgSlug]/sales/route.ts:8)
 *
 * R5 banPrismaInPresentation scope verified ESTRICTAMENTE `modules/{module}/presentation/...`
 * (NO incluye `app/**`). Pages `app/(dashboard)/...` legacy presentation territory
 * NO sujeto R5. Precedent: `app/(dashboard)/[orgSlug]/audit/page.tsx:2` import
 * `prisma` direct. NO §13.Y emergente conflict.
 *
 * Expected failure cumulative (RED justificado, 6 assertions α source-shape mirror
 * A3-C2 c2-cutover-shape α1 pattern 6 positive + 6 negative; A3-C4a tiene 1
 * caller → 3+3):
 *   - Test 1 positive: `makeSaleService` import desde
 *     `@/modules/sale/presentation/composition-root` en sales/page.tsx
 *   - Test 2 positive: `toSaleWithDetails` import desde
 *     `@/modules/sale/presentation/mappers/sale-to-with-details.mapper`
 *   - Test 3 positive: `prisma` import desde `@/lib/prisma`
 *   - Test 4 negative: `new SaleService()` ABSENT (legacy class instantiation)
 *   - Test 5 negative: `@/features/sale/server` ABSENT (legacy barrel server)
 *   - Test 6 negative: `@/features/sale` ABSENT exact root barrel (regex
 *     anchored — preserva imports legítimos `@/features/sale/...` deep paths
 *     scope A3-C7 cleanup; NO present en page después GREEN)
 *
 * GREEN A3-C4a single commit β (mirror precedent A3-C2 atomic batch β1):
 *   - Modify `app/(dashboard)/[orgSlug]/sales/page.tsx`:
 *     · Replace `new SaleService()` con `makeSaleService()`
 *     · Add Prisma batch lookups contacts + periods Promise.all
 *     · Add Map<id,X> lookups
 *     · Map sales.map(s => toSaleWithDetails(s, {contact, period, receivable: null, ivaSalesBook: null}))
 *     · Drop `import { SaleService } from "@/features/sale/server"`
 *     · Add `import { makeSaleService } from "@/modules/sale/presentation/composition-root"`
 *     · Add `import { toSaleWithDetails } from "@/modules/sale/presentation/mappers/sale-to-with-details.mapper"`
 *     · Add `import { prisma } from "@/lib/prisma"`
 *
 * Self-contained future-proof check (lección A6 #5): shape test asserta path
 * `app/(dashboard)/[orgSlug]/sales/page.tsx` (Next.js page persistente). NO toca
 * `features/{sale,purchase}/*` que A3-C7/C8 borran wholesale. Self-contained vs
 * future deletes ✅.
 *
 * Cross-ref:
 * - architecture.md §13.T DTO shape divergence Sale entity vs SaleWithDetails
 * - architecture.md §13.W (engram-only) drop createdBy unused dep
 * - architecture.md §13.7 lecciones operacionales 9 cementadas
 * - engram bookmark `poc-nuevo/a3/c4a/locked` Marco locks heredados Q1-Q8 + SubQ-α-δ
 * - engram bookmark `poc-nuevo/a3/c3-5/closed` A3-C3.5 §13.W resolved
 * - engram bookmark `poc-nuevo/a3/c3/closed` A3-C3 mappers built
 * - engram bookmark `poc-nuevo/a3/c2/closed` A3-C2 cutover shape precedent
 * - features/sale/sale.repository.ts:30-58 (legacy saleInclude — list NO receivable D9)
 * - app/(dashboard)/[orgSlug]/audit/page.tsx:2 (Prisma direct app page precedent)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

const SALES_PAGE_PATH = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/sales/page.tsx",
);

describe("POC nuevo A3-C4a — cutover sales/page.tsx list view shape", () => {
  // ── Tests 1-3 positive: hex imports + mapper + Prisma ───────────────────────

  it("Test 1: sales/page.tsx imports `makeSaleService` from `@/modules/sale/presentation/composition-root` (hex cutover)", () => {
    const source = fs.readFileSync(SALES_PAGE_PATH, "utf8");
    expect(source).toMatch(
      /import\s*\{[^}]*\bmakeSaleService\b[^}]*\}\s*from\s*["']@\/modules\/sale\/presentation\/composition-root["']/,
    );
  });

  it("Test 2: sales/page.tsx imports `toSaleWithDetails` from mappers presentation (caller-passes-deps bridge)", () => {
    const source = fs.readFileSync(SALES_PAGE_PATH, "utf8");
    expect(source).toMatch(
      /import\s*\{[^}]*\btoSaleWithDetails\b[^}]*\}\s*from\s*["']@\/modules\/sale\/presentation\/mappers\/sale-to-with-details\.mapper["']/,
    );
  });

  it("Test 3: sales/page.tsx imports `prisma` from `@/lib/prisma` (Prisma direct batch lookups Q4)", () => {
    const source = fs.readFileSync(SALES_PAGE_PATH, "utf8");
    expect(source).toMatch(
      /import\s*\{[^}]*\bprisma\b[^}]*\}\s*from\s*["']@\/lib\/prisma["']/,
    );
  });

  // ── Tests 4-6 negative: legacy ausentes ─────────────────────────────────────

  it("Test 4: sales/page.tsx does NOT contain `new SaleService()` (legacy class instantiation absent)", () => {
    const source = fs.readFileSync(SALES_PAGE_PATH, "utf8");
    expect(source).not.toMatch(/new\s+SaleService\s*\(/);
  });

  it("Test 5: sales/page.tsx does NOT import from `@/features/sale/server` (legacy barrel server absent)", () => {
    const source = fs.readFileSync(SALES_PAGE_PATH, "utf8");
    expect(source).not.toMatch(/from\s*["']@\/features\/sale\/server["']/);
  });

  it("Test 6: sales/page.tsx does NOT import from exact `@/features/sale` root barrel (regex anchored — preserves deep paths future-proof)", () => {
    const source = fs.readFileSync(SALES_PAGE_PATH, "utf8");
    expect(source).not.toMatch(/from\s*["']@\/features\/sale["']/);
  });
});
