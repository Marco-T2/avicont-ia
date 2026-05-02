/**
 * POC nuevo A3-C2 — purchase consumers cutover shape (@/features/purchase barrel
 * → @/modules/purchase/presentation/{dto, schemas}).
 *
 * Axis: cutover 6 non-test consumers `@/features/purchase` root barrel
 * (types+schemas) a hex modules/purchase/presentation/* deep paths. Precondición
 * §13.R asimetría material RESUELTA A3-C1 GREEN (build hex purchase
 * presentation/dto + schemas).
 *
 * 6 consumers cutover scope (verificados pre-recon lectura individual):
 *   - 2 pages PurchaseType (type-only):
 *       app/(dashboard)/[orgSlug]/purchases/[purchaseId]/page.tsx (L8)
 *       app/(dashboard)/[orgSlug]/purchases/new/page.tsx (L7)
 *   - 2 components PurchaseWithDetails (type-only):
 *       components/purchases/purchase-form.tsx (L36)
 *       components/purchases/purchase-list.tsx (L46)
 *   - 2 routes Zod schemas (runtime value):
 *       app/api/organizations/[orgSlug]/purchases/route.ts (L3-6 multiline:
 *         createPurchaseSchema + purchaseFiltersSchema)
 *       app/api/organizations/[orgSlug]/purchases/[purchaseId]/route.ts (L4:
 *         updatePurchaseSchema)
 *
 * Marco lock α1 final RED (12 assertions = 6 positive source-shape +
 * 6 negative source-shape):
 *   - Tests 1-6 POSITIVE: cada consumer source contiene
 *     `from "@/modules/purchase/presentation/(dto|schemas)/..."` (cutover happened).
 *   - Tests 7-12 NEGATIVE: cada consumer source NO contiene barrel exact
 *     `from "@/features/purchase"` (sin path suffix — preserva imports deep
 *     `@/features/purchase/server` que pertenecen scope cutover A3-C4 callers
 *     `new PurchaseService()`). Future-proof contra accidental re-import legacy.
 *
 * NO §13 emergente nuevo este pre-recon — clean lecciones #1-#10 application.
 *
 * Self-contained future-proof check (lección A6 #5): shape test asserta paths
 * app/{...}/page.tsx + components/purchases/* + app/api/.../route.ts (consumers
 * que persisten post A3-C7/C8 wholesale deletes features/{sale,purchase}/*).
 * NO toca features/* que A3-C7/C8 borran. Self-contained vs future deletes ✅.
 *
 * Source-string assertion pattern: mirror `legacy-class-deletion-shape.poc-siguiente-a2.test.ts`
 * + `bridges-teardown-shape.poc-siguiente-a1.test.ts` + `asymmetry-shape.poc-nuevo-a3.test.ts`.
 *
 * §13.V resolution preserved: 4 type-only imports cutover NO introducen R5
 * violations (consumers en app/ + components/ NO son layers
 * domain/application/presentation; hex dto re-exporta Prisma `PurchaseType`
 * type-only ya cubierto carve-out A3-C1.5 banPrismaInPresentation
 * allowTypeImports: true).
 *
 * Cross-ref:
 * - architecture.md §13.R asimetría material RESUELTA A3-C1 GREEN
 * - architecture.md §13.V allowTypeImports presentation carve-out (A3-C1.5)
 * - engram bookmark `poc-nuevo/a3/c1/closed` (#1520) A3-C1+C1.5 CLOSED cumulative
 * - engram bookmark `poc-siguiente/a3/pre-recon-deferred-new-poc` (#1517) 6 consumers scope
 * - modules/purchase/presentation/dto/purchase-with-details.ts (hex target type-only consumers)
 * - modules/purchase/presentation/schemas/purchase.schemas.ts (hex target runtime consumers)
 * - modules/purchase/presentation/__tests__/asymmetry-shape.poc-nuevo-a3.test.ts (precedent A3-C1 RED)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

const PAGE_PURCHASE_DETAIL = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/purchases/[purchaseId]/page.tsx",
);
const PAGE_PURCHASE_NEW = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/purchases/new/page.tsx",
);
const COMPONENT_PURCHASE_FORM = path.join(
  REPO_ROOT,
  "components/purchases/purchase-form.tsx",
);
const COMPONENT_PURCHASE_LIST = path.join(
  REPO_ROOT,
  "components/purchases/purchase-list.tsx",
);
const ROUTE_PURCHASES_INDEX = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/purchases/route.ts",
);
const ROUTE_PURCHASES_DETAIL = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/purchases/[purchaseId]/route.ts",
);

const HEX_DTO_IMPORT_RE =
  /from\s*["']@\/modules\/purchase\/presentation\/dto\/purchase-with-details["']/;
const HEX_SCHEMAS_IMPORT_RE =
  /from\s*["']@\/modules\/purchase\/presentation\/schemas\/purchase\.schemas["']/;
const LEGACY_BARREL_IMPORT_RE = /from\s*["']@\/features\/purchase["']/;

describe("POC nuevo A3-C2 — purchase consumers cutover shape", () => {
  // ── POSITIVE source-shape (Tests 1-6) — hex import present ─────────────────

  it("Test 1: page purchases/[purchaseId] imports PurchaseType from hex dto/purchase-with-details", () => {
    const source = fs.readFileSync(PAGE_PURCHASE_DETAIL, "utf8");
    expect(source).toMatch(HEX_DTO_IMPORT_RE);
  });

  it("Test 2: page purchases/new imports PurchaseType from hex dto/purchase-with-details", () => {
    const source = fs.readFileSync(PAGE_PURCHASE_NEW, "utf8");
    expect(source).toMatch(HEX_DTO_IMPORT_RE);
  });

  it("Test 3: component purchase-form imports PurchaseWithDetails from hex dto/purchase-with-details", () => {
    const source = fs.readFileSync(COMPONENT_PURCHASE_FORM, "utf8");
    expect(source).toMatch(HEX_DTO_IMPORT_RE);
  });

  it("Test 4: component purchase-list imports PurchaseWithDetails from hex dto/purchase-with-details", () => {
    const source = fs.readFileSync(COMPONENT_PURCHASE_LIST, "utf8");
    expect(source).toMatch(HEX_DTO_IMPORT_RE);
  });

  it("Test 5: route purchases/route imports createPurchaseSchema + purchaseFiltersSchema from hex schemas/purchase.schemas", () => {
    const source = fs.readFileSync(ROUTE_PURCHASES_INDEX, "utf8");
    expect(source).toMatch(HEX_SCHEMAS_IMPORT_RE);
  });

  it("Test 6: route purchases/[purchaseId]/route imports updatePurchaseSchema from hex schemas/purchase.schemas", () => {
    const source = fs.readFileSync(ROUTE_PURCHASES_DETAIL, "utf8");
    expect(source).toMatch(HEX_SCHEMAS_IMPORT_RE);
  });

  // ── NEGATIVE source-shape (Tests 7-12) — legacy barrel absent ──────────────
  // Future-proof contra accidental re-import legacy `@/features/purchase` exact
  // barrel. NO toca `@/features/purchase/server` (A3-C4 callers scope deferred).

  it("Test 7: page purchases/[purchaseId] does NOT import from legacy barrel @/features/purchase", () => {
    const source = fs.readFileSync(PAGE_PURCHASE_DETAIL, "utf8");
    expect(source).not.toMatch(LEGACY_BARREL_IMPORT_RE);
  });

  it("Test 8: page purchases/new does NOT import from legacy barrel @/features/purchase", () => {
    const source = fs.readFileSync(PAGE_PURCHASE_NEW, "utf8");
    expect(source).not.toMatch(LEGACY_BARREL_IMPORT_RE);
  });

  it("Test 9: component purchase-form does NOT import from legacy barrel @/features/purchase", () => {
    const source = fs.readFileSync(COMPONENT_PURCHASE_FORM, "utf8");
    expect(source).not.toMatch(LEGACY_BARREL_IMPORT_RE);
  });

  it("Test 10: component purchase-list does NOT import from legacy barrel @/features/purchase", () => {
    const source = fs.readFileSync(COMPONENT_PURCHASE_LIST, "utf8");
    expect(source).not.toMatch(LEGACY_BARREL_IMPORT_RE);
  });

  it("Test 11: route purchases/route does NOT import from legacy barrel @/features/purchase", () => {
    const source = fs.readFileSync(ROUTE_PURCHASES_INDEX, "utf8");
    expect(source).not.toMatch(LEGACY_BARREL_IMPORT_RE);
  });

  it("Test 12: route purchases/[purchaseId]/route does NOT import from legacy barrel @/features/purchase", () => {
    const source = fs.readFileSync(ROUTE_PURCHASES_DETAIL, "utf8");
    expect(source).not.toMatch(LEGACY_BARREL_IMPORT_RE);
  });
});
