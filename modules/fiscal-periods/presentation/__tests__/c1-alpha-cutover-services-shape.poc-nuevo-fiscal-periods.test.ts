/**
 * POC nuevo fiscal-periods C1-α RED — Opción A re-export bridge mecánico puro
 * path swap 3 cross-feature services FiscalPeriodsService class hex barrel
 * (single feature axis, NO paired sister — fiscal-periods es single feature
 * axis).
 *
 * Axis: FiscalPeriodsService class identity cutover OUT of legacy barrel
 * `@/features/fiscal-periods/server` → canonical hex barrel
 * `@/modules/fiscal-periods/presentation/server`. Mirror precedent contacts C1
 * EXACT literal — Opción A re-export legacy class identity preserved via hex
 * barrel ADD `export { FiscalPeriodsService } from "@/features/fiscal-periods/server"`
 * (NO hex application path — preserves toLegacyShape entity → Prisma row cast
 * via .toSnapshot() features/fiscal-periods/server.ts:8-9 + zero-arg ctor +
 * methods end-to-end). Path swap mecánico puro 3 consumers.
 *
 * §13.A5-α multi-level composition-root delegation 15ma evidencia matures
 * cumulative cross-POC sub-cycle continuation post-cementación canonical
 * (cumulative POC contacts 14ma + payment 13ma + paired-pr 11ma + earlier).
 * Engram canonical home `arch/§13/A5-alpha-multi-level-composition-root-delegation`
 * — C1-α NO requiere re-cementación canonical home; matures cumulative cross-POC
 * sub-cycle precedent forward C-bis-C2-C3-C4-C5-C6-C7.
 *
 * Marco locks Opción 4 split (Step 0 close fiscal-periods):
 *   - L1 (C1-α Opción A re-export bridge mecánico puro path swap): hex barrel
 *     `modules/fiscal-periods/presentation/server.ts` ADD re-export
 *     `export { FiscalPeriodsService } from "@/features/fiscal-periods/server"`
 *     (LEGACY shim, NO hex application). Preserves toLegacyShape entity → Prisma
 *     row cast via .toSnapshot() + zero-arg ctor + methods end-to-end. Mirror
 *     contacts C1 EXACT literal — re-export source path mirror precedent literal.
 *     C7 wholesale delete features/fiscal-periods/* defer.
 *   - L2 (C-bis insertado post-C1 real class→factory swap + entity API
 *     adjustments): period.isOpen(), period.status.value, validatePeriodOpen
 *     signature accept entity. Mirror contacts C4-bis precedent EXACT. Defer
 *     C-bis. POC ajustado 8-9 ciclos cumulative C1-α→C-bis→C2→C3→C4→C5→C6→C7→D1.
 *   - L3 (axis-distinct collision elevation): period.status VO vs string pattern
 *     detected pre-RED — escalated NOT silently resolved. Marco lock L1 ESTRICTO
 *     axis-distinct collision retroactive permitido split scope. feedback
 *     `marco-lock-L1-estricto-expand-axis-distinct-collision` aplicado. Capturar
 *     evidencia D1 cementación cumulative fiscal-periods.
 *   - L4 (TSC baseline NEW 17 honest aceptado): premise-verification-fail D1
 *     contacts claim 13 EXACT capture en D1 fiscal-periods cementación. 4 NEW
 *     errors purchases/* + sales/[saleId]/* CreateDraftInput contract drift,
 *     OUTSIDE POC fiscal-periods modification domain → no bloquea.
 *   - L5 (§13 emergentes 5 confirmados diferir cementación a D1): Adapter
 *     cross-module 4ta + §13.A reverse type-only 6ta + A5-ζ wholesale 4ta +
 *     A4-η factory return shape N+3ma + Path simplificado v2 RSC 3ra.
 *
 * Marco lock final RED scope C1-α (5 assertions α):
 *
 *   ── A: Hex canonical barrel import POSITIVE per file (Tests 1-3) ──
 *   3 cross-feature services swap import path `@/features/fiscal-periods/server`
 *   → `@/modules/fiscal-periods/presentation/server`. Hex barrel post-GREEN
 *   re-exports { FiscalPeriodsService } from "@/features/fiscal-periods/server"
 *   (Opción A Marco lock L1) — class identity preserved, toLegacyShape entity
 *   → Prisma row cast preserved, methods preserved end-to-end.
 *     T1 features/accounting/journal.service.ts
 *     T2 features/dispatch/dispatch.service.ts
 *     T3 features/monthly-close/monthly-close.service.ts
 *
 *   ── B: Legacy `from "@/features/fiscal-periods/server"` ABSENT consolidated (Test 4) ──
 *   PROJECT-scope grep features/ paths consolidated single assertion — 3 services
 *   collectively NO contain legacy barrel import. Single assertion replaces 3
 *   per-callsite negatives (consolidated 5-total target estricto Marco lock).
 *     T4 3 services collectively NO contain `from "@/features/fiscal-periods/server"`
 *
 *   ── C: Hex barrel canonical Opción A re-export (Test 5) ──
 *   Opción A Marco lock L1 — hex barrel re-export legacy class identity
 *   `{ FiscalPeriodsService }` from `@/features/fiscal-periods/server` (LEGACY
 *   shim, NO hex application). Preserves toLegacyShape + zero-arg ctor + methods
 *   + class identity end-to-end. Mirror contacts C1 EXACT literal precedent.
 *     T5 modules/fiscal-periods/presentation/server.ts contains
 *        `export { FiscalPeriodsService } from "@/features/fiscal-periods/server"`
 *        (canonical Opción A re-export legacy shim — preserves zero-arg ctor +
 *        toLegacyShape entity → Prisma row cast + methods + class identity defer
 *        C7 wholesale delete features/fiscal-periods/*)
 *
 * Cross-cycle red test cementación gate forward (4ta evidencia POC fiscal-periods
 * C1-α PROACTIVE matures cumulative cross-POC: 1ra C3 contacts retroactive + 2da
 * C4-pre contacts PROACTIVE + 3ra C5-pre contacts PROACTIVE + 4ta C4 contacts
 * PROACTIVE + 5ta C1-α fiscal-periods PROACTIVE — gate matures cumulative
 * forward):
 *   - Tests 1-4 retire en C-bis GREEN (real class→factory swap inverts invariant
 *     — services swap from `import { FiscalPeriodsService }` to `import
 *     { makeFiscalPeriodsService }` + `new FiscalPeriodsService()` to factory
 *     call `makeFiscalPeriodsService()` + period.status string → period.status.value
 *     VO + period.isOpen() + validatePeriodOpen signature). Mirror contacts
 *     Tests 7-10 retire C4-bis GREEN precedent EXACT. Skip+comment archaeology
 *     preserved per `it.skip` (NO `describe.skip`) preserva diagnostic granularity
 *     per-test.
 *   - Test 5 retire en C7 GREEN (wholesale delete features/fiscal-periods/* drops
 *     hex barrel re-export Opción A line). Mirror contacts Test 14 retire C4
 *     GREEN precedent EXACT. Skip+comment archaeology preserved.
 *
 * Self-contained future-proof check (lección A6 #5 + Marco lock L6 heredado mismo
 * path C0-pre): shape test asserta paths `features/accounting/journal.service.ts`,
 * `features/dispatch/dispatch.service.ts`, `features/monthly-close/monthly-close.service.ts`,
 * `modules/fiscal-periods/presentation/server.ts` que persisten post C7 wholesale
 * delete `features/fiscal-periods/*`. Test vive en
 * `modules/fiscal-periods/presentation/__tests__/` — NO toca `features/fiscal-periods/*`
 * que C7 borrará. Self-contained vs future deletes ✓. (Cross-feature
 * `features/{accounting,dispatch,monthly-close}/*.service.ts` son pre-existing
 * services NO en scope wholesale C7.)
 *
 * Source-string assertion pattern: mirror precedent contacts C1 EXACT (`fs.readFileSync`
 * regex match) — keep pattern POC nuevo fiscal-periods. Target asserciones consumer
 * surface paths + hex barrel canonical re-export shape.
 *
 * Expected RED failure mode pre-GREEN (per feedback_red_acceptance_failure_mode):
 *   - T1-T3 FAIL: 3 services hoy importan `from "@/features/fiscal-periods/server"`
 *     legacy barrel — `toMatch` hex canonical pattern fails (hex import path NO
 *     present pre-cutover).
 *   - T4 FAIL: 3 services collectively contienen `from "@/features/fiscal-periods/server"`
 *     pre-cutover — `not.toMatch` legacy pattern reverses. Test fails on unwanted
 *     match (legacy import path PRESENT pre-cutover ALL 3 services).
 *   - T5 FAIL: hex barrel `modules/fiscal-periods/presentation/server.ts` hoy NO
 *     contiene `export { FiscalPeriodsService } from "@/features/fiscal-periods/server"`
 *     pre-GREEN (re-export añadido GREEN scope). Test fails on missing positive
 *     match canonical Opción A re-export legacy shim.
 * Total expected FAIL pre-GREEN: 5/5 (Marco mandate failure mode honest enumerated
 * single side fiscal-periods).
 *
 * Cross-ref:
 *   - architecture.md §13.A5-α multi-level composition delegation (15ma evidencia
 *     matures cumulative cross-POC sub-cycle continuation post POC contacts 14ma)
 *   - engram `arch/§13/A5-alpha-multi-level-composition-root-delegation` #1587
 *     (canonical home — POC nuevo fiscal-periods 15ma evidencia matures cumulative)
 *   - engram `poc-nuevo/fiscal-periods/bookmark-step0` (Step 0 close + Marco locks
 *     Opción A POC FULL 8-9 ciclos + 5 §13 deferred D1 + TSC 17 baseline NEW honest)
 *   - engram `poc-nuevo/contacts/closed` #1685 (precedent POC contacts C1 — mirror
 *     EXACT literal Opción A re-export legacy shim path swap)
 *   - engram `feedback/marco-lock-L1-estricto-expand-axis-distinct-collision`
 *     (period.status VO vs string axis-distinct collision elevated pre-RED + Marco
 *     lock L1 ESTRICTO retroactive permitido split scope Opción 4)
 *   - engram `feedback/cross-cycle-red-test-cementacion-gate` (4ta evidencia POC
 *     fiscal-periods C1-α PROACTIVE matures cumulative cross-POC sub-cycle)
 *   - engram `feedback/red-regex-discipline` (mirror precedent EXACT regex shape
 *     contacts C1 — `\bFiscalPeriodsService\b` import specifier name presence
 *     guard contra incidental schema imports)
 *   - engram `feedback/red-acceptance-failure-mode` (failure mode honest 5/5
 *     enumerated single side fiscal-periods)
 *   - engram `feedback/canonical-rule-application-commit-body` (cite + rationale
 *     + cross-ref applied RED commit body — §13.A5-α 15ma matures cumulative)
 *   - features/accounting/journal.service.ts (target T1)
 *   - features/dispatch/dispatch.service.ts (target T2)
 *   - features/monthly-close/monthly-close.service.ts (target T3)
 *   - modules/fiscal-periods/presentation/server.ts (target T5 — hex barrel
 *     canonical Opción A re-export legacy class ADD `export { FiscalPeriodsService }
 *     from "@/features/fiscal-periods/server"`)
 *   - features/fiscal-periods/server.ts (legacy shim FiscalPeriodsService class —
 *     preserved C1-α scope as canonical Opción A source, drop C7 wholesale delete)
 *   - modules/contacts/presentation/__tests__/c1-cutover-services-shape.poc-nuevo-contacts.test.ts
 *     (precedent shape POC nuevo contacts C1 RED + GREEN — mirror EXACT literal)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

// ── C1-α cutover targets (3 source files single-axis) ──

const JOURNAL_SERVICE = path.join(
  REPO_ROOT,
  "features/accounting/journal.service.ts",
);
const DISPATCH_SERVICE = path.join(
  REPO_ROOT,
  "features/dispatch/dispatch.service.ts",
);
const MONTHLY_CLOSE_SERVICE = path.join(
  REPO_ROOT,
  "features/monthly-close/monthly-close.service.ts",
);

// Hex barrel target T5
const HEX_BARREL_SERVER = path.join(
  REPO_ROOT,
  "modules/fiscal-periods/presentation/server.ts",
);

// ── Regex patterns ───────────────────────────────────────────────────────────

// Regex precision rationale (per `feedback_red_regex_discipline`): assert
// `import { ... FiscalPeriodsService ... } from "@/modules/fiscal-periods/presentation/server"`
// specifically (NOT just the module path). Pattern guard contra incidental
// import lines `import { makeFiscalPeriodsService, FiscalPeriod, ... }` que ya
// importan from hex barrel server — precise pattern asserts FiscalPeriodsService
// runtime import name presence in import specifier list.
const HEX_CANONICAL_SERVER_IMPORT_RE =
  /import\s*\{[^}]*\bFiscalPeriodsService\b[^}]*\}\s*from\s+["']@\/modules\/fiscal-periods\/presentation\/server["']/;
const LEGACY_FEATURES_FISCAL_PERIODS_SERVER_IMPORT_RE =
  /from\s+["']@\/features\/fiscal-periods\/server["']/;
const HEX_BARREL_OPCION_A_REEXPORT_RE =
  /export\s*\{\s*FiscalPeriodsService\s*\}\s*from\s+["']@\/features\/fiscal-periods\/server["']/;

describe("POC nuevo fiscal-periods C1-α — Opción A re-export bridge mecánico puro path swap 3 cross-feature services FiscalPeriodsService class hex barrel (single feature axis NO paired, §13.A5-α 15ma evidencia matures cumulative cross-POC sub-cycle continuation Opción A re-export legacy shim class identity preserved + toLegacyShape entity → Prisma row cast preserved end-to-end)", () => {
  // ── A: Hex canonical barrel import POSITIVE per file (Tests 1-3) ──────────
  // Opción A Marco lock L1 — hex barrel re-exporta { FiscalPeriodsService }
  // from "@/features/fiscal-periods/server" (post-GREEN canonical re-export
  // legacy shim). 3 cross-feature services swap import path únicamente — class
  // identity preserved, toLegacyShape entity → Prisma row cast preservado, methods
  // preserved end-to-end.

  // ── Tests 1-3 RETIRED scope-expired pre-C-bis class→factory swap ──
  // C-bis invierte invariant cumulative cross-cycle scope evolution — Tests 1-3
  // cementación histórica preserved archaeology (skip + comentario, NO delete
  // wholesale). Los 3 tests cementaron en C1-α GREEN (commit 099553b) que las 3
  // services DEBEN importar `FiscalPeriodsService` (legacy class) from
  // `@/modules/fiscal-periods/presentation/server` (Opción A re-export bridge
  // class identity preserved). C-bis GREEN invierte el invariant: las 3 services
  // swap import a `makeFiscalPeriodsService` factory + ctor `new FiscalPeriodsService()`
  // → `makeFiscalPeriodsService()`. Mantener Tests 1-3 activos contradiría C-bis
  // GREEN naturalmente — collision detected proactively pre-RED este turno
  // (cross-cycle-red-test-cementacion-gate 5ta evidencia POC fiscal-periods C-bis
  // PROACTIVE — gate funcionó forward). Marco lock Opción A1 absorb cumulative
  // single GREEN batch (mirror contacts Tests 7-10 retire C4-bis precedent EXACT).
  // Test 4 (NEG legacy `from "@/features/fiscal-periods/server"`) preservado PASS
  // — services no contienen legacy path post C1-α GREEN, invariant cumulative
  // preserved forward C-bis-C7 unchanged.
  it.skip("Test 1: features/accounting/journal.service.ts DOES import from `@/modules/fiscal-periods/presentation/server` (FiscalPeriodsService class hex post-cutover Opción A canonical re-export legacy shim class identity preserved)", () => {
    const source = fs.readFileSync(JOURNAL_SERVICE, "utf8");
    expect(source).toMatch(HEX_CANONICAL_SERVER_IMPORT_RE);
  });

  it.skip("Test 2: features/dispatch/dispatch.service.ts DOES import from `@/modules/fiscal-periods/presentation/server` (FiscalPeriodsService class hex post-cutover Opción A canonical re-export legacy shim class identity preserved)", () => {
    const source = fs.readFileSync(DISPATCH_SERVICE, "utf8");
    expect(source).toMatch(HEX_CANONICAL_SERVER_IMPORT_RE);
  });

  it.skip("Test 3: features/monthly-close/monthly-close.service.ts DOES import from `@/modules/fiscal-periods/presentation/server` (FiscalPeriodsService class hex post-cutover Opción A canonical re-export legacy shim class identity preserved)", () => {
    const source = fs.readFileSync(MONTHLY_CLOSE_SERVICE, "utf8");
    expect(source).toMatch(HEX_CANONICAL_SERVER_IMPORT_RE);
  });

  // ── B: Legacy `from "@/features/fiscal-periods/server"` ABSENT consolidated (Test 4) ──
  // PROJECT-scope grep features/ paths consolidated single assertion — 3 services
  // collectively NO contain legacy barrel import. Single assertion replaces 3
  // per-callsite negatives.

  // ── Test 4 RETIRED scope-expired C7 wholesale delete + DROP bridge ──
  // C7 GREEN wholesale delete features/fiscal-periods/* + DROP línea 9 bridge
  // re-export hex barrel `export { FiscalPeriodsService } from "@/features/
  // fiscal-periods/server"`. Test 4 asserción NEG legacy path
  // `from "@/features/fiscal-periods/server"` collapsed post-C7 — legacy path
  // ABSENT en filesystem (3 archivos features/fiscal-periods/* DELETED + bridge
  // línea DROPPED). Test cementación histórica preserved archaeology (skip +
  // comentario, NO delete wholesale — preservar precedent EXACT intra-file
  // T1-T3 retire pattern same file per Marco lock Opción C mixto retirement-
  // strategy-mixto NEW canonical home 1ra evidencia POC fiscal-periods C7).
  // Cross-ref c7-wholesale-delete-bridge-drop.poc-nuevo-fiscal-periods.test.ts
  // T1-T3 NEG file ABSENT (3 archivos features/fiscal-periods/*) + T4 NEG
  // bridge línea ABSENT (mismo regex shape Opción A reverso not.toMatch).
  it.skip("Test 4: 3 services collectively NO contain `from \"@/features/fiscal-periods/server\"` (legacy barrel import dropped post-cutover ALL 3 services consolidated PROJECT-scope grep features/ paths)", () => {
    const sources = [
      fs.readFileSync(JOURNAL_SERVICE, "utf8"),
      fs.readFileSync(DISPATCH_SERVICE, "utf8"),
      fs.readFileSync(MONTHLY_CLOSE_SERVICE, "utf8"),
    ].join("\n");
    expect(sources).not.toMatch(LEGACY_FEATURES_FISCAL_PERIODS_SERVER_IMPORT_RE);
  });

  // ── C: Hex barrel canonical Opción A re-export (Test 5) ──────────────────
  // Opción A Marco lock L1 — hex barrel re-export legacy class identity
  // `{ FiscalPeriodsService }` from `@/features/fiscal-periods/server` (LEGACY
  // shim, NO hex application). Preserves toLegacyShape + zero-arg ctor + methods
  // + class identity end-to-end. Mirror contacts C1 EXACT literal precedent.

  // ── Test 5 RETIRED scope-expired C7 wholesale delete + DROP bridge ──
  // C7 GREEN DROPS línea 9 bridge re-export `export { FiscalPeriodsService }
  // from "@/features/fiscal-periods/server"` post wholesale delete features/
  // fiscal-periods/*. Test 5 asserción POS canonical Opción A re-export shim
  // collapsed post-C7 — bridge línea ABSENT post-DROP. Test cementación
  // histórica preserved archaeology (skip + comentario, NO delete wholesale —
  // preservar precedent EXACT intra-file T1-T3 retire pattern same file per
  // Marco lock Opción C mixto retirement-strategy-mixto NEW canonical home).
  // Cross-ref c7-wholesale-delete-bridge-drop.poc-nuevo-fiscal-periods.test.ts
  // T4 NEG bridge ABSENT (mismo regex shape Opción A reverso not.toMatch) +
  // T5 POS preservation guard canonical hex exports preserved post-DROP.
  it.skip("Test 5: modules/fiscal-periods/presentation/server.ts contains `export { FiscalPeriodsService } from \"@/features/fiscal-periods/server\"` (canonical Opción A re-export legacy shim class identity preserved — preserves zero-arg ctor + toLegacyShape entity → Prisma row cast + methods + class identity defer C7 wholesale delete features/fiscal-periods/*)", () => {
    const source = fs.readFileSync(HEX_BARREL_SERVER, "utf8");
    expect(source).toMatch(HEX_BARREL_OPCION_A_REEXPORT_RE);
  });
});
