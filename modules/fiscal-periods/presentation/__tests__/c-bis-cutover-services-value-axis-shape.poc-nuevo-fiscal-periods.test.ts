/**
 * POC nuevo fiscal-periods C-bis RED — 3 archivos cross-feature services VALUE-axis
 * cutover legacy `FiscalPeriodsService` class hex barrel re-export Opción A
 * (cementado C1-α GREEN línea 7-8 modules/fiscal-periods/presentation/server.ts) →
 * factory `makeFiscalPeriodsService()` pattern hex same barrel path + entity API
 * adjustments callsite-internal. Cementación VALUE-axis honest 8α explicit
 * pre-DROP línea 7-8 cumulative C7 GREEN single batch (Marco lock Opción 4 split
 * — C-bis insertado post-C1-α addendum RED separate + GREEN cumulative preserves
 * D-β-c4 mental model wholesale delete + cumulative cutover atomic, mirror
 * contacts C4-bis precedent EXACT literal).
 *
 * Recon gap NO surfaced — 12 callsites entity API adjustments pre-identified
 * Step 0 expand pre-RED este turno (4 string compares period.status === | !== +
 * 4 cast period.status as + 4 validatePeriodOpen duck-type {status: string}).
 * Marco lock L1 ESTRICTO axis-distinct collision retroactive permitido split
 * scope — period.status VO vs string pattern collision detected pre-RED +
 * escalated honest NO silently resolved (feedback marco-lock-L1-estricto-expand
 * -axis-distinct-collision aplicado). Capturar evidencia D1 cementación
 * cumulative fiscal-periods.
 *
 * 3 archivos VALUE consumers FULL (NO type-only):
 *   - features/accounting/journal.service.ts (field type + ctor DI default + new
 *     FiscalPeriodsService() + 3 string compares period.status !== "OPEN" + 2
 *     cast period.status as "OPEN" | "CLOSED" + 1 validatePeriodOpen call)
 *   - features/dispatch/dispatch.service.ts (field type + ctor DI default + new
 *     FiscalPeriodsService() + 2 cast period.status as "OPEN" | "CLOSED" + 3
 *     validatePeriodOpen calls)
 *   - features/monthly-close/monthly-close.service.ts (field type + ctor DI
 *     default + new FiscalPeriodsService() + 1 string compare period.status ===
 *     "CLOSED")
 *
 * 8α single test file homogeneous granularity per archivo bisect-friendly
 * (mirror contacts C4-bis 8α 4 archivos × 2 assertions = 8α — fiscal-periods
 * 3 archivos × 2 assertions = 6α + 2 cross-cutting consolidated period.status
 * patterns NEG + validatePeriodOpen entity duck type POS = 8α total):
 *   - 3 POS hex factory `^import { makeFiscalPeriodsService } from "@/modules/fiscal-periods/presentation/server";$/m` per archivo (Tests 1, 3, 5)
 *   - 3 NEG alternation legacy class drop `(?:import { FiscalPeriodsService } from|new FiscalPeriodsService\()` per archivo (mirror C4-bis Test 2/4/6/8 alternation precedent EXACT) (Tests 2, 4, 6)
 *   - 1 NEG consolidated period.status string-based access patterns ABSENT 3 services joined `/period\.status\s*(?:===|!==|as\s)/` (Test 7)
 *   - 1 POS validatePeriodOpen signature entity-shape duck type `period: { isOpen: () => boolean }` document-lifecycle.service.ts (Test 8)
 *
 * Test file location modules/fiscal-periods/presentation/__tests__/ — target hex
 * ownership mirror precedent contacts C4-bis EXACT — self-contained future-proof
 * vs C7 wholesale delete features/fiscal-periods/*. Cross-feature
 * `features/{accounting,dispatch,monthly-close}/*.service.ts` +
 * `features/accounting/document-lifecycle.service.ts` son pre-existing files NO
 * en scope wholesale C7.
 *
 * Marco locks Opción 4 split aplicados (heredados Step 0 close fiscal-periods):
 *   - L1 (C1-α Opción A re-export bridge cementado GREEN 099553b): hex barrel
 *     línea 7-8 ADD `export { FiscalPeriodsService } from "@/features/fiscal-periods/server"`
 *     preserva class identity end-to-end (zero-arg ctor + toLegacyShape entity
 *     → Prisma row cast). DROP línea 7-8 cumulative C7 GREEN wholesale delete
 *     features/fiscal-periods/* atomic single batch.
 *   - L2 (C-bis real class→factory swap + entity API adjustments este RED):
 *     period.isOpen() (entity method available line 83-85 modules/fiscal-periods/
 *     domain/fiscal-period.entity.ts), period.status.value (FiscalPeriodStatus
 *     VO), validatePeriodOpen signature accept entity-shape duck `{ isOpen: () =>
 *     boolean }` (4 in-scope callsites + 1 declaration site, NO out-of-scope
 *     ripples PROJECT-scope grep verified Step 0 expand). Mirror contacts C4-bis
 *     precedent EXACT literal — 8α homogeneous granularity per archivo
 *     bisect-friendly + 2 cross-cutting consolidated.
 *   - L3 (axis-distinct collision retroactive permitido split scope): 12 callsite
 *     breaks pre-identified pre-RED escalated honest. Capturar evidencia D1
 *     cementación cumulative fiscal-periods.
 *
 * Cross-cycle red test cementación gate forward (5ta evidencia POC fiscal-periods
 * C-bis PROACTIVE matures cumulative cross-POC sub-cycle): 8α tests survive
 * forward all cycles C2 through D1 unchanged — no path collision (C2 components
 * + C3 cross-module adapters + C4 page.tsx/route.ts + C5 vi.mock+integration +
 * C6 test files TYPE + C7 wholesale delete features/fiscal-periods/* + D1
 * doc-only). NO retire schedule needed — invariants hold cumulative POC closure.
 *
 * §13.A4-η factory return shape sub-pattern matures cumulative cross-POC (POC
 * contacts N+2ma cementada cumulative + POC fiscal-periods C-bis N+3ma evidencia
 * matures cumulative — class→factory swap cementación VALUE-axis honest mirror
 * contacts C4-bis precedent EXACT literal). Engram canonical home `arch/§13/A4-eta
 * -factory-return-shape-sub-pattern` matures cumulative cross-POC sub-cycle —
 * NO requiere re-cementación canonical home; matures cumulative.
 *
 * Self-contained future-proof check (lección A6 #5 + Marco lock L6 heredado mismo
 * path C0-pre): shape test asserta paths `features/accounting/journal.service.ts`,
 * `features/dispatch/dispatch.service.ts`, `features/monthly-close/monthly-close.service.ts`,
 * `features/accounting/document-lifecycle.service.ts` que persisten post C7
 * wholesale delete features/fiscal-periods/*. Test vive en
 * `modules/fiscal-periods/presentation/__tests__/` — NO toca features/fiscal-periods/*
 * que C7 borrará. Self-contained vs future deletes ✓.
 *
 * Source-string assertion pattern: mirror contacts C4-bis EXACT (`fs.readFileSync`
 * regex match) — keep pattern POC nuevo fiscal-periods. Target asserciones
 * consumer surface paths + cross-cutting status access patterns +
 * validatePeriodOpen entity duck type signature.
 *
 * Expected RED failure mode pre-GREEN (per feedback_red_acceptance_failure_mode):
 *   - T1, T3, T5 FAIL: 3 services hoy importan `import { FiscalPeriodsService } from`
 *     `@/modules/fiscal-periods/presentation/server` (post C1-α GREEN swap path
 *     completed) — `toMatch` factory hex pattern fails (factory makeFiscalPeriodsService
 *     NO present pre-GREEN, class FiscalPeriodsService present).
 *   - T2, T4, T6 FAIL: 3 services hoy contienen `import { FiscalPeriodsService } from`
 *     + `new FiscalPeriodsService()` (post C1-α legacy class identity preserved
 *     via Opción A re-export). `not.toMatch` alternation reverses. Test fails on
 *     unwanted match (legacy class import + instanciación PRESENT pre-GREEN).
 *   - T7 FAIL: 3 services collectively hoy contienen `period.status ===` o
 *     `period.status !==` o `period.status as` pre-GREEN (12 callsites string
 *     compares + cast). `not.toMatch` reverses. Test fails on unwanted match
 *     (string-based status access PRESENT pre-GREEN).
 *   - T8 FAIL: document-lifecycle.service.ts hoy define `validatePeriodOpen(period:
 *     { status: string })` legacy duck type — `toMatch` entity-shape duck type
 *     pattern fails (entity duck `{ isOpen: () => boolean }` NO present pre-GREEN).
 * Total expected FAIL pre-GREEN: 8/8 (Marco mandate failure mode honest enumerated
 * single side fiscal-periods).
 *
 * Cross-ref:
 *   - architecture.md §13.A4-η factory return shape sub-pattern (matures
 *     cumulative cross-POC sub-cycle continuation post POC contacts N+2ma)
 *   - engram `arch/§13/A4-eta-factory-return-shape-sub-pattern` (canonical home)
 *   - engram `poc-nuevo/fiscal-periods/bookmark-step0` (Step 0 close + Marco
 *     locks Opción 4 split L1+L2)
 *   - engram `poc-nuevo/contacts/closed` #1685 (precedent POC contacts C4-bis +
 *     C4-ter — mirror EXACT literal class→factory cutover VALUE-axis cementación)
 *   - engram `feedback/marco-lock-L1-estricto-expand-axis-distinct-collision`
 *     (period.status VO vs string axis-distinct collision elevated pre-RED + Marco
 *     lock L1 ESTRICTO retroactive permitido split scope Opción 4)
 *   - engram `feedback/cross-cycle-red-test-cementacion-gate` (5ta evidencia POC
 *     fiscal-periods C-bis PROACTIVE matures cumulative cross-POC sub-cycle)
 *   - engram `feedback/red-regex-discipline` (mirror precedent EXACT regex shape
 *     contacts C4-bis — `^import { makeFiscalPeriodsService } from ...;$/m`
 *     anchor + alternation `(?:...|...)` + character class precision)
 *   - engram `feedback/red-acceptance-failure-mode` (failure mode honest 8/8
 *     enumerated single side fiscal-periods)
 *   - engram `feedback/canonical-rule-application-commit-body` (cite + rationale
 *     + cross-ref applied RED commit body — §13.A4-η matures cumulative)
 *   - features/accounting/journal.service.ts (target T1, T2)
 *   - features/dispatch/dispatch.service.ts (target T3, T4)
 *   - features/monthly-close/monthly-close.service.ts (target T5, T6)
 *   - 3 services consolidated period.status patterns (target T7)
 *   - features/accounting/document-lifecycle.service.ts (target T8 —
 *     validatePeriodOpen signature entity-shape duck type)
 *   - modules/contacts/presentation/__tests__/c4-bis-cutover-services-value-axis-shape.poc-nuevo-contacts.test.ts
 *     (precedent shape POC nuevo contacts C4-bis RED + GREEN — mirror EXACT
 *     literal 8α homogeneous granularity per archivo bisect-friendly)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../../..");

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("POC nuevo fiscal-periods C-bis — 3 archivos cross-feature services VALUE-axis cutover legacy FiscalPeriodsService class hex barrel re-export Opción A → factory makeFiscalPeriodsService() pattern hex same barrel path + entity API adjustments callsite-internal (period.isOpen + validatePeriodOpen entity-shape duck type, mirror contacts C4-bis precedent EXACT literal 8α homogeneous granularity per archivo + 2 cross-cutting consolidated)", () => {
  // journal.service.ts
  it("Test 1: journal.service.ts contains `import { makeFiscalPeriodsService } from \"@/modules/fiscal-periods/presentation/server\"` (POSITIVE hex factory swap target post-cutover)", () => {
    const src = read("features/accounting/journal.service.ts");
    expect(src).toMatch(
      /^import \{ makeFiscalPeriodsService \} from "@\/modules\/fiscal-periods\/presentation\/server";$/m,
    );
  });
  it("Test 2: journal.service.ts NO contains legacy `import { FiscalPeriodsService } from` o `new FiscalPeriodsService(` instanciación (NEGATIVE alternation legacy class drop post-cutover Marco lock C1-α Opción A re-export DROP línea 7-8 defer C7)", () => {
    const src = read("features/accounting/journal.service.ts");
    expect(src).not.toMatch(
      /(?:import\s*\{\s*FiscalPeriodsService\s*\}\s*from|new\s+FiscalPeriodsService\s*\()/,
    );
  });

  // dispatch.service.ts
  it("Test 3: dispatch.service.ts contains `import { makeFiscalPeriodsService } from \"@/modules/fiscal-periods/presentation/server\"` (POSITIVE hex factory swap target post-cutover)", () => {
    const src = read("features/dispatch/dispatch.service.ts");
    expect(src).toMatch(
      /^import \{ makeFiscalPeriodsService \} from "@\/modules\/fiscal-periods\/presentation\/server";$/m,
    );
  });
  it("Test 4: dispatch.service.ts NO contains legacy `import { FiscalPeriodsService } from` o `new FiscalPeriodsService(` instanciación (NEGATIVE alternation legacy class drop post-cutover Marco lock C1-α Opción A re-export DROP línea 7-8 defer C7)", () => {
    const src = read("features/dispatch/dispatch.service.ts");
    expect(src).not.toMatch(
      /(?:import\s*\{\s*FiscalPeriodsService\s*\}\s*from|new\s+FiscalPeriodsService\s*\()/,
    );
  });

  // monthly-close.service.ts
  it("Test 5: monthly-close.service.ts contains `import { makeFiscalPeriodsService } from \"@/modules/fiscal-periods/presentation/server\"` (POSITIVE hex factory swap target post-cutover)", () => {
    const src = read("features/monthly-close/monthly-close.service.ts");
    expect(src).toMatch(
      /^import \{ makeFiscalPeriodsService \} from "@\/modules\/fiscal-periods\/presentation\/server";$/m,
    );
  });
  it("Test 6: monthly-close.service.ts NO contains legacy `import { FiscalPeriodsService } from` o `new FiscalPeriodsService(` instanciación (NEGATIVE alternation legacy class drop post-cutover Marco lock C1-α Opción A re-export DROP línea 7-8 defer C7)", () => {
    const src = read("features/monthly-close/monthly-close.service.ts");
    expect(src).not.toMatch(
      /(?:import\s*\{\s*FiscalPeriodsService\s*\}\s*from|new\s+FiscalPeriodsService\s*\()/,
    );
  });

  // ── Cross-cutting consolidated assertions (Tests 7-8) ──

  it("Test 7: 3 services collectively NO contain `period.status ===` o `period.status !==` o `period.status as` (NEGATIVE consolidated 12 callsites string-based status access patterns ABSENT post-cutover entity API adjustments — period.isOpen() o period.status.value VO post-GREEN)", () => {
    const sources = [
      read("features/accounting/journal.service.ts"),
      read("features/dispatch/dispatch.service.ts"),
      read("features/monthly-close/monthly-close.service.ts"),
    ].join("\n");
    expect(sources).not.toMatch(/period\.status\s*(?:===|!==|as\s)/);
  });

  it("Test 8: document-lifecycle.service.ts contains `period: { isOpen: () => boolean }` (POSITIVE validatePeriodOpen signature entity-shape duck type — accept FiscalPeriod entity directly via .isOpen() method post-cutover Marco lock L2 entity API adjustments)", () => {
    const src = read("features/accounting/document-lifecycle.service.ts");
    expect(src).toMatch(
      /period:\s*\{\s*isOpen:\s*\(\)\s*=>\s*boolean\s*\}/,
    );
  });
});
