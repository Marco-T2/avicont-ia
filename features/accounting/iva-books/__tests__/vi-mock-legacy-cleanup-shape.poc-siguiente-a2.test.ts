/**
 * POC siguiente A2-C2 — vi.mock factory legacy cleanup shape (axis distinto vs A2-C1/C3 cumulative legacy-class-deletion-shape).
 *
 * Axis orthogonality (3 archivos shape POC siguiente A1+A2):
 *   - bridges-teardown-shape.poc-siguiente-a1.test.ts: bridges teardown interfaces axis (A1)
 *   - legacy-class-deletion-shape.poc-siguiente-a2.test.ts: legacy class file existence + TASA_IVA migration axis (A2-C1 + A2-C3 cumulative)
 *   - vi-mock-legacy-cleanup-shape.poc-siguiente-a2.test.ts: vi.mock factory cleanup axis (A2-C2 — ESTE archivo)
 *
 * Expected failure A2-C2 RED (8 assertions α, axis source-text vi.mock factory keys):
 *   - 6 Cat A (CRUD non-LIST: sales/purchases × {[id], reactivate, void}): vi.mock("@/features/accounting/iva-books/server", ...) factory contiene `IvaBooksService:` + `IvaBooksRepository:` keys actualmente. GREEN A2-C2 sub-pasos drop vi.mock block + var mockLegacyServiceInstance unused.
 *   - 2 Cat B (CRUD LIST: sales L157 + purchases L160): además de factory keys, contiene L157/L160 `mockLegacyServiceInstance.list*ByPeriod.mockResolvedValue([])` runtime config residual. GREEN sub-pasos drop vi.mock block + L157/L160 line + var def + scout verify isolated runtime pre-commit (Q8 lock Marco).
 *
 * Cat C 2 archivos EXCLUDED scope A2-C2 (factory ya clean, single key `exportIvaBookExcel:`):
 *   - app/api/organizations/[orgSlug]/iva-books/sales/export/__tests__/route.test.ts
 *   - app/api/organizations/[orgSlug]/iva-books/purchases/export/__tests__/route.test.ts
 *
 * Discrimination factor (Q7 α + §13.K cementación path heuristic false positives):
 *   Regex `/IvaBooks(Service|Repository):\s*vi\.fn\(/` discrimina factory KEY syntax
 *   (`Name: vi.fn(`) contra JSDoc references texto natural (`IvaBooksService` sin `:`
 *   inmediato siguiente — §13.M defer A6 cosmetic). Cat A/B post-cleanup pierden
 *   factory completo → regex 0 match. Cat C pre-existente NO contiene factory keys
 *   legacy → regex 0 match (validado pre-RED via lectura individual lección A6 #7).
 *   Self-contained §13.J: no depende de target legacy class files (que serán deleted
 *   A2-C3) — assertions referencian source-text archivos test que persisten.
 *
 * Locks Q6-Q9 Marco A2-C2 (lock chain confirmed cross-check independent):
 *   - Q6 (scope 8 archivos): Cat A 6 + Cat B 2 confirmado, Cat C 2 EXCLUDED.
 *   - Q7 (α 8 assertions): 1 expect por archivo, single regex axis-distinto, NO γ baseline-pass.
 *   - Q8 (Cat B drop unconditional vs verify): drop + scout verify isolated pre-commit Cat B.
 *   - Q9 (lección A6 #7): scope shrink in-flight via lectura individual obligatoria pre-clasificación.
 *
 * Source-string assertion pattern: mirror legacy-class-deletion-shape + bridges-teardown-shape.
 *
 * Cross-ref:
 *   - engram bookmark `poc-siguiente/a2/c1/closed` (#1508) — Step 0 forward A2-C2
 *   - lección A6 #2 (lock regex requires target file read pre-RED) — cementada A2-C1
 *   - lección A6 #7 (scope shrink in-flight via lectura individual) — cementar post-GREEN
 *   - lección A6 #8 (re-pre-recon independent cross-check próxima sesión) — cementar post-GREEN
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

const FACTORY_KEY_REGEX = /IvaBooks(Service|Repository):\s*vi\.fn\(/;

// Cat A — 6 archivos CRUD non-LIST (sales/purchases × {[id], reactivate, void})
const SALES_GET_BY_ID_TEST = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/iva-books/sales/[id]/__tests__/route.test.ts",
);
const SALES_REACTIVATE_TEST = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/iva-books/sales/[id]/reactivate/__tests__/route.test.ts",
);
const SALES_VOID_TEST = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/iva-books/sales/[id]/void/__tests__/route.test.ts",
);
const PURCHASES_GET_BY_ID_TEST = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/iva-books/purchases/[id]/__tests__/route.test.ts",
);
const PURCHASES_REACTIVATE_TEST = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/iva-books/purchases/[id]/reactivate/__tests__/route.test.ts",
);
const PURCHASES_VOID_TEST = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/iva-books/purchases/[id]/void/__tests__/route.test.ts",
);

// Cat B — 2 archivos CRUD LIST (runtime config L157/L160 mockLegacyServiceInstance)
const SALES_LIST_TEST = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/iva-books/sales/__tests__/route.test.ts",
);
const PURCHASES_LIST_TEST = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/iva-books/purchases/__tests__/route.test.ts",
);

describe("POC siguiente A2-C2 — vi.mock factory legacy cleanup shape", () => {
  // ── Cat A (6) — CRUD non-LIST: factory key drop unconditional ──────────────
  it("sales/[id]/__tests__/route.test.ts factory drops IvaBooksService/Repository legacy keys (Cat A)", () => {
    const source = fs.readFileSync(SALES_GET_BY_ID_TEST, "utf8");
    expect(source).not.toMatch(FACTORY_KEY_REGEX);
  });

  it("sales/[id]/reactivate/__tests__/route.test.ts factory drops IvaBooksService/Repository legacy keys (Cat A)", () => {
    const source = fs.readFileSync(SALES_REACTIVATE_TEST, "utf8");
    expect(source).not.toMatch(FACTORY_KEY_REGEX);
  });

  it("sales/[id]/void/__tests__/route.test.ts factory drops IvaBooksService/Repository legacy keys (Cat A)", () => {
    const source = fs.readFileSync(SALES_VOID_TEST, "utf8");
    expect(source).not.toMatch(FACTORY_KEY_REGEX);
  });

  it("purchases/[id]/__tests__/route.test.ts factory drops IvaBooksService/Repository legacy keys (Cat A)", () => {
    const source = fs.readFileSync(PURCHASES_GET_BY_ID_TEST, "utf8");
    expect(source).not.toMatch(FACTORY_KEY_REGEX);
  });

  it("purchases/[id]/reactivate/__tests__/route.test.ts factory drops IvaBooksService/Repository legacy keys (Cat A)", () => {
    const source = fs.readFileSync(PURCHASES_REACTIVATE_TEST, "utf8");
    expect(source).not.toMatch(FACTORY_KEY_REGEX);
  });

  it("purchases/[id]/void/__tests__/route.test.ts factory drops IvaBooksService/Repository legacy keys (Cat A)", () => {
    const source = fs.readFileSync(PURCHASES_VOID_TEST, "utf8");
    expect(source).not.toMatch(FACTORY_KEY_REGEX);
  });

  // ── Cat B (2) — CRUD LIST: factory key drop + L157/L160 runtime config drop ─
  it("sales/__tests__/route.test.ts (LIST) factory drops IvaBooksService/Repository legacy keys (Cat B — paired drop L157 mockLegacyServiceInstance.listSalesByPeriod runtime config)", () => {
    const source = fs.readFileSync(SALES_LIST_TEST, "utf8");
    expect(source).not.toMatch(FACTORY_KEY_REGEX);
  });

  it("purchases/__tests__/route.test.ts (LIST) factory drops IvaBooksService/Repository legacy keys (Cat B — paired drop L160 mockLegacyServiceInstance.listPurchasesByPeriod runtime config)", () => {
    const source = fs.readFileSync(PURCHASES_LIST_TEST, "utf8");
    expect(source).not.toMatch(FACTORY_KEY_REGEX);
  });
});
