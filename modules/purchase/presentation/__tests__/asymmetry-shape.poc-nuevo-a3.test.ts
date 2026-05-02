/**
 * POC nuevo A3-C1 — purchase presentation asymmetry shape (build hex precondición §13.R).
 *
 * Axis: build hex modules/purchase/presentation/{dto, schemas} mirror sale precedent
 * bit-exact desde features/purchase/{purchase.types.ts, purchase.validation.ts}.
 *
 * Asimetría material §13.R cementada A3 pre-recon: modules/sale/presentation/{dto,
 * schemas}/ ✅ existen vs modules/purchase/presentation/ solo composition-root.ts
 * (NO dto + NO schemas). 6 consumers @/features/purchase root barrel (types+schemas)
 * requieren hex equivalent build pre-cutover (A3-C2).
 *
 * Expected failure cumulative (RED justificado, 10 assertions α file existence × 2 +
 * export shape × 8):
 *
 * A3-C1 RED (Tests 1-10, GREEN al cierre A3-C1):
 *   - Tests 1-2 file existence: purchase-with-details.ts + purchase.schemas.ts NO
 *     existen (asimetría material §13.R). GREEN A3-C1 sub-paso 1+2 build files.
 *   - Tests 3-7 dto export shape: 4 interfaces mirror sale precedent
 *     (PaymentAllocationSummary + PayableSummary + PurchaseDetailRow +
 *     PurchaseWithDetails) + Test 7 re-export PurchaseType + PurchaseStatus de
 *     Prisma (asimetría legítima vs sale: 6 consumers consumen PurchaseType — sale
 *     tiene 0 consumers root barrel). GREEN A3-C1 sub-paso 1 build
 *     dto/purchase-with-details.ts paridad bit-exact features/purchase/purchase.types.ts
 *     L11 + L16-102.
 *   - Tests 8-10 schemas export shape: 3 Zod schemas (createPurchaseSchema +
 *     updatePurchaseSchema + purchaseFiltersSchema) — Q5 lock Marco (a) mirror
 *     legacy estricto: NO purchaseStatusSchema (legacy purchase.validation.ts NO
 *     tiene; status endpoint schema inline ad-hoc resolved §13 emergente futuro
 *     NO scope creep A3-C1). GREEN A3-C1 sub-paso 2 build schemas/purchase.schemas.ts
 *     paridad bit-exact features/purchase/purchase.validation.ts L28-65.
 *
 * Self-contained future-proof check (lección A6 #5): shape test asserta paths
 * modules/purchase/presentation/* (hex que persiste). NO toca features/{sale,
 * purchase}/* que A3-C7/C8 borran wholesale. Self-contained vs future deletes
 * A3-C2..C8 ✅.
 *
 * Source-string assertion pattern: mirror `legacy-class-deletion-shape.poc-siguiente-a2.test.ts`
 * + `bridges-teardown-shape.poc-siguiente-a1.test.ts`.
 *
 * Cross-ref:
 * - architecture.md §13.R asimetría material modules/purchase NO presentation/dto+schemas
 * - architecture.md §18.4 fila POC siguiente A3 deferral → POC nuevo dedicado
 * - engram bookmark `poc-siguiente/closed` (#1518) POC anterior CLOSED cumulative
 * - engram bookmark `poc-siguiente/a3/pre-recon-deferred-new-poc` (#1517) A3 starting state
 * - features/purchase/purchase.types.ts (legacy mirror target migración bit-exact)
 * - features/purchase/purchase.validation.ts (legacy mirror target migración bit-exact)
 * - modules/sale/presentation/dto/sale-with-details.ts + schemas/sale.schemas.ts (hex precedent simétrico)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

const PURCHASE_DTO_PATH = path.join(
  REPO_ROOT,
  "modules/purchase/presentation/dto/purchase-with-details.ts",
);
const PURCHASE_SCHEMAS_PATH = path.join(
  REPO_ROOT,
  "modules/purchase/presentation/schemas/purchase.schemas.ts",
);

describe("POC nuevo A3-C1 — purchase presentation asymmetry shape", () => {
  // ── File existence (Tests 1-2) ─────────────────────────────────────────────

  it("Test 1: modules/purchase/presentation/dto/purchase-with-details.ts exists (asimetría §13.R closed)", () => {
    expect(fs.existsSync(PURCHASE_DTO_PATH)).toBe(true);
  });

  it("Test 2: modules/purchase/presentation/schemas/purchase.schemas.ts exists (asimetría §13.R closed)", () => {
    expect(fs.existsSync(PURCHASE_SCHEMAS_PATH)).toBe(true);
  });

  // ── DTO export shape (Tests 3-7) ───────────────────────────────────────────

  it("Test 3: dto exports interface PaymentAllocationSummary (mirror sale precedent + legacy purchase.types)", () => {
    const source = fs.readFileSync(PURCHASE_DTO_PATH, "utf8");
    expect(source).toMatch(/export\s+interface\s+PaymentAllocationSummary\b/);
  });

  it("Test 4: dto exports interface PayableSummary (asimetría legítima vs sale ReceivableSummary)", () => {
    const source = fs.readFileSync(PURCHASE_DTO_PATH, "utf8");
    expect(source).toMatch(/export\s+interface\s+PayableSummary\b/);
  });

  it("Test 5: dto exports interface PurchaseDetailRow (paridad bit-exact features/purchase/purchase.types.ts L37-61)", () => {
    const source = fs.readFileSync(PURCHASE_DTO_PATH, "utf8");
    expect(source).toMatch(/export\s+interface\s+PurchaseDetailRow\b/);
  });

  it("Test 6: dto exports interface PurchaseWithDetails (paridad bit-exact features/purchase/purchase.types.ts L63-102)", () => {
    const source = fs.readFileSync(PURCHASE_DTO_PATH, "utf8");
    expect(source).toMatch(/export\s+interface\s+PurchaseWithDetails\b/);
  });

  it("Test 7: dto re-exports PurchaseType + PurchaseStatus from Prisma client (asimetría legítima vs sale: 6 consumers PurchaseType)", () => {
    const source = fs.readFileSync(PURCHASE_DTO_PATH, "utf8");
    expect(source).toMatch(
      /export\s+type\s*\{[^}]*\bPurchaseType\b[^}]*\}/,
    );
    expect(source).toMatch(
      /export\s+type\s*\{[^}]*\bPurchaseStatus\b[^}]*\}/,
    );
  });

  // ── Schemas export shape (Tests 8-10) — Q5 lock (a) mirror legacy estricto ─

  it("Test 8: schemas exports const createPurchaseSchema (Zod, paridad legacy purchase.validation.ts L28-41)", () => {
    const source = fs.readFileSync(PURCHASE_SCHEMAS_PATH, "utf8");
    expect(source).toMatch(/export\s+const\s+createPurchaseSchema\s*=/);
  });

  it("Test 9: schemas exports const updatePurchaseSchema (Zod, paridad legacy purchase.validation.ts L43-54)", () => {
    const source = fs.readFileSync(PURCHASE_SCHEMAS_PATH, "utf8");
    expect(source).toMatch(/export\s+const\s+updatePurchaseSchema\s*=/);
  });

  it("Test 10: schemas exports const purchaseFiltersSchema (Zod, paridad legacy purchase.validation.ts L56-65)", () => {
    const source = fs.readFileSync(PURCHASE_SCHEMAS_PATH, "utf8");
    expect(source).toMatch(/export\s+const\s+purchaseFiltersSchema\s*=/);
  });
});
