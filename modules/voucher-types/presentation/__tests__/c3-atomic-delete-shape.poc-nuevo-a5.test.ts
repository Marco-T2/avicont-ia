/**
 * POC nuevo A5-C3 — atomic delete `features/voucher-types/` wholesale shape
 * (single sub-fase, NEW file).
 *
 * Axis: legacy `features/voucher-types/` directory wholesale deletion (3 source
 * files — server.ts shim @deprecated + index.ts re-export barrel +
 * voucher-types.types.ts legacy types module — sin `__tests__/` collateral)
 * post cumulative cutover hex `modules/voucher-types` completado A5-C1 (Cat 1
 * + Cat 2 atomic Path α'' merge — 9 source pages/routes + 10 vi.mock factory
 * paired) + A5-C2a (Cat 3 cross-feature cleanup — 9 archivos / Path α'' merge
 * §13.A5-α factory + §13.A5-ε method-on-class Option D-3) + A5-C2b (Cat 3
 * cross-module cleanup — 5 archivos α/β/γ + paired test cascade fix Issue #1
 * §13.A5-α 4ta evidencia matures cumulative) + A5-C2c (Cat 4 cross-module
 * integration tests cleanup — 3 archivos uniform Shape α §13.A5-ζ 5ta evidencia
 * matures cumulative).
 *
 * Cero CONSUMER PRODUCCIÓN residual `@/features/voucher-types(/server)` verified
 * pre-RED via PROJECT-scope grep classification 5-axis (retirement_reinventory_
 * gate MEMORY.md APPLIED Step 0 expand cycle-start A5-C3): CONSUMER 0 +
 * TEST-MOCK-DECLARATION legacy 0 + RESIDUAL 0 + DEAD-IMPORT 0 +
 * TEST-SHAPE-ASSERTION-NEGATIVE ~38 (string literals + JSDoc en c1/c2a/c2b/c2c
 * RED tests A5, permanecen válidas post-delete — `expect(content).not.toContain
 * ("@/features/voucher-types/server")` patterns NEGATIVE forward-looking).
 * HEX `VoucherType` entity + factory `makeVoucherTypeRepository()` resolved
 * via `@/modules/voucher-types/presentation/server` (composition-root + paired
 * pages/routes/services/integration tests post-cutover cumulative).
 *
 * Sister precedent EXACT mirror (atomic delete shape pattern):
 * - `modules/org-settings/presentation/__tests__/c3-delete-wholesale.poc-nuevo
 *   -a4.test.ts` (RED commit `0bae9f2` GREEN `31ff403` — 5 assertions α 2 file
 *   + 1 dir + 2 PROJECT absence regex). Mirror EXACT estricto Marco lock
 *   Opción B confirmed pre-RED A5-C3.
 * - `modules/purchase/presentation/__tests__/c8-legacy-purchase-deletion-shape
 *   .poc-nuevo-a3.test.ts` (engram `poc-nuevo/a3/c8/closed` — 9 assertions α).
 * - `modules/sale/presentation/__tests__/c7-legacy-sale-deletion-shape
 *   .poc-nuevo-a3.test.ts` (engram `poc-nuevo/a3/c7/closed` — 8 assertions α).
 *
 * Asimetría legítima A5-C3 vs A4-C3 (3 source +1 vs 2):
 *   - Source +1 archivo: A4-C3 deletea 2 source archivos (server.ts shim +
 *     index.ts barrel). A5-C3 deletea 3 source archivos (server.ts +
 *     index.ts + voucher-types.types.ts) — paired sister 3rd file (legacy types
 *     module heredado del pre-hex schema, NO existe en org-settings dado entity
 *     hex absorbió types completos via VOs `VoucherTypeCode` + `VoucherTypePrefix`).
 *   - Tests collateral N/A: ambos sin `features/{org-settings,voucher-types}/
 *     __tests__/` directory. Atomic delete shape simpler que A3-C7+C8.
 *   - Bridges-teardown N/A: equivalente A4-C3 — NO hay bridges-teardown shape
 *     dedicado voucher-types consumers (retirement gate confirmó zero CONSUMER
 *     production + 0 vi.mock declarations legacy cumulative cross-ciclos POC A5).
 *   - Dir test absorbed: A4-C3 incluyó Test 3 dir existence (5 = 2 source +
 *     1 dir + 2 safety net). A5-C3 con +1 source file absorbe el dir slot al
 *     3rd source file (5 = 3 source + 0 dir + 2 safety net). Mathematical
 *     preserva 5 assertions α total mirror A4-C3 EXACT estructuralmente
 *     (3 transition + 2 safety net forward-looking PROJECT-scope import
 *     absence regex IDENTICAL).
 *
 * Pattern preferido (lección A6 #5 PROACTIVE — engram `protocol/agent-lock-
 * discipline/a2c3-additions`): `expect(fs.existsSync(path)).toBe(false)`
 * future-proof. NO `fs.readFileSync(...)` para Tests 1-3 (fragile contra atomic
 * delete batch GREEN sub-pasos → ENOENT exception, NO clean assertion fail).
 * Tests 4-5 sí usan `fs.readFileSync` regex match sobre PROJECT-scope production
 * sources (excluye `__tests__/`, `node_modules/`, `.next/`, `.turbo/`) —
 * scope auto-elimina archivos eliminados en GREEN sub-pasos via early `fs
 * .existsSync` guard en `walkProductionSources`.
 *
 * Marco lock A5-C3 RED scope confirmado (Locks 1-4 pre-RED Opción B):
 *   - Lock 1: 5 assertions α Opción B (3 source file existence transition + 2
 *     PROJECT-scope import absence regex safety net forward-looking) mirror
 *     A4-C3 EXACT estricto. Hex preservation collateral damage NO assertion
 *     (cumulative cross-ciclos A5-C1+C2a+C2b+C2c verificó hex intact 4 veces
 *     consecutive runtime).
 *   - Lock 2: Path α'' merge atomic NO aplica A5-C3 — paired RED+GREEN
 *     sequential separate commits mirror A4-C3 `31ff403` precedent EXACT.
 *     Path α'' merge fue específico mock-source coupling §13.A4-η (A4-C1 +
 *     A5-C1). Atomic delete wholesale shape simpler, sin paired test cascade.
 *   - Lock 3: Lección #10-skippable dry-run skip pre-RED autorizado
 *     (estructural puro `fs.existsSync` + `fs.readFileSync` regex match +
 *     sibling baseline clean cumulative cross-ciclos A5).
 *   - Lock 4: §13 emergente detection PROACTIVE pre-RED dispensable confirmed
 *     (cero consumers residuales activos + atomic delete trivial mecánico,
 *     NO material §13 nuevo emerge — §13.A5-α/γ/ε/ζ ya cementadas ciclos
 *     previos).
 *
 * Expected RED failure mode pre-GREEN (per feedback_red_acceptance_failure_mode):
 *
 *   ── Tests 1-3 FAIL (transición RED → GREEN) ──
 *   - Test 1 FAIL: `features/voucher-types/server.ts` EXISTS pre-GREEN
 *     (`fs.existsSync === true`, NO false). GREEN A5-C3 sub-paso 1 deletes
 *     archivo → assertion transitions RED → GREEN.
 *   - Test 2 FAIL: `features/voucher-types/index.ts` EXISTS pre-GREEN
 *     (`fs.existsSync === true`). GREEN A5-C3 sub-paso 2 deletes archivo →
 *     transition.
 *   - Test 3 FAIL: `features/voucher-types/voucher-types.types.ts` EXISTS
 *     pre-GREEN (`fs.existsSync === true`). GREEN A5-C3 sub-paso 3 deletes
 *     archivo → transition. Paired sister 3rd file vs A4-C3 EXACT (legacy
 *     types module pre-hex schema heredado).
 *
 *   ── Tests 4-5 PASS pre-GREEN (safety net forward-looking divergence justificada) ──
 *   - Test 4 PASS pre-GREEN: zero PRODUCTION source imports
 *     `from "@/features/voucher-types/server"` ALREADY verified retirement
 *     re-inventory gate Step 0 expand cycle-start A5-C3 (CONSUMER 0
 *     cumulative post A5-C1+C2a+C2b+C2c — los 4 ciclos previos cubrieron
 *     cutover Cat 1 routes/pages + Cat 2 vi.mock + Cat 3 cross-feature/cross-
 *     module SOURCE + Cat 4 cross-module integration tests). Test forward-
 *     looking safety net contra reintroducción consumer post-A5-C3 GREEN.
 *     Marco lock 1 Opción B confirmed scope acceptance — divergence from
 *     pure RED discipline justificada (precedent A4-C3 same shape Tests
 *     4-5 PASS pre-RED safety net forward-looking, mirror EXACT estricto).
 *   - Test 5 PASS pre-GREEN: idem barrel exact `from "@/features/voucher-types"`
 *     (sin /server, regex closing quote inmediato). Forward-looking safety
 *     net contra reintroducción barrel import post-A5-C3 GREEN.
 *
 * Total expected pre-GREEN: 3 FAIL (Tests 1-3) + 2 PASS (Tests 4-5 safety net).
 * Justified divergence per Marco lock 1 Opción B + `feedback_red_acceptance_
 * failure_mode` surface honest declaration explicit (NO silently accept "FAILS
 * cumple"). Mirror A4-C3 precedent EXACT 3 FAIL + 2 PASS shape (verified commit
 * `0bae9f2` body Read confirmation pre-RED A5-C3).
 *
 * Self-contained future-proof check (lección A6 #5 PROACTIVE applied desde
 * inicio): este shape file vive en `modules/voucher-types/presentation/__tests__/`
 * (NO bajo `features/voucher-types/__tests__/` que NO existe). Pattern
 * `fs.existsSync` future-proof contra futuras retirement wholesale (sub-fases
 * POCs siguientes). ✅
 *
 * Métricas baseline expected post-GREEN A5-C3 (mirror A4-C3 verified pattern +
 * heredado A5-C2c baseline 5088/6/2 cumulative invariant 5096):
 *   - TSC 17 baseline preserved (HEX paths `@/modules/voucher-types/presentation/
 *     server` consumed por composition-roots + paired pages/routes/services/
 *     integration tests post-cutover cumulative — independientes
 *     `features/voucher-types/*` deleted)
 *   - Suite delta net: +5 RED→GREEN A5-C3 (3 transition + 2 safety net) =
 *     5096 → 5101 cumulative invariant. Failed delta: heredado §13.A3-D4-α
 *     dispatches-hub flake env-dependent toggle (8va evidencia documentada,
 *     expected within margin per `arch/lecciones/dispatches-hub-flake-recurrente`
 *     engram).
 *   - ESLint baseline 10e/13w preserved (lección #10 sub-precedent skippable —
 *     `features/voucher-types/*` deletion NO afecta 10e/13w distribuidos en
 *     dispatch.service/documents/accounting/shared)
 *   - REQ-FMB.5 0 violations preserved (inferido por absence-from-failure-list)
 *
 * Cross-ref:
 * - architecture.md §13.7 lecciones operacionales 14 cementadas + #10-#14
 *   evidencias cumulative + #10-skippable sub-precedent + #14 4 métricas runtime
 *   verify post-GREEN MANDATORY
 * - architecture.md §13.A5-α multi-level composition-root delegation (resolved
 *   cumulative POC A5 — 5ta evidencia matures factory `makeVoucherTypeRepository`)
 * - architecture.md §13.A5-γ DTO divergence runtime path coverage (resolved
 *   cumulative POC A5 — 8 callsites material 4× magnitud vs §13.A4-α)
 * - architecture.md §13.A5-ε method-on-class shim signature divergence (resolved
 *   A5-C2a GREEN — Option D-3 final)
 * - architecture.md §13.A5-ζ classification by-target-type (resolved cumulative
 *   POC A5 — 5ta evidencia matures cross-track Marco lock paired sister
 *   source/unit-test/integration-test/mock-declaration)
 * - engram bookmark `poc-nuevo/a5/c2c-closed` (#1602) — atomic Cat 4 cross-module
 *   integration tests cleanup precedent paired sister cumulative
 * - engram bookmark `poc-nuevo/a4/c3/closed` — atomic delete precedent EXACT mirror
 * - engram bookmark `arch/§13/A5-zeta-classification-by-target-type` (#1598) —
 *   formal cementación PROACTIVE pre-RED A5-C2c
 * - engram bookmark `arch/§13/A5-alpha-multi-level-composition-root-delegation`
 *   (#1587) — formal cementación PROACTIVE pre-RED A5-C2a
 * - engram bookmark `arch/§13/A5-gamma-dto-divergence-runtime-path-coverage`
 *   (#1582) — formal cementación PROACTIVE pre-RED A5-C1
 * - engram bookmark `arch/§13/A5-epsilon-method-signature-shim-divergence`
 *   (#1590) — formal cementación PROACTIVE A5-C2a Option D-3
 * - engram pattern `protocol/agent-lock-discipline/a2c3-additions` (#1515) —
 *   lección A6 #5 PROACTIVE fs.existsSync future-proof origen
 * - engram pattern `arch/lecciones/leccion-10-eslint-dry-run-skippable` —
 *   sub-precedent cumulative cross-ciclo evidencia
 * - feedback memory `retirement_reinventory_gate` — PROJECT-scope grep
 *   classification 5-axis APPLIED (CONSUMER PROD 0 + TEST-MOCK-DECLARATION
 *   legacy 0 + RESIDUAL 0 + DEAD-IMPORT 0 + TEST-SHAPE-ASSERTION-NEGATIVE ~38
 *   self-reference absorbed cumulative cross-ciclos POC A5)
 * - feedback memory `red_acceptance_failure_mode` — Tests 4-5 safety net
 *   divergence declared explicit (NO silently accept "FAILS cumple" mirror
 *   A4-C3 precedent EXACT)
 * - feedback memory `sub_phase_start_coherence_gate` — Step 0 cycle-start cold
 *   verified bookmark↔repo coherence (3 archivos exact + cero consumers
 *   residuales activos)
 * - feedback memory `low_cost_verification_asymmetry` — RED runtime FAIL
 *   verify pre-commit MANDATORY (lección #14 PROACTIVE)
 * - modules/voucher-types/presentation/__tests__/c1-cutover-shape.poc-nuevo-a5
 *   .test.ts (precedent A5-C1 RED — 54 assertions α Cat 1 + Cat 2 cutover)
 * - modules/voucher-types/presentation/__tests__/c2a-cross-feature-shape.poc-
 *   nuevo-a5.test.ts (precedent A5-C2a RED — 13 assertions α Cat 3 cross-feature)
 * - modules/voucher-types/presentation/__tests__/c2b-cross-module-shape.poc-
 *   nuevo-a5.test.ts (precedent A5-C2b RED — 13 assertions α Cat 3 cross-module
 *   α/β/γ asimétrico)
 * - modules/voucher-types/presentation/__tests__/c2c-cross-module-integration-
 *   test-shape.poc-nuevo-a5.test.ts (precedent A5-C2c RED — 13 assertions α
 *   Cat 4 cross-module integration tests uniform Shape α §13.A5-ζ)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

// ── A5-C3 RED paths (3 source file existence transition, dir absorbed) ──────

const VOUCHER_TYPES_SERVER_PATH = path.join(
  REPO_ROOT,
  "features/voucher-types/server.ts",
);
const VOUCHER_TYPES_INDEX_PATH = path.join(
  REPO_ROOT,
  "features/voucher-types/index.ts",
);
const VOUCHER_TYPES_TYPES_PATH = path.join(
  REPO_ROOT,
  "features/voucher-types/voucher-types.types.ts",
);

// ── A5-C3 RED PROJECT-scope absence regex (safety net consumer reintroducción) ─

const LEGACY_SERVER_IMPORT_RE =
  /from\s*["']@\/features\/voucher-types\/server["']/;
const LEGACY_BARREL_IMPORT_RE = /from\s*["']@\/features\/voucher-types["']/;

const PRODUCTION_SCAN_DIRS = ["app", "features", "modules"];

function walkProductionSources(dir: string): string[] {
  const collected: string[] = [];
  if (!fs.existsSync(dir)) return collected;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === ".next" ||
        entry.name === ".turbo" ||
        entry.name === "__tests__"
      ) {
        continue;
      }
      collected.push(...walkProductionSources(full));
    } else if (
      entry.isFile() &&
      /\.(ts|tsx)$/.test(entry.name) &&
      !/\.(test|spec)\.tsx?$/.test(entry.name)
    ) {
      collected.push(full);
    }
  }
  return collected;
}

function findFilesMatchingImport(re: RegExp): string[] {
  const matches: string[] = [];
  for (const subdir of PRODUCTION_SCAN_DIRS) {
    const root = path.join(REPO_ROOT, subdir);
    const files = walkProductionSources(root);
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      if (re.test(source)) {
        matches.push(path.relative(REPO_ROOT, file));
      }
    }
  }
  return matches;
}

describe("POC nuevo A5-C3 — atomic delete features/voucher-types/ wholesale shape", () => {
  // ── Tests 1-3: source files no longer exist (legacy wholesale deletion) ──

  it("Test 1: features/voucher-types/server.ts no longer exists (legacy shim @deprecated deletion A5-C3)", () => {
    expect(fs.existsSync(VOUCHER_TYPES_SERVER_PATH)).toBe(false);
  });

  it("Test 2: features/voucher-types/index.ts no longer exists (legacy re-export barrel deletion A5-C3)", () => {
    expect(fs.existsSync(VOUCHER_TYPES_INDEX_PATH)).toBe(false);
  });

  it("Test 3: features/voucher-types/voucher-types.types.ts no longer exists (legacy types module deletion A5-C3 — paired sister 3rd file vs A4-C3 EXACT, dir absorbed)", () => {
    expect(fs.existsSync(VOUCHER_TYPES_TYPES_PATH)).toBe(false);
  });

  // ── Tests 4-5: PROJECT-scope absence safety net (PASS pre-GREEN — divergence justified) ──
  // Forward-looking safety net contra reintroducción post-A5-C3 GREEN.
  // Pre-GREEN PASS por retirement gate ZERO CONSUMER verified Step 0 cycle-start
  // expand cumulative POC A5 (post A5-C1+C2a+C2b+C2c).

  it("Test 4: zero production source imports `from \"@/features/voucher-types/server\"` (PROJECT-scope safety net consumer reintroducción)", () => {
    const matches = findFilesMatchingImport(LEGACY_SERVER_IMPORT_RE);
    expect(matches).toEqual([]);
  });

  it("Test 5: zero production source imports `from \"@/features/voucher-types\"` exact barrel (PROJECT-scope safety net consumer reintroducción)", () => {
    const matches = findFilesMatchingImport(LEGACY_BARREL_IMPORT_RE);
    expect(matches).toEqual([]);
  });
});
