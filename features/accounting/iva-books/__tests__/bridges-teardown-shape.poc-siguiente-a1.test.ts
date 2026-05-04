/**
 * POC siguiente A1 — bridges teardown shape assertion (cumulative C1+C2).
 *
 * **A2-C3 update (lección A6 #5 §13.N)**: Test 2 DROPPED mismo RED commit A2-C3
 * porque leía `iva-books.service.ts` via fs.readFileSync — file será deleted
 * en A2-C3 GREEN atomic batch sub-paso 2 → ENOENT exception. Subsumed por file
 * existence assertion en `legacy-class-deletion-shape.poc-siguiente-a2.test.ts`
 * (file no existe ⇒ no declara interfaces). IVA_SERVICE_PATH constant removed
 * mismo RED commit.
 *
 * **A3-C7 update (lección A6 #5 §13.A3-C7-α)**: Test 4 DROPPED mismo RED commit
 * A3-C7 porque leía `features/sale/sale.service.ts` via fs.readFileSync — file
 * será deleted en A3-C7 GREEN atomic batch sub-paso 1 → ENOENT exception
 * (mirror exact §13.N A2-C3 pattern, lección A6 #5 empirical validation 2da
 * evidencia formal). Subsumed por file existence assertion Test 1 en
 * `c7-legacy-sale-deletion-shape.poc-nuevo-a3.test.ts` (file no existe ⇒ no
 * declara interface, redundancia trivial). SALE_SERVICE_PATH constant removed
 * mismo RED commit.
 *
 * **A3-C8 update (lección A6 #5 §13.A3-C8-α PROACTIVE 3ra evidencia formal)**:
 * Test 3 DROPPED mismo RED commit A3-C8 porque leía `features/purchase/
 * purchase.service.ts` via fs.readFileSync — file será deleted en A3-C8 GREEN
 * atomic batch sub-paso 1 → ENOENT exception (mirror exact §13.A3-C7-α + §13.N
 * A2-C3 pattern, lección A6 #5 PROACTIVE 3ra evidencia formal — pattern matures
 * cumulative cross-feature retirement). Subsumed por file existence assertion
 * Test 1 en `c8-legacy-purchase-deletion-shape.poc-nuevo-a3.test.ts` (file no
 * existe ⇒ no declara interface + no invoca cascade, redundancia trivial).
 * PURCHASE_SERVICE_PATH constant removed mismo RED commit.
 *
 * **§13.A3-C8-γ archivo entero DELETE A3-C8 GREEN (Marco Opción A1 lock —
 * mock_hygiene_commit_scope ANALOGUE para test files retirement)**: post Test 3
 * DROP solo Test 1 sobrevive en este archivo (`purchases/[purchaseId]/route.ts
 * no longer instantiates legacy IvaBooksService`). Invariant Test 1 subsumido
 * por A2-C3 wholesale `IvaBooksService` class deletion — `new IvaBooksService(`
 * compile error TSC, redundant safety net runtime shape vs compile-time
 * enforcement. GREEN A3-C8 atomic batch sub-paso 20 DELETE archivo entero
 * (cleanup completo retirement post 4 ciclos cumulative A1-C1 GREEN trans +
 * A2-C3 §13.N + A3-C7 §13.A3-C7-α + A3-C8 §13.A3-C8-α/γ). Razón Marco Opción
 * A1 (vs A2 defer Parte 2 doc-only): atomic preferred — A2 introduciría gap
 * temporal innecesario archivo con 1 test latente entre A3-C8 GREEN y Parte 2.
 *
 * Resultado post-A3-C8 RED: 1 test A1 (Test 1 ÚNICO sobreviviente) en este
 * archivo + 12 tests A2 (Tests 1-4 A2-C1+C1.5 + Tests 5-12 A2-C3) en sister
 * shape file `legacy-class-deletion-shape.poc-siguiente-a2.test.ts` + 8 tests
 * A3-C7 en sister shape file `c7-legacy-sale-deletion-shape.poc-nuevo-a3.test.ts`
 * + 9 tests A3-C8 en sister shape file `c8-legacy-purchase-deletion-shape.poc-
 * nuevo-a3.test.ts` (cumulative file existence assertions cross-feature legacy
 * retirement).
 *
 * Resultado post-A3-C8 GREEN: archivo DELETE wholesale (cleanup completo
 * retirement). Invariants históricos A1-C1 cumulative subsumidos por:
 * (a) Tests A2-C3 file existence iva-books wholesale class deletion (TSC
 * compile-time enforcement post wholesale class GONE), (b) Tests A3-C7 file
 * existence sale wholesale, (c) Tests A3-C8 file existence purchase wholesale.
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

// PURCHASE_SERVICE_PATH constant REMOVED en A3-C8 RED commit (lección A6 #5
// §13.A3-C8-α PROACTIVE 3ra evidencia formal): consumido únicamente por Test 3
// DROPPED — `features/purchase/purchase.service.ts` será deleted A3-C8 GREEN
// atomic batch sub-paso 1.

// SALE_SERVICE_PATH constant REMOVED en A3-C7 RED commit (lección A6 #5
// §13.A3-C7-α): consumido únicamente por Test 4 DROPPED — `features/sale/
// sale.service.ts` será deleted A3-C7 GREEN atomic batch sub-paso 1.

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

  // Test 3 DROPPED en A3-C8 RED commit (lección A6 #5 §13.A3-C8-α PROACTIVE
  // 3ra evidencia formal): shape test prev sub-fase NO self-contained contra
  // A3-C8 atomic delete `features/purchase/purchase.service.ts`. Original
  // verificaba `purchase.service.ts no longer wires
  // IvaBooksServiceForPurchaseCascade outbound (asimetría C1)` via
  // fs.readFileSync(PURCHASE_SERVICE_PATH, "utf8") — post-delete → ENOENT
  // exception (assertion fails by exception, NO `not.toMatch` clean).
  // Subsumed por file existence assertion Test 1 en `c8-legacy-purchase-
  // deletion-shape.poc-nuevo-a3.test.ts` (file no existe ⇒ no declara
  // interface + no invoca cascade, redundancia trivial). PURCHASE_SERVICE_PATH
  // constant removed mismo RED commit. Mirror exact §13.A3-C7-α + §13.N A2-C3
  // pattern (Tests 4 + 2 DROPPED bloques abajo, lección A6 #5 PROACTIVE pattern
  // matures cumulative cross-feature retirement).
  //
  // §13.A3-C8-γ (archivo entero DELETE A3-C8 GREEN — Marco Opción A1 lock):
  // post Test 3 DROP solo Test 1 sobrevive en este archivo (purchase route
  // ABSENCE invariant subsumido por A2-C3 wholesale `IvaBooksService` class
  // deletion — `new IvaBooksService(` compile error TSC, redundant safety net
  // runtime shape vs compile-time enforcement). GREEN A3-C8 atomic batch
  // sub-paso 20 DELETE archivo entero (cleanup completo retirement post 4
  // ciclos cumulative A1-C1 + A2-C3 + A3-C7 + A3-C8).

  // Test 4 DROPPED en A3-C7 RED commit (lección A6 #5 §13.A3-C7-α): shape
  // test prev sub-fase NO self-contained contra A3-C7 atomic delete `features/
  // sale/sale.service.ts`. Original verificaba `sale.service.ts no longer
  // wires IvaBooksServiceForSaleCascade outbound (asimetría C2)` via
  // fs.readFileSync(SALE_SERVICE_PATH, "utf8") — post-delete → ENOENT
  // exception (assertion fails by exception, NO `not.toMatch` clean).
  // Subsumed por file existence assertion Test 1 en `c7-legacy-sale-deletion-
  // shape.poc-nuevo-a3.test.ts` (file no existe ⇒ no declara interface,
  // redundancia trivial). SALE_SERVICE_PATH constant removed mismo RED commit.
  // Mirror exact §13.N A2-C3 pattern (Test 2 DROPPED bloque arriba).
});
