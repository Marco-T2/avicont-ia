/**
 * POC paired payables↔receivables C7 — atomic delete features/payables/
 * wholesale shape (cxp side, paired sister mirror receivables).
 *
 * Axis: legacy `features/payables/` directory wholesale deletion (6 source
 * files — server.ts shim @deprecated + index.ts re-export barrel +
 * payables.types.ts legacy types module + payables.validation.ts
 * pass-through re-export hex canonical + payables.service.ts legacy shim
 * DTO bridge + payables.repository.ts legacy alias) post cumulative cutover
 * hex `modules/payables` completado:
 *   - C0 dispatch cleanup absorb residuals
 *   - C1a service hex factory `makePayablesService()`
 *   - C1b-α attach contact boundary composition root migration
 *   - C3-C4 cutover paired UI pages + API routes (vi.mock §13.A4-η swap
 *     load-bearing render path coverage MATERIAL)
 *   - C5-C6 drop legacy POJO type defs `PayableWithContact` + `OpenAggregate`
 *     wholesale + DTO divergence paired axis hex (§13.B-paired NEW
 *     classification 'DTO drop axis paired' emergent)
 *   - C7-pre barrel sub-import migration prerequisite (schemas zod cutover
 *     6 routes + dead aspirational vi.mock cleanup 4 declarations —
 *     §13.A5-ζ-prerequisite NEW classification candidate emergent
 *     cementación target D8)
 *
 * Cero CONSUMER PRODUCCIÓN residual `@/features/payables(/server)` verified
 * pre-RED via PROJECT-scope grep classification 5-axis Step 0 expand cycle
 * -start C7 (retirement_reinventory_gate MEMORY.md APPLIED): CONSUMER 0 +
 * TEST-MOCK-DECLARATION legacy 0 + RESIDUAL solo features/payables/* internos
 * (target delete, esperado) + DEAD-IMPORT 0 + TEST-SHAPE-ASSERTION-NEGATIVE
 * 178 self-references absorbed cumulative cross-ciclos POC paired (c0 +
 * c1b + c3-c4 + c5-c6 + c7-pre paired-pr.test.ts inmutables post-delete).
 * HEX `Payable` entity + factory `makePayablesService()` + bridge
 * `attachContact[s]` resolved via `@/modules/payables/presentation/server`
 * (composition-root + paired pages/routes/services post-cutover cumulative).
 *
 * Sister precedent EXACT mirror (atomic delete shape pattern):
 * - `modules/voucher-types/presentation/__tests__/c3-atomic-delete-shape
 *   .poc-nuevo-a5.test.ts` (RED commit `47d7bfb` GREEN `f9a1e06` — 5
 *   assertions α 3 source + 0 dir absorbed + 2 PROJECT absence regex).
 *   Mirror EXACT estricto Marco lock Opción A confirmed pre-RED C7 scaled
 *   paired 6 source + 0 dir absorbed + 2 safety net per side = 8 per side.
 * - `modules/org-settings/presentation/__tests__/c3-delete-wholesale.poc-
 *   nuevo-a4.test.ts` (RED `0bae9f2` GREEN `31ff403` — 5 assertions α
 *   2 file + 1 dir + 2 PROJECT absence regex). Primigenio Opción B
 *   estructura.
 *
 * Asimetría legítima C7-paired vs A5-C3 (6 source per side vs 3, 8 per side vs 5):
 *   - Source +3 archivos per side: A5-C3 deletea 3 source archivos
 *     (server.ts shim + index.ts barrel + voucher-types.types.ts). C7-paired
 *     deletea 6 source archivos per side (server.ts + index.ts +
 *     {X}.types.ts + {X}.validation.ts pass-through re-export hex canonical
 *     + {X}.service.ts legacy shim DTO bridge + {X}.repository.ts legacy
 *     alias). Justificación paired: features/{payables,receivables}/ tienen
 *     repository.ts + service.ts archivos heredados pre-hex que NO existen
 *     en voucher-types (entity hex absorbió completos via VOs); validation.ts
 *     pass-through re-export legítimo post-cutover schemas zod canonical
 *     home hex (preservado C7-pre scope as residuo barrel migration
 *     prerequisite forward-looking, drop C7 wholesale).
 *   - Tests collateral N/A: ambos sin features/{payables,receivables,
 *     voucher-types}/__tests__/ directory. Atomic delete shape simpler.
 *   - Bridges-teardown N/A: equivalente A5-C3 — NO hay bridges-teardown
 *     shape dedicado paired payables/receivables consumers (retirement gate
 *     confirmó zero CONSUMER production + 0 vi.mock declarations legacy
 *     cumulative cross-ciclos POC paired).
 *   - Dir test absorbed: A5-C3 con 3 source absorbió dir slot al 3rd file
 *     (5 = 3 source + 0 dir + 2 safety net). C7-paired con 6 source absorbe
 *     dir slot al 6th file (8 per side = 6 source + 0 dir + 2 safety net).
 *     Mathematical preserva shape α paired sister scaled per side (mirror
 *     A5-C3 EXACT estructuralmente — transition + safety net forward-looking
 *     PROJECT-scope import absence regex IDENTICAL).
 *
 * Pattern preferido (lección A6 #5 PROACTIVE — engram `protocol/agent-lock-
 * discipline/a2c3-additions`): `expect(fs.existsSync(path)).toBe(false)`
 * future-proof. NO `fs.readFileSync(...)` para Tests 1-6 (fragile contra
 * atomic delete batch GREEN sub-pasos → ENOENT exception, NO clean
 * assertion fail). Tests 7-8 sí usan `fs.readFileSync` regex match sobre
 * PROJECT-scope production sources (excluye `__tests__/`, `node_modules/`,
 * `.next/`, `.turbo/`) — scope auto-elimina archivos eliminados en GREEN
 * sub-pasos via early `fs.existsSync` guard en `walkProductionSources`.
 *
 * Marco lock C7 RED scope confirmado (Locks 1-4 pre-RED Opción A):
 *   - Lock 1: 16 assertions α paired Opción A (8 per side × 2 sides = 16
 *     stricto). Per side: 6 source file existence transition + 2 PROJECT
 *     -scope import absence regex safety net forward-looking (mirror A5-C3
 *     EXACT scaled per side). Hex preservation collateral damage NO
 *     assertion (cumulative cross-ciclos POC paired C0+C1a+C1b-α+C3-C4+C5
 *     -C6+C7-pre verificó hex intact 6 veces consecutive runtime).
 *   - Lock 2: Trust bookmark C7-pre `fbb66e3` métricas baseline runtime
 *     5193/{6,9}/17/10e/13w (working tree clean post-commit, no edits
 *     intermedios). Skip suite full pre-RED ground truth verify.
 *   - Lock 3: Lección #10-skippable dry-run skip pre-RED autorizado
 *     (estructural puro `fs.existsSync` + `fs.readFileSync` regex match +
 *     sibling baseline clean cumulative cross-ciclos POC paired C0-C7-pre).
 *   - Lock 4: §13.A5-ζ-prerequisite engram canonical home persistido
 *     PROACTIVE pre-RED (mirror §13.A5-ζ #1599 timing) — cementación
 *     target D8 architecture.md scheduled, paired sister POC-context
 *     inmutable.
 *
 * Expected RED failure mode pre-GREEN (per feedback_red_acceptance_failure_mode):
 *
 *   ── Tests 1-6 FAIL (transición RED → GREEN, paired side cxp) ──
 *   - Test 1 FAIL: `features/payables/server.ts` EXISTS pre-GREEN
 *     (`fs.existsSync === true`, NO false). GREEN C7 sub-paso 1 deletes
 *     archivo → assertion transitions RED → GREEN.
 *   - Test 2 FAIL: `features/payables/index.ts` EXISTS pre-GREEN. GREEN
 *     C7 sub-paso 2 deletes archivo → transition.
 *   - Test 3 FAIL: `features/payables/payables.types.ts` EXISTS pre-GREEN.
 *     GREEN C7 sub-paso 3 deletes archivo → transition.
 *   - Test 4 FAIL: `features/payables/payables.validation.ts` EXISTS
 *     pre-GREEN (pass-through re-export preserved C7-pre scope, drop C7
 *     wholesale). GREEN C7 sub-paso 4 deletes archivo → transition.
 *   - Test 5 FAIL: `features/payables/payables.service.ts` EXISTS pre-GREEN
 *     (legacy shim DTO bridge preserved C5-C6 scope post-swap a hex types,
 *     drop C7 wholesale). GREEN C7 sub-paso 5 deletes archivo → transition.
 *   - Test 6 FAIL: `features/payables/payables.repository.ts` EXISTS
 *     pre-GREEN (legacy alias `PayablesRepository = PrismaPayablesRepository`).
 *     GREEN C7 sub-paso 6 deletes archivo → transition.
 *
 *   ── Tests 7-8 PASS pre-GREEN (safety net forward-looking divergence justificada) ──
 *   - Test 7 PASS pre-GREEN: zero PRODUCTION source imports
 *     `from "@/features/payables/server"` ALREADY verified retirement
 *     re-inventory gate Step 0 expand cycle-start C7 (CONSUMER 0
 *     cumulative post C0+C1a+C1b-α+C3-C4+C5-C6+C7-pre — los 6 ciclos
 *     previos cubrieron cutover Cat 1 routes/pages C3-C4 + Cat 2 vi.mock
 *     §13.A4-η swap material C3-C4 + DTO drop C5-C6 + barrel sub-import
 *     C7-pre + dead aspirational vi.mock cleanup C7-pre). Test forward
 *     -looking safety net contra reintroducción consumer post-C7 GREEN.
 *     Marco lock 1 Opción A confirmed scope acceptance — divergence
 *     from pure RED discipline justificada (precedent A5-C3 same shape
 *     Tests 4-5 PASS pre-RED safety net forward-looking, mirror EXACT
 *     estricto).
 *   - Test 8 PASS pre-GREEN: idem barrel exact `from "@/features/payables"`
 *     (sin /server, regex closing quote inmediato). Forward-looking
 *     safety net contra reintroducción barrel import post-C7 GREEN
 *     (post C7-pre absorbió 3 schemas zod barrel sub-imports + 2 vi.mock
 *     declarations dead).
 *
 * Total expected pre-GREEN cxp side: 6 FAIL (Tests 1-6) + 2 PASS (Tests 7-8 safety net).
 * Justified divergence per Marco lock 1 Opción A + `feedback_red_acceptance_
 * failure_mode` surface honest declaration explicit (NO silently accept "FAILS
 * cumple"). Mirror A5-C3 precedent EXACT scaled paired (verified commit
 * `47d7bfb` body Read confirmation pre-RED C7). Paired sister cxc side
 * mirror 6 FAIL + 2 PASS = 12 FAIL + 4 PASS overall (16 total paired).
 *
 * Self-contained future-proof check (lección A6 #5 PROACTIVE applied desde
 * inicio): este shape file vive en `modules/payables/presentation/__tests__/`
 * (NO bajo `features/payables/__tests__/` que NO existe). Pattern
 * `fs.existsSync` future-proof contra futuras retirement wholesale (sub-fases
 * POCs siguientes). ✅
 *
 * Métricas baseline expected post-GREEN C7 (mirror A5-C3 verified pattern +
 * heredado C7-pre baseline 5193/{6,9}/17/10e/13w cumulative invariant):
 *   - TSC 17 baseline preserved (HEX paths `@/modules/{payables,receivables}/
 *     presentation/server` consumed por composition-roots + paired pages/
 *     routes/services post-cutover cumulative — independientes
 *     `features/{payables,receivables}/*` deleted)
 *   - Suite delta net: +16 RED→GREEN C7 paired (12 transition + 4 safety net) =
 *     5193 → 5209 cumulative invariant. Failed delta: heredado §13.A3-D4-α
 *     dispatches-hub flake env-dependent toggle expected within margin
 *     {6,9} per `arch/lecciones/dispatches-hub-flake-recurrente` engram.
 *   - ESLint baseline 10e/13w preserved (lección #10 sub-precedent skippable —
 *     `features/{payables,receivables}/*` deletion NO afecta 10e/13w
 *     distribuidos en dispatch.service/documents/accounting/shared)
 *   - REQ-FMB.5 0 violations preserved delta-POC (inferido por absence-from
 *     -failure-list)
 *
 * Cross-ref:
 * - architecture.md §13.7 lecciones operacionales 14 cementadas + #10-#14
 *   evidencias cumulative + #10-skippable sub-precedent + #14 4 métricas
 *   runtime verify post-GREEN MANDATORY
 * - architecture.md §13.A5-ζ classification by-target-type wholesale (resolved
 *   cumulative POC A5 — 5ta evidencia matures cross-track Marco lock paired
 *   sister source/unit-test/integration-test/mock-declaration). Distinción:
 *   wholesale puro Opción B EXACT (A4-C3 + A5-C3 + C7-paired).
 * - architecture.md §13.A5-ζ-prerequisite barrel sub-import migration
 *   prerequisite (NEW classification candidate emergent C7-pre — cementación
 *   target D8 architecture.md scheduled, formal cementación PROACTIVE pre-RED
 *   C7 mirror §13.A5-ζ #1599 timing)
 * - architecture.md §13.B-paired DTO drop axis paired (resolved C5-C6 — NEW
 *   classification 'DTO drop axis paired' emergent post DTO divergence
 *   paired axis hex)
 * - engram bookmark `poc-nuevo/paired-payables-receivables/c7-pre-closed`
 *   (#1628) — barrel sub-import migration prerequisite cutover precedent
 *   paired sister cumulative
 * - engram bookmark `poc-nuevo/a5/c3-closed` (#1606) — atomic delete precedent
 *   EXACT mirror scaled paired (3 source +0 dir +2 safety → 6 source +0 dir
 *   +2 safety per side)
 * - engram bookmark `arch/§13/A5-zeta-classification-by-target-type` (#1598
 *   /#1599) — formal cementación PROACTIVE pre-RED A5-C2c precedent timing
 * - engram bookmark `arch/§13/A5-zeta-prerequisite-barrel-sub-import-migration
 *   -prerequisite` (THIS BATCH save) — formal cementación PROACTIVE pre-RED C7
 * - engram pattern `protocol/agent-lock-discipline/a2c3-additions` (#1515) —
 *   lección A6 #5 PROACTIVE fs.existsSync future-proof origen
 * - engram pattern `arch/lecciones/leccion-10-eslint-dry-run-skippable` —
 *   sub-precedent cumulative cross-ciclo evidencia
 * - feedback memory `retirement_reinventory_gate` — PROJECT-scope grep
 *   classification 5-axis APPLIED (CONSUMER PROD 0 + TEST-MOCK-DECLARATION
 *   legacy 0 + RESIDUAL solo features/{payables,receivables}/* internos +
 *   DEAD-IMPORT 0 + TEST-SHAPE-ASSERTION-NEGATIVE 178 self-references
 *   absorbed cumulative cross-ciclos POC paired)
 * - feedback memory `red_acceptance_failure_mode` — Tests 7-8 safety net
 *   divergence declared explicit (NO silently accept "FAILS cumple" mirror
 *   A5-C3 precedent EXACT)
 * - feedback memory `sub_phase_start_coherence_gate` — Step 0 cycle-start
 *   cold verified bookmark↔repo coherence (12 archivos paired exact + cero
 *   consumers residuales activos)
 * - feedback memory `low_cost_verification_asymmetry` — RED runtime FAIL
 *   verify pre-commit MANDATORY (lección #14 PROACTIVE)
 * - feedback memory `diagnostic_stash_gate_pattern` — 8va evidencia C7-pre
 *   cumulative POC, 9na evidencia post-GREEN C7 expected
 * - feedback memory `enumerated_baseline_failure_ledger` — bookmark closure
 *   futuros DEBEN lock per-test FAIL/PASS ledger enumerated explicit
 * - modules/payables/presentation/__tests__/c0-dispatch-cleanup-shape.paired
 *   -pr.test.ts (precedent C0 RED — paired sister)
 * - modules/payables/presentation/__tests__/c1b-attach-contact-boundary-shape
 *   .paired-pr.test.ts (precedent C1b-α RED — paired sister)
 * - modules/payables/presentation/__tests__/c3-c4-cutover-shape.paired-pr.test.ts
 *   (precedent C3-C4 RED — paired sister 26 assertions α 13 per side)
 * - modules/payables/presentation/__tests__/c5-c6-dto-drop-shape.paired-pr.test.ts
 *   (precedent C5-C6 RED — paired sister 26 assertions α 13 per side)
 * - modules/payables/presentation/__tests__/c7-pre-cutover-schemas-shape.paired
 *   -pr.test.ts (precedent C7-pre RED — paired sister 16 assertions α 8 per side)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

// ── C7 RED paths cxp side (6 source file existence transition, dir absorbed) ──

const PAYABLES_SERVER_PATH = path.join(
  REPO_ROOT,
  "features/payables/server.ts",
);
const PAYABLES_INDEX_PATH = path.join(
  REPO_ROOT,
  "features/payables/index.ts",
);
const PAYABLES_TYPES_PATH = path.join(
  REPO_ROOT,
  "features/payables/payables.types.ts",
);
const PAYABLES_VALIDATION_PATH = path.join(
  REPO_ROOT,
  "features/payables/payables.validation.ts",
);
const PAYABLES_SERVICE_PATH = path.join(
  REPO_ROOT,
  "features/payables/payables.service.ts",
);
const PAYABLES_REPOSITORY_PATH = path.join(
  REPO_ROOT,
  "features/payables/payables.repository.ts",
);

// ── C7 RED PROJECT-scope absence regex (safety net consumer reintroducción) ──

const LEGACY_SERVER_IMPORT_RE =
  /from\s*["']@\/features\/payables\/server["']/;
const LEGACY_BARREL_IMPORT_RE = /from\s*["']@\/features\/payables["']/;

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

describe("POC paired payables↔receivables C7 — atomic delete features/payables/ wholesale shape (cxp side)", () => {
  // ── Tests 1-6: source files no longer exist (legacy wholesale deletion paired sister cxp) ──

  it("Test 1: features/payables/server.ts no longer exists (legacy shim @deprecated deletion C7 — barrel re-export `PayablesService` + `PayablesRepository` resolved canonical home `@/modules/payables/presentation/server` post-cutover cumulative)", () => {
    expect(fs.existsSync(PAYABLES_SERVER_PATH)).toBe(false);
  });

  it("Test 2: features/payables/index.ts no longer exists (legacy re-export barrel deletion C7 — schemas zod + types absorbed canonical home post C7-pre cutover)", () => {
    expect(fs.existsSync(PAYABLES_INDEX_PATH)).toBe(false);
  });

  it("Test 3: features/payables/payables.types.ts no longer exists (legacy types module deletion C7 — POJO `PayableWithContact` + `OpenAggregate` already dropped C5-C6 wholesale, drop residual `Prisma` re-exports C7)", () => {
    expect(fs.existsSync(PAYABLES_TYPES_PATH)).toBe(false);
  });

  it("Test 4: features/payables/payables.validation.ts no longer exists (legacy pass-through re-export deletion C7 — schemas zod canonical home `@/modules/payables/presentation/validation` consumed direct post C7-pre cutover)", () => {
    expect(fs.existsSync(PAYABLES_VALIDATION_PATH)).toBe(false);
  });

  it("Test 5: features/payables/payables.service.ts no longer exists (legacy shim DTO bridge deletion C7 — `PayablesService` factory hex `makePayablesService()` consumed via composition-root post-cutover, return types swap a `PayableSnapshotWithContact` C5-C6 absorbed)", () => {
    expect(fs.existsSync(PAYABLES_SERVICE_PATH)).toBe(false);
  });

  it("Test 6: features/payables/payables.repository.ts no longer exists (legacy alias `PayablesRepository = PrismaPayablesRepository` deletion C7 — canonical home `@/modules/payables/presentation/server` consumed direct post-cutover)", () => {
    expect(fs.existsSync(PAYABLES_REPOSITORY_PATH)).toBe(false);
  });

  // ── Tests 7-8: PROJECT-scope absence safety net (PASS pre-GREEN — divergence justified) ──
  // Forward-looking safety net contra reintroducción post-C7 GREEN.
  // Pre-GREEN PASS por retirement gate ZERO CONSUMER verified Step 0 cycle-start
  // expand cumulative POC paired (post C0+C1a+C1b-α+C3-C4+C5-C6+C7-pre).

  it("Test 7: zero production source imports `from \"@/features/payables/server\"` (PROJECT-scope safety net consumer reintroducción cxp side)", () => {
    const matches = findFilesMatchingImport(LEGACY_SERVER_IMPORT_RE);
    expect(matches).toEqual([]);
  });

  it("Test 8: zero production source imports `from \"@/features/payables\"` exact barrel (PROJECT-scope safety net consumer reintroducción cxp side)", () => {
    const matches = findFilesMatchingImport(LEGACY_BARREL_IMPORT_RE);
    expect(matches).toEqual([]);
  });
});
