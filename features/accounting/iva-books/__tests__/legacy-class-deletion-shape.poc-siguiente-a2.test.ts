/**
 * POC siguiente A2 — legacy class deletion + TASA_IVA migration shape (cumulative C1 + C1.5 + C3).
 *
 * Axis: legacy class structure file deletion + TASA_IVA migration target paths.
 * Sister shape file (axis-orthogonal): `vi-mock-legacy-cleanup-shape.poc-siguiente-a2.test.ts`
 * (vi.mock factory cleanup A2-C2 — Q4 lock A2-C2 archivo NUEVO axis distinto).
 *
 * Expected failure cumulative (RED justificado):
 *
 * A2-C1 RED (Tests 1-4, GREEN al cierre A2-C1+C1.5):
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
 * A2-C2 (axis-orthogonal — separate archivo, NO en este shape file):
 *   - Q4 lock A2-C2: `vi-mock-legacy-cleanup-shape.poc-siguiente-a2.test.ts`
 *     archivo NUEVO con axis vi.mock factory cleanup (8 assertions α Cat A 6 +
 *     Cat B 2). Cross-ref engram bookmark `poc-siguiente/a2/c2/closed` (#1511).
 *
 * A2-C3 RED (extend cumulative en C3 — Tests 5-12, ESTE archivo):
 *   - 6 file existence assertions (Tests 5-10): 2 source classes (iva-books.service.ts +
 *     iva-books.repository.ts) + 4 legacy tests (iva-books.service.test.ts +
 *     iva-books.repository.test.ts + iva-books-repo-noon-utc.test.ts +
 *     iva-recompute.test.ts). Pattern `expect(fs.existsSync(path)).toBe(false)`
 *     — lección A6 #5 self-contained: NO `readFileSync` (future-proof contra
 *     atomic delete batch GREEN sub-pasos 2-7).
 *   - 2 server.ts source-text assertions (Tests 11-12): drop IvaBooksService +
 *     drop IvaBooksRepository exports (preserve `exportIvaBookExcel` línea 10
 *     + TASA_IVA via top-level barrel `index.ts` re-export from iva-calc.utils
 *     post-A2-C1.5 — 0 consumers de TASA_IVA via server.ts verified pre-RED).
 *   - 2 Q5 integration tests deletion (modules/{sale,purchase}/.../prisma-iva-
 *     book-regen-notifier.adapter.integration.test.ts) — collateral GREEN
 *     sub-pasos 8-9, NO shape assertion separada en este axis (Q5 axis = adapter
 *     infra ≠ legacy class structure axis; coverage via tsc 16 baseline preserved).
 *   - DROP Test 2 from `bridges-teardown-shape.poc-siguiente-a1.test.ts` mismo
 *     RED commit (lección A6 #5 §13.N: shape test prev sub-fase NO self-contained
 *     contra A2-C3 atomic delete iva-books.service.ts → ENOENT exception fix).
 *   - JSDoc §13.O fix mismo RED commit (este bloque): A2-C2 stale references
 *     corrected (A2-C2 went to separate axis-orthogonal file per Q4 lock).
 *
 * Source-string assertion pattern: mirror `bridges-teardown-shape.poc-siguiente-a1.test.ts`.
 *
 * Q4 lock Marco A2-C1 (post §13.G discovery Decimal.js normaliza trailing zeros):
 * Source-text regex genuino para textual lock "0.1300" — runtime .toString()
 * NO discrimina (Decimal.js retorna "0.13" para ambos valores). P3.4 runtime
 * matemática ya cementada en entity-to-dto.test.ts:111 (.equals + .toNumber).
 *
 * Cross-ref:
 * - engram bookmark `poc-siguiente/a1/c2/closed` (#1506) Step 0 forward A2
 * - engram bookmark `poc-siguiente/a2/c2/closed` (#1511) sister axis-orthogonal
 * - engram pattern `protocol/agent-lock-discipline/a2c2-additions` (#1512) lecciones A6 #7+#8
 * - JSDoc legacy `iva-books.service.ts:25` P3.4 lock textual "0.1300" (DELETED A2-C3)
 * - entity-to-dto.test.ts:111 P3.4 runtime matemática lock cementado
 * - lección A6 #5: shape tests prev sub-fase self-contained against future deletes
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

// ── A2-C3 RED paths (file existence × 6 + server.ts source-text × 2) ────────
const IVA_SERVICE_PATH = path.join(
  REPO_ROOT,
  "features/accounting/iva-books/iva-books.service.ts",
);
const IVA_REPOSITORY_PATH = path.join(
  REPO_ROOT,
  "features/accounting/iva-books/iva-books.repository.ts",
);
const SERVER_PATH = path.join(
  REPO_ROOT,
  "features/accounting/iva-books/server.ts",
);
const IVA_SERVICE_TEST_PATH = path.join(
  REPO_ROOT,
  "features/accounting/iva-books/__tests__/iva-books.service.test.ts",
);
const IVA_REPOSITORY_TEST_PATH = path.join(
  REPO_ROOT,
  "features/accounting/iva-books/__tests__/iva-books.repository.test.ts",
);
const IVA_REPO_NOON_UTC_TEST_PATH = path.join(
  REPO_ROOT,
  "features/accounting/iva-books/__tests__/iva-books-repo-noon-utc.test.ts",
);
const IVA_RECOMPUTE_TEST_PATH = path.join(
  REPO_ROOT,
  "features/accounting/iva-books/__tests__/iva-recompute.test.ts",
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

  // ── A2-C3 RED: legacy class structure file deletion (Tests 5-10) ──────────

  it("Test 5: iva-books.service.ts no longer exists (legacy class deletion A2-C3)", () => {
    expect(fs.existsSync(IVA_SERVICE_PATH)).toBe(false);
  });

  it("Test 6: iva-books.repository.ts no longer exists (legacy class deletion A2-C3)", () => {
    expect(fs.existsSync(IVA_REPOSITORY_PATH)).toBe(false);
  });

  it("Test 7: iva-books.service.test.ts no longer exists (legacy test deletion A2-C3)", () => {
    expect(fs.existsSync(IVA_SERVICE_TEST_PATH)).toBe(false);
  });

  it("Test 8: iva-books.repository.test.ts no longer exists (legacy test deletion A2-C3)", () => {
    expect(fs.existsSync(IVA_REPOSITORY_TEST_PATH)).toBe(false);
  });

  it("Test 9: iva-books-repo-noon-utc.test.ts no longer exists (legacy test deletion A2-C3)", () => {
    expect(fs.existsSync(IVA_REPO_NOON_UTC_TEST_PATH)).toBe(false);
  });

  it("Test 10: iva-recompute.test.ts no longer exists (legacy test deletion A2-C3)", () => {
    expect(fs.existsSync(IVA_RECOMPUTE_TEST_PATH)).toBe(false);
  });

  // ── A2-C3 RED: server.ts trim verification (Tests 11-12) ──────────────────

  it("Test 11: server.ts no longer exports IvaBooksService (A2-C3 trim line 8)", () => {
    const source = fs.readFileSync(SERVER_PATH, "utf8");
    expect(source).not.toMatch(/IvaBooksService/);
  });

  it("Test 12: server.ts no longer exports IvaBooksRepository (A2-C3 trim line 9)", () => {
    const source = fs.readFileSync(SERVER_PATH, "utf8");
    expect(source).not.toMatch(/IvaBooksRepository/);
  });
});
