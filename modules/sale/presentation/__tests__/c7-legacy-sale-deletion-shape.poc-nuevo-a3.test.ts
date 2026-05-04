/**
 * POC nuevo A3-C7 — atomic delete `features/sale/` wholesale shape (single sub-fase, NEW file).
 *
 * Axis: legacy `features/sale/` directory wholesale deletion (6 source files +
 * 11 tests + 2 collateral directories) post cumulative cutover hex modules/sale
 * completado A3-C1...C6c (page list A3-C6a + page detail A3-C6b + routes 3+4
 * A3-C6c + dispatches page A3-C5 + dispatches-hub route A3-C5 + sales/page.tsx
 * A3-C4a + sales/[saleId]/page.tsx A3-C4b). Cero CONSUMER PRODUCCIÓN residual
 * `@/features/sale/server` o `@/features/sale/sale.service` verified pre-RED
 * via PROJECT-scope grep classification 4-axis (retirement_reinventory_gate
 * MEMORY.md APPLIED).
 *
 * Sister precedent (mirror EXACT atomic delete shape pattern): `features/
 * accounting/iva-books/__tests__/legacy-class-deletion-shape.poc-siguiente-a2.
 * test.ts` Tests 5-12 A2-C3 RED (engram `poc-siguiente/a2/c3/closed` #1514).
 *
 * Pattern preferido (lección A6 #5 PROACTIVE — engram `protocol/agent-lock-
 * discipline/a2c3-additions` #1515): `expect(fs.existsSync(path)).toBe(false)`
 * future-proof. NO `fs.readFileSync(...)` (fragile contra atomic delete batch
 * GREEN sub-pasos → ENOENT exception, NO clean assertion fail).
 *
 * Expected failure RED (8 assertions α — file existence × 6 + directory
 * existence × 2):
 *
 *   - Test 1-6: 6 source files de `features/sale/` actualmente EXIST en master
 *     (sale.service.ts + sale.repository.ts + sale.types.ts + sale.utils.ts +
 *     server.ts + index.ts). Todos `fs.existsSync(path) === true` pre-GREEN.
 *     GREEN A3-C7 sub-pasos 1-6 deletean cada file → assertions transition
 *     RED → GREEN.
 *   - Test 7: directorio `features/sale/__tests__/` actualmente EXIST (11 test
 *     files dentro). GREEN A3-C7 sub-pasos 7-17 deletean los 11 tests +
 *     sub-paso 18 rmdir `__tests__/`.
 *   - Test 8: directorio top-level `features/sale/` actualmente EXIST. GREEN
 *     A3-C7 sub-paso 19 rmdir `features/sale/` (post sub-pasos 1-18 empty).
 *
 * Marco lock A3-C7 RED scope confirmado (Locks 1-5 turn pre-RED):
 *   - Lock 1: 8 assertions α (file existence × 6 + directory existence × 2)
 *     mirror A2-C3 EXACT granularity. NO source-text assertions adicionales
 *     (vs A2-C3 Tests 11-12 server.ts trim — A3-C7 deletea server.ts wholesale,
 *     trim NO aplica).
 *   - Lock 2: DROP Test 4 + SALE_SERVICE_PATH constant + JSDoc top-note en
 *     `bridges-teardown-shape.poc-siguiente-a1.test.ts` mismo RED commit
 *     (lección A6 #5 §13.A3-C7-α — Test 4 leía sale.service.ts via
 *     `fs.readFileSync` → ENOENT post-A3-C7 GREEN sub-paso 1).
 *   - Lock 3: GREEN 21 sub-pasos atomic batch single commit con 2 vi.mock
 *     stale (`dispatches/__tests__/page.test.ts:34-37` +
 *     `dispatches-hub/__tests__/route.test.ts:65-69`) named explicit en
 *     commit message body (mock hygiene commit scope MEMORY.md APPLIED).
 *   - Lock 4: atomic single ciclo (mirror A2-C3). NO split mock cleanup
 *     preceding commit — mocks STALE post A3-C5 cutover quedan named
 *     scope semántico A3-C7 GREEN deletion.
 *   - Lock 5: ESLint baseline dry-run SKIP (asymmetric cost-benefit — shape
 *     test pattern `fs.existsSync` puro NO toca rules contested R5/REQ-FMB,
 *     mirror sibling tests precedent c3/c4a/c4b/c4a-5/c5 todos clean
 *     baseline). Engram refinement `arch/lecciones/leccion-10-eslint-dry-
 *     run-skippable` post-commit cementación.
 *
 * §13.A3-C7-α emergente cementado mismo RED commit (mirror exact §13.N A2-C3):
 *   - `bridges-teardown-shape.poc-siguiente-a1.test.ts` Test 4 (líneas 117-
 *     123) leía `SALE_SERVICE_PATH = features/sale/sale.service.ts` via
 *     `fs.readFileSync(SALE_SERVICE_PATH, "utf8")` para asertar
 *     `not.toMatch(/interface\s+IvaBooksServiceForSaleCascade/)`.
 *   - Post-A3-C7 GREEN sub-paso 1 delete sale.service.ts → ENOENT exception.
 *   - Resolution Escenario A (lección A6 #5): DROP Test 4 — invariant
 *     subsumido por Test 1 nuevo en este shape file (file no existe ⇒ no
 *     declara interface, redundancia trivial). SALE_SERVICE_PATH constant
 *     removed mismo RED commit. JSDoc top-note bridges-teardown actualizado
 *     con cross-ref §13.A3-C7-α.
 *   - Resultado bridges-teardown post-DROP: 2 tests A1 (Tests 1 + 3) — Test
 *     1 (purchases route) + Test 3 (purchase.service.ts) ambos paths
 *     persisten post-A3-C7 (purchase delete = A3-C8).
 *
 * §13.A3-C7-β emergente named GREEN commit message body (mock hygiene
 * MEMORY.md):
 *   - `app/(dashboard)/[orgSlug]/dispatches/__tests__/page.test.ts:34-37`
 *     declara `vi.mock("@/features/sale/server", () => { class SaleService {}
 *     return { SaleService } })` DEAD-MOCK post A3-C5 cutover (page actual NO
 *     importa `@/features/sale/server`).
 *   - `app/api/organizations/[orgSlug]/dispatches-hub/__tests__/route.test.
 *     ts:65-69` declara `vi.mock("@/features/sale/sale.service", () => ({
 *     SaleService: vi.fn().mockImplementation(...) }))` DEAD-MOCK post A3-C5
 *     cutover (route consume `makeSaleService()` desde hex composition-root).
 *   - GREEN A3-C7 sub-pasos 20-21 drop ambos vi.mock blocks + comment
 *     explicativo named explicit en commit message body.
 *
 * Self-contained future-proof check (lección A6 #5 PROACTIVE applied desde
 * inicio): este shape file vive en `modules/sale/presentation/__tests__/`
 * (NO bajo `features/sale/__tests__/` que será deleted). Pattern
 * `fs.existsSync` future-proof contra A3-C8 atomic delete `features/purchase/`
 * (sister sub-fase NO afecta paths target A3-C7). ✅
 *
 * Métricas baseline expected post-GREEN A3-C7 (mirror A2-C3 verified pattern):
 *   - TSC 16 baseline preserved (HEX paths consumed por composition-roots +
 *     iva-books adapters NO afectados — `features/dispatch/hub.service.ts`
 *     ya HEX-only post A3-C5)
 *   - Suite delta net: -11 legacy tests (features/sale/__tests__/) + 8
 *     RED→GREEN A3-C7 + DROP Test 4 bridges-teardown (-1) = -4 net
 *     (5049 → 5045)
 *   - ESLint baseline preserved (10e/13w + REQ-FMB.5 0 violations)
 *
 * Cross-ref:
 * - architecture.md §13.7 lecciones operacionales 9 cementadas + #10-#13 candidates engram
 * - engram bookmark `poc-nuevo/a3/c6c/closed` (#1547) — sub-fase previa CLOSED + Step 0 forward A3-C7
 * - engram bookmark `poc-siguiente/a2/c3/closed` (#1514) — A2-C3 atomic delete precedent EXACT
 * - engram pattern `protocol/agent-lock-discipline/a2c3-additions` (#1515) — lección A6 #5 cementada
 * - engram pattern `arch/lecciones/leccion-13-bookmark-precedent-verification` (#1546) — Step 0 PROACTIVE
 * - engram pattern `arch/lecciones/leccion-12-runtime-path-coverage` (#1542) — NO aplica delete-only
 * - feedback memory `retirement_reinventory_gate` — PROJECT-scope grep + classification 4-axis APPLIED
 * - feedback memory `mock_hygiene_commit_scope` — 2 vi.mock stale named explicit GREEN commit message
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

// ── A3-C7 RED paths (file existence × 6 + directory existence × 2) ──────────
const SALE_SERVICE_PATH = path.join(
  REPO_ROOT,
  "features/sale/sale.service.ts",
);
const SALE_REPOSITORY_PATH = path.join(
  REPO_ROOT,
  "features/sale/sale.repository.ts",
);
const SALE_TYPES_PATH = path.join(
  REPO_ROOT,
  "features/sale/sale.types.ts",
);
const SALE_UTILS_PATH = path.join(
  REPO_ROOT,
  "features/sale/sale.utils.ts",
);
const SALE_SERVER_PATH = path.join(
  REPO_ROOT,
  "features/sale/server.ts",
);
const SALE_INDEX_PATH = path.join(
  REPO_ROOT,
  "features/sale/index.ts",
);
const SALE_TESTS_DIR_PATH = path.join(
  REPO_ROOT,
  "features/sale/__tests__",
);
const SALE_TOP_LEVEL_DIR_PATH = path.join(
  REPO_ROOT,
  "features/sale",
);

describe("POC nuevo A3-C7 — atomic delete features/sale/ wholesale shape", () => {
  // ── Tests 1-6: source files no longer exist (legacy wholesale deletion) ──

  it("Test 1: features/sale/sale.service.ts no longer exists (legacy class deletion A3-C7)", () => {
    expect(fs.existsSync(SALE_SERVICE_PATH)).toBe(false);
  });

  it("Test 2: features/sale/sale.repository.ts no longer exists (legacy class deletion A3-C7)", () => {
    expect(fs.existsSync(SALE_REPOSITORY_PATH)).toBe(false);
  });

  it("Test 3: features/sale/sale.types.ts no longer exists (legacy types deletion A3-C7)", () => {
    expect(fs.existsSync(SALE_TYPES_PATH)).toBe(false);
  });

  it("Test 4: features/sale/sale.utils.ts no longer exists (legacy utils deletion A3-C7)", () => {
    expect(fs.existsSync(SALE_UTILS_PATH)).toBe(false);
  });

  it("Test 5: features/sale/server.ts no longer exists (legacy barrel deletion A3-C7)", () => {
    expect(fs.existsSync(SALE_SERVER_PATH)).toBe(false);
  });

  it("Test 6: features/sale/index.ts no longer exists (legacy index deletion A3-C7)", () => {
    expect(fs.existsSync(SALE_INDEX_PATH)).toBe(false);
  });

  // ── Tests 7-8: directory existence wholesale (collateral cleanup) ────────

  it("Test 7: features/sale/__tests__/ directory no longer exists (11 legacy tests deleted A3-C7)", () => {
    expect(fs.existsSync(SALE_TESTS_DIR_PATH)).toBe(false);
  });

  it("Test 8: features/sale/ top-level directory no longer exists (wholesale deletion A3-C7)", () => {
    expect(fs.existsSync(SALE_TOP_LEVEL_DIR_PATH)).toBe(false);
  });
});
