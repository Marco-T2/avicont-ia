/**
 * POC nuevo fiscal-periods C3 RED — 3 archivos cross-module adapters VALUE-axis
 * cutover legacy `FiscalPeriodsService` class hex barrel re-export Opción A
 * (cementado C1-α GREEN línea 7-8 modules/fiscal-periods/presentation/server.ts) →
 * factory `makeFiscalPeriodsService()` pattern hex same barrel path. Path swap
 * puro mínimo — Marco lock C3 #3 NO callsite-internal entity API adjustments
 * (status cast `as "OPEN" | "CLOSED"` preservado iva-books + payment, accounting
 * pass-through preservado). Cementación VALUE-axis honest 8α explicit pre-DROP
 * línea 7-8 cumulative C7 GREEN single batch (mirror C-bis precedent EXACT
 * literal — 3 archivos × 2α + 2 cross-cutting consolidated mock declarations).
 *
 * Pattern divergence preservada (Marco lock C3 #2 NO homogenizar — scope creep
 * axis-distinct):
 *   - accounting/.../fiscal-periods-read.adapter.ts: module-level singleton
 *     `const legacy = new FiscalPeriodsService()` (línea 7) — preservar
 *     pattern post-GREEN (`const legacy = makeFiscalPeriodsService()`).
 *   - iva-books/.../legacy-fiscal-periods.adapter.ts: constructor inject w/
 *     default `= new FiscalPeriodsService()` — preservar ctor inject post-GREEN
 *     (default `= makeFiscalPeriodsService()`).
 *   - payment/.../legacy-fiscal-periods.adapter.ts: idem ctor inject w/ default
 *     — preservar post-GREEN.
 *
 * 3 archivos VALUE consumers cross-module FULL (NO type-only):
 *   - modules/accounting/infrastructure/fiscal-periods-read.adapter.ts (import
 *     legacy class + module-level singleton `new FiscalPeriodsService()`)
 *   - modules/iva-books/infrastructure/legacy-fiscal-periods.adapter.ts (import
 *     legacy class + ctor field type + ctor default `new FiscalPeriodsService()`)
 *   - modules/payment/infrastructure/adapters/legacy-fiscal-periods.adapter.ts
 *     (import legacy class + ctor field type + ctor default `new FiscalPeriodsService()`)
 *
 * 8α single test file homogeneous granularity per archivo bisect-friendly
 * (mirror contacts C4-bis + fiscal-periods C-bis 8α EXACT — 3 archivos × 2
 * assertions = 6α + 2 cross-cutting consolidated Sub-B mock declarations
 * paired = 8α total):
 *   - 3 POS hex factory `^import { makeFiscalPeriodsService } from "@/modules/fiscal-periods/presentation/server";$/m` per archivo (Tests 1, 3, 5)
 *   - 3 NEG alternation legacy class drop `(?:import { FiscalPeriodsService } from|new FiscalPeriodsService\()` per archivo (mirror C-bis Test 2/4/6 alternation precedent EXACT) (Tests 2, 4, 6)
 *   - 1 NEG consolidated legacy class mock shape ABSENT 2 adapter test files
 *     `FiscalPeriodsService:\s*class` (Test 7 — Sub-B mock-hygiene-commit-scope
 *     cleanup paired GREEN batch Marco lock C3 #4)
 *   - 1 POS consolidated factory hex barrel mock target PRESENT 2 adapter test
 *     files `vi.mock("@/modules/fiscal-periods/presentation/server"` (Test 8 —
 *     Sub-B mock-hygiene-commit-scope add paired GREEN batch Marco lock C3 #4)
 *
 * Test file location modules/fiscal-periods/presentation/__tests__/ — target hex
 * ownership mirror precedent C-bis EXACT — self-contained future-proof vs C7
 * wholesale delete features/fiscal-periods/*. Cross-module
 * `modules/{accounting,iva-books,payment}/infrastructure/.../legacy-fiscal-periods.adapter.ts`
 * + 2 adapter test files (accounting + iva-books) son pre-existing files
 * cross-module — NO en scope wholesale C7. Payment adapter SIN test file
 * dedicado — solo 2 adapter mock files cross-cutting consolidated.
 *
 * Marco locks C3 aplicados (este RED):
 *   - #1 Granularidad 8α mirror C-bis literal (3 × 2α + 2 cross-cutting consolidated)
 *   - #2 Pattern accounting singleton preservar divergence module-level — NO
 *     homogenizar ctor inject (scope creep axis-distinct)
 *   - #3 Status cast iva/payment preservar `as "OPEN" | "CLOSED"` — path swap
 *     puro mínimo NO callsite-internal entity API adjustments
 *   - #4 Mock declarations paired Sub-B same GREEN batch (C-bis precedent EXACT
 *     mock-hygiene-commit-scope)
 *
 * Cross-cycle red test cementación gate forward (6ta evidencia POC
 * fiscal-periods C3 PROACTIVE matures cumulative cross-POC sub-cycle): 8α tests
 * survive forward all cycles C4 through D1 unchanged — no path collision (C4
 * page.tsx/route.ts production VALUE swap + C5 vi.mock factory declarations
 * remaining + C6 test files TYPE swap + C7 wholesale delete features/fiscal-
 * periods/* + D1 doc-only). NO retire schedule needed — invariants hold
 * cumulative POC closure. C3 unbloquea C7 (post-swap adapters NO importan from
 * features/* — wholesale delete safe).
 *
 * §13.A4-η factory return shape sub-pattern matures cumulative cross-POC (POC
 * contacts N+2ma + POC fiscal-periods C-bis N+3ma + C2 N+4ma + C3 N+5ma
 * evidencia matures cumulative — class→factory swap cementación VALUE-axis
 * honest mirror C-bis precedent EXACT literal). Engram canonical home
 * `arch/§13/A4-eta-factory-return-shape-sub-pattern` matures cumulative
 * cross-POC sub-cycle — NO requiere re-cementación canonical home; matures
 * cumulative.
 *
 * §13 Adapter Layer cross-module 4ta evidencia matures (post POC contacts C3
 * 3ra evidencia contacts → fiscal-periods C3 4ta) — capturar D1 cementación
 * cumulative.
 *
 * 3rd own-port duplicate scheduled DEFERRED §18 preservado — accounting +
 * iva-books + payment own-port duplicate `FiscalPeriodReaderPort` /
 * `FiscalPeriodsReadPort` NO promote shared port este C3 (scope reduction §18).
 * Refactor cross-module ~20 archivos diferido POC #11.0c A5 reorg E-2.
 *
 * Self-contained future-proof check (lección A6 #5 + Marco lock L6 heredado):
 * shape test asserta paths `modules/accounting/infrastructure/fiscal-periods-read.adapter.ts`,
 * `modules/iva-books/infrastructure/legacy-fiscal-periods.adapter.ts`,
 * `modules/payment/infrastructure/adapters/legacy-fiscal-periods.adapter.ts`
 * + 2 adapter test files que persisten post C7 wholesale delete
 * features/fiscal-periods/*. Test vive en `modules/fiscal-periods/presentation/__tests__/`
 * — NO toca features/fiscal-periods/* que C7 borrará. Self-contained vs future
 * deletes ✓.
 *
 * Source-string assertion pattern: mirror C-bis EXACT (`fs.readFileSync` regex
 * match) — keep pattern POC nuevo fiscal-periods. Target asserciones consumer
 * surface paths + cross-cutting mock declarations Sub-B.
 *
 * Expected RED failure mode pre-GREEN (per feedback_red_acceptance_failure_mode):
 *   - T1, T3, T5 FAIL: 3 adapters hoy importan `import { FiscalPeriodsService } from`
 *     `@/features/fiscal-periods/server` (legacy class identity preservada via
 *     C1-α Opción A re-export hex barrel línea 7-8) — `toMatch` factory hex
 *     pattern fails (factory makeFiscalPeriodsService NO present pre-GREEN,
 *     class FiscalPeriodsService present).
 *   - T2, T4, T6 FAIL: 3 adapters hoy contienen `import { FiscalPeriodsService } from`
 *     + `new FiscalPeriodsService()` (legacy class import + instanciación PRESENT
 *     pre-GREEN). `not.toMatch` alternation reverses. Test fails on unwanted
 *     match.
 *   - T7 FAIL: 2 adapter test files hoy contienen `FiscalPeriodsService: class`
 *     legacy class mock shape (vi.mock "@/features/fiscal-periods/server" mock
 *     shape pre-GREEN). `not.toMatch` reverses. Test fails on unwanted match
 *     (legacy class mock shape PRESENT pre-GREEN).
 *   - T8 FAIL: 2 adapter test files hoy contienen `vi.mock("@/features/fiscal-periods/server"`
 *     legacy path mock target. `toMatch` factory hex barrel mock target fails
 *     (factory hex barrel mock `vi.mock("@/modules/fiscal-periods/presentation/server"`
 *     NO present pre-GREEN).
 * Total expected FAIL pre-GREEN: 8/8 (Marco mandate failure mode honest
 * enumerated single side fiscal-periods).
 *
 * Cross-ref:
 *   - architecture.md §13 Adapter Layer cross-module 4ta evidencia matures
 *     cumulative cross-POC (post POC contacts C3 3ra)
 *   - architecture.md §13.A4-η factory return shape sub-pattern matures
 *     cumulative cross-POC sub-cycle continuation post POC fiscal-periods C2
 *     N+4ma → C3 N+5ma
 *   - engram `arch/§13/adapter-cross-module` (canonical home — 4ta evidencia)
 *   - engram `arch/§13/A4-eta-factory-return-shape-sub-pattern` (canonical
 *     home — 5ta evidencia matures cumulative)
 *   - engram `poc-nuevo/fiscal-periods/bookmark-step0` (Step 0 close + Marco
 *     locks Opción 4 split L1+L2+L3 + locks C3 #1-#4)
 *   - engram `poc-nuevo/contacts/closed` #1685 (precedent POC contacts C3 cross-
 *     module routes API Balance methods cutover 3 routes legacy shim
 *     ContactsService → hex factory makeContactBalancesService — mirror EXACT)
 *   - engram `feedback/cross-cycle-red-test-cementacion-gate` (6ta evidencia
 *     POC fiscal-periods C3 PROACTIVE matures cumulative cross-POC sub-cycle)
 *   - engram `feedback/red-regex-discipline` (mirror precedent EXACT regex shape
 *     C-bis — `^import { makeFiscalPeriodsService } from ...;$/m` anchor +
 *     alternation `(?:...|...)` + character class precision)
 *   - engram `feedback/red-acceptance-failure-mode` (failure mode honest 8/8
 *     enumerated single side fiscal-periods)
 *   - engram `feedback/mock-hygiene-commit-scope` (Sub-B mock declarations
 *     paired GREEN batch Marco lock C3 #4)
 *   - engram `feedback/canonical-rule-application-commit-body` (cite +
 *     rationale + cross-ref applied RED commit body — §13 Adapter Layer
 *     cross-module 4ta + §13.A4-η N+5ma matures + 3rd own-port duplicate §18
 *     deferral preservado)
 *   - modules/accounting/infrastructure/fiscal-periods-read.adapter.ts (target T1, T2)
 *   - modules/iva-books/infrastructure/legacy-fiscal-periods.adapter.ts (target T3, T4)
 *   - modules/payment/infrastructure/adapters/legacy-fiscal-periods.adapter.ts (target T5, T6)
 *   - modules/accounting/infrastructure/__tests__/fiscal-periods-read.adapter.test.ts
 *     (target T7, T8 — Sub-B mock declaration paired GREEN batch)
 *   - modules/iva-books/infrastructure/__tests__/legacy-fiscal-periods.adapter.test.ts
 *     (target T7, T8 — Sub-B mock declaration paired GREEN batch)
 *   - modules/fiscal-periods/presentation/__tests__/c-bis-cutover-services-value-axis-shape.poc-nuevo-fiscal-periods.test.ts
 *     (precedent shape POC nuevo fiscal-periods C-bis RED + GREEN — mirror
 *     EXACT literal 8α homogeneous granularity per archivo bisect-friendly)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../../..");

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("POC nuevo fiscal-periods C3 — 3 archivos cross-module adapters VALUE-axis cutover legacy FiscalPeriodsService class hex barrel re-export Opción A → factory makeFiscalPeriodsService() pattern hex same barrel path (path swap puro mínimo, NO callsite-internal entity API adjustments — status cast preservado, pattern divergence preservada accounting singleton vs iva/payment ctor inject, mirror C-bis precedent EXACT literal 8α homogeneous granularity per archivo + 2 cross-cutting consolidated Sub-B mock declarations)", () => {
  // accounting/.../fiscal-periods-read.adapter.ts
  it("Test 1: accounting/infrastructure/fiscal-periods-read.adapter.ts contains `import { makeFiscalPeriodsService } from \"@/modules/fiscal-periods/presentation/server\"` (POSITIVE hex factory swap target post-cutover)", () => {
    const src = read("modules/accounting/infrastructure/fiscal-periods-read.adapter.ts");
    expect(src).toMatch(
      /^import \{ makeFiscalPeriodsService \} from "@\/modules\/fiscal-periods\/presentation\/server";$/m,
    );
  });
  it("Test 2: accounting/infrastructure/fiscal-periods-read.adapter.ts NO contains legacy `import { FiscalPeriodsService } from` o `new FiscalPeriodsService(` instanciación (NEGATIVE alternation legacy class drop post-cutover Marco lock C1-α Opción A re-export DROP línea 7-8 defer C7)", () => {
    const src = read("modules/accounting/infrastructure/fiscal-periods-read.adapter.ts");
    expect(src).not.toMatch(
      /(?:import\s*\{\s*FiscalPeriodsService\s*\}\s*from|new\s+FiscalPeriodsService\s*\()/,
    );
  });

  // iva-books/.../legacy-fiscal-periods.adapter.ts
  it("Test 3: iva-books/infrastructure/legacy-fiscal-periods.adapter.ts contains `import { makeFiscalPeriodsService } from \"@/modules/fiscal-periods/presentation/server\"` (POSITIVE hex factory swap target post-cutover)", () => {
    const src = read("modules/iva-books/infrastructure/legacy-fiscal-periods.adapter.ts");
    expect(src).toMatch(
      /^import \{ makeFiscalPeriodsService \} from "@\/modules\/fiscal-periods\/presentation\/server";$/m,
    );
  });
  it("Test 4: iva-books/infrastructure/legacy-fiscal-periods.adapter.ts NO contains legacy `import { FiscalPeriodsService } from` o `new FiscalPeriodsService(` instanciación (NEGATIVE alternation legacy class drop post-cutover Marco lock C1-α Opción A re-export DROP línea 7-8 defer C7)", () => {
    const src = read("modules/iva-books/infrastructure/legacy-fiscal-periods.adapter.ts");
    expect(src).not.toMatch(
      /(?:import\s*\{\s*FiscalPeriodsService\s*\}\s*from|new\s+FiscalPeriodsService\s*\()/,
    );
  });

  // payment/.../legacy-fiscal-periods.adapter.ts
  it("Test 5: payment/infrastructure/adapters/legacy-fiscal-periods.adapter.ts contains `import { makeFiscalPeriodsService } from \"@/modules/fiscal-periods/presentation/server\"` (POSITIVE hex factory swap target post-cutover)", () => {
    const src = read("modules/payment/infrastructure/adapters/legacy-fiscal-periods.adapter.ts");
    expect(src).toMatch(
      /^import \{ makeFiscalPeriodsService \} from "@\/modules\/fiscal-periods\/presentation\/server";$/m,
    );
  });
  it("Test 6: payment/infrastructure/adapters/legacy-fiscal-periods.adapter.ts NO contains legacy `import { FiscalPeriodsService } from` o `new FiscalPeriodsService(` instanciación (NEGATIVE alternation legacy class drop post-cutover Marco lock C1-α Opción A re-export DROP línea 7-8 defer C7)", () => {
    const src = read("modules/payment/infrastructure/adapters/legacy-fiscal-periods.adapter.ts");
    expect(src).not.toMatch(
      /(?:import\s*\{\s*FiscalPeriodsService\s*\}\s*from|new\s+FiscalPeriodsService\s*\()/,
    );
  });

  // ── Cross-cutting consolidated Sub-B mock declarations (Tests 7-8) ──

  it("Test 7: 2 adapter test files (accounting + iva-books) collectively NO contain `FiscalPeriodsService: class` legacy class mock shape (NEGATIVE consolidated Sub-B mock-hygiene-commit-scope cleanup post-cutover Marco lock C3 #4 paired GREEN batch — payment adapter sin test file dedicado)", () => {
    const sources = [
      read("modules/accounting/infrastructure/__tests__/fiscal-periods-read.adapter.test.ts"),
      read("modules/iva-books/infrastructure/__tests__/legacy-fiscal-periods.adapter.test.ts"),
    ].join("\n");
    expect(sources).not.toMatch(/FiscalPeriodsService:\s*class/);
  });

  it("Test 8: 2 adapter test files (accounting + iva-books) collectively contain `vi.mock(\"@/modules/fiscal-periods/presentation/server\"` factory hex barrel mock target (POSITIVE consolidated Sub-B mock-hygiene-commit-scope add post-cutover Marco lock C3 #4 paired GREEN batch — vi.mock target alineado con import path adapter source post-swap)", () => {
    const sources = [
      read("modules/accounting/infrastructure/__tests__/fiscal-periods-read.adapter.test.ts"),
      read("modules/iva-books/infrastructure/__tests__/legacy-fiscal-periods.adapter.test.ts"),
    ].join("\n");
    expect(sources).toMatch(
      /vi\.mock\("@\/modules\/fiscal-periods\/presentation\/server"/,
    );
  });
});
