/**
 * POC nuevo A3-C8 — atomic delete `features/purchase/` wholesale shape (single sub-fase, NEW file).
 *
 * Axis: legacy `features/purchase/` directory wholesale deletion (7 source files +
 * 9 tests + 2 collateral directories) post cumulative cutover hex modules/purchase
 * completado A3-C1...C6c (page list A3-C6a + page detail A3-C6b + routes 3+4
 * A3-C6c + dispatches/related cutovers cumulative). Cero CONSUMER PRODUCCIÓN
 * residual `@/features/purchase/server` o `@/features/purchase/purchase.service`
 * verified pre-RED via PROJECT-scope grep classification 4-axis
 * (retirement_reinventory_gate MEMORY.md APPLIED). HEX `PurchaseService` class
 * resolved via `@/modules/purchase/application/purchase.service` (composition-root
 * + iva-books adapter independientes features/purchase/* deleted).
 *
 * Sister precedent (mirror EXACT atomic delete shape pattern):
 * - `modules/sale/presentation/__tests__/c7-legacy-sale-deletion-shape.poc-nuevo-a3.test.ts`
 *   A3-C7 RED (engram `poc-nuevo/a3/c7/closed` #1551 — 8 assertions α file × 6 +
 *   dir × 2 + DROP Test 4 bridges-teardown §13.A3-C7-α 2da evidencia formal).
 * - `features/accounting/iva-books/__tests__/legacy-class-deletion-shape.poc-siguiente-a2.test.ts`
 *   Tests 5-12 A2-C3 RED (engram `poc-siguiente/a2/c3/closed` #1514 — origen
 *   atomic delete pattern + DROP Test 2 §13.N 1ra evidencia formal).
 *
 * Pattern preferido (lección A6 #5 PROACTIVE — engram `protocol/agent-lock-
 * discipline/a2c3-additions` #1515): `expect(fs.existsSync(path)).toBe(false)`
 * future-proof. NO `fs.readFileSync(...)` (fragile contra atomic delete batch
 * GREEN sub-pasos → ENOENT exception, NO clean assertion fail).
 *
 * Expected failure RED (9 assertions α — file existence × 7 + directory
 * existence × 2):
 *
 *   - Test 1-7: 7 source files de `features/purchase/` actualmente EXIST en
 *     master (purchase.service.ts + purchase.repository.ts + purchase.types.ts +
 *     purchase.utils.ts + purchase.validation.ts + server.ts + index.ts).
 *     Asimetría legítima vs A3-C7 sale (+1 source `purchase.validation.ts` —
 *     sale NO declara archivo dedicado validation, lógica embebida en utils).
 *     Todos `fs.existsSync(path) === true` pre-GREEN. GREEN A3-C8 sub-pasos 1-7
 *     deletean cada file → assertions transition RED → GREEN.
 *   - Test 8: directorio `features/purchase/__tests__/` actualmente EXIST (9
 *     test files dentro — asimetría legítima vs A3-C7 sale 11 tests, purchase
 *     scope reducido). GREEN A3-C8 sub-pasos 8-16 deletean los 9 tests +
 *     sub-paso 17 rmdir `__tests__/`.
 *   - Test 9: directorio top-level `features/purchase/` actualmente EXIST.
 *     GREEN A3-C8 sub-paso 18 rmdir `features/purchase/` (post sub-pasos 1-17
 *     empty).
 *
 * Marco lock A3-C8 RED scope confirmado (Locks 1-5 turn pre-RED):
 *   - Lock 1: 9 assertions α (file existence × 7 + directory existence × 2)
 *     mirror A3-C7 EXACT granularity adjusted +1 source legítima
 *     (purchase.validation.ts asimetría). NO source-text assertions adicionales
 *     (mirror A3-C7 — atomic delete wholesale, trim NO aplica).
 *   - Lock 2: DROP Test 3 + PURCHASE_SERVICE_PATH constant + JSDoc top-note en
 *     `bridges-teardown-shape.poc-siguiente-a1.test.ts` mismo RED commit
 *     (lección A6 #5 PROACTIVE 3ra evidencia formal §13.A3-C8-α — Test 3 leía
 *     purchase.service.ts via `fs.readFileSync` → ENOENT post-A3-C8 GREEN
 *     sub-paso 1, mirror exact §13.A3-C7-α + §13.N A2-C3 pattern).
 *   - Lock 3: GREEN 20 sub-pasos atomic batch single commit (asimetría -1 vs
 *     A3-C7 21 — +1 source compensa -2 vi.mock + +1 file DELETE bridges-
 *     teardown wholesale).
 *   - Lock 4: vi.mock cleanup + DELETE archivo bridges-teardown named explicit
 *     body (§13.A3-C8-β + §13.A3-C8-γ — mock_hygiene_commit_scope MEMORY.md
 *     APPLIED + ANALOGUE para test files retirement).
 *   - Lock 5: ESLint baseline dry-run SKIP (lección #10 sub-precedent 2da
 *     evidencia — target pattern `fs.existsSync` puro mirror A3-C7 + sibling
 *     baseline clean cumulative c2/c5-5/c6a/c6b/c6c). Engram refinement
 *     `arch/lecciones/leccion-10-eslint-dry-run-skippable` cumulative cross-
 *     ciclo evidencia.
 *
 * §13.A3-C8-α emergente cementado mismo RED commit (mirror exact §13.A3-C7-α +
 * §13.N A2-C3 — lección A6 #5 PROACTIVE 3ra evidencia formal):
 *   - `bridges-teardown-shape.poc-siguiente-a1.test.ts` Test 3 (post DROP Test 4
 *     A3-C7) leía `PURCHASE_SERVICE_PATH = features/purchase/purchase.service.ts`
 *     via `fs.readFileSync(PURCHASE_SERVICE_PATH, "utf8")` para asertar
 *     `not.toMatch(/interface\s+IvaBooksServiceForPurchaseCascade/)` +
 *     `not.toMatch(/this\.ivaBooksService\.recomputeFromPurchaseCascade/)`.
 *   - Post-A3-C8 GREEN sub-paso 1 delete purchase.service.ts → ENOENT exception.
 *   - Resolution Escenario A (lección A6 #5): DROP Test 3 — invariant subsumido
 *     por Test 1 nuevo en este shape file (file no existe ⇒ no declara
 *     interface + no invoca cascade, redundancia trivial). PURCHASE_SERVICE_PATH
 *     constant removed mismo RED commit. JSDoc top-note bridges-teardown
 *     actualizado con cross-ref §13.A3-C8-α + §13.A3-C8-γ archivo DELETE GREEN.
 *   - Resultado bridges-teardown post-DROP: 1 test A1 (Test 1 ÚNICO sobreviviente,
 *     `purchases/[purchaseId]/route.ts no longer instantiates legacy
 *     IvaBooksService`) — invariant subsumido por A2-C3 wholesale class deletion
 *     (`IvaBooksService` class GONE → `new IvaBooksService(` compile error TSC,
 *     redundant safety net runtime shape vs compile-time enforcement).
 *
 * §13.A3-C8-β emergente named GREEN commit message body (mock hygiene
 * MEMORY.md APPLIED — asimetría legítima vs A3-C7 2 vi.mock):
 *   - `app/(dashboard)/[orgSlug]/purchases/new/__tests__/page-rbac.test.ts:49`
 *     declara `vi.mock("@/features/purchase/server", () => ({}))` DEAD-MOCK
 *     post A3-C6a/b/c cutover (purchase pages + routes ya importan
 *     `makePurchaseService()` desde hex composition-root).
 *   - GREEN A3-C8 sub-paso 19 drop vi.mock block + comment explicativo named
 *     explicit en commit message body. Sale precedent A3-C7-β tenía 2
 *     vi.mock (dispatches/page + dispatches-hub/route — purchase NO tiene
 *     dispatch consumers paired, asimetría -1 legítima).
 *
 * §13.A3-C8-γ emergente named GREEN commit message body (mock_hygiene_commit_
 * scope ANALOGUE para test files retirement — DELETE archivo entero):
 *   - `features/accounting/iva-books/__tests__/bridges-teardown-shape.poc-
 *     siguiente-a1.test.ts` cumplió rol cumulative C1+C2 (Tests 1-3 origen) +
 *     DROP secuencia evolutiva natural retirement (Test 2 §13.N A2-C3 + Test 4
 *     §13.A3-C7-α + Test 3 §13.A3-C8-α). Test 1 sobreviviente = redundant
 *     safety net runtime shape contra TSC compile-time enforcement de
 *     `IvaBooksService` class deletion (A2-C3 wholesale).
 *   - GREEN A3-C8 sub-paso 20 DELETE archivo entero (Marco Opción A1 lock —
 *     atomic preferred vs A2 defer Parte 2 doc-only que introduciría gap
 *     temporal innecesario archivo con 1 test latente).
 *   - Cleanup completo retirement bridges-teardown post 4 ciclos cumulative
 *     (A1-C1 GREEN trans + A2-C3 §13.N + A3-C7 §13.A3-C7-α + A3-C8 §13.A3-C8-α/γ).
 *
 * Self-contained future-proof check (lección A6 #5 PROACTIVE applied desde
 * inicio): este shape file vive en `modules/purchase/presentation/__tests__/`
 * (NO bajo `features/purchase/__tests__/` que será deleted). Pattern
 * `fs.existsSync` future-proof contra futuras retirement wholesale (sub-fases
 * POCs siguientes ~12 features). ✅
 *
 * Métricas baseline expected post-GREEN A3-C8 (mirror A3-C7 verified pattern):
 *   - TSC 17 baseline preserved (HEX paths consumed por composition-roots +
 *     iva-books adapters NO afectados — `@/modules/purchase/application/
 *     purchase.service` HEX home independiente features/purchase/* deleted)
 *   - Suite delta net: -9 legacy tests (features/purchase/__tests__/) + 9
 *     RED→GREEN A3-C8 + DROP Test 3 bridges-teardown (-1) + DELETE archivo
 *     entero bridges-teardown (-1 Test 1) = -2 net (5045 → 5043)
 *   - ESLint baseline preserved (10e/13w + REQ-FMB.5 0 violations)
 *
 * Cross-ref:
 * - architecture.md §13.7 lecciones operacionales 9 cementadas + #10-#13
 *   candidates engram (Parte 2 doc-only post-mortem cumulative review)
 * - engram bookmark `poc-nuevo/a3/c7/closed` (#1551) — sub-fase previa CLOSED
 *   + Step 0 forward A3-C8 source bookmark precedent EXACT
 * - engram bookmark `poc-siguiente/a2/c3/closed` (#1514) — A2-C3 atomic delete
 *   precedent origen (single ciclo + atomic batch GREEN + lección A6 #5 §13.N)
 * - engram pattern `protocol/agent-lock-discipline/a2c3-additions` (#1515) —
 *   lección A6 #5 cementada origen + 1ra evidencia formal §13.N A2-C3
 * - engram pattern `arch/lecciones/leccion-13-bookmark-precedent-verification`
 *   (#1546) — Step 0 PROACTIVE 3ra evidencia A3-C8 (Marco subdecisión adelantada
 *   "0 tests activos post-A3-C8" corregida via Step 0 expand pre-recon — Test 1
 *   sobreviviente con invariant subsumido TSC, NO 0 tests)
 * - engram pattern `arch/lecciones/leccion-12-runtime-path-coverage` (#1542) —
 *   NO aplica delete-only (6ta evidencia confirmation post 5ta A3-C7)
 * - engram pattern `arch/lecciones/leccion-10-eslint-dry-run-skippable` (#1550)
 *   — sub-precedent 2da evidencia A3-C8 (mirror A3-C7 1ra)
 * - feedback memory `retirement_reinventory_gate` — PROJECT-scope grep +
 *   classification 4-axis APPLIED (CONSUMER PROD 0 + HEX independent + 1
 *   vi.mock STALE + 13 self-references absorbed wholesale)
 * - feedback memory `mock_hygiene_commit_scope` — 1 vi.mock stale named
 *   explicit GREEN commit message + 1 DELETE archivo entero ANALOGUE para
 *   test files retirement (§13.A3-C8-β + §13.A3-C8-γ)
 * - feedback memory `sub_phase_start_coherence_gate` — Step 0 cycle-start cold
 *   verified bookmark↔repo coherence + expand pre-recon corrected Marco
 *   subdecisión adelantada (PROACTIVE 3ra evidencia lección #13)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

// ── A3-C8 RED paths (file existence × 7 + directory existence × 2) ──────────
const PURCHASE_SERVICE_PATH = path.join(
  REPO_ROOT,
  "features/purchase/purchase.service.ts",
);
const PURCHASE_REPOSITORY_PATH = path.join(
  REPO_ROOT,
  "features/purchase/purchase.repository.ts",
);
const PURCHASE_TYPES_PATH = path.join(
  REPO_ROOT,
  "features/purchase/purchase.types.ts",
);
const PURCHASE_UTILS_PATH = path.join(
  REPO_ROOT,
  "features/purchase/purchase.utils.ts",
);
const PURCHASE_VALIDATION_PATH = path.join(
  REPO_ROOT,
  "features/purchase/purchase.validation.ts",
);
const PURCHASE_SERVER_PATH = path.join(
  REPO_ROOT,
  "features/purchase/server.ts",
);
const PURCHASE_INDEX_PATH = path.join(
  REPO_ROOT,
  "features/purchase/index.ts",
);
const PURCHASE_TESTS_DIR_PATH = path.join(
  REPO_ROOT,
  "features/purchase/__tests__",
);
const PURCHASE_TOP_LEVEL_DIR_PATH = path.join(
  REPO_ROOT,
  "features/purchase",
);

describe("POC nuevo A3-C8 — atomic delete features/purchase/ wholesale shape", () => {
  // ── Tests 1-7: source files no longer exist (legacy wholesale deletion) ──

  it("Test 1: features/purchase/purchase.service.ts no longer exists (legacy class deletion A3-C8)", () => {
    expect(fs.existsSync(PURCHASE_SERVICE_PATH)).toBe(false);
  });

  it("Test 2: features/purchase/purchase.repository.ts no longer exists (legacy class deletion A3-C8)", () => {
    expect(fs.existsSync(PURCHASE_REPOSITORY_PATH)).toBe(false);
  });

  it("Test 3: features/purchase/purchase.types.ts no longer exists (legacy types deletion A3-C8)", () => {
    expect(fs.existsSync(PURCHASE_TYPES_PATH)).toBe(false);
  });

  it("Test 4: features/purchase/purchase.utils.ts no longer exists (legacy utils deletion A3-C8)", () => {
    expect(fs.existsSync(PURCHASE_UTILS_PATH)).toBe(false);
  });

  it("Test 5: features/purchase/purchase.validation.ts no longer exists (legacy validation deletion A3-C8 — asimetría legítima vs A3-C7 sale +1 source)", () => {
    expect(fs.existsSync(PURCHASE_VALIDATION_PATH)).toBe(false);
  });

  it("Test 6: features/purchase/server.ts no longer exists (legacy barrel deletion A3-C8)", () => {
    expect(fs.existsSync(PURCHASE_SERVER_PATH)).toBe(false);
  });

  it("Test 7: features/purchase/index.ts no longer exists (legacy index deletion A3-C8)", () => {
    expect(fs.existsSync(PURCHASE_INDEX_PATH)).toBe(false);
  });

  // ── Tests 8-9: directory existence wholesale (collateral cleanup) ────────

  it("Test 8: features/purchase/__tests__/ directory no longer exists (9 legacy tests deleted A3-C8)", () => {
    expect(fs.existsSync(PURCHASE_TESTS_DIR_PATH)).toBe(false);
  });

  it("Test 9: features/purchase/ top-level directory no longer exists (wholesale deletion A3-C8)", () => {
    expect(fs.existsSync(PURCHASE_TOP_LEVEL_DIR_PATH)).toBe(false);
  });
});
