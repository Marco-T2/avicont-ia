/**
 * POC siguiente A1-C1 RED — bridges teardown shape assertion.
 *
 * Expected failure (RED justificado, TS-N/A runtime assertion):
 *   - "purchases/[purchaseId]/route.ts no longer instantiates legacy
 *     IvaBooksService" FALLA porque route.ts:8 contiene `new IvaBooksService()`
 *     todavía + import legacy `@/features/accounting/iva-books/server`. GREEN
 *     A1-C1 sub-paso 2 cierra el RED.
 *   - "iva-books.service.ts no longer declares SaleServiceForBridge /
 *     PurchaseServiceForBridge interfaces" FALLA porque iva-books.service.ts
 *     declara ambas interfaces (líneas 82-110, 115-143). GREEN A1-C1 sub-paso 3
 *     cierra el RED.
 *
 * Al terminar A1-C1 GREEN sub-pasos 2-6 este archivo debe pasar.
 *
 * 6 sub-pasos visibles A1-C1 (granularity γ axis-based, paired RED+GREEN
 * atomic per A4-c precedent):
 *   1. Tests assert post-teardown shape (este archivo) — RED commit
 *   2. Cutover `purchases/[purchaseId]/route.ts:8` (drop `new IvaBooksService()`
 *      + adjust legacy `PurchaseService` ctor signature drop ivaBooksService param)
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
});
