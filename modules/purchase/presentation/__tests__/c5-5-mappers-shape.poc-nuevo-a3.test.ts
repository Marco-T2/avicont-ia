/**
 * POC nuevo A3-C5.5 — atomic build purchase presentation mappers + drop
 * createdBy paired (§13.W-purchase resolution).
 *
 * Atomic single ciclo collapse A3-C3 + A3-C3.5 sale precedent (Marco lock
 * Q-final-1) — pre-recon expand profundo discovered:
 *   - createdBy production cero consumers purchase-list.tsx + purchase-form.tsx
 *     + components/purchases/*.tsx non-test (mirror sale §13.W resolution).
 *   - hex `purchaseInclude = { details only }` siempre `payable: null` —
 *     §13.X-purchase MATERIAL preparation Prisma direct caller-passes-deps
 *     mapper signature (mirror sale §13.X exact, A3-C6b/c resolution).
 *
 * Marco locks Q-final 1-5 (engram poc-nuevo/a3/c5-5/locked):
 *   - Q-final-1 atomic single ciclo build mapper + drop createdBy paired
 *   - Q-final-2 split A3-C6a/b/c (granularity 13) — bisect-friendly asimetría
 *     real callers (page list trivial vs page detail con deps vs routes
 *     interdependientes routes 3+4 atomic juntas C6c)
 *   - Q-final-3 DEFER §13.AB+AC-purchase A3-C8 doc-only — scope creep avoid
 *     + mirror sale precedent latent bug acceptance
 *   - Q-final-4 mapper signature confirmed: NO createdBy deps + payable
 *     Prisma direct caller-passes-deps mirror sale §13.X exact
 *   - Q-final-5 procedé RED + GREEN + commit
 *
 * Mapper export shape × 7 + drop axis × 2 = 9 assertions α RED:
 *   - Test 1 file existence: mappers/purchase-to-with-details.mapper.ts exists
 *   - Test 2 computeDisplayCode export (utility TYPE_PREFIXES per purchaseType
 *     `FL/PF/CG/SV` vs sale fixed `VG`, throws null SubQ-d invariant mirror sale)
 *   - Test 3 toContactSummary export (passthrough)
 *   - Test 4 toPeriodSummary export (passthrough)
 *   - Test 5 toPayableSummary export (Prisma raw → DTO Decimal→number §13.X
 *     preparation — divergencia vs sale toReceivableSummary same structural
 *     pattern, replaces sale receivable concept con purchase payable)
 *   - Test 6 toPurchaseDetailRow export (domain PurchaseDetail entity → DTO
 *     12+ optional fields PolloFaenado/Flete/General/Servicio handling)
 *   - Test 7 toPurchaseWithDetails export (main compositor caller-passes-deps)
 *   - Test 8 mapper file `\bcreatedBy\b` ABSENT (cubre: NO CreatedByRaw type
 *     + NO toCreatedBySummary fn + NO ToPurchaseWithDetailsDeps.createdBy
 *     field + NO main compositor createdBy assignment — full drop axis 4 refs)
 *   - Test 9 DTO file `\bcreatedBy\b` ABSENT (cubre: PurchaseWithDetails.
 *     createdBy `{ id, name, email }` field drop; createdById preservado via
 *     `Omit<Purchase, ...>` pass-through Prisma type field)
 *
 * Word boundary `\bcreatedBy\b` regex evita false-positive con `createdById`
 * (sufijo `Id` rompe match exacto — verified mirror sale precedent A3-C3.5).
 *
 * Expected failure cumulative (RED justificado, 9 assertions α — todos fail
 * pre-GREEN, ENOENT cascade declared explicit mirror sale c3-mappers-shape
 * precedent líneas 39-49):
 *
 *   - Test 1: FAILS — `mappers/` dir does NOT exist pre-GREEN
 *   - Tests 2-7: FAIL with ENOENT readFileSync error — mapper file absent
 *     (cascade from Test 1; resolves single GREEN sub-paso file build)
 *   - Test 8: FAIL with ENOENT readFileSync error — mapper file absent (drop
 *     axis cannot evaluate yet, cascade)
 *   - Test 9: FAILS — DTO `purchase-with-details.ts:104-108` contains
 *     `createdBy: { id, name, email }` field pre-GREEN drop
 *
 * GREEN A3-C5.5 atomic batch β (mirror precedent A3-C3 atomic + A3-C3.5
 * paired collapsed):
 *   - Build mapper.ts (~250 LOC mirror sale 229 + purchase-specific overhead)
 *   - Drop createdBy from DTO purchase-with-details.ts
 *   - Reactive lección #11 fixture cleanup if TSC fail mid-GREEN
 *
 * Self-contained future-proof check (lección A6 #5): shape test asserta paths
 * modules/purchase/presentation/* (hex que persiste). NO toca features/{sale,
 * purchase}/* que A3-C7/C8 borran wholesale. Self-contained vs future deletes.
 *
 * Source-string assertion pattern: mirror sale precedent c3-mappers-shape +
 * c3-5-drop-created-by-shape. Regex export shape flexible `(function|const)`
 * para tolerar GREEN implementation freedom (function declaration vs const
 * arrow). Coupling intencional al name binding, NO a la sintaxis de declaración.
 *
 * §13.V resolution preserved: mappers son TS puros (NO Prisma type runtime
 * imports directos en mapper module — solo Prisma type-only `import type`
 * permitido per allowTypeImports R5 carve-out A3-C1.5).
 *
 * Cross-ref:
 * - architecture.md §13.W (sale resolution) — purchase analogue resuelto este ciclo
 * - architecture.md §13.X (sale resolution Prisma direct) — purchase analogue C6b/c
 * - architecture.md §13.7 lecciones operacionales 9 cementadas
 * - engram bookmark `poc-nuevo/a3/c5-5/locked` Marco locks Q-final 1-5
 * - engram bookmark `poc-nuevo/a3/c5/closed` (#1534) A3-C5 cumulative + computeDisplayCode reuse
 * - engram bookmark `poc-nuevo/a3/c3-5/closed` paired §13.W resolution sale precedent
 * - engram bookmark `poc-nuevo/a3/c3/closed` (#1525) A3-C3 build sale mappers precedent
 * - components/purchases/purchase-list.tsx (production NO consume createdBy verified pre-recon)
 * - components/purchases/purchase-form.tsx (production NO consume createdBy verified pre-recon)
 * - features/purchase/purchase.utils.ts:47-49 (legacy getDisplayCode formula reference)
 * - modules/purchase/application/purchase.service.ts:46-51 (TYPE_PREFIXES FL/PF/CG/SV)
 * - modules/purchase/presentation/dto/purchase-with-details.ts (target shape destination)
 * - modules/purchase/infrastructure/prisma-purchase.repository.ts:31-39 (hex include = details only, payable null doc explicit)
 * - modules/purchase/application/purchase.service.ts:109-119 (hex .list/.getById return Purchase entity)
 * - modules/sale/presentation/mappers/sale-to-with-details.mapper.ts (229 LOC reusable structure)
 * - modules/sale/presentation/__tests__/c3-mappers-shape.poc-nuevo-a3.test.ts (RED template precedent)
 * - modules/sale/presentation/__tests__/c3-5-drop-created-by-shape.poc-nuevo-a3.test.ts (negative drop precedent)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

const PURCHASE_MAPPER_PATH = path.join(
  REPO_ROOT,
  "modules/purchase/presentation/mappers/purchase-to-with-details.mapper.ts",
);

const PURCHASE_DTO_PATH = path.join(
  REPO_ROOT,
  "modules/purchase/presentation/dto/purchase-with-details.ts",
);

describe("POC nuevo A3-C5.5 — atomic build purchase mappers + drop createdBy paired (§13.W-purchase)", () => {
  // ── File existence (Test 1) ───────────────────────────────────────────────────

  it("Test 1: modules/purchase/presentation/mappers/purchase-to-with-details.mapper.ts exists (mapper module build)", () => {
    expect(fs.existsSync(PURCHASE_MAPPER_PATH)).toBe(true);
  });

  // ── Export shape × 6 (Tests 2-7) — caller-passes-deps mapper symbols ─────────

  it("Test 2: mapper exports computeDisplayCode (utility TYPE_PREFIXES per purchaseType, throws null SubQ-d invariant mirror sale)", () => {
    const source = fs.readFileSync(PURCHASE_MAPPER_PATH, "utf8");
    expect(source).toMatch(/export\s+(?:function|const)\s+computeDisplayCode\b/);
  });

  it("Test 3: mapper exports toContactSummary (sub-mapper passthrough)", () => {
    const source = fs.readFileSync(PURCHASE_MAPPER_PATH, "utf8");
    expect(source).toMatch(/export\s+(?:function|const)\s+toContactSummary\b/);
  });

  it("Test 4: mapper exports toPeriodSummary (sub-mapper passthrough)", () => {
    const source = fs.readFileSync(PURCHASE_MAPPER_PATH, "utf8");
    expect(source).toMatch(/export\s+(?:function|const)\s+toPeriodSummary\b/);
  });

  it("Test 5: mapper exports toPayableSummary (sub-mapper Prisma raw → DTO Decimal→number, §13.X-purchase preparation)", () => {
    const source = fs.readFileSync(PURCHASE_MAPPER_PATH, "utf8");
    expect(source).toMatch(/export\s+(?:function|const)\s+toPayableSummary\b/);
  });

  it("Test 6: mapper exports toPurchaseDetailRow (sub-mapper domain PurchaseDetail → DTO 12+ optional fields)", () => {
    const source = fs.readFileSync(PURCHASE_MAPPER_PATH, "utf8");
    expect(source).toMatch(/export\s+(?:function|const)\s+toPurchaseDetailRow\b/);
  });

  it("Test 7: mapper exports toPurchaseWithDetails (main compositor caller-passes-deps)", () => {
    const source = fs.readFileSync(PURCHASE_MAPPER_PATH, "utf8");
    expect(source).toMatch(/export\s+(?:function|const)\s+toPurchaseWithDetails\b/);
  });

  // ── Drop axis × 2 (Tests 8-9) — §13.W-purchase resolution mirror A3-C3.5 ─────

  it("Test 8: mapper file does NOT contain `createdBy` (full drop axis — 4 references)", () => {
    const source = fs.readFileSync(PURCHASE_MAPPER_PATH, "utf8");
    expect(source).not.toMatch(/\bcreatedBy\b/);
  });

  it("Test 9: PurchaseWithDetails DTO file does NOT contain `createdBy` field (DTO drop)", () => {
    const source = fs.readFileSync(PURCHASE_DTO_PATH, "utf8");
    expect(source).not.toMatch(/\bcreatedBy\b/);
  });
});
