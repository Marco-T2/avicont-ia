/**
 * POC nuevo monthly-close C6-b RED-α — cutover summary route hex factory
 * `makeMonthlyCloseService()` consume `getSummary` cementado C2.5
 * cumulative-precedent EXACT driver-anchored. 4α minimal mirror C6-a precedent
 * EXACT (`fs.readFileSync` regex content-grep cutover RED-time assertions
 * axis-distinct C1 lección permitida cutover — POS hex import + POS factory
 * call + NEG legacy server import absent + NEG legacy class ctor absent).
 *
 * **Marco locks pre-RED 4 ejes confirmados**:
 *
 *   1. **Granularity α single batch atomic RED+GREEN split** — 3 archivos
 *      (1 NEW + 2 MOD): NEW c6-b-cutover-shape test + MOD `app/api/.../
 *      monthly-close/summary/route.ts` (swap import + factory) + MOD
 *      `app/api/.../monthly-close/summary/__tests__/route.test.ts` (vi.mock
 *      target swap @/features → @/modules + factory shape importOriginal
 *      §13.A4-η Sub-D 9na evidencia matures cumulative cross-POC). Reduced
 *      vs C6-a 7 archivos — NO schema migration (GET no consume schema), NO
 *      signature adapt (getSummary 2-arg positional paridad EXACT cementado
 *      C2.5).
 *
 *   2. **RED-α test shape 4α minimal mirror C6-a precedent EXACT axis L1
 *      bisect-friendly simetría POS/NEG completa**:
 *      - T1 POS hex import `from "@/modules/monthly-close/presentation/server"`
 *        en summary/route.ts source.
 *      - T2 POS factory call `makeMonthlyCloseService()` en summary/route.ts
 *        source.
 *      - T3 NEG legacy `@/features/monthly-close/server` import absent en
 *        summary/route.ts source.
 *      - T4 NEG `new MonthlyCloseService()` class ctor pattern absent en
 *        summary/route.ts source (paired T2 POS factory call symmetric).
 *      Defer T5+ vi.mock paired runtime (content-grep RED-time assertions
 *      axis-distinct C1 lección permitida cutover mirror C6-a precedent
 *      EXACT). 4α suficiente coverage RED-α minimal — paired vi.mock target
 *      swap + factory shape verified GREEN tsc + suite cross-cycle. Mirror
 *      C6-a 4α scope (route.ts route swap solo, sin schema) preservar
 *      bisect-friendly per axis L1 estricto.
 *
 *   3. **vi.mock paired swap shape post-cutover (§13.A4-η 9na evidencia
 *      matures cumulative cross-POC paired C6-a 8va)** — Sub-B target swap +
 *      Sub-D entity-shape paired:
 *      - summary/route.test.ts: importOriginal preserves hex barrel re-exports
 *        + factory shape `makeMonthlyCloseService: vi.fn().mockImplementation(
 *        () => ({ getSummary: mockGetSummary }))`. importOriginal symmetry
 *        mirror C6-a route.test.ts EXACT (forward consistency cross-route +
 *        future-proof si summary route adds schema dep future).
 *
 *   4. **Pre-phase-audit-gate method-level signature verification 5ta evidencia
 *      matures cumulative cross-POC distinción canonical** — paridad EXACT
 *      pre-existing signature alignment vs cascade adapt:
 *      - C6-a 4ta: cascade adapt `close()` object→positional 4 args (hex
 *        intentional design choice positional decomposed args design intent
 *        textual evidence c5-integration test:37).
 *      - C6-b 5ta NEW: paridad EXACT `getSummary(orgId, periodId): Promise<
 *        MonthlyCloseSummary>` 2-arg positional cementado C2.5 — legacy
 *        consumer summary/route.ts:25 invoca `service.getSummary(orgId,
 *        periodId)` SAME signature. NO adapt needed cutover puro import +
 *        factory swap. Aspirational-mock-signals-unimplemented-contract
 *        review pre-RED — real producer hex honors contract EXACT (signature
 *        + return shape `MonthlyCloseSummary.balance.{balanced,totalDebit:
 *        string,totalCredit:string,difference:string}` match fixture
 *        `fullSummary` test L52-64 EXACT). NOT aspirational.
 *
 * **Pre-RED redact gate textual-rule-verification recursive structural
 * conventions 6ta evidencia matures cumulative** (C1 1ra + C2.2 2da + C3 3ra +
 * C4 4ta + C6-a 5ta + C6-b 6ta recursive — verified ≥3 evidencias EXACT
 * cutover route test naming + assertion shape + axis-distinct cutover
 * content-grep mirror C6-a EXACT):
 *
 *   1. **Test file location `modules/<X>/__tests__/c<N>-<topic>.poc-nuevo-<X>.test.ts`**:
 *      7 evidencias EXACT cumulative monthly-close (C0-C5 + C6-a + C6-b NEW).
 *      Marco lock automatic.
 *   2. **`fs.readFileSync` + regex `.toMatch` source-string assertion pattern**:
 *      ≥3 evidencias EXACT cumulative cross-POC (paired payables↔receivables
 *      C0+C1a+C1b-α+C3-C4 + iva-books A4-a + monthly-close C6-a + C6-b NEW).
 *   3. **POS hex import path regex `/from\s+["']@\/modules\/<X>\/presentation\/
 *      server["']/m`**: 3 evidencias EXACT (paired #1622 + iva-books A4-a +
 *      monthly-close C6-a + C6-b NEW) — cutover content-grep cumulative-
 *      precedent paired sister cross-POC.
 *   4. **NEG legacy class import regex `/from\s+["']@\/features\/<X>\/server["']/m`
 *      `not.toMatch`**: 3 evidencias EXACT (paired #1622 T9-T12 + iva-books
 *      A4-a + monthly-close C6-a + C6-b NEW) — cumulative-precedent paired
 *      sister.
 *   5. **POS factory call regex `/\bmake<X>Service\s*\(/`**: 3 evidencias EXACT
 *      (paired #1622 T1-T4 + iva-books A4-a + monthly-close C6-a + C6-b NEW).
 *   6. **NEG class ctor regex `/\bnew\s+<X>Service\s*\(/` `not.toMatch`** NEW
 *      pattern paired T2 POS factory call symmetric — 1ra evidencia POC
 *      monthly-close C6-b (defer rule-of-three cementación cross-POC threshold
 *      future). Forward-applicable: simetría POS/NEG completa axis L1
 *      bisect-friendly cutover RED-α minimal coverage.
 *   7. **Cycle classification RED+GREEN atomic split (axis-distinct content-grep
 *      cutover válidas)**: ≥3 evidencias EXACT cumulative cross-POC paired
 *      C3-C4 + iva-books A4-a + monthly-close C4 + C6-a + C6-b NEW.
 *
 * **§13 emergentes capturar D1 cumulative**:
 *   - §13.A4-η Sub-D factory shape paired post-cutover **9na evidencia matures
 *     cumulative cross-POC** (paired payables C3-C4 7ma + monthly-close C6-a
 *     8va + monthly-close C6-b NEW 9na).
 *   - §13 hex barrel `presentation/server` cross-route consumption **4ta
 *     evidencia matures cumulative** (sale + iva-books + monthly-close C6-a
 *     route + C6-b summary route NEW — cross-route barrel reuse pattern
 *     consistency).
 *   - §13 importOriginal preserve barrel re-export pattern cross-route
 *     consistency variant — symmetry justifica inclusión aún sin schema dep
 *     en summary route (forward-applicable future-proof si summary route
 *     adds schema dep future cumulative cross-route).
 *   - pre-phase-audit-gate method-level signature verification paridad EXACT
 *     **5ta evidencia matures cumulative** (C6-a 4ta cascade adapt
 *     object→positional vs C6-b 5ta paridad EXACT — distinción canonical
 *     pre-existing signature alignment vs cascade adapt forward-applicable
 *     cross-POC cumulative).
 *   - aspirational-mock-signals-unimplemented-contract review pre-RED
 *     verified mock NOT aspirational — real producer hex honors contract
 *     EXACT (signature + return shape) **2da evidencia POC monthly-close
 *     paired C6-a 1ra retroactive activation review pattern matures**.
 *
 * **Cycle scope GREEN target shape**:
 *   - GREEN (T1+T2+T3+T4 PASS): swap `app/api/.../monthly-close/summary/
 *     route.ts` L3 import legacy → hex barrel + L5 `new MonthlyCloseService()`
 *     → `makeMonthlyCloseService()`; L25 invocation `service.getSummary(orgId,
 *     periodId)` SAME signature EXACT preserved (paridad pre-existing
 *     cementado C2.5); swap `app/api/.../monthly-close/summary/__tests__/
 *     route.test.ts` vi.mock target legacy → hex + factory shape importOriginal
 *     pattern paired §13.A4-η Sub-D 9na ev.
 *
 * Self-contained future-proof (lección A6 #5 + Marco lock heredado): shape
 * test asserta paths `app/api/organizations/[orgSlug]/monthly-close/summary/
 * route.ts` que persiste post C7 wholesale delete `features/monthly-close/*`.
 * Test vive en `modules/monthly-close/__tests__/` — NO toca `features/
 * monthly-close/*` que C7 borrará. Self-contained vs future deletes ✓.
 *
 * Source-string assertion pattern: mirror C6-a precedent EXACT
 * (`fs.readFileSync` + regex match). Target asserciones consumer surface
 * invocation patterns (summary/route.ts source).
 *
 * Expected RED-α failure mode pre-GREEN (per `feedback_red_acceptance_failure_mode`):
 *   - T1 FAIL: summary/route.ts hoy importa `from "@/features/monthly-close/
 *     server"` legacy path — NO contiene `from "@/modules/monthly-close/
 *     presentation/server"` literal. Regex match falla.
 *   - T2 FAIL: summary/route.ts hoy invoca `new MonthlyCloseService()` class
 *     ctor pattern — NO contiene `makeMonthlyCloseService(` literal. Regex
 *     match falla.
 *   - T3 FAIL: summary/route.ts hoy importa `MonthlyCloseService` class —
 *     `not.toMatch` legacy import path expectation reverses (legacy path
 *     PRESENT pre-cutover). Test fails on unwanted match.
 *   - T4 FAIL: summary/route.ts hoy invoca `new MonthlyCloseService()` class
 *     ctor — `not.toMatch` class ctor pattern expectation reverses (class
 *     ctor PRESENT pre-cutover). Test fails on unwanted match.
 * Total expected FAIL pre-GREEN: 4/4 declared explícito Marco mandate failure
 * mode honest enumerated.
 *
 * Cross-ref:
 *   - architecture.md §13.A4-η vi.mock target+shape paired 9na evidencia matures.
 *   - architecture.md §13 hex barrel cross-route consumption 4ta evidencia matures.
 *   - features/monthly-close/server.ts:1-3 (driver-anchored barrel pattern legacy
 *     `import "server-only"; export { MonthlyCloseService } from "./monthly-close.service";
 *     export * from "./monthly-close.validation"` — C6-b cutover swap target
 *     (preserved hasta C7 wholesale delete features/monthly-close/* 17 files).
 *   - app/api/organizations/[orgSlug]/monthly-close/summary/route.ts:1-31
 *     (driver-anchored legacy consumer L3 `import { MonthlyCloseService } from
 *     "@/features/monthly-close/server"`; L5 `const service = new
 *     MonthlyCloseService()`; L25 `await service.getSummary(orgId, periodId)`
 *     — C6-b cutover swap target hex barrel + factory; L25 invocation EXACT
 *     preserved paridad cementada C2.5).
 *   - app/api/organizations/[orgSlug]/monthly-close/summary/__tests__/route.test.ts:28-32
 *     (vi.mock target + class shape NO importOriginal — C6-b swap target hex
 *     barrel + factory shape importOriginal symmetry mirror C6-a EXACT paired
 *     §13.A4-η Sub-D 9na ev cumulative cross-POC).
 *   - modules/monthly-close/application/monthly-close.service.ts:148-196
 *     (C2.5 cementado `getSummary(organizationId, periodId): Promise<
 *     MonthlyCloseSummary>` 2-arg positional + DTO inline shape match fixture
 *     test EXACT — paridad signature pre-existing alignment).
 *   - modules/monthly-close/presentation/composition-root.ts (C2.5 cementado
 *     `makeMonthlyCloseService(): MonthlyCloseService` zero-arg factory 4 deps
 *     wiring — C6-b hex factory consumer surface ready).
 *   - modules/monthly-close/presentation/server.ts (C4+C6-a populated factory
 *     re-export `export { makeMonthlyCloseService } from "./composition-root"`
 *     + `export * from "./validation"` — C6-b GREEN consume same barrel).
 *   - modules/monthly-close/__tests__/c6-cutover-shape.poc-nuevo-monthly-close.test.ts
 *     (C6-a precedent EXACT 4α RED-α route.ts cutover paired sister cycle —
 *     C6-b mirror EXACT shape adaptado scope summary route + T4 NEG class ctor
 *     vs C6-a T4 POS schema file).
 *   - paired-pr-C3-C4 RED `a610ef6` + GREEN `2278b11` master (preceding cycle
 *     paired POC — schemas live en hex pattern Sub-finding forward-applicable).
 *   - poc-11/0c/a4/a-c1 RED + GREEN master (iva-books A4-a precedent EXACT
 *     cutover routes hex factory single batch).
 *   - engram `feedback/cross-cycle-red-test-cementacion-gate` (forward-only
 *     check C6-b → C7 CLEAN: paths `app/api/.../monthly-close/summary/
 *     route.ts` persisten post C7 wholesale delete `features/monthly-close/*`).
 *   - engram `feedback/red-acceptance-failure-mode` (failure mode 4/4 FAIL
 *     enumerated declared explícito Marco mandate honest pre-write).
 *   - engram `feedback/red-regex-discipline` (regex discipline EXACT — POS
 *     `/from\s+["']@\/modules\/monthly-close\/presentation\/server["']/m` +
 *     `/\bmakeMonthlyCloseService\s*\(/` + NEG `/from\s+["']@\/features\/
 *     monthly-close\/server["']/m` + NEG `/\bnew\s+MonthlyCloseService\s*\(/`).
 *   - engram `feedback/canonical-rule-application-commit-body` (cite + rationale
 *     + cross-ref applied RED-α commit body — Marco locks #1-4 confirmados +
 *     5 capturas D1 cumulative + lecciones matures 9na §13.A4-η + 4ta hex
 *     barrel cross-route + 5ta pre-phase-audit-gate paridad EXACT distinción
 *     canonical + 6ta textual-rule-verification + 2da aspirational-mock review).
 *   - engram `feedback/aspirational-mock-signals-unimplemented-contract` (mock
 *     NOT aspirational verified pre-RED — real producer hex honors contract
 *     EXACT signature + return shape).
 *   - engram `feedback/pre-phase-audit` (5ta evidencia matures cumulative
 *     cross-POC method-level signature verification paridad EXACT distinción
 *     canonical pre-existing alignment vs cascade adapt).
 *   - engram `feedback/textual-rule-verification` (recursive structural
 *     conventions 6ta evidencia matures cumulative C1+C2.2+C3+C4+C6-a+C6-b).
 *   - engram `poc-nuevo/monthly-close/c2-5-closed` #1757 (precedent C2.5 cycle
 *     getSummary cementado 2-arg positional + MonthlyCloseSummary DTO inline
 *     shape — C6-b consumer surface paridad EXACT preserved cementado).
 *   - engram `poc-nuevo/monthly-close/c6-a-closed` #1754 (precedent C6-a cycle
 *     cutover route.ts hex factory + closeRequestSchema migration + invariant-
 *     collision-elevation 2da ev — C6-b mirror EXACT shape reduced scope sin
 *     schema sin signature adapt).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../..");

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

// ── C6-b cutover targets ────────────────────────────────────────────────────

const SUMMARY_ROUTE_TS =
  "app/api/organizations/[orgSlug]/monthly-close/summary/route.ts";

// ── Regex patterns ──────────────────────────────────────────────────────────

const HEX_BARREL_IMPORT_RE =
  /from\s+["']@\/modules\/monthly-close\/presentation\/server["']/m;
const MAKE_MONTHLY_CLOSE_SERVICE_RE = /\bmakeMonthlyCloseService\s*\(/;
const LEGACY_FEATURES_MONTHLY_CLOSE_SERVER_IMPORT_RE =
  /from\s+["']@\/features\/monthly-close\/server["']/m;
const LEGACY_CLASS_CTOR_RE = /\bnew\s+MonthlyCloseService\s*\(/;

describe("POC nuevo monthly-close C6-b RED-α — cutover summary route hex factory `makeMonthlyCloseService()` consume `getSummary` cementado C2.5 cumulative-precedent EXACT driver-anchored (Lock #1 α single batch atomic 3 archivos reduced scope vs C6-a 7 sin schema sin signature adapt + Lock #2 RED-α 4α minimal mirror C6-a EXACT axis L1 bisect-friendly simetría POS/NEG completa + Lock #3 vi.mock paired §13.A4-η 9na evidencia matures cumulative cross-POC paired C6-a 8va + Lock #4 pre-phase-audit-gate method-level signature verification paridad EXACT 5ta evidencia matures distinción canonical pre-existing alignment vs cascade adapt) Opción α atomic single batch axis-distinct cutover content-grep RED-time assertions C1 lección permitida cutover (mirror fiscal-periods C2/C3/C4 + paired #1622 + iva-books A4-a + monthly-close C6-a precedent EXACT cumulative-precedent recursive textual-rule-verification recursive structural conventions 6ta evidencia matures + 7 conventions verified ≥3 evidencias EXACT pre-RED redact gate cutover route layer + aspirational-mock-signals review verified mock NOT aspirational real producer hex honors contract EXACT)", () => {
  // ── A: Hex factory cutover POSITIVE (Tests 1-2) ─────────────────────────
  // Marco lock #2 RED-α 4α minimal — T1+T2 POS hex import + factory call
  // summary/route.ts source. GET getSummary primary cutover target paridad
  // EXACT pre-existing signature alignment cementado C2.5.

  it("Test 1: app/api/organizations/[orgSlug]/monthly-close/summary/route.ts contains `from \"@/modules/monthly-close/presentation/server\"` import (POS hex barrel cutover swap legacy `@/features/monthly-close/server` — Marco lock #1 α single batch atomic 3 archivos reduced scope vs C6-a 7 + Marco lock #2 RED-α 4α minimal mirror C6-a EXACT axis L1 bisect-friendly + Lock #4 paridad EXACT pre-existing signature alignment cementado C2.5 distinción canonical vs C6-a cascade adapt object→positional)", () => {
    const source = read(SUMMARY_ROUTE_TS);
    expect(source).toMatch(HEX_BARREL_IMPORT_RE);
  });

  it("Test 2: app/api/organizations/[orgSlug]/monthly-close/summary/route.ts contains `makeMonthlyCloseService(` invocation (POS factory call cutover swap legacy `new MonthlyCloseService()` zero-arg — cumulative-precedent EXACT 7 evidencias zero-arg supersede absoluto sale + payment + fiscal-periods + iva-books + accounting + monthly-close C4 + C6-a cementado consumer surface ready)", () => {
    const source = read(SUMMARY_ROUTE_TS);
    expect(source).toMatch(MAKE_MONTHLY_CLOSE_SERVICE_RE);
  });

  // ── B: Legacy import + class ctor ABSENT (Tests 3-4) ────────────────────
  // Cutover removes legacy `from "@/features/monthly-close/server"` import
  // + `new MonthlyCloseService()` class ctor pattern summary/route.ts —
  // bridge route uses hex barrel + factory exclusively post-cutover. Mirror
  // C6-a precedent EXACT not.toMatch pattern T3 + paired symmetric T4 NEW
  // pattern axis L1 bisect-friendly simetría POS/NEG completa.

  it("Test 3: app/api/organizations/[orgSlug]/monthly-close/summary/route.ts does NOT import from `@/features/monthly-close/server` (NEG legacy import path dropped post-cutover — features barrel preserved hasta C7 wholesale delete features/monthly-close/* 17 files orto al cutover; mirror C6-a precedent EXACT not.toMatch pattern)", () => {
    const source = read(SUMMARY_ROUTE_TS);
    expect(source).not.toMatch(LEGACY_FEATURES_MONTHLY_CLOSE_SERVER_IMPORT_RE);
  });

  it("Test 4: app/api/organizations/[orgSlug]/monthly-close/summary/route.ts does NOT contain `new MonthlyCloseService(` class ctor pattern (NEG legacy class ctor dropped post-cutover paired T2 POS factory call symmetric — axis L1 bisect-friendly simetría POS/NEG completa NEW pattern 1ra evidencia POC monthly-close C6-b defer rule-of-three cementación cross-POC threshold future)", () => {
    const source = read(SUMMARY_ROUTE_TS);
    expect(source).not.toMatch(LEGACY_CLASS_CTOR_RE);
  });
});
