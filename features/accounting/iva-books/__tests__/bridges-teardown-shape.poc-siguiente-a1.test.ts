/**
 * POC siguiente A1 — bridges teardown shape assertion (cumulative C1+C2).
 *
 * **A2-C3 update (lección A6 #5 §13.N)**: Test 2 DROPPED mismo RED commit A2-C3
 * porque leía `iva-books.service.ts` via fs.readFileSync — file será deleted
 * en A2-C3 GREEN atomic batch sub-paso 2 → ENOENT exception. Subsumed por file
 * existence assertion en `legacy-class-deletion-shape.poc-siguiente-a2.test.ts`
 * (file no existe ⇒ no declara interfaces). IVA_SERVICE_PATH constant removed
 * mismo RED commit. Resultado post-A2-C3: 3 tests A1 (Tests 1, 3, 4) en este
 * archivo + 12 tests A2 (Tests 1-4 A2-C1+C1.5 + Tests 5-12 A2-C3) en el sister
 * shape file.
 *
 * Expected failure cumulative ORIGINAL (RED justificado, TS-N/A runtime assertion × 8):
 *
 * A1-C1 RED (Tests 1-3, transitioned GREEN at commits 7b7ff94 + b86c26d):
 *   - Test 1 "purchases/[purchaseId]/route.ts no longer instantiates legacy
 *     IvaBooksService" FALLA porque route.ts:8 contiene `new IvaBooksService()`
 *     todavía + import legacy `@/features/accounting/iva-books/server`. GREEN
 *     A1-C1 sub-paso 2 cierra el RED.
 *   - Test 2 "iva-books.service.ts no longer declares SaleServiceForBridge /
 *     PurchaseServiceForBridge interfaces" FALLA porque iva-books.service.ts
 *     declara ambas interfaces (líneas 82-110, 115-143). GREEN A1-C1 sub-paso 3
 *     cierra el RED.
 *   - Test 3 "purchase.service.ts no longer wires
 *     IvaBooksServiceForPurchaseCascade outbound" FALLA porque
 *     purchase.service.ts declara la interface (línea 60) + invoca el cascade
 *     en `editPosted` (línea 1078). GREEN A1-C1 sub-paso 2 (purchase outbound
 *     full asimetría) cierra el RED.
 *
 * A1-C2 RED (Test 4, transitará GREEN en sub-pasos C2):
 *   - Test 4 "sale.service.ts no longer wires IvaBooksServiceForSaleCascade
 *     outbound (asimetría C2)" FALLA porque sale.service.ts:59 declara la
 *     interface `IvaBooksServiceForSaleCascade` + sale.service.ts:926 invoca
 *     `this.ivaBooksService.recomputeFromSaleCascade` en `editPosted`. GREEN
 *     A1-C2 sub-pasos 1-3 (drop interface + ctor param/field/assignment + drop
 *     cascade invocation block) cierran el RED. Re-route via hex
 *     `IvaBookRegenNotifierPort` adapter `modules/sale/infrastructure/...`
 *     (Q5 verified tx-bound preserve POC #11.0c A4-c C2 GREEN P1 (b)).
 *
 * Al terminar A1-C1 + A1-C2 GREEN este archivo debe pasar (4 tests, 8 assertions).
 *
 * Asimetría legítima C1/C2 (post-pre-recon profundo): purchase outbound full
 * (interface + ctor param + field + invocation cascade chain) absorbido en
 * sub-paso 2 dado que ctor signature change colapsa cadena atómicamente. Sale
 * outbound vive en archivo distinto independiente (sale.service.ts:60-67 + 926)
 * y se mantiene scope C2. Mirror precedent A4-c granularity D' asimétrica.
 *
 * 6 sub-pasos visibles A1-C1 (granularity γ axis-based, paired RED+GREEN
 * atomic per A4-c precedent):
 *   1. Tests assert post-teardown shape (este archivo) — RED commit
 *   2. Cutover `purchases/[purchaseId]/route.ts:8` (drop `new IvaBooksService()`
 *      + adjust legacy `PurchaseService` ctor signature drop ivaBooksService
 *      param) + purchase outbound full (drop interface
 *      `IvaBooksServiceForPurchaseCascade` + ctor param/field + invocation
 *      cascade purchase.service.ts:1076-1078)
 *   3. Teardown `SaleServiceForBridge` + `PurchaseServiceForBridge` interface
 *      declarations en iva-books.service.ts líneas 82-110, 115-143
 *   4. Eliminate bridges ctor params + fields en `IvaBooksService` class
 *   5. Eliminate `maybeRegenerateJournal` helper (líneas 187-234) + invocations
 *   6. Eliminate 2 tests collateral
 *      `features/purchase/__tests__/{reactivate,unlink}-regenerates-journal.test.ts`
 *
 * Source-string assertion pattern: mirror `features/audit/__tests__/feature-boundaries.test.ts`.
 *
 * Cross-ref:
 * - architecture.md §19 (4 IVA bridges teardown defer pre-IVA-CRUD-hex-migration)
 * - engram bookmark `poc-11/0c/closed` (POC #11.0c CLOSED + A0/A0+ doc correction)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

const ROUTE_PATH = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/purchases/[purchaseId]/route.ts",
);

const PURCHASE_SERVICE_PATH = path.join(
  REPO_ROOT,
  "features/purchase/purchase.service.ts",
);

const SALE_SERVICE_PATH = path.join(
  REPO_ROOT,
  "features/sale/sale.service.ts",
);

describe("POC siguiente A1 — bridges teardown shape assertion", () => {
  it("purchases/[purchaseId]/route.ts no longer instantiates legacy IvaBooksService", () => {
    const source = fs.readFileSync(ROUTE_PATH, "utf8");
    expect(source).not.toMatch(/new\s+IvaBooksService\s*\(/);
    expect(source).not.toMatch(
      /from\s+["']@\/features\/accounting\/iva-books\/server["']/,
    );
  });

  // Test 2 DROPPED en A2-C3 RED commit (lección A6 #5 §13.N): shape test
  // prev sub-fase NO self-contained contra A2-C3 atomic delete iva-books.
  // service.ts. Original verificaba `iva-books.service.ts no longer declares
  // SaleServiceForBridge / PurchaseServiceForBridge interfaces` via
  // fs.readFileSync(IVA_SERVICE_PATH, "utf8") — post-delete → ENOENT
  // exception (assertion fails by exception, NO `not.toMatch` clean).
  // Subsumed por file existence assertion en `legacy-class-deletion-shape.
  // poc-siguiente-a2.test.ts` (file no existe ⇒ no declara interfaces,
  // redundancia trivial). IVA_SERVICE_PATH constant removed mismo RED commit.

  it("purchase.service.ts no longer wires IvaBooksServiceForPurchaseCascade outbound (asimetría C1)", () => {
    const source = fs.readFileSync(PURCHASE_SERVICE_PATH, "utf8");
    expect(source).not.toMatch(/interface\s+IvaBooksServiceForPurchaseCascade/);
    expect(source).not.toMatch(
      /this\.ivaBooksService\.recomputeFromPurchaseCascade/,
    );
  });

  it("sale.service.ts no longer wires IvaBooksServiceForSaleCascade outbound (asimetría C2)", () => {
    const source = fs.readFileSync(SALE_SERVICE_PATH, "utf8");
    expect(source).not.toMatch(/interface\s+IvaBooksServiceForSaleCascade/);
    expect(source).not.toMatch(
      /this\.ivaBooksService\.recomputeFromSaleCascade/,
    );
  });
});
