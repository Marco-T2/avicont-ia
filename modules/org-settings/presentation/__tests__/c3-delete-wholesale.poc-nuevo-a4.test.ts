/**
 * POC nuevo A4-C3 — atomic delete `features/org-settings/` wholesale shape
 * (single sub-fase, NEW file).
 *
 * Axis: legacy `features/org-settings/` directory wholesale deletion (2 source
 * files — server.ts shim @deprecated + index.ts re-export barrel — sin
 * `__tests__/` collateral) post cumulative cutover hex modules/org-settings
 * completado A4-C1 (Cat 1 + Cat 2 atomic Path α'' merge — 5 pages + api route +
 * 4 page-rbac vi.mock factory paired) + A4-C2 (Cat 3 cross-feature + cross-
 * module — 3 source dispatch.service/find-accounts/legacy-org-settings.adapter
 * + 2 paired tests dispatch.service.audit/tools.find-accounts).
 *
 * Cero CONSUMER PRODUCCIÓN residual `@/features/org-settings(/server)` verified
 * pre-RED via PROJECT-scope grep classification 5-axis (retirement_reinventory_
 * gate MEMORY.md APPLIED): CONSUMER 0 + TEST-MOCK-DECLARATION legacy 0 +
 * RESIDUAL 0 + DEAD-IMPORT 0 + TEST-SHAPE-ASSERTION ~18 (string literals en c1
 * + c2 RED tests, permanecen válidas post-delete). HEX `OrgSettingsService` +
 * factory `makeOrgSettingsService()` resolved via
 * `@/modules/org-settings/presentation/server` (composition-root + paired
 * pages/route/services post-cutover cumulative).
 *
 * Sister precedent (mirror EXACT atomic delete shape pattern):
 * - `modules/purchase/presentation/__tests__/c8-legacy-purchase-deletion-shape
 *   .poc-nuevo-a3.test.ts` (engram `poc-nuevo/a3/c8/closed` — 9 assertions α
 *   file × 7 + dir × 2 + DROP Test 3 bridges-teardown §13.A3-C8-α 3ra evidencia
 *   formal + DELETE archivo entero §13.A3-C8-γ).
 * - `modules/sale/presentation/__tests__/c7-legacy-sale-deletion-shape
 *   .poc-nuevo-a3.test.ts` (engram `poc-nuevo/a3/c7/closed` — 8 assertions α
 *   file × 6 + dir × 2 + DROP Test 4 bridges-teardown §13.A3-C7-α 2da evidencia).
 *
 * Asimetría legítima A4-C3 vs A3-C7+C8 (simpler shape):
 *   - Source -5 archivos: A3-C7+C8 deletean 6-7 source archivos (service +
 *     repository + types + utils + validation + server + index). A4-C3 deletea
 *     2 archivos (server.ts shim @deprecated + index.ts re-export barrel) —
 *     scope reducido legítimo: org-settings shim heredado post-A4-C1+C2 cutover
 *     hex completo NO declara purchase.service/repository/types/utils
 *     equivalents (composition-root + entity hex absorben funcionalidad).
 *   - Tests collateral -1 directorio: A3-C7+C8 incluyen `features/{sale,purchase}
 *     /__tests__/` rmdir (9-11 tests cada). A4-C3 NO tiene `features/org-
 *     settings/__tests__/` — verified Step 0 ls -la directory contiene SOLO
 *     server.ts + index.ts. Asimetría -1 collateral cleanup.
 *   - Bridges-teardown N/A: §13.A3-C7-α/A3-C8-α aplicaban a bridges-teardown-
 *     shape.poc-siguiente-a1.test.ts retirement evolutiva post wholesale delete
 *     features/{sale,purchase}/. Para A4-C3 NO hay bridges-teardown shape
 *     dedicado org-settings consumers (retirement gate confirmó zero CONSUMER
 *     production + 0 vi.mock declarations legacy). Asimetría legítima -1
 *     §13.A4-? evidencia (NO emerge nuevo §13).
 *
 * Pattern preferido (lección A6 #5 PROACTIVE — engram `protocol/agent-lock-
 * discipline/a2c3-additions`): `expect(fs.existsSync(path)).toBe(false)`
 * future-proof. NO `fs.readFileSync(...)` (fragile contra atomic delete batch
 * GREEN sub-pasos → ENOENT exception, NO clean assertion fail).
 *
 * Marco lock A4-C3 RED scope confirmado (Locks 1-4 pre-RED):
 *   - Lock 1: 5 assertions α (file existence × 2 + directory existence × 1 +
 *     PROJECT-scope absence verify hex consumers × 2). NO Test 6 vi.mock —
 *     todos los 4 page-rbac vi.mock target hex post-A4-C1 (verified retirement
 *     gate ZERO TEST-MOCK-DECLARATION legacy), assertion redundante.
 *     Mirror A3-C8 9 reduced legítimo per asimetría -5 source -1 collateral.
 *   - Lock 2: Commit shape 2 commits paired RED+GREEN (mirror A3-C7+C8 EXACT
 *     precedent). TDD discipline cementada lección operacional A3 cumulative.
 *     "Atomic single ciclo" bookmark refiere granularity ciclo, NO single
 *     commit. Bisect-friendly preserved + RED contract honest fail mode pre-
 *     GREEN.
 *   - Lock 3: Test file location consistente intra-POC A4 (c1+c2 mirror) +
 *     cross-POC parity A3 precedent.
 *   - Lock 4: Procedé RED commit + GREEN atomic batch siguiente.
 *
 * Expected RED failure mode pre-GREEN (per feedback_red_acceptance_failure_mode):
 *
 *   ── Tests 1-3 FAIL (transición RED → GREEN) ──
 *   - Test 1 FAIL: `features/org-settings/server.ts` EXISTS pre-GREEN
 *     (`fs.existsSync === true`, NO false). GREEN A4-C3 sub-paso 1 deletes
 *     archivo → assertion transitions RED → GREEN.
 *   - Test 2 FAIL: `features/org-settings/index.ts` EXISTS pre-GREEN
 *     (`fs.existsSync === true`). GREEN A4-C3 sub-paso 2 deletes archivo →
 *     transition.
 *   - Test 3 FAIL: `features/org-settings/` directory EXISTS pre-GREEN
 *     (`fs.existsSync === true`). GREEN A4-C3 sub-paso 3 rmdir → transition.
 *
 *   ── Tests 4-5 PASS pre-GREEN (safety net divergence justificada) ──
 *   - Test 4 PASS pre-GREEN: zero PRODUCTION source imports
 *     `from "@/features/org-settings/server"` ALREADY verified retirement re-
 *     inventory gate (CONSUMER 0). Test forward-looking safety net contra
 *     reintroducción consumer post-A4-C3 GREEN. Marco lock 1 confirmed scope
 *     acceptance — divergence from pure RED discipline justificada (precedent
 *     A3-C7+C8 9/8 todas transition RED→GREEN; A4-C3 5 = 3 transition + 2
 *     safety net por scope simpler asimétrico).
 *   - Test 5 PASS pre-GREEN: idem barrel exact `from "@/features/org-settings"`
 *     (sin /server). Forward-looking safety net.
 *
 * Total expected pre-GREEN: 3 FAIL (Tests 1-3) + 2 PASS (Tests 4-5 safety net).
 * Justified divergence per Marco lock 1 + `feedback_red_acceptance_failure_mode`
 * surface honest declaration explicit (NO silently accept "FAILS cumple").
 *
 * Self-contained future-proof check (lección A6 #5 PROACTIVE applied desde
 * inicio): este shape file vive en `modules/org-settings/presentation/__tests__/`
 * (NO bajo `features/org-settings/__tests__/` que NO existe). Pattern
 * `fs.existsSync` future-proof contra futuras retirement wholesale (sub-fases
 * POCs siguientes). ✅
 *
 * Métricas baseline expected post-GREEN A4-C3 (mirror A3-C7+C8 verified pattern
 * + heredado A4-C2 baseline §13.A4-η):
 *   - TSC 17 baseline preserved (HEX paths `@/modules/org-settings/presentation
 *     /server` consumed por composition-roots + paired pages/route/services
 *     post-cutover cumulative — independientes features/org-settings/* deleted)
 *   - Suite delta net: +5 RED→GREEN A4-C3 (3 transition + 2 safety net) =
 *     5001 → 5006 total. Failed delta: heredado §13.A3-D4-α flake env-dependent
 *     (cross-session toggle) — within-session 3 sequential runs IDENTICAL 7
 *     fails + isolated dispatches-hub 3/3 PASS confirmed. NO regresión A4 scope
 *     (verified retirement gate + analysis 8 REQ-FMB.4 violations ai-agent +
 *     organizations.service NOT touch A4 paths).
 *   - ESLint baseline 10e/13w preserved (lección #10 sub-precedent skippable —
 *     features/org-settings/* deletion NO afecta 10e/13w distribuidos en
 *     dispatch.service/documents/accounting/shared)
 *   - REQ-FMB.5 0 violations preserved
 *
 * Cross-ref:
 * - architecture.md §13.7 lecciones operacionales 14 cementadas + #10-#14
 *   evidencias cumulative
 * - architecture.md §13.A4-α DTO divergence (resolved cumulative POC A4
 *   complete — 12 .toSnapshot() callsites)
 * - architecture.md §13.A4-β callers no-args (resolved cumulative POC A4
 *   complete — 9 makeOrgSettingsService callers)
 * - architecture.md §13.A4-δ cross-module dep (resolved A4-C2 GREEN — cycle
 *   conceptual modules→features→modules eliminated)
 * - architecture.md §13.A4-ε cross-feature dep (resolved A4-C2 GREEN — paired
 *   cleanup atomic mirror A3-C5 precedent)
 * - architecture.md §13.A4-η Cat 2 vi.mock factory load-bearing (resolved
 *   A4-C1 GREEN paired sister cumulative §11/§12 cross-evidence)
 * - architecture.md §13.A4-γ + ζ + θ + ι NO-formal candidates defer A4-D1
 *   cumulative engram cleanup sub-task #10 expand
 * - engram bookmark `poc-nuevo/a4/13.eta-mock-factory-load-bearing` (§13.A4-η
 *   post-RED A4-C1 paired sister)
 * - engram bookmark `poc-nuevo/a3/c7/closed` (#1551) — atomic delete precedent
 *   cross-POC parity
 * - engram bookmark `poc-nuevo/a3/c8/closed` (#1554) — atomic delete precedent
 *   cross-POC parity EXACT mirror shape
 * - engram pattern `protocol/agent-lock-discipline/a2c3-additions` (#1515) —
 *   lección A6 #5 PROACTIVE fs.existsSync future-proof origen
 * - engram pattern `arch/lecciones/leccion-10-eslint-dry-run-skippable`
 *   (#1550) — sub-precedent cumulative cross-ciclo evidencia
 * - engram pointer `poc-nuevo/operational/vitest-rerun-discriminator` —
 *   operational verify discipline cementada esta sesión POC A4-C3 Step 0
 *   baseline verify (vitest sequential consecutive NEVER parallel — CPU
 *   contention contamina signal §13.A3-D4-α flake env-dependent)
 * - feedback memory `retirement_reinventory_gate` — PROJECT-scope grep
 *   classification 5-axis APPLIED (CONSUMER PROD 0 + TEST-MOCK-DECLARATION
 *   legacy 0 + RESIDUAL 0 + DEAD-IMPORT 0 + TEST-SHAPE-ASSERTION ~18 self-
 *   reference absorbed)
 * - feedback memory `red_acceptance_failure_mode` — Tests 4-5 safety net
 *   divergence declared explicit (NO silently accept "FAILS cumple")
 * - feedback memory `sub_phase_start_coherence_gate` — Step 0 cycle-start cold
 *   verified bookmark↔repo coherence + baseline drift +1 §13.A3-D4-α flake
 *   identified via engram lookup #1568 (NO regresión A4 scope)
 * - modules/org-settings/presentation/__tests__/c1-cutover-shape.poc-nuevo-a4
 *   .test.ts (precedent A4-C1 RED — 30 assertions α Cat 1 + Cat 2 cutover)
 * - modules/org-settings/presentation/__tests__/c2-cleanup-shape.poc-nuevo-a4
 *   .test.ts (precedent A4-C2 RED — 21 assertions α Cat 3 cleanup granular
 *   per callsite + Test 15 atomic mid-cycle correction §13.A4-ι NO-formal)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

// ── A4-C3 RED paths (file existence × 2 + directory existence × 1) ──────────

const ORG_SETTINGS_SERVER_PATH = path.join(
  REPO_ROOT,
  "features/org-settings/server.ts",
);
const ORG_SETTINGS_INDEX_PATH = path.join(
  REPO_ROOT,
  "features/org-settings/index.ts",
);
const ORG_SETTINGS_TOP_LEVEL_DIR_PATH = path.join(
  REPO_ROOT,
  "features/org-settings",
);

// ── A4-C3 RED PROJECT-scope absence regex (safety net consumer reintroducción) ─

const LEGACY_SERVER_IMPORT_RE =
  /from\s*["']@\/features\/org-settings\/server["']/;
const LEGACY_BARREL_IMPORT_RE = /from\s*["']@\/features\/org-settings["']/;

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

describe("POC nuevo A4-C3 — atomic delete features/org-settings/ wholesale shape", () => {
  // ── Tests 1-2: source files no longer exist (legacy wholesale deletion) ──

  it("Test 1: features/org-settings/server.ts no longer exists (legacy shim @deprecated deletion A4-C3)", () => {
    expect(fs.existsSync(ORG_SETTINGS_SERVER_PATH)).toBe(false);
  });

  it("Test 2: features/org-settings/index.ts no longer exists (legacy re-export barrel deletion A4-C3)", () => {
    expect(fs.existsSync(ORG_SETTINGS_INDEX_PATH)).toBe(false);
  });

  // ── Test 3: directory existence wholesale (collateral cleanup -1 vs A3-C7+C8) ──

  it("Test 3: features/org-settings/ top-level directory no longer exists (wholesale deletion A4-C3 — asimetría -1 collateral vs A3-C7+C8 sin __tests__/)", () => {
    expect(fs.existsSync(ORG_SETTINGS_TOP_LEVEL_DIR_PATH)).toBe(false);
  });

  // ── Tests 4-5: PROJECT-scope absence safety net (PASS pre-GREEN — divergence justified) ──
  // §13.A4-? safety net divergence declared explicit per feedback_red_acceptance
  // _failure_mode. Pre-GREEN PASS por retirement gate ZERO CONSUMER verified.
  // Forward-looking contra reintroducción post-A4-C3 GREEN.

  it("Test 4: zero production source imports `from \"@/features/org-settings/server\"` (PROJECT-scope safety net consumer reintroducción)", () => {
    const matches = findFilesMatchingImport(LEGACY_SERVER_IMPORT_RE);
    expect(matches).toEqual([]);
  });

  it("Test 5: zero production source imports `from \"@/features/org-settings\"` exact barrel (PROJECT-scope safety net consumer reintroducción)", () => {
    const matches = findFilesMatchingImport(LEGACY_BARREL_IMPORT_RE);
    expect(matches).toEqual([]);
  });
});
