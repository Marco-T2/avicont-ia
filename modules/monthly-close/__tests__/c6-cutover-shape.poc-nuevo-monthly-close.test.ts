/**
 * POC nuevo monthly-close C6 RED-α — cutover routes hex factory
 * `makeMonthlyCloseService()` + `closeRequestSchema` migration atomic to hex
 * `modules/monthly-close/presentation/validation.ts` cumulative-precedent EXACT
 * driver-anchored. 4α minimal mirror paired payables↔receivables C3-C4 precedent
 * EXACT (`fs.readFileSync` regex content-grep cutover RED-time assertions
 * axis-distinct C1 lección permitida cutover — POS hex import + POS factory call
 * + NEG legacy class import absent + POS schema home file exists).
 *
 * **Marco locks pre-RED 4 ejes confirmados**:
 *
 *   1. **closeRequestSchema migration scope C6 atomic Opción A** — schema HOME
 *      migrate atomic to hex `modules/monthly-close/presentation/validation.ts`
 *      NEW + hex barrel `modules/monthly-close/presentation/server.ts` populate
 *      `export * from "./validation"`. Precedent paired #1622 forward-applicable
 *      explícito (Sub-finding "schemas live en hex `modules/{X}/presentation/
 *      validation` re-exported via `features/{X}/index`"). Opción B viola §17
 *      carve-out 6ta evidencia cumulative absoluto NO §17 cite at composition-
 *      root. Opción C deja route.ts:5 dangling al C7 wholesale forzando rescue
 *      tardío. evidence-supersedes-assumption-lock **7ma evidencia matures**
 *      cumulative cross-POC (bookmark wording "barrel migration scope" loose
 *      superseded por precedent paired #1622 atomic migration).
 *
 *   2. **Granularity α1 atomic single batch RED+GREEN split** — 7 archivos
 *      (3 NEW + 4 MOD): NEW c6-cutover-shape test + NEW
 *      `modules/monthly-close/presentation/validation.ts` (closeRequestSchema
 *      migrated) + MOD `modules/monthly-close/presentation/server.ts` (populate
 *      schema re-export) + MOD `app/api/.../monthly-close/route.ts` (swap import
 *      + factory) + MOD `app/api/.../monthly-close/summary/route.ts` (swap
 *      import + factory) + MOD `app/api/.../monthly-close/__tests__/route.test.ts`
 *      (vi.mock target + factory shape paired §13.A4-η) + MOD
 *      `app/api/.../monthly-close/summary/__tests__/route.test.ts` (vi.mock
 *      target + factory shape paired §13.A4-η). Mirror precedent paired #1622
 *      (10 archivos batch single) + iva-books A4-a (8 routes batch cumulative).
 *
 *   3. **RED-α test shape 4α minimal mirror cumulative-precedent**:
 *      - T1 POS hex import `from "@/modules/monthly-close/presentation/server"`
 *        en route.ts source (POST close — primary cutover target).
 *      - T2 POS factory call `makeMonthlyCloseService()` en route.ts source.
 *      - T3 NEG legacy `MonthlyCloseService` import absent en route.ts source.
 *      - T4 POS schema home file exists
 *        `modules/monthly-close/presentation/validation.ts`.
 *      Defer T5 hex barrel re-exports schema content-grep + T6 vi.mock paired
 *      runtime — content-grep RED-time assertions axis-distinct C1 lección
 *      permitida cutover (mirror fiscal-periods C2/C3/C4 precedent EXACT).
 *      4α suficiente coverage RED-α minimal — paired vi.mock target swap +
 *      hex barrel schema re-export verified GREEN tsc + suite cross-cycle.
 *      summary/route.ts cutover material GREEN scope, verified vitest cross-
 *      cycle (suite full GREEN preserves 4 métricas baseline EXACT).
 *
 *   4. **vi.mock paired swap shape post-cutover (§13.A4-η 8va evidencia matures
 *      cumulative cross-POC)** — Sub-B target swap + Sub-D entity-shape paired:
 *      - route.test.ts: importOriginal preserves schema re-export hex barrel +
 *        factory shape `makeMonthlyCloseService: vi.fn().mockImplementation(
 *        () => ({ close }))`.
 *      - summary/route.test.ts: factory shape `makeMonthlyCloseService:
 *        vi.fn().mockImplementation(() => ({ getSummary }))`.
 *
 * **Pre-RED redact gate textual-rule-verification recursive structural
 * conventions 5ta evidencia matures cumulative** (C1 1ra + C2.2 2da + C3 3ra +
 * C4 4ta + C6 5ta recursive — verified ≥3 evidencias EXACT cutover route
 * test naming + assertion shape + axis-distinct cutover content-grep):
 *
 *   1. **Test file location `modules/<X>/__tests__/c<N>-<topic>.poc-nuevo-<X>.test.ts`**:
 *      6 evidencias EXACT cumulative (C0-C5 monthly-close consistente). Marco
 *      lock automatic.
 *   2. **`fs.readFileSync` + regex `.toMatch` source-string assertion pattern**:
 *      ≥3 evidencias EXACT cumulative cross-POC (paired payables↔receivables
 *      C0+C1a+C1b-α+C3-C4 + iva-books A4-a + monthly-close C6 NEW). Marco lock
 *      #3 cumulative-precedent.
 *   3. **`existsSync` + `path.resolve(__dirname, "../../..")` POS file existence
 *      pattern**: 6 evidencias EXACT cumulative monthly-close (C0-C5).
 *      Convención reusada T4 schema file existence assertion.
 *   4. **POS hex import path regex `/from\s+["']@\/modules\/<X>\/presentation\/
 *      server["']/`**: 2 evidencias EXACT (paired #1622 + iva-books A4-a) —
 *      cutover content-grep cumulative-precedent paired sister cross-POC.
 *   5. **NEG legacy class import regex `/from\s+["']@\/features\/<X>\/server["']/`
 *      `not.toMatch`**: 2 evidencias EXACT (paired #1622 T9-T12 + iva-books
 *      A4-a) — cumulative-precedent paired sister.
 *   6. **POS factory call regex `/\bmake<X>Service\s*\(/`**: 2 evidencias EXACT
 *      (paired #1622 T1-T4 + iva-books A4-a) — cumulative-precedent paired
 *      sister.
 *   7. **Cycle classification RED+GREEN atomic split (axis-distinct content-grep
 *      cutover válidas)**: ≥3 evidencias EXACT cumulative cross-POC — paired
 *      C3-C4 RED `a610ef6` + GREEN `2278b11` + iva-books A4-a C1 RED + GREEN
 *      + monthly-close C4 RED `a11e3a2` + GREEN `54043d7`. Marco lock #2
 *      granularity α1 atomic single batch RED+GREEN split.
 *
 * **§13 emergentes capturar D1 cumulative**:
 *   - §13 closeRequestSchema atomic migration C6 paired with route cutover
 *     canonical home (precedent #1622 forward-applied) **NEW evidencia
 *     variant** — schema migration timing axis: pre-wholesale-delete C6 (NEW)
 *     vs at-wholesale-delete C7 (Opción C — descartada).
 *   - §13 hex barrel populate `export * from "./validation"` pattern matures
 *     cumulative **3ra evidencia EXACT** (sale + iva-books + monthly-close
 *     NEW).
 *   - §13.A4-η Sub-B vi.mock target swap + Sub-D factory shape paired **8va
 *     evidencia matures** cumulative cross-POC (paired payables C3-C4 7ma +
 *     monthly-close C6 NEW 8va).
 *   - §13 NO route handlers Prisma direct mock-source-identification-gate
 *     aplicado (cumulative-precedent fiscal-periods C4 Categ A/B classification).
 *   - §13 ESLint `no-restricted-imports` scope routes ortogonal — NO REQ-FMB.5
 *     violation barrel-level swap (verified Step 0 expand: ESLint glob scope
 *     components dir + app dir client-suffixed files only, routes ORTOGONAL).
 *   - evidence-supersedes-assumption-lock **7ma evidencia matures** (Lock #1
 *     bookmark wording "barrel migration scope" loose superseded por precedent
 *     paired #1622 atomic migration cumulative cross-POC).
 *   - textual-rule-verification recursive structural conventions **5ta
 *     evidencia matures** cumulative (C1 + C2.2 + C3 + C4 + C6 recursive 7
 *     conventions verified ≥3 evidencias EXACT pre-RED redact gate cutover
 *     route layer).
 *   - pre-phase-audit-gate scope incluye production callsites + mock test files
 *     pre-existing **4ta evidencia matures** (fiscal-periods C4 1ra → contacts
 *     C4 2da → paired #1622 C3-C4 3ra → monthly-close C6 4ta cumulative
 *     cross-POC).
 *
 * **Cycle scope GREEN target shape**:
 *   - GREEN (T1+T2+T3 PASS + T4 PASS): swap `app/api/.../monthly-close/route.ts`
 *     L3 import legacy → hex barrel + L7 `new MonthlyCloseService()` →
 *     `makeMonthlyCloseService()`; swap `app/api/.../monthly-close/summary/
 *     route.ts` L3+L5 mismo pattern; NEW
 *     `modules/monthly-close/presentation/validation.ts` (closeRequestSchema
 *     migrated EXACT content desde `features/monthly-close/monthly-close.
 *     validation.ts` — preserved hasta C7 wholesale); MOD
 *     `modules/monthly-close/presentation/server.ts` populate `export * from
 *     "./validation"`; swap vi.mock target+shape paired 2 test files §13.A4-η.
 *
 * Self-contained future-proof (lección A6 #5 + Marco lock heredado): shape
 * test asserta paths `app/api/organizations/[orgSlug]/monthly-close/...` +
 * `modules/monthly-close/presentation/...` que persisten post C7 wholesale
 * delete `features/monthly-close/*`. Test vive en `modules/monthly-close/
 * __tests__/` — NO toca `features/monthly-close/*` que C7 borrará. Self-
 * contained vs future deletes ✓.
 *
 * Source-string assertion pattern: mirror precedent paired #1622 + iva-books
 * A4-a (`fs.readFileSync` + regex match). Target asserciones consumer surface
 * invocation patterns (route.ts source) + schema file existence (modules/
 * monthly-close/presentation/validation.ts).
 *
 * Expected RED-α failure mode pre-GREEN (per `feedback_red_acceptance_failure_mode`):
 *   - T1 FAIL: route.ts hoy importa `from "@/features/monthly-close/server"`
 *     legacy path — NO contiene `from "@/modules/monthly-close/presentation/
 *     server"` literal. Regex match falla.
 *   - T2 FAIL: route.ts hoy invoca `new MonthlyCloseService()` class ctor
 *     pattern — NO contiene `makeMonthlyCloseService(` literal. Regex match
 *     falla.
 *   - T3 FAIL: route.ts hoy importa `MonthlyCloseService` class — `not.toMatch`
 *     legacy import path expectation reverses (legacy path PRESENT pre-cutover).
 *     Test fails on unwanted match.
 *   - T4 FAIL: schema home file `modules/monthly-close/presentation/validation.ts`
 *     NO existe pre-GREEN — `existsSync === true` reverses (path AUSENTE
 *     pre-GREEN, POS existence assertion fails on missing path).
 * Total expected FAIL pre-GREEN: 4/4 declared explícito Marco mandate failure
 * mode honest enumerated.
 *
 * Cross-ref:
 *   - architecture.md §13 closeRequestSchema atomic migration C6 NEW evidencia variant.
 *   - architecture.md §13 hex barrel populate schema re-export 3ra evidencia matures.
 *   - architecture.md §13.A4-η vi.mock target+shape paired 8va evidencia matures.
 *   - features/monthly-close/server.ts:1-3 (driver-anchored barrel pattern legacy
 *     `import "server-only"; export { MonthlyCloseService } from "./monthly-close.service";
 *     export * from "./monthly-close.validation"` — C6 cutover swap target hex
 *     factory + schema migration atomic to hex).
 *   - features/monthly-close/monthly-close.validation.ts (legacy schema home —
 *     preserved C6 scope, drop C7 wholesale delete; content migrated EXACT to
 *     hex `modules/monthly-close/presentation/validation.ts` GREEN target).
 *   - app/api/organizations/[orgSlug]/monthly-close/route.ts:3,5,7 (driver-anchored
 *     legacy consumer `import { MonthlyCloseService } from "@/features/monthly-close/
 *     server"; import { closeRequestSchema } from "@/features/monthly-close/server";
 *     const service = new MonthlyCloseService()` — C6 cutover swap target hex
 *     barrel + factory + schema re-export).
 *   - app/api/organizations/[orgSlug]/monthly-close/summary/route.ts:3,5
 *     (driver-anchored legacy consumer mismo shape — C6 cutover swap target
 *     idem).
 *   - app/api/organizations/[orgSlug]/monthly-close/__tests__/route.test.ts:40-42
 *     (vi.mock target + class shape importOriginal preserve schema — C6 swap
 *     target hex barrel + factory shape paired §13.A4-η).
 *   - app/api/organizations/[orgSlug]/monthly-close/summary/__tests__/route.test.ts:28-32
 *     (vi.mock target + class shape NO importOriginal — C6 swap target hex
 *     barrel + factory shape paired §13.A4-η).
 *   - modules/monthly-close/presentation/composition-root.ts (C4 cementado
 *     `makeMonthlyCloseService(): MonthlyCloseService` zero-arg cumulative-
 *     precedent EXACT — C6 hex factory consumer surface ready).
 *   - modules/monthly-close/presentation/server.ts (C4 populated factory re-
 *     export `export { makeMonthlyCloseService } from "./composition-root"` —
 *     C6 GREEN target populate adicional `export * from "./validation"`).
 *   - modules/payables/presentation/__tests__/c3-c4-cutover-shape.paired-pr.test.ts
 *     (precedent EXACT cutover RED 13α paired sister shape regex match — C6
 *     reduced 4α minimal Marco lock #3 axis-distinct content-grep cutover).
 *   - modules/receivables/presentation/__tests__/c3-c4-cutover-shape.paired-pr.test.ts
 *     (precedent EXACT cutover RED paired sister mirror simétrico).
 *   - paired-pr-C3-C4 RED `a610ef6` + GREEN `2278b11` master (preceding cycle
 *     paired POC — schemas live en hex pattern Sub-finding forward-applicable).
 *   - poc-11/0c/a4/a-c1 RED + GREEN master (iva-books A4-a precedent EXACT
 *     cutover routes hex factory single batch).
 *   - engram `feedback/cross-cycle-red-test-cementacion-gate` (forward-only
 *     check C6 → C7 CLEAN: paths `app/api/.../monthly-close/route.ts` +
 *     `modules/monthly-close/presentation/validation.ts` persisten post C7
 *     wholesale delete `features/monthly-close/*`).
 *   - engram `feedback/red-acceptance-failure-mode` (failure mode 4/4 FAIL
 *     enumerated declared explícito Marco mandate honest pre-write).
 *   - engram `feedback/red-regex-discipline` (regex discipline EXACT — POS
 *     `/from\s+["']@\/modules\/monthly-close\/presentation\/server["']/m` +
 *     `/\bmakeMonthlyCloseService\s*\(/` + NEG `/from\s+["']@\/features\/monthly-close\/server["']/m`).
 *   - engram `feedback/canonical-rule-application-commit-body` (cite + rationale
 *     + cross-ref applied RED-α commit body — Marco locks #1-4 confirmados +
 *     8 capturas D1 cumulative + lecciones matures 7ma evidence-supersedes-
 *     assumption-lock + 5ta textual-rule-verification recursive + 4ta
 *     pre-phase-audit-gate).
 *   - engram `feedback/evidence-supersedes-assumption-lock` (1ra-7ma evidencia
 *     matures cumulative cross-POC — Lock #1 bookmark wording "barrel
 *     migration scope" loose superseded por precedent paired #1622 atomic
 *     migration).
 *   - engram `feedback/textual-rule-verification` (recursive structural
 *     conventions 5ta evidencia matures cumulative C1+C2.2+C3+C4+C6).
 *   - engram `feedback/pre-phase-audit` (4ta evidencia matures cumulative
 *     cross-POC fiscal-periods C4 1ra → contacts C4 2da → paired #1622 C3-C4
 *     3ra → monthly-close C6 4ta).
 *   - engram `poc-nuevo/monthly-close/c5-closed` #1752 (precedent C5 cycle
 *     bookmark post-GREEN clean cutover — 4 métricas baseline EXACT preserved
 *     cumulative + 7 fails ledger same set + master HEAD `81be1b7` +14 unpushed
 *     origin + integration tests cementados C5 GREEN target consume C4
 *     composition root).
 *   - engram `poc-nuevo/paired-payables-receivables/c3-c4-closed` #1622
 *     (precedent EXACT cutover paired UI pages + API routes RED+GREEN atomic
 *     single batch — Sub-finding schemas live en hex re-exported via features
 *     forward-applicable C6 monthly-close).
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../..");

function exists(rel: string): boolean {
  return existsSync(resolve(ROOT, rel));
}

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

// ── C6 cutover targets ──────────────────────────────────────────────────────

const ROUTE_TS = "app/api/organizations/[orgSlug]/monthly-close/route.ts";
const HEX_VALIDATION = "modules/monthly-close/presentation/validation.ts";

// ── Regex patterns ──────────────────────────────────────────────────────────

const HEX_BARREL_IMPORT_RE =
  /from\s+["']@\/modules\/monthly-close\/presentation\/server["']/m;
const MAKE_MONTHLY_CLOSE_SERVICE_RE = /\bmakeMonthlyCloseService\s*\(/;
const LEGACY_FEATURES_MONTHLY_CLOSE_SERVER_IMPORT_RE =
  /from\s+["']@\/features\/monthly-close\/server["']/m;

describe("POC nuevo monthly-close C6 RED-α — cutover routes hex factory `makeMonthlyCloseService()` + closeRequestSchema atomic migration to hex `modules/monthly-close/presentation/validation.ts` cumulative-precedent EXACT driver-anchored (Lock #1 Opción A schema migrate atomic + Lock #2 α1 single batch atomic 7 archivos + Lock #3 RED-α 4α minimal mirror cumulative-precedent + Lock #4 vi.mock paired §13.A4-η 8va evidencia matures cumulative cross-POC) Opción α1 atomic single batch axis-distinct cutover content-grep RED-time assertions C1 lección permitida cutover (mirror fiscal-periods C2/C3/C4 + paired #1622 + iva-books A4-a precedent EXACT cumulative-precedent recursive evidence-supersedes-assumption-lock 7ma evidencia matures cumulative cross-POC bookmark wording \"barrel migration scope\" loose superseded por precedent paired #1622 atomic migration + textual-rule-verification recursive structural conventions 5ta evidencia matures + 7 conventions verified ≥3 evidencias EXACT pre-RED redact gate cutover route layer)", () => {
  // ── A: Hex factory cutover POSITIVE (Tests 1-2) ─────────────────────────
  // Marco lock #3 RED-α 4α minimal — T1+T2 POS hex import + factory call
  // route.ts source. POST close primary cutover target. summary/route.ts
  // cutover material GREEN scope (Lock #2 7 archivos), verified vitest cross-
  // cycle suite full GREEN preserves 4 métricas baseline EXACT.

  it("Test 1: app/api/organizations/[orgSlug]/monthly-close/route.ts contains `from \"@/modules/monthly-close/presentation/server\"` import (POS hex barrel cutover swap legacy `@/features/monthly-close/server` — Marco lock #1 Opción A closeRequestSchema atomic migration paired with route cutover canonical home + Marco lock #2 α1 single batch atomic precedent paired #1622 + iva-books A4-a forward-applicable + Lock #3 RED-α 4α minimal axis-distinct content-grep cutover C1 lección permitida)", () => {
    const source = read(ROUTE_TS);
    expect(source).toMatch(HEX_BARREL_IMPORT_RE);
  });

  it("Test 2: app/api/organizations/[orgSlug]/monthly-close/route.ts contains `makeMonthlyCloseService(` invocation (POS factory call cutover swap legacy `new MonthlyCloseService()` zero-arg — cumulative-precedent EXACT 6 evidencias zero-arg supersede absoluto sale + payment + fiscal-periods + iva-books + accounting + monthly-close C4 cementado consumer surface ready)", () => {
    const source = read(ROUTE_TS);
    expect(source).toMatch(MAKE_MONTHLY_CLOSE_SERVICE_RE);
  });

  // ── B: Legacy class import ABSENT (Test 3) ──────────────────────────────
  // Cutover removes legacy `from "@/features/monthly-close/server"` import
  // route.ts — bridge route uses hex barrel exclusively post-cutover. Mirror
  // paired #1622 T9-T12 cumulative-precedent EXACT not.toMatch pattern.

  it("Test 3: app/api/organizations/[orgSlug]/monthly-close/route.ts does NOT import from `@/features/monthly-close/server` (NEG legacy class ctor pattern dropped post-cutover — schema atomic migration Lock #1 Opción A elimina último import legacy del route.ts; features barrel preserved hasta C7 wholesale delete — features/monthly-close/* 17 files orto al cutover)", () => {
    const source = read(ROUTE_TS);
    expect(source).not.toMatch(LEGACY_FEATURES_MONTHLY_CLOSE_SERVER_IMPORT_RE);
  });

  // ── C: Schema home file existence (Test 4) ──────────────────────────────
  // Lock #1 Opción A closeRequestSchema migration atomic — NEW
  // `modules/monthly-close/presentation/validation.ts` hex schema home.
  // Mirror C0+C1-α+C2.1-α+C2.2-α+C3-α+C4 precedent EXACT existsSync POS
  // existence pattern cumulative monthly-close 7ma evidencia recursive.

  it("Test 4: modules/monthly-close/presentation/validation.ts file exists (POS schema home Lock #1 Opción A closeRequestSchema migration atomic to hex — mirror precedent paired #1622 Sub-finding forward-applicable schemas live en hex `modules/{X}/presentation/validation` re-exported via `features/{X}/index`; content migrated EXACT desde `features/monthly-close/monthly-close.validation.ts` legacy preserved hasta C7 wholesale)", () => {
    expect(exists(HEX_VALIDATION)).toBe(true);
  });
});
