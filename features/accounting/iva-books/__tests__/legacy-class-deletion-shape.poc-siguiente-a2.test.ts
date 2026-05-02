/**
 * POC siguiente A2 — legacy class deletion + TASA_IVA migration shape (cumulative C1+C2+C3).
 *
 * Expected failure cumulative (RED justificado, TS-N/A runtime assertion × 4 for C1):
 *
 * A2-C1 RED (Tests 1-4, transitarán GREEN en sub-pasos C1):
 *   - Test 1 "iva-calc.utils.ts exports TASA_IVA Decimal('0.1300')" FALLA porque
 *     iva-calc.utils.ts:12 actualmente declara `const TASA_IVA = new Prisma.Decimal("0.13")`
 *     local NO exported + valor textual "0.13" (drop trailing zero rompe P3.4
 *     textual lock). GREEN A2-C1 sub-paso 1 (convert const → export const +
 *     harmonize "0.13" → "0.1300" + JSDoc migrate del legacy + cite P3.4) cierra.
 *   - Test 2-4 (post-A2-C1.5): import path target = top-level barrel
 *     `@/features/accounting/iva-books` (NO deep `/iva-calc.utils`). Discriminación
 *     vía binding capture regex `import { TASA_IVA } from ...` evita premature
 *     green via type imports preexistentes (IvaSalesBookDTO/IvaPurchaseBookDTO
 *     importados del top-level barrel para types — diferente binding).
 *
 * A2-C1.5 follow-up RED+GREEN (post §13.H + §13.I emergentes):
 *   - §13.H REQ-FMB.5: deep import `iva-calc.utils` desde `app/` violó feature
 *     boundary (8 violations REQ-FMB.4 baseline + 2 violations REQ-FMB.5
 *     emergentes A2-C1). Fix: re-export TASA_IVA via index.ts top-level barrel
 *     + redirect 4 consumers a top-level path (NO deep).
 *   - §13.I premature green: regex sin binding capture matchea OTROS imports
 *     top-level barrel preexistentes (type imports). Fix: regex stronger
 *     `/import\s*\{\s*TASA_IVA\s*\}\s*from.../` discrimina explícitamente el
 *     binding `{ TASA_IVA }` named import from top-level barrel.
 *
 * A2-C2 RED (extend cumulative en C2):
 *   - Class IvaBooksService deletion + Repository deletion + 4 legacy tests
 *     deletion + 2 integration tests adapters Q5 deletion + 2 bridges interfaces
 *     residuales + trim server.ts legacy exports.
 *
 * A2-C3 RED (extend cumulative en C3):
 *   - 12 vi.mock factories drop legacy keys (route + export + page tests).
 *
 * Source-string assertion pattern: mirror `bridges-teardown-shape.poc-siguiente-a1.test.ts`.
 *
 * Q4 lock Marco (post §13.G discovery Decimal.js normaliza trailing zeros):
 * Source-text regex genuino para textual lock "0.1300" — runtime .toString()
 * NO discrimina (Decimal.js retorna "0.13" para ambos valores). P3.4 runtime
 * matemática ya cementada en entity-to-dto.test.ts:111 (.equals + .toNumber).
 *
 * Cross-ref:
 * - engram bookmark poc-siguiente/a1/c2/closed (#1506) Step 0 forward A2
 * - JSDoc legacy `iva-books.service.ts:25` P3.4 lock textual "0.1300"
 * - entity-to-dto.test.ts:111 P3.4 runtime matemática lock cementado
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

const IVA_CALC_UTILS_PATH = path.join(
  REPO_ROOT,
  "features/accounting/iva-books/iva-calc.utils.ts",
);

const SALES_ENTITY_TO_DTO_PATH = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/iva-books/sales/export/entity-to-dto.ts",
);

const PURCHASES_ENTITY_TO_DTO_PATH = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/iva-books/purchases/export/entity-to-dto.ts",
);

const SALES_ENTITY_TO_DTO_TEST_PATH = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/iva-books/sales/export/__tests__/entity-to-dto.test.ts",
);

const PURCHASES_ENTITY_TO_DTO_TEST_PATH = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/iva-books/purchases/export/__tests__/entity-to-dto.test.ts",
);

describe("POC siguiente A2 — legacy class deletion + TASA_IVA migration shape", () => {
  it("iva-calc.utils.ts exports TASA_IVA as Prisma.Decimal(\"0.1300\") (P3.4 textual lock + migration target A2-C1)", () => {
    const source = fs.readFileSync(IVA_CALC_UTILS_PATH, "utf8");
    expect(source).toMatch(
      /export\s+const\s+TASA_IVA\s*=\s*new\s+Prisma\.Decimal\("0\.1300"\)/,
    );
  });

  it("entity-to-dto.ts (sales export) imports TASA_IVA from top-level barrel (REQ-FMB.5 compliance, A2-C1.5 follow-up §13.H)", () => {
    const source = fs.readFileSync(SALES_ENTITY_TO_DTO_PATH, "utf8");
    expect(source).toMatch(
      /import\s*\{\s*TASA_IVA\s*\}\s*from\s+["']@\/features\/accounting\/iva-books["']/,
    );
  });

  it("entity-to-dto.ts (purchases export) imports TASA_IVA from top-level barrel (REQ-FMB.5 compliance, A2-C1.5 follow-up §13.H)", () => {
    const source = fs.readFileSync(PURCHASES_ENTITY_TO_DTO_PATH, "utf8");
    expect(source).toMatch(
      /import\s*\{\s*TASA_IVA\s*\}\s*from\s+["']@\/features\/accounting\/iva-books["']/,
    );
  });

  it("entity-to-dto.test.ts (sales + purchases export) import TASA_IVA from top-level barrel (A2-C1.5 follow-up §13.H + binding capture §13.I)", () => {
    const salesTestSource = fs.readFileSync(SALES_ENTITY_TO_DTO_TEST_PATH, "utf8");
    const purchasesTestSource = fs.readFileSync(
      PURCHASES_ENTITY_TO_DTO_TEST_PATH,
      "utf8",
    );
    const BINDING_REGEX =
      /import\s*\{\s*TASA_IVA\s*\}\s*from\s+["']@\/features\/accounting\/iva-books["']/;
    expect({
      sales: BINDING_REGEX.test(salesTestSource),
      purchases: BINDING_REGEX.test(purchasesTestSource),
    }).toEqual({ sales: true, purchases: true });
  });
});
