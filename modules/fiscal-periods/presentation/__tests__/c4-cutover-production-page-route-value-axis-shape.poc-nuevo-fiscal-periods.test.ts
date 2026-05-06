/**
 * POC nuevo fiscal-periods C4 RED — 17 page.tsx + 3 route.ts production VALUE-axis
 * cutover legacy `FiscalPeriodsService` class hex barrel re-export Opción A
 * (cementado C1-α GREEN línea 7-8 modules/fiscal-periods/presentation/server.ts) →
 * factory `makeFiscalPeriodsService()` pattern hex same barrel path + 1
 * `createFiscalPeriodSchema` deferred C2 finalización isomorphic barrel swap
 * `@/features/fiscal-periods` → `@/modules/fiscal-periods/presentation/index`
 * (mirror contacts C4-ter precedent EXACT cumulative absorb single batch — 21
 * archivos cumulative single batch GREEN). Marco lock Opción A absorb cumulative
 * single batch — audit pre-RED Opción F confirma 20/20 entity API uniforme,
 * split artificial sin axis natural, L1 ESTRICTO axis-distinct collision NO
 * aplica (surfaced upfront via pre-phase-audit-gate, NO mid-Sub-A retroactive).
 *
 * Pre-phase-audit-gate aplicado pre-RED 2da evidencia matures cumulative cross-
 * POC (1ra contacts C1 ESLint post-RED → 2da fiscal-periods C4 pre-RED entity-
 * api). Audit confirma 20/20 sites afectados por entity API change subyacente
 * (factory returns FiscalPeriod entity con VO status, legacy shim returns
 * FiscalPeriodSnapshot string status):
 *   - Categ A (12 sites): consumen `p.status === "OPEN"` filter o `period.status`
 *     direct → rompe con VO post-swap → resolución `.toSnapshot()` bridge
 *     callsite-internal mecánico GREEN
 *   - Categ A' (1 site, monthly-close): manual map `status: p.status` sin
 *     JSON.stringify → mismo break, misma resolución
 *   - Categ B (7 sites): JSON.stringify/Response.json del array entity → rompe
 *     serialization → resolución `.toSnapshot()` mapping pre-stringify
 *
 * Resolución bridge mirror C3 A1 Opción E EXACT — `.toSnapshot()` bridge mínimo
 * callsite-internal possible (FiscalPeriod entity línea 91 modules/fiscal-
 * periods/domain/fiscal-period.entity.ts disponible — FiscalPeriodSnapshot.status
 * typed `"OPEN" | "CLOSED"` línea 35 valida filter post-swap directo, NO cast
 * `as` necesario).
 *
 * §13 Path simplificado v2 RSC boundary serialization adapter 5ta evidencia
 * matures cumulative cross-POC (POC mortality C1 1ra → POC contacts C4-ter 2da
 * → POC fiscal-periods C-bis 3ra → C3 4ta → C4 5ta evidencia matures cumulative).
 * Capturar D1 cementación cumulative.
 *
 * invariant-collision-elevation audit-detected-pre-RED variant NEW (vs
 * retroactive mid-Sub-A) — distinción canonical. C-bis L1 strict expand
 * mid-Sub-A vs C4 audit-detected-pre-RED. Capturar D1 cementación cumulative
 * lección NEW canonical home distinción.
 *
 * 17 page.tsx VALUE consumers FULL (NO type-only) — 17 inline `new
 * FiscalPeriodsService()` per-request salvo monthly-close module-level singleton
 * (preservar pattern post-GREEN factory call módulo-level OK, C-bis precedent):
 *   - app/(dashboard)/[orgSlug]/sales/[saleId]/page.tsx (Categ A)
 *   - app/(dashboard)/[orgSlug]/sales/new/page.tsx (Categ A)
 *   - app/(dashboard)/[orgSlug]/payments/new/page.tsx (Categ A)
 *   - app/(dashboard)/[orgSlug]/settings/periods/page.tsx (Categ B)
 *   - app/(dashboard)/[orgSlug]/informes/impuestos/libro-compras/page.tsx (Categ B)
 *   - app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/edit/page.tsx (Categ A)
 *   - app/(dashboard)/[orgSlug]/payments/[paymentId]/page.tsx (Categ A)
 *   - app/(dashboard)/[orgSlug]/accounting/journal/page.tsx (Categ B)
 *   - app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/page.tsx (Categ A)
 *   - app/(dashboard)/[orgSlug]/accounting/balances/page.tsx (Categ B)
 *   - app/(dashboard)/[orgSlug]/accounting/journal/new/page.tsx (Categ B)
 *   - app/(dashboard)/[orgSlug]/informes/impuestos/libro-ventas/page.tsx (Categ B)
 *   - app/(dashboard)/[orgSlug]/purchases/[purchaseId]/page.tsx (Categ A)
 *   - app/(dashboard)/[orgSlug]/accounting/monthly-close/page.tsx (Categ A' module-level)
 *   - app/(dashboard)/[orgSlug]/dispatches/[dispatchId]/page.tsx (Categ A)
 *   - app/(dashboard)/[orgSlug]/purchases/new/page.tsx (Categ A)
 *   - app/(dashboard)/[orgSlug]/dispatches/new/page.tsx (Categ A)
 *
 * 3 route.ts VALUE consumers FULL — agent module-level singleton + 2 inline:
 *   - app/api/organizations/[orgSlug]/agent/route.ts (Categ A module-level
 *     `period.status !== "OPEN"` direct compare línea 251)
 *   - app/api/organizations/[orgSlug]/periods/[periodId]/route.ts (Categ B
 *     `service.getById` Response.json entity)
 *   - app/api/organizations/[orgSlug]/periods/route.ts (Categ B `service.list`
 *     Response.json entity + `service.create` Response.json entity + barrel
 *     `createFiscalPeriodSchema` isomorphic barrel deferred C2 finalización
 *     swap mismo archivo single batch)
 *
 * 42α single test file homogeneous granularity per archivo per axis bisect-
 * friendly (mirror C-bis/C3 precedent EXACT scaled linearly — 21 archivos × 2
 * assertions = 42α total Marco lock RED-1 full bisect):
 *   - 17 POS hex factory `^import { makeFiscalPeriodsService } from "@/modules/fiscal-periods/presentation/server";$/m` per page.tsx (Tests 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33)
 *   - 17 NEG alternation legacy class drop `(?:import { FiscalPeriodsService } from|new FiscalPeriodsService\()` per page.tsx (mirror C-bis/C3 alternation precedent EXACT) (Tests 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34)
 *   - 3 POS hex factory per route.ts (Tests 35, 37, 39)
 *   - 3 NEG alternation legacy class drop per route.ts (Tests 36, 38, 40)
 *   - 1 POS hex isomorphic barrel `^import { createFiscalPeriodSchema } from "@/modules/fiscal-periods/presentation/index";$/m` periods/route.ts (Test 41 — deferred C2 finalización absorb)
 *   - 1 NEG legacy isomorphic barrel `from "@/features/fiscal-periods"(?!\/)` periods/route.ts negative lookahead excluding /server suffix (Test 42)
 *
 * Test file location modules/fiscal-periods/presentation/__tests__/ — target hex
 * ownership mirror precedent C-bis/C2/C3 EXACT — self-contained future-proof vs
 * C7 wholesale delete features/fiscal-periods/*. Production app/(dashboard)/
 * + app/api/ son pre-existing files NO en scope wholesale C7.
 *
 * Marco locks C4 aplicados (este RED):
 *   - Lock A absorb cumulative single batch — 17 page.tsx + 3 route.ts + 1
 *     barrel mismo single batch GREEN mirror C-bis precedent EXACT cumulative
 *   - Lock RED-1 full bisect 42α — granularity per archivo per axis preservado
 *     L1 estricto, NO compresión asimétrica (RED-2 23α / RED-3 6α descartadas)
 *   - Pattern divergence preservada — monthly-close page module-level singleton
 *     + agent route module-level singleton preservar post-GREEN factory call
 *     module-level OK (C-bis precedent NO homogenizar ctor inject scope creep)
 *   - `.toSnapshot()` bridge resolución mecánica GREEN — NO aserción RED
 *     dedicated per archivo (resolución determinística post-VALUE swap, runtime
 *     coverage supplied via TSC + 4 métricas suite-full)
 *
 * Lección #12 runtime path coverage RED scope — NO aplicada per archivo
 * runtime test (page.tsx/route.ts Server Components sin runtime test infra
 * POC). Cobertura via TSC type-check (FiscalPeriodSnapshot.status `"OPEN"|
 * "CLOSED"` valida filter `=== "OPEN"`) + 4 métricas baseline post-GREEN suite-
 * full + `.toSnapshot()` bridge mecánico GREEN determinístico. Surface honest —
 * lección #12 PROACTIVE timing aplicada via audit pre-phase-audit-gate (Categ
 * A/A'/B classification pre-RED), runtime test per archivo NO requerido scope
 * POC. Capturar D1 reasoning cementación cumulative.
 *
 * Cross-cycle red test cementación gate forward (7ma evidencia POC fiscal-
 * periods C4 PROACTIVE matures cumulative cross-POC sub-cycle): 42α tests
 * survive forward all cycles C5 through D1 unchanged — no path collision (C5
 * vi.mock factory declarations remaining + C6 test files TYPE swap + 1
 * component period-list.tsx TYPE-only + C7 wholesale delete features/fiscal-
 * periods/* + D1 doc-only). NO retire schedule needed — invariants hold
 * cumulative POC closure. C4 unbloquea C7 (post-swap production NO importan
 * from features/* — wholesale delete safe).
 *
 * §13.A4-η factory return shape sub-pattern matures cumulative cross-POC (POC
 * contacts N+2ma + POC fiscal-periods C-bis N+3ma + C2 N+4ma + C3 N+5ma + C4
 * N+6ma evidencia matures cumulative — class→factory swap cementación VALUE-
 * axis honest mirror precedent EXACT literal). Engram canonical home `arch/§13/
 * A4-eta-factory-return-shape-sub-pattern` matures cumulative cross-POC sub-
 * cycle — NO requiere re-cementación canonical home; matures cumulative.
 *
 * §13 Adapter Layer cross-module 5ta evidencia matures (post POC fiscal-
 * periods C3 4ta → C4 5ta production) — capturar D1 cementación cumulative.
 *
 * 3rd own-port duplicate scheduled DEFERRED §18 preservado — accounting +
 * iva-books + payment own-port duplicate `FiscalPeriodReaderPort` /
 * `FiscalPeriodsReadPort` NO promote shared port este C4 (scope reduction §18).
 * Refactor cross-module ~20 archivos diferido POC #11.0c A5 reorg E-2.
 *
 * Self-contained future-proof check (lección A6 #5 + Marco lock L6 heredado):
 * shape test asserta paths `app/(dashboard)/[orgSlug]/.../page.tsx` (17) +
 * `app/api/organizations/[orgSlug]/.../route.ts` (3) que persisten post C7
 * wholesale delete features/fiscal-periods/*. Test vive en `modules/fiscal-
 * periods/presentation/__tests__/` — NO toca features/fiscal-periods/* que C7
 * borrará. Self-contained vs future deletes ✓.
 *
 * Source-string assertion pattern: mirror C-bis/C2/C3 EXACT (`fs.readFileSync`
 * regex match) — keep pattern POC nuevo fiscal-periods. Target asserciones
 * production consumer surface paths.
 *
 * Expected RED failure mode pre-GREEN (per feedback_red_acceptance_failure_mode):
 *   - T1, T3, T5, T7, T9, T11, T13, T15, T17, T19, T21, T23, T25, T27, T29, T31,
 *     T33 FAIL: 17 page.tsx hoy importan `import { FiscalPeriodsService } from`
 *     `@/features/fiscal-periods/server` (legacy class identity preservada via
 *     C1-α Opción A re-export hex barrel línea 7-8) — `toMatch` factory hex
 *     pattern fails (factory makeFiscalPeriodsService NO present pre-GREEN,
 *     class FiscalPeriodsService present).
 *   - T2, T4, T6, T8, T10, T12, T14, T16, T18, T20, T22, T24, T26, T28, T30,
 *     T32, T34 FAIL: 17 page.tsx hoy contienen `import { FiscalPeriodsService }
 *     from` + `new FiscalPeriodsService()` (legacy class import + instanciación
 *     PRESENT pre-GREEN). `not.toMatch` alternation reverses. Test fails on
 *     unwanted match.
 *   - T35, T37, T39 FAIL: 3 route.ts hoy importan legacy class — `toMatch`
 *     factory hex fails.
 *   - T36, T38, T40 FAIL: 3 route.ts hoy contienen legacy class import + ctor —
 *     `not.toMatch` alternation reverses, test fails on unwanted match.
 *   - T41 FAIL: periods/route.ts hoy importa `import { createFiscalPeriodSchema
 *     } from "@/features/fiscal-periods"` legacy isomorphic barrel — `toMatch`
 *     hex isomorphic barrel pattern fails (target NO present pre-GREEN).
 *   - T42 FAIL: periods/route.ts hoy contiene `from "@/features/fiscal-periods"`
 *     legacy isomorphic barrel path PRESENT pre-GREEN — `not.toMatch` reverses.
 *     Test fails on unwanted match (negative lookahead `(?!\/)` excluyendo
 *     `/server` suffix verifica isomorphic barrel únicamente).
 * Total expected FAIL pre-GREEN: 42/42 (Marco mandate failure mode honest
 * enumerated single side fiscal-periods C4).
 *
 * Cross-ref:
 *   - architecture.md §13 Adapter Layer cross-module 5ta evidencia matures
 *     cumulative cross-POC (post POC fiscal-periods C3 4ta)
 *   - architecture.md §13 Path simplificado v2 RSC boundary serialization
 *     adapter 5ta evidencia matures cumulative cross-POC (post POC fiscal-
 *     periods C3 4ta → C4 5ta production)
 *   - architecture.md §13.A4-η factory return shape sub-pattern matures
 *     cumulative cross-POC sub-cycle continuation post POC fiscal-periods C3
 *     N+5ma → C4 N+6ma
 *   - engram `arch/§13/adapter-cross-module` (canonical home — 5ta evidencia)
 *   - engram `arch/§13/path-simplificado-v2-rsc-boundary-serialization-adapter`
 *     (canonical home — 5ta evidencia matures cumulative)
 *   - engram `arch/§13/A4-eta-factory-return-shape-sub-pattern` (canonical
 *     home — 6ta evidencia matures cumulative)
 *   - engram `poc-nuevo/fiscal-periods/bookmark-step0` (Step 0 close + Marco
 *     locks Opción A absorb cumulative + RED-1 full bisect 42α + locks C4)
 *   - engram `poc-nuevo/contacts/closed` (precedent POC contacts C4-ter cross-
 *     module routes API production VALUE consumers cycle separado de components
 *     mirror EXACT cumulative absorb)
 *   - engram `feedback/cross-cycle-red-test-cementacion-gate` (7ma evidencia
 *     POC fiscal-periods C4 PROACTIVE matures cumulative cross-POC sub-cycle)
 *   - engram `feedback/red-regex-discipline` (mirror precedent EXACT regex shape
 *     C-bis/C3 — `^import { makeFiscalPeriodsService } from ...;$/m` anchor +
 *     alternation `(?:...|...)` + character class precision + barrel negative
 *     lookahead `(?!\/)`)
 *   - engram `feedback/red-acceptance-failure-mode` (failure mode honest 42/42
 *     enumerated single side fiscal-periods C4)
 *   - engram `feedback/pre-phase-audit-gate` (2da evidencia matures cumulative
 *     pre-RED entity-api Categ A/A'/B classification — 1ra contacts C1 ESLint
 *     post-RED → 2da fiscal-periods C4 pre-RED entity-api)
 *   - engram `feedback/invariant-collision-elevation` (audit-detected-pre-RED
 *     variant NEW capturar D1 distinción canonical vs C-bis L1 strict expand
 *     mid-Sub-A vs C4 audit-detected-pre-RED)
 *   - engram `feedback/runtime-path-coverage-red-scope` (lección #12 NO
 *     aplicada per archivo runtime test, cobertura via TSC + 4 métricas
 *     suite-full + `.toSnapshot()` bridge determinístico — capturar D1 reasoning)
 *   - engram `feedback/canonical-rule-application-commit-body` (cite +
 *     rationale + cross-ref applied RED commit body)
 *   - 17 page.tsx + 3 route.ts production targets (target T1-T40)
 *   - app/api/organizations/[orgSlug]/periods/route.ts (target T41-T42 barrel
 *     deferred C2 finalización absorb single batch)
 *   - modules/fiscal-periods/presentation/__tests__/c-bis-cutover-services-value-axis-shape.poc-nuevo-fiscal-periods.test.ts
 *     + c2-cutover-components-value-axis-shape.poc-nuevo-fiscal-periods.test.ts
 *     + c3-cutover-cross-module-adapters-value-axis-shape.poc-nuevo-fiscal-periods.test.ts
 *     (precedent shape POC nuevo fiscal-periods C-bis/C2/C3 RED + GREEN —
 *     mirror EXACT literal Nα homogeneous granularity per archivo bisect-friendly)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../../..");

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

const POS_FACTORY =
  /^import \{ makeFiscalPeriodsService \} from "@\/modules\/fiscal-periods\/presentation\/server";$/m;
const NEG_LEGACY_CLASS =
  /(?:import\s*\{\s*FiscalPeriodsService\s*\}\s*from|new\s+FiscalPeriodsService\s*\()/;

describe("POC nuevo fiscal-periods C4 — 17 page.tsx + 3 route.ts production VALUE-axis cutover legacy `FiscalPeriodsService` class hex barrel re-export Opción A → factory `makeFiscalPeriodsService()` pattern hex same barrel path + 1 `createFiscalPeriodSchema` deferred C2 finalización isomorphic barrel swap (Marco lock Opción A absorb cumulative single batch + RED-1 full bisect 42α mirror C-bis/C3 precedent EXACT scaled linearly per archivo per axis)", () => {
  // ── 17 page.tsx Tests 1-34 (POS hex factory + NEG alternation legacy class) ──

  it("Test 1: app/(dashboard)/[orgSlug]/sales/[saleId]/page.tsx contains hex factory import (POSITIVE)", () => {
    const src = read("app/(dashboard)/[orgSlug]/sales/[saleId]/page.tsx");
    expect(src).toMatch(POS_FACTORY);
  });
  it("Test 2: app/(dashboard)/[orgSlug]/sales/[saleId]/page.tsx NO contains legacy class import o ctor (NEGATIVE alternation)", () => {
    const src = read("app/(dashboard)/[orgSlug]/sales/[saleId]/page.tsx");
    expect(src).not.toMatch(NEG_LEGACY_CLASS);
  });

  it("Test 3: app/(dashboard)/[orgSlug]/sales/new/page.tsx contains hex factory import (POSITIVE)", () => {
    const src = read("app/(dashboard)/[orgSlug]/sales/new/page.tsx");
    expect(src).toMatch(POS_FACTORY);
  });
  it("Test 4: app/(dashboard)/[orgSlug]/sales/new/page.tsx NO contains legacy class import o ctor (NEGATIVE alternation)", () => {
    const src = read("app/(dashboard)/[orgSlug]/sales/new/page.tsx");
    expect(src).not.toMatch(NEG_LEGACY_CLASS);
  });

  it("Test 5: app/(dashboard)/[orgSlug]/payments/new/page.tsx contains hex factory import (POSITIVE)", () => {
    const src = read("app/(dashboard)/[orgSlug]/payments/new/page.tsx");
    expect(src).toMatch(POS_FACTORY);
  });
  it("Test 6: app/(dashboard)/[orgSlug]/payments/new/page.tsx NO contains legacy class import o ctor (NEGATIVE alternation)", () => {
    const src = read("app/(dashboard)/[orgSlug]/payments/new/page.tsx");
    expect(src).not.toMatch(NEG_LEGACY_CLASS);
  });

  it("Test 7: app/(dashboard)/[orgSlug]/settings/periods/page.tsx contains hex factory import (POSITIVE)", () => {
    const src = read("app/(dashboard)/[orgSlug]/settings/periods/page.tsx");
    expect(src).toMatch(POS_FACTORY);
  });
  it("Test 8: app/(dashboard)/[orgSlug]/settings/periods/page.tsx NO contains legacy class import o ctor (NEGATIVE alternation)", () => {
    const src = read("app/(dashboard)/[orgSlug]/settings/periods/page.tsx");
    expect(src).not.toMatch(NEG_LEGACY_CLASS);
  });

  it("Test 9: app/(dashboard)/[orgSlug]/informes/impuestos/libro-compras/page.tsx contains hex factory import (POSITIVE)", () => {
    const src = read("app/(dashboard)/[orgSlug]/informes/impuestos/libro-compras/page.tsx");
    expect(src).toMatch(POS_FACTORY);
  });
  it("Test 10: app/(dashboard)/[orgSlug]/informes/impuestos/libro-compras/page.tsx NO contains legacy class import o ctor (NEGATIVE alternation)", () => {
    const src = read("app/(dashboard)/[orgSlug]/informes/impuestos/libro-compras/page.tsx");
    expect(src).not.toMatch(NEG_LEGACY_CLASS);
  });

  it("Test 11: app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/edit/page.tsx contains hex factory import (POSITIVE)", () => {
    const src = read("app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/edit/page.tsx");
    expect(src).toMatch(POS_FACTORY);
  });
  it("Test 12: app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/edit/page.tsx NO contains legacy class import o ctor (NEGATIVE alternation)", () => {
    const src = read("app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/edit/page.tsx");
    expect(src).not.toMatch(NEG_LEGACY_CLASS);
  });

  it("Test 13: app/(dashboard)/[orgSlug]/payments/[paymentId]/page.tsx contains hex factory import (POSITIVE)", () => {
    const src = read("app/(dashboard)/[orgSlug]/payments/[paymentId]/page.tsx");
    expect(src).toMatch(POS_FACTORY);
  });
  it("Test 14: app/(dashboard)/[orgSlug]/payments/[paymentId]/page.tsx NO contains legacy class import o ctor (NEGATIVE alternation)", () => {
    const src = read("app/(dashboard)/[orgSlug]/payments/[paymentId]/page.tsx");
    expect(src).not.toMatch(NEG_LEGACY_CLASS);
  });

  it("Test 15: app/(dashboard)/[orgSlug]/accounting/journal/page.tsx contains hex factory import (POSITIVE)", () => {
    const src = read("app/(dashboard)/[orgSlug]/accounting/journal/page.tsx");
    expect(src).toMatch(POS_FACTORY);
  });
  it("Test 16: app/(dashboard)/[orgSlug]/accounting/journal/page.tsx NO contains legacy class import o ctor (NEGATIVE alternation)", () => {
    const src = read("app/(dashboard)/[orgSlug]/accounting/journal/page.tsx");
    expect(src).not.toMatch(NEG_LEGACY_CLASS);
  });

  it("Test 17: app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/page.tsx contains hex factory import (POSITIVE)", () => {
    const src = read("app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/page.tsx");
    expect(src).toMatch(POS_FACTORY);
  });
  it("Test 18: app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/page.tsx NO contains legacy class import o ctor (NEGATIVE alternation)", () => {
    const src = read("app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/page.tsx");
    expect(src).not.toMatch(NEG_LEGACY_CLASS);
  });

  it("Test 19: app/(dashboard)/[orgSlug]/accounting/balances/page.tsx contains hex factory import (POSITIVE)", () => {
    const src = read("app/(dashboard)/[orgSlug]/accounting/balances/page.tsx");
    expect(src).toMatch(POS_FACTORY);
  });
  it("Test 20: app/(dashboard)/[orgSlug]/accounting/balances/page.tsx NO contains legacy class import o ctor (NEGATIVE alternation)", () => {
    const src = read("app/(dashboard)/[orgSlug]/accounting/balances/page.tsx");
    expect(src).not.toMatch(NEG_LEGACY_CLASS);
  });

  it("Test 21: app/(dashboard)/[orgSlug]/accounting/journal/new/page.tsx contains hex factory import (POSITIVE)", () => {
    const src = read("app/(dashboard)/[orgSlug]/accounting/journal/new/page.tsx");
    expect(src).toMatch(POS_FACTORY);
  });
  it("Test 22: app/(dashboard)/[orgSlug]/accounting/journal/new/page.tsx NO contains legacy class import o ctor (NEGATIVE alternation)", () => {
    const src = read("app/(dashboard)/[orgSlug]/accounting/journal/new/page.tsx");
    expect(src).not.toMatch(NEG_LEGACY_CLASS);
  });

  it("Test 23: app/(dashboard)/[orgSlug]/informes/impuestos/libro-ventas/page.tsx contains hex factory import (POSITIVE)", () => {
    const src = read("app/(dashboard)/[orgSlug]/informes/impuestos/libro-ventas/page.tsx");
    expect(src).toMatch(POS_FACTORY);
  });
  it("Test 24: app/(dashboard)/[orgSlug]/informes/impuestos/libro-ventas/page.tsx NO contains legacy class import o ctor (NEGATIVE alternation)", () => {
    const src = read("app/(dashboard)/[orgSlug]/informes/impuestos/libro-ventas/page.tsx");
    expect(src).not.toMatch(NEG_LEGACY_CLASS);
  });

  it("Test 25: app/(dashboard)/[orgSlug]/purchases/[purchaseId]/page.tsx contains hex factory import (POSITIVE)", () => {
    const src = read("app/(dashboard)/[orgSlug]/purchases/[purchaseId]/page.tsx");
    expect(src).toMatch(POS_FACTORY);
  });
  it("Test 26: app/(dashboard)/[orgSlug]/purchases/[purchaseId]/page.tsx NO contains legacy class import o ctor (NEGATIVE alternation)", () => {
    const src = read("app/(dashboard)/[orgSlug]/purchases/[purchaseId]/page.tsx");
    expect(src).not.toMatch(NEG_LEGACY_CLASS);
  });

  it("Test 27: app/(dashboard)/[orgSlug]/accounting/monthly-close/page.tsx contains hex factory import (POSITIVE — module-level singleton preservar pattern post-GREEN)", () => {
    const src = read("app/(dashboard)/[orgSlug]/accounting/monthly-close/page.tsx");
    expect(src).toMatch(POS_FACTORY);
  });
  it("Test 28: app/(dashboard)/[orgSlug]/accounting/monthly-close/page.tsx NO contains legacy class import o ctor (NEGATIVE alternation — module-level new FiscalPeriodsService() drop)", () => {
    const src = read("app/(dashboard)/[orgSlug]/accounting/monthly-close/page.tsx");
    expect(src).not.toMatch(NEG_LEGACY_CLASS);
  });

  it("Test 29: app/(dashboard)/[orgSlug]/dispatches/[dispatchId]/page.tsx contains hex factory import (POSITIVE)", () => {
    const src = read("app/(dashboard)/[orgSlug]/dispatches/[dispatchId]/page.tsx");
    expect(src).toMatch(POS_FACTORY);
  });
  it("Test 30: app/(dashboard)/[orgSlug]/dispatches/[dispatchId]/page.tsx NO contains legacy class import o ctor (NEGATIVE alternation)", () => {
    const src = read("app/(dashboard)/[orgSlug]/dispatches/[dispatchId]/page.tsx");
    expect(src).not.toMatch(NEG_LEGACY_CLASS);
  });

  it("Test 31: app/(dashboard)/[orgSlug]/purchases/new/page.tsx contains hex factory import (POSITIVE)", () => {
    const src = read("app/(dashboard)/[orgSlug]/purchases/new/page.tsx");
    expect(src).toMatch(POS_FACTORY);
  });
  it("Test 32: app/(dashboard)/[orgSlug]/purchases/new/page.tsx NO contains legacy class import o ctor (NEGATIVE alternation)", () => {
    const src = read("app/(dashboard)/[orgSlug]/purchases/new/page.tsx");
    expect(src).not.toMatch(NEG_LEGACY_CLASS);
  });

  it("Test 33: app/(dashboard)/[orgSlug]/dispatches/new/page.tsx contains hex factory import (POSITIVE)", () => {
    const src = read("app/(dashboard)/[orgSlug]/dispatches/new/page.tsx");
    expect(src).toMatch(POS_FACTORY);
  });
  it("Test 34: app/(dashboard)/[orgSlug]/dispatches/new/page.tsx NO contains legacy class import o ctor (NEGATIVE alternation)", () => {
    const src = read("app/(dashboard)/[orgSlug]/dispatches/new/page.tsx");
    expect(src).not.toMatch(NEG_LEGACY_CLASS);
  });

  // ── 3 route.ts Tests 35-40 (POS hex factory + NEG alternation legacy class) ──

  it("Test 35: app/api/organizations/[orgSlug]/agent/route.ts contains hex factory import (POSITIVE — module-level singleton preservar pattern post-GREEN)", () => {
    const src = read("app/api/organizations/[orgSlug]/agent/route.ts");
    expect(src).toMatch(POS_FACTORY);
  });
  it("Test 36: app/api/organizations/[orgSlug]/agent/route.ts NO contains legacy class import o ctor (NEGATIVE alternation — module-level fiscalPeriodsService = new FiscalPeriodsService() drop)", () => {
    const src = read("app/api/organizations/[orgSlug]/agent/route.ts");
    expect(src).not.toMatch(NEG_LEGACY_CLASS);
  });

  it("Test 37: app/api/organizations/[orgSlug]/periods/[periodId]/route.ts contains hex factory import (POSITIVE)", () => {
    const src = read("app/api/organizations/[orgSlug]/periods/[periodId]/route.ts");
    expect(src).toMatch(POS_FACTORY);
  });
  it("Test 38: app/api/organizations/[orgSlug]/periods/[periodId]/route.ts NO contains legacy class import o ctor (NEGATIVE alternation)", () => {
    const src = read("app/api/organizations/[orgSlug]/periods/[periodId]/route.ts");
    expect(src).not.toMatch(NEG_LEGACY_CLASS);
  });

  it("Test 39: app/api/organizations/[orgSlug]/periods/route.ts contains hex factory import (POSITIVE)", () => {
    const src = read("app/api/organizations/[orgSlug]/periods/route.ts");
    expect(src).toMatch(POS_FACTORY);
  });
  it("Test 40: app/api/organizations/[orgSlug]/periods/route.ts NO contains legacy class import o ctor (NEGATIVE alternation)", () => {
    const src = read("app/api/organizations/[orgSlug]/periods/route.ts");
    expect(src).not.toMatch(NEG_LEGACY_CLASS);
  });

  // ── 1 barrel deferred C2 finalización Tests 41-42 (POS hex isomorphic + NEG legacy isomorphic) ──

  it("Test 41: app/api/organizations/[orgSlug]/periods/route.ts contains `import { createFiscalPeriodSchema } from \"@/modules/fiscal-periods/presentation/index\"` (POSITIVE hex isomorphic barrel swap target post-cutover deferred C2 finalización absorb single batch C4)", () => {
    const src = read("app/api/organizations/[orgSlug]/periods/route.ts");
    expect(src).toMatch(
      /^import \{ createFiscalPeriodSchema \} from "@\/modules\/fiscal-periods\/presentation\/index";$/m,
    );
  });
  it("Test 42: app/api/organizations/[orgSlug]/periods/route.ts NO contains legacy `from \"@/features/fiscal-periods\"` isomorphic barrel path (NEGATIVE legacy isomorphic barrel drop post-cutover — negative lookahead `(?!\\/)` excluyendo `/server` suffix verifica isomorphic barrel únicamente, NO server path)", () => {
    const src = read("app/api/organizations/[orgSlug]/periods/route.ts");
    expect(src).not.toMatch(/from\s+"@\/features\/fiscal-periods"(?!\/)/);
  });
});
