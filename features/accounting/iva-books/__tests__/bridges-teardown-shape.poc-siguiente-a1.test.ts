/**
 * POC siguiente A1-C1 RED — bridges teardown shape assertion.
 *
 * Expected failure (RED justificado, TS-N/A runtime assertion × 6):
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
 * Al terminar A1-C1 GREEN sub-pasos 2-6 este archivo debe pasar.
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

const IVA_SERVICE_PATH = path.join(
  REPO_ROOT,
  "features/accounting/iva-books/iva-books.service.ts",
);

const PURCHASE_SERVICE_PATH = path.join(
  REPO_ROOT,
  "features/purchase/purchase.service.ts",
);

describe("POC siguiente A1-C1 — bridges teardown shape assertion", () => {
  it("purchases/[purchaseId]/route.ts no longer instantiates legacy IvaBooksService", () => {
    const source = fs.readFileSync(ROUTE_PATH, "utf8");
    expect(source).not.toMatch(/new\s+IvaBooksService\s*\(/);
    expect(source).not.toMatch(
      /from\s+["']@\/features\/accounting\/iva-books\/server["']/,
    );
  });

  it("iva-books.service.ts no longer declares SaleServiceForBridge / PurchaseServiceForBridge interfaces", () => {
    const source = fs.readFileSync(IVA_SERVICE_PATH, "utf8");
    expect(source).not.toMatch(/interface\s+SaleServiceForBridge/);
    expect(source).not.toMatch(/interface\s+PurchaseServiceForBridge/);
  });

  it("purchase.service.ts no longer wires IvaBooksServiceForPurchaseCascade outbound (asimetría C1)", () => {
    const source = fs.readFileSync(PURCHASE_SERVICE_PATH, "utf8");
    expect(source).not.toMatch(/interface\s+IvaBooksServiceForPurchaseCascade/);
    expect(source).not.toMatch(
      /this\.ivaBooksService\.recomputeFromPurchaseCascade/,
    );
  });
});
