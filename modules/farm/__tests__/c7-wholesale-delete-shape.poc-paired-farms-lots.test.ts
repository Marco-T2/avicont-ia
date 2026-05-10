/**
 * POC paired farms+lots C7 — atomic delete features/farms/ wholesale shape
 * (farm side, paired sister mirror lot).
 *
 * Axis: legacy `features/farms/` directory wholesale deletion (6 source
 * files — server.ts legacy barrel re-export + index.ts barrel re-export +
 * farms.types.ts legacy types module + farms.validation.ts legacy zod schemas
 * + farms.service.ts legacy `FarmsService` class + farms.repository.ts legacy
 * `FarmsRepository` class) post cumulative cutover hex `modules/farm`
 * completado:
 *   - C0 domain shape (Farm entity + ports + errors)
 *   - C1 application service hex factory `makeFarmService()`
 *   - C2 infrastructure adapter PrismaFarmRepository
 *   - C3 presentation composition-root + barrel `@/modules/farm/presentation/server`
 *   - C4 cutover paired API routes hex factory consumed direct
 *   - C5 cutover paired UI pages hex factory consumed direct + attachLots bridge
 *   - C6 cross-feature ports migration (FarmInquiryPort + LocalFarmInquiryAdapter
 *     + cross-feature SERVICE consumers ai-agent + pricing DI cutover legacy
 *     `new FarmsService()` → adapter DI + D8 test mocks adapt cascade)
 *
 * Cero CONSUMER PRODUCCIÓN residual `@/features/farms(/server)` verified
 * pre-RED via PROJECT-scope grep classification 5-axis Step 0 expand cycle
 * -start C7 (retirement_reinventory_gate MEMORY.md APPLIED): CONSUMER 0 +
 * TEST-MOCK-DECLARATION legacy 0 (D8 cascade C6 absorbed) + RESIDUAL solo
 * features/farms/* internos (target delete, esperado) + DEAD-IMPORT 0 +
 * TEST-SHAPE-ASSERTION-NEGATIVE 8 self-references absorbed cumulative
 * cross-ciclos POC paired (c4 + c5 + c6 paired sister test files inmutables
 * post-delete — assertions NEGATIVE form `not.toMatch`/`not.toContain` sigue
 * PASS post-DELETE forward-only). HEX `Farm` entity + factory
 * `makeFarmService()` + adapter `LocalFarmInquiryAdapter` resolved via
 * `@/modules/farm/presentation/server` (composition-root + paired
 * pages/routes/services post-cutover cumulative).
 *
 * Sister precedent EXACT mirror (atomic delete shape pattern):
 * - `modules/payables/presentation/__tests__/c7-atomic-delete-shape.paired-
 *   pr.test.ts` (paired sister payables/receivables C7 — 8 assertions α
 *   6 source + 0 dir absorbed + 2 PROJECT absence regex per side = 16α
 *   total). Mirror EXACT estricto Marco lock 8α/side confirmed pre-RED.
 *
 * Path location top-level `modules/farm/__tests__/` (NOT `presentation/__tests__/`)
 * matches POC paired farms+lots C6 cross-feature precedent (D6 path top-level
 * convention multi-layer cross-cutting scope per #1853 c6-closed bookmark).
 * C7 wholesale delete es retirement scope cross-cutting (NO presentation
 * cutover) → top-level consistency forward POC internal precedent honored.
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
 * Marco lock C7 RED scope confirmado (Locks 1-3 pre-RED):
 *   - Lock 1: 16 assertions α paired Opción A (8 per side × 2 sides = 16
 *     stricto). Per side: 6 source file existence transition + 2 PROJECT
 *     -scope import absence regex safety net forward-looking (mirror
 *     paired sister payables/receivables C7 EXACT). Hex preservation
 *     collateral damage NO assertion (cumulative cross-ciclos POC paired
 *     C0+C1+C2+C3+C4+C5+C6 verificó hex intact 7 veces consecutive runtime).
 *   - Lock 2: Trust bookmark C6-closed `a0df684` métricas baseline runtime
 *     5589/{6,9}/17/10e/16w/REQ-FMB.5 0 verified ground truth pre-RED
 *     (suite full + tsc + eslint executed Step 0 cycle-start cold).
 *   - Lock 3: Single session atomic batch RED commit + GREEN commit same
 *     turn (paired sister payables/receivables C7 EXACT precedent + monthly-
 *     close C7 EXACT precedent cumulative cross-POC).
 *
 * Expected RED failure mode pre-GREEN (per feedback_red_acceptance_failure_mode):
 *
 *   ── Tests 1-6 FAIL (transición RED → GREEN, paired side farm) ──
 *   - Test 1 FAIL: `features/farms/server.ts` EXISTS pre-GREEN
 *     (`fs.existsSync === true`, NO false). GREEN C7 sub-paso 1 deletes
 *     archivo → assertion transitions RED → GREEN.
 *   - Test 2 FAIL: `features/farms/index.ts` EXISTS pre-GREEN. GREEN
 *     C7 sub-paso 2 deletes archivo → transition.
 *   - Test 3 FAIL: `features/farms/farms.types.ts` EXISTS pre-GREEN.
 *     GREEN C7 sub-paso 3 deletes archivo → transition.
 *   - Test 4 FAIL: `features/farms/farms.validation.ts` EXISTS pre-GREEN.
 *     GREEN C7 sub-paso 4 deletes archivo → transition.
 *   - Test 5 FAIL: `features/farms/farms.service.ts` EXISTS pre-GREEN
 *     (legacy `FarmsService` class preserved C6 ADDITIVE D1 Opt C strategy
 *     hasta C7). GREEN C7 sub-paso 5 deletes archivo → transition.
 *   - Test 6 FAIL: `features/farms/farms.repository.ts` EXISTS pre-GREEN
 *     (legacy `FarmsRepository` class preserved C6 ADDITIVE strategy hasta
 *     C7). GREEN C7 sub-paso 6 deletes archivo → transition.
 *
 *   ── Tests 7-8 PASS pre-GREEN (safety net forward-looking divergence justificada) ──
 *   - Test 7 PASS pre-GREEN: zero PRODUCTION source imports
 *     `from "@/features/farms/server"` ALREADY verified retirement
 *     re-inventory gate Step 0 expand cycle-start C7 (CONSUMER 0
 *     cumulative post C0+C1+C2+C3+C4+C5+C6 — los 7 ciclos previos
 *     cubrieron cutover Cat 1 routes/pages C4-C5 + Cat 2 cross-feature
 *     ports migration C6 SERVICE consumers ai-agent + pricing DI cutover).
 *     Test forward-looking safety net contra reintroducción consumer
 *     post-C7 GREEN. Marco lock 1 confirmed scope acceptance — divergence
 *     from pure RED discipline justificada (precedent paired sister
 *     payables/receivables C7 same shape Tests 7-8 PASS pre-RED safety
 *     net forward-looking, mirror EXACT estricto).
 *   - Test 8 PASS pre-GREEN: idem barrel exact `from "@/features/farms"`
 *     (sin /server, regex closing quote inmediato). Forward-looking
 *     safety net contra reintroducción barrel import post-C7 GREEN.
 *
 * Total expected pre-GREEN farm side: 6 FAIL (Tests 1-6) + 2 PASS (Tests 7-8 safety net).
 * Justified divergence per Marco lock 1 + `feedback_red_acceptance_failure_mode`
 * surface honest declaration explicit (NO silently accept "FAILS cumple").
 * Mirror paired sister payables/receivables C7 precedent EXACT (verified
 * commit body Read confirmation pre-RED C7). Paired sister lot side
 * mirror 6 FAIL + 2 PASS = 12 FAIL + 4 PASS overall (16 total paired).
 *
 * Self-contained future-proof check (lección A6 #5 PROACTIVE applied desde
 * inicio): este shape file vive en `modules/farm/__tests__/` (NOT bajo
 * `features/farms/__tests__/` que NO existe). Pattern `fs.existsSync`
 * future-proof contra futuras retirement wholesale (sub-fases POCs
 * siguientes). ✅
 *
 * Métricas baseline expected post-GREEN C7 (mirror paired sister verified
 * pattern + heredado C6 baseline 5589/{6,9}/17/10e/16w/REQ-FMB.5 0
 * cumulative invariant):
 *   - TSC 17 baseline preserved (HEX paths `@/modules/{farm,lot}/
 *     presentation/server` consumed por composition-roots + paired pages/
 *     routes/services post-cutover cumulative — independientes
 *     `features/{farms,lots}/*` deleted)
 *   - Suite delta net: +16 RED→GREEN C7 paired (12 transition + 4 safety net) =
 *     5589 → 5605 cumulative invariant. Failed delta: heredado §13.A3-D4-α
 *     dispatches-hub flake env-dependent toggle expected within margin
 *     {6,9} per `arch/lecciones/dispatches-hub-flake-recurrente` engram.
 *   - ESLint baseline 10e/16w preserved (lección #10 sub-precedent skippable —
 *     `features/{farms,lots}/*` deletion NO afecta 10e/16w distribuidos en
 *     dispatch.service/documents/accounting/shared/tests/stress)
 *   - REQ-FMB.5 0 violations preserved delta-POC (inferido por absence-from
 *     -failure-list)
 *
 * Cross-ref:
 * - architecture.md §13.7 lecciones operacionales 14 cementadas + #10-#14
 *   evidencias cumulative + #10-skippable sub-precedent + #14 4 métricas
 *   runtime verify post-GREEN MANDATORY
 * - architecture.md §13.A5-ζ classification by-target-type wholesale
 *   (resolved cumulative POC A5 — 6ta evidencia matures cross-track
 *   cumulative cross-POC paired sister source/unit-test/integration-test/
 *   mock-declaration). Distinción: wholesale puro Opción B EXACT
 *   (A4-C3 + A5-C3 + paired payables/receivables C7 + monthly-close C7 +
 *   fiscal-periods C7 + paired farms+lots C7).
 * - engram bookmark `poc-paired-farms-lots/c6-closed` (#1853) — preceding
 *   ciclo cross-feature ports migration cumulative
 * - engram bookmark `poc-nuevo/paired-payables-receivables/c7-closed` (#1632)
 *   — paired sister precedent EXACT mirror cumulative cross-POC
 * - engram bookmark `poc-nuevo/monthly-close/c7-closed` (#1761) — wholesale
 *   delete precedent
 * - engram pattern `protocol/agent-lock-discipline/a2c3-additions` (#1515) —
 *   lección A6 #5 PROACTIVE fs.existsSync future-proof origen
 * - engram pattern `arch/lecciones/leccion-10-eslint-dry-run-skippable` —
 *   sub-precedent cumulative cross-ciclo evidencia
 * - feedback memory `retirement_reinventory_gate` — PROJECT-scope grep
 *   classification 5-axis APPLIED (CONSUMER PROD 0 + TEST-MOCK-DECLARATION
 *   legacy 0 + RESIDUAL solo features/{farms,lots}/* internos +
 *   DEAD-IMPORT 0 + TEST-SHAPE-ASSERTION-NEGATIVE 8 self-references
 *   absorbed cumulative cross-ciclos POC paired)
 * - feedback memory `red_acceptance_failure_mode` — Tests 7-8 safety net
 *   divergence declared explicit (NO silently accept "FAILS cumple" mirror
 *   paired sister precedent EXACT)
 * - feedback memory `sub_phase_start_coherence_gate` — Step 0 cycle-start
 *   cold verified bookmark↔repo coherence (12 archivos paired exact + cero
 *   consumers residuales activos)
 * - feedback memory `low_cost_verification_asymmetry` — RED runtime FAIL
 *   verify pre-commit MANDATORY (lección #14 PROACTIVE)
 * - feedback memory `enumerated_baseline_failure_ledger` — bookmark closure
 *   futuros DEBEN lock per-test FAIL/PASS ledger enumerated explicit
 * - feedback memory `red-test-cementado-jsdoc-references-legacy-cleanup-pending`
 *   — 15mo cumulative cross-POC paired sister 14 heredados (5 JSDoc references
 *   c4/c5 cementados PRESERVE intactos C7 — DEFER cleanup D1 doc-only)
 * - modules/farm/__tests__/c0-domain-shape.poc-paired-farms-lots.test.ts
 *   (precedent C0 RED — paired sister)
 * - modules/farm/presentation/__tests__/c4-cutover-shape.poc-paired-farms-lots.test.ts
 *   (precedent C4 RED — paired sister)
 * - modules/farm/presentation/__tests__/c5-pages-cutover-shape.poc-paired-farms-lots.test.ts
 *   (precedent C5 RED — paired sister)
 * - modules/farm/__tests__/c6-cross-feature-shape.poc-paired-farms-lots.test.ts
 *   (precedent C6 RED — paired sister cross-feature ports migration)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../..");

// ── C7 RED paths farm side (6 source file existence transition, dir absorbed) ──

const FARMS_SERVER_PATH = path.join(REPO_ROOT, "features/farms/server.ts");
const FARMS_INDEX_PATH = path.join(REPO_ROOT, "features/farms/index.ts");
const FARMS_TYPES_PATH = path.join(
  REPO_ROOT,
  "features/farms/farms.types.ts",
);
const FARMS_VALIDATION_PATH = path.join(
  REPO_ROOT,
  "features/farms/farms.validation.ts",
);
const FARMS_SERVICE_PATH = path.join(
  REPO_ROOT,
  "features/farms/farms.service.ts",
);
const FARMS_REPOSITORY_PATH = path.join(
  REPO_ROOT,
  "features/farms/farms.repository.ts",
);

// ── C7 RED PROJECT-scope absence regex (safety net consumer reintroducción) ──

const LEGACY_SERVER_IMPORT_RE =
  /from\s*["']@\/features\/farms\/server["']/;
const LEGACY_BARREL_IMPORT_RE = /from\s*["']@\/features\/farms["']/;

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

describe("POC paired farms+lots C7 — atomic delete features/farms/ wholesale shape (farm side)", () => {
  // ── Tests 1-6: source files no longer exist (legacy wholesale deletion paired sister farm) ──

  it("Test 1: features/farms/server.ts no longer exists (legacy barrel re-export deletion C7 — `FarmsService` + `FarmsRepository` resolved canonical home `@/modules/farm/presentation/server` post-cutover cumulative C3-C6)", () => {
    expect(fs.existsSync(FARMS_SERVER_PATH)).toBe(false);
  });

  it("Test 2: features/farms/index.ts no longer exists (legacy re-export barrel deletion C7 — schemas zod + types absorbed canonical home `@/modules/farm/presentation/{server,validation}` post C4-C6 cutover cumulative)", () => {
    expect(fs.existsSync(FARMS_INDEX_PATH)).toBe(false);
  });

  it("Test 3: features/farms/farms.types.ts no longer exists (legacy types module deletion C7 — POJO `FarmWithLots` already dropped C5-C6 wholesale, drop residual `Prisma` re-exports C7)", () => {
    expect(fs.existsSync(FARMS_TYPES_PATH)).toBe(false);
  });

  it("Test 4: features/farms/farms.validation.ts no longer exists (legacy zod schemas deletion C7 — schemas zod canonical home `@/modules/farm/presentation/validation` consumed direct post C4 cutover cumulative)", () => {
    expect(fs.existsSync(FARMS_VALIDATION_PATH)).toBe(false);
  });

  it("Test 5: features/farms/farms.service.ts no longer exists (legacy `FarmsService` class deletion C7 — factory hex `makeFarmService()` consumed via composition-root post-cutover, cross-feature SERVICE consumers ai-agent + pricing DI via `LocalFarmInquiryAdapter` C6 absorbed)", () => {
    expect(fs.existsSync(FARMS_SERVICE_PATH)).toBe(false);
  });

  it("Test 6: features/farms/farms.repository.ts no longer exists (legacy `FarmsRepository` class deletion C7 — canonical home `@/modules/farm/presentation/server` (`PrismaFarmRepository`) consumed direct post-cutover cumulative C2-C6)", () => {
    expect(fs.existsSync(FARMS_REPOSITORY_PATH)).toBe(false);
  });

  // ── Tests 7-8: PROJECT-scope absence safety net (PASS pre-GREEN — divergence justified) ──
  // Forward-looking safety net contra reintroducción post-C7 GREEN.
  // Pre-GREEN PASS por retirement gate ZERO CONSUMER verified Step 0 cycle-start
  // expand cumulative POC paired (post C0+C1+C2+C3+C4+C5+C6).

  it("Test 7: zero production source imports `from \"@/features/farms/server\"` (PROJECT-scope safety net consumer reintroducción farm side)", () => {
    const matches = findFilesMatchingImport(LEGACY_SERVER_IMPORT_RE);
    expect(matches).toEqual([]);
  });

  it("Test 8: zero production source imports `from \"@/features/farms\"` exact barrel (PROJECT-scope safety net consumer reintroducción farm side)", () => {
    const matches = findFilesMatchingImport(LEGACY_BARREL_IMPORT_RE);
    expect(matches).toEqual([]);
  });
});
