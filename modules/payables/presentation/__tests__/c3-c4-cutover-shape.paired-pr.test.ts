/**
 * POC paired payables↔receivables C3-C4 RED — cutover paired UI pages + API
 * routes (cxp side, paired sister mirror receivables).
 *
 * Axis: cutover invocation patterns from legacy class ctor `new PayablesService()`
 * → hex factory `makePayablesService()` + `attachContact[s]` bridge in ALL 4
 * source archivos cxp (3 routes + 1 page RSC) + 1 page test mock target swap
 * §13.A4-η load-bearing render path coverage. NEW pattern emergent §13.A5-γ
 * Opción A bridge (vs Opción C `.toSnapshot()` adapter precedent A5-C1) —
 * post-C1b-α canonical R4 exception path, hex barrel re-exporta `attachContact[s]`
 * que preserva DTO contract `PayableSnapshotWithContact[]` legacy via mapper interno
 * `toPayableSnapshotWithContact` reconstructing `Prisma.Decimal` at infrastructure/
 * layer (R5 honored). Cutover preserves consumer surface — components/
 * `payable-list.tsx` type consumer NO change scope C3-C4 (defer DTO drop
 * a C5-C6 wholesale). Mirror C0+C1a+C1b-α precedent EXACT estricto Path α
 * direct factory swap mecánico (4ta aplicación post-cementación cumulative —
 * §13.A5-α paired sister sub-cycle 8va evidencia matures).
 *
 * 4 source archivos cutover INCLUIDOS Marco lock #2 granularity 1 (single ciclo
 * merge atomic C3+C4):
 *   1. app/api/organizations/[orgSlug]/cxp/route.ts (list+create — 2 callsites)
 *   2. app/api/organizations/[orgSlug]/cxp/[payableId]/route.ts (getById+update+void — 3 callsites)
 *   3. app/api/organizations/[orgSlug]/cxp/[payableId]/status/route.ts (updateStatus — 1 callsite)
 *   4. app/(dashboard)/[orgSlug]/accounting/cxp/page.tsx (list RSC — 1 callsite)
 *
 * 1 page test file mock target swap §13.A4-η load-bearing render path coverage
 * MANDATORY (Marco lock vi.mock §13.A4-η confirmed pre-RED — page tests mock
 * declarations swap paired con cutover OR runtime fail post-GREEN cuando page
 * imports new path NOT mocked):
 *   5. app/(dashboard)/[orgSlug]/accounting/cxp/__tests__/page.test.ts
 *
 * Marco lock final RED scope C3-C4 (13 assertions α paired-payables side —
 * paired sister mirror receivables 13 assertions = 26 paired total Marco
 * confirmed pre-RED ~20-25 stretch +1 vi.mock §13.A4-η):
 *
 *   ── A: Hex factory invocation POSITIVE (Tests 1-4) ──
 *     T1 cxp/route.ts contains `makePayablesService(` invocation
 *     T2 cxp/[payableId]/route.ts contains `makePayablesService(` invocation
 *     T3 cxp/[payableId]/status/route.ts contains `makePayablesService(` invocation
 *     T4 cxp/page.tsx contains `makePayablesService(` invocation
 *
 *   ── B: attachContact[s] bridge invocation POSITIVE (Tests 5-8) ──
 *     T5 cxp/route.ts contains `attachContact` (word boundary — covers list→attachContacts plural + create→attachContact singular)
 *     T6 cxp/[payableId]/route.ts contains `attachContact` (covers getById/update/void singular)
 *     T7 cxp/[payableId]/status/route.ts contains `attachContact` (covers updateStatus singular)
 *     T8 cxp/page.tsx contains `attachContacts` (plural specifically — list RSC method)
 *
 *   ── C: Legacy class import ABSENT (Tests 9-12) ──
 *     T9  cxp/route.ts does NOT import from `@/features/payables/server`
 *     T10 cxp/[payableId]/route.ts does NOT import from `@/features/payables/server`
 *     T11 cxp/[payableId]/status/route.ts does NOT import from `@/features/payables/server`
 *     T12 cxp/page.tsx does NOT import from `@/features/payables/server`
 *
 *   ── D: vi.mock target swap §13.A4-η load-bearing render path coverage (Test 13) ──
 *     T13 cxp/__tests__/page.test.ts mocks `@/modules/payables/presentation/server`
 *         (NOT `@/features/payables/server`) — page tests must mock NEW import
 *         path post-cutover OR runtime fail (mock orphan = page imports unmocked
 *         hex barrel triggering Prisma load chain). Mirror precedent §13.A4-η
 *         vi.mock factory load-bearing render path coverage MATERIAL (paired
 *         sister precedent A4 mock factory cementada A4-D1 cumulative).
 *
 * Marco locks aplicados pre-RED C3-C4:
 *   - L1: Strategy α (bridge attachContact + path swap mecánico) — vs β (Snapshot+
 *     new mapper) y γ (wholesale drop attachContact). Minimum scope honest mirror
 *     C0+C1a+C1b-α precedent EXACT, preserves DTO contract via attachContact
 *     bridge cementado C1b-α canonical R4 exception path. Defers DTO drop a C5-C6.
 *   - L2: Granularity 1 (single ciclo merge atomic C3+C4) — 10 source paired +
 *     2 vi.mock target swap paired single commit. Mirror C1b-α `89e6441` precedent
 *     EXACT (8 archivos atomic), slight uptick magnitude (10+2=12 vs 8) bisect-
 *     friendly preserved Marco lock #1 cycle pattern.
 *   - L3: Route tests 3a — defer C8 D-fase add representative tests (scenario b
 *     gap §13.A5-γ #1582 zero handler tests confirmed); risk silent regression
 *     accept mirror precedent. NO new route tests RED scope C3-C4.
 *   - L4: Test path confirmed `modules/{payables,receivables}/presentation/__tests__/
 *     c3-c4-cutover-shape.paired-pr.test.ts` (mirror C1b-α path EXACT — sibling
 *     baseline clean, self-contained future-proof post-C7 wholesale delete).
 *   - L5: Lección scope reduction emergent (~30-40% vs heredado #1612
 *     `.toSnapshot()` estimate) — bridge attachContact preserves contract via
 *     mapper Prisma.Decimal reconstruction at infrastructure/ post-C1b-α →
 *     cementación target D8 NEW pattern §13.A5-γ Opción A bridge.
 *   - vi.mock §13.A4-η: load-bearing render path coverage MANDATORY (Marco
 *     confirmed pre-RED) — 1 test per side T13 mocks hex barrel target swap.
 *
 * §13.A5-α paired sister sub-cycle continuation (8va evidencia matures cumulative
 * cross-§13 same POC paired): A5-C2a (3ra) → A5-C2b (4ta) → A5-C2c (5ta) → C0
 * (5ta + sister continuation) → C1a (6ta paired sister Path α direct Option B
 * inverso 2da aplicación) → C1b-α (7ma paired sister Option A push INTO
 * infrastructure/ functional move NEW kind + R5 invariant honor + α-A3.B
 * canonical R4 exception path) → **C3-C4 (8va paired sister Path α direct
 * factory swap + attachContact bridge §13.A5-γ Opción A NEW pattern emergent
 * 4ta aplicación post-cementación cumulative)**. Engram canonical home
 * `arch/§13/A5-alpha-multi-level-composition-root-delegation` (cementado A5-C2a)
 * — C3-C4 NO require re-cementación canonical home; defer §13.A5-γ Opción A
 * bridge sub-rule cementación post-cumulative D8.
 *
 * §13.A5-γ MATERIAL boundary preservation (Opción A bridge NEW pattern emergent
 * vs Opción C `.toSnapshot()` precedent A5-C1):
 *   - Pre-cutover: legacy `PayablesService.list/getById/create/update/updateStatus/void`
 *     returns `Promise<PayableSnapshotWithContact>` via internal `attachContact[s]`
 *     invocation (post-C1b-α delegation chain through hex factory + bridge).
 *   - Post-cutover: routes/page invoke directly `makePayablesService()` factory
 *     + explicit `attachContact[s]` bridge → preserves Promise<PayableSnapshotWithContact>
 *     contract at consumer surface (components/ payable-list.tsx + Response.json
 *     consumers + JSON.stringify RSC boundary). NO `.toSnapshot()` adapter
 *     required at boundary — bridge attachContact reconstructs Prisma.Decimal
 *     via mapper interno honoring legacy POJO contract.
 *   - Magnitude: 7 callsites paired-payables side (2 list/create route.ts + 3
 *     getById/update/void [id]/route.ts + 1 updateStatus status/route.ts + 1
 *     list page.tsx) × 2 features = 14 callsites material. Magnitude factor
 *     vs A5-C1 4 representative tests `.toSnapshot()` Opción C: bridge route
 *     simplifies scope ~30-40% (single attachContact bridge call vs 4
 *     representative `.toSnapshot()` adapter rep tests). Cementación target D8.
 *
 * §13.A4-η vi.mock factory load-bearing render path coverage MATERIAL (paired
 * sister precedent A4-C1 cementada cumulative):
 *   - Page tests vi.mock(`@/features/payables/server`, ...) declaration declares
 *     class `PayablesService` export with `list = mockList` method. Pre-cutover
 *     this is correct mock target.
 *   - Post-cutover page imports from `@/modules/payables/presentation/server`
 *     (NEW path). vi.mock(`@/features/payables/server`, ...) becomes ORPHAN
 *     (mocks unimported module, NO effect). Page test runtime then attempts to
 *     load real hex barrel triggering Prisma load chain → page test FAIL.
 *   - Resolution: vi.mock target swap paired with cutover. Declare hex barrel
 *     export shape: `makePayablesService` factory function + `attachContact[s]`
 *     bridge functions (NOT class).
 *   - T13 asserts page test mocks NEW path post-GREEN — load-bearing render
 *     path coverage MANDATORY paired with source cutover.
 *
 * §13.A5-ε method-level signature divergence — DESCARTADO C3-C4 (verified Step 0
 * expand): NO method shim divergent — hex `service.list/getById/create/update/
 * transitionStatus/void` signature matches consumer-side; bridge `attachContact[s]`
 * adds contact attachment + Decimal reconstruction at boundary, NO method
 * divergence.
 *
 * Sub-findings emergentes (Step 0 expand pre-RED):
 *   - EMERGENTE #1: drift inventory disk vs heredado #1612 — heredado estimaba
 *     "4 routes" pero realidad disco son 6 routes (3 per side, includes /status
 *     route NO en bookmark). Total 10 source paired matches estimación final
 *     ~10 source.
 *   - EMERGENTE #2: hex barrel hex API ya completo post-C1b-α — `makePayablesService`
 *     factory + `attachContact[s]` bridge ready, `Payable.toSnapshot()` adapter
 *     ready (NO se usa Opción A bridge — defer C5-C6 DTO drop wholesale).
 *   - EMERGENTE #3: §13.A5-γ Opción A bridge NEW pattern emergent (vs Opción C
 *     `.toSnapshot()` adapter precedent A5-C1) — preserves DTO contract via
 *     mapper interno cementado C1b-α. Cementación target D8 NEW sub-rule §13.A5-γ
 *     Opción A bridge.
 *   - EMERGENTE #4: scenario (b) gap §13.A5-γ confirmed (NO existen route tests
 *     cxp/cxc) — Marco lock 3a defer C8 D-fase representative tests, accept
 *     risk silent regression mirror precedent.
 *   - EMERGENTE #5: §13.A4-η vi.mock factory load-bearing render path coverage
 *     MATERIAL — page tests mock target+shape swap paired MANDATORY (Marco
 *     lock confirmed RED scope T13).
 *
 * Expected RED failure mode pre-GREEN (per `feedback_red_acceptance_failure_mode`):
 *   - T1-T4 FAIL: source archivos hoy invocan `new PayablesService(contactsService)`
 *     class ctor pattern — NO contienen `makePayablesService(` literal. Regex
 *     match falla.
 *   - T5-T8 FAIL: source archivos hoy invocan `payablesService.list/getById/...`
 *     class instance methods — NO contienen `attachContact` o `attachContacts`
 *     literal (bridge invocation NEW post-cutover). Regex match falla.
 *   - T9-T12 FAIL: source archivos hoy importan `from "@/features/payables/server"`
 *     — `not.toMatch` legacy import path expectation reverses (legacy path PRESENT
 *     pre-cutover). Test fails on unwanted match.
 *   - T13 FAIL: page test hoy mockea `@/features/payables/server` (legacy path)
 *     — NO contiene `vi.mock("@/modules/payables/presentation/server"` literal.
 *     Regex match falla.
 * Total expected FAIL pre-GREEN: 13/13 (Marco mandate failure mode honest enumerated).
 *
 * Self-contained future-proof check (lección A6 #5 + Marco lock L4): shape test
 * asserta paths `app/api/organizations/[orgSlug]/cxp/...` + `app/(dashboard)/
 * [orgSlug]/accounting/cxp/...` que persisten post C7 wholesale delete
 * `features/payables/`. Test vive en `modules/payables/presentation/__tests__/` —
 * NO toca `features/payables/*` que C7 borrará. Self-contained vs future deletes ✓.
 *
 * Source-string assertion pattern: mirror precedent C1b-α + C1a + C0 + A5-C2b
 * (`fs.readFileSync` regex match) — keep pattern paired POC. Departure note
 * vs C1b-α: target asserciones shifts de boundary hex internals (server.ts +
 * infrastructure/contact-attacher.ts) → consumer surface invocation patterns
 * (app/api/... routes + app/(dashboard)/... pages + page test mock target).
 *
 * Cross-ref:
 *   - architecture.md §13.A5-α paired sister 7ma evidencia matures (cementada C1b-α `89e6441` paired closure)
 *   - architecture.md §13.A5-γ DTO divergence runtime path coverage (cementada A5-D1 — Opción A bridge NEW pattern emergent C3-C4 cementación target D8)
 *   - architecture.md §13.A4-η vi.mock factory load-bearing render path coverage (cementada A4 cumulative)
 *   - engram `arch/§13/A5-alpha-multi-level-composition-root-delegation` #1587 (canonical home — paired sister 8va evidencia matures cumulative this RED C3-C4)
 *   - engram `arch/§13/A5-gamma-dto-divergence-runtime-path-coverage` #1582 (formal cementación A5-D1 — Opción A bridge NEW pattern emergent vs Opción C precedent)
 *   - engram `poc-nuevo/paired-payables-receivables/c1b-alpha-closed` #1620 (cycle-start bookmark C3-C4 heredado)
 *   - engram `poc-nuevo/paired-payables-receivables/c1a-closed` #1617 (preceding cycle paired)
 *   - engram `poc-nuevo/paired-payables-receivables/c0-closed` #1615 (preceding cycle paired)
 *   - engram `paired/proximo-poc/pre-decision-analysis` #1610 (Marco lock Option A pre-decisional refined)
 *   - engram `feedback/step-0-expand-eslint-restricted-imports-grep` (REFINED CR4+CR6 — Step 0 expand pre-RED grep ALL no-restricted-imports rules MANDATORY applied este turno)
 *   - engram `feedback_red_acceptance_failure_mode` (failure mode honest 13/13 per side enumerated)
 *   - engram `feedback_canonical_rule_application_commit_body` (cite + rationale + cross-ref applied RED body)
 *   - engram `feedback_diagnostic_stash_gate_pattern` (Marco lock #3 PROACTIVE applied post-GREEN — cumulative cross-POC 6ta evidencia este RED→GREEN turn)
 *   - engram `feedback_low_cost_verification_asymmetry` (single vitest gate suficiente post-RED Marco lock procedure)
 *   - engram `feedback_invariant_collision_elevation` (CR1-CR7 sequence catalog — applied retroactivo si RED→GREEN surfaces NEW collision)
 *   - app/api/organizations/[orgSlug]/cxp/route.ts (target list+create — 2 callsites)
 *   - app/api/organizations/[orgSlug]/cxp/[payableId]/route.ts (target getById+update+void — 3 callsites)
 *   - app/api/organizations/[orgSlug]/cxp/[payableId]/status/route.ts (target updateStatus — 1 callsite)
 *   - app/(dashboard)/[orgSlug]/accounting/cxp/page.tsx (target list RSC — 1 callsite)
 *   - app/(dashboard)/[orgSlug]/accounting/cxp/__tests__/page.test.ts (target vi.mock §13.A4-η load-bearing)
 *   - features/payables/payables.service.ts (legacy shim — preserved C3-C4 scope, drop C7 wholesale delete)
 *   - features/payables/payables.types.ts (PayableSnapshotWithContact type preserved C3-C4 scope, components type consumer NO change, drop C5-C6 DTO + C7 wholesale)
 *   - modules/payables/presentation/server.ts (hex barrel re-exports `makePayablesService` + `attachContact[s]` post-C1b-α — consumer surface ready)
 *   - modules/payables/infrastructure/contact-attacher.ts (mapper Prisma.Decimal reconstruction post-C1b-α — bridge content)
 *   - modules/receivables/presentation/__tests__/c3-c4-cutover-shape.paired-pr.test.ts (paired sister mirror RED this batch)
 *   - modules/payables/presentation/__tests__/c1b-attach-contact-boundary-shape.paired-pr.test.ts (precedent shape C1b-α RED-α `ec83d7c` + GREEN `89e6441`)
 *   - modules/sale/presentation/__tests__/c1a-cross-module-shape.paired-pr.test.ts (precedent shape C1a RED `5ca99cf` + GREEN `47449d8`)
 *   - modules/receivables/presentation/__tests__/c0-dispatch-cleanup-shape.paired-pr.test.ts (precedent shape C0 RED `d6b9f4d` + GREEN `5f18aac`)
 *   - paired-pr-C0 RED `d6b9f4d` + GREEN `5f18aac` master (preceding ciclo paired POC)
 *   - paired-pr-C1a RED `5ca99cf` + GREEN `47449d8` master (preceding ciclo paired POC)
 *   - paired-pr-C1b-α RED `ec83d7c` + GREEN `89e6441` master (preceding ciclo paired POC)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

// ── C3-C4 cutover targets (5 archivos paired-payables side) ──

const CXP_ROUTE = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/cxp/route.ts",
);
const CXP_BY_ID_ROUTE = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/cxp/[payableId]/route.ts",
);
const CXP_STATUS_ROUTE = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/cxp/[payableId]/status/route.ts",
);
const CXP_PAGE = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/accounting/cxp/page.tsx",
);
const CXP_PAGE_TEST = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/accounting/cxp/__tests__/page.test.ts",
);

// ── Regex patterns ───────────────────────────────────────────────────────────

const MAKE_PAYABLES_SERVICE_RE = /\bmakePayablesService\s*\(/;
const ATTACH_CONTACT_RE = /\battachContact\b/;
const ATTACH_CONTACTS_PLURAL_RE = /\battachContacts\b/;
const LEGACY_FEATURES_PAYABLES_SERVER_IMPORT_RE =
  /from\s+["']@\/features\/payables\/server["']/;
const VI_MOCK_HEX_BARREL_RE =
  /vi\.mock\s*\(\s*["']@\/modules\/payables\/presentation\/server["']/;

describe("POC paired payables↔receivables C3-C4 — cutover paired UI pages + API routes shape (paired-payables side, §13.A5-γ Opción A bridge NEW pattern emergent + §13.A4-η vi.mock factory load-bearing render path coverage MATERIAL, 8va evidencia §13.A5-α paired sister sub-cycle 4ta aplicación post-cementación cumulative)", () => {
  // ── A: Hex factory invocation POSITIVE (Tests 1-4) ──────────────────────

  it("Test 1: app/api/organizations/[orgSlug]/cxp/route.ts contains `makePayablesService(` invocation (list+create — 2 callsites cutover Path α direct factory swap mecánico)", () => {
    const source = fs.readFileSync(CXP_ROUTE, "utf8");
    expect(source).toMatch(MAKE_PAYABLES_SERVICE_RE);
  });

  it("Test 2: app/api/organizations/[orgSlug]/cxp/[payableId]/route.ts contains `makePayablesService(` invocation (getById+update+void — 3 callsites)", () => {
    const source = fs.readFileSync(CXP_BY_ID_ROUTE, "utf8");
    expect(source).toMatch(MAKE_PAYABLES_SERVICE_RE);
  });

  it("Test 3: app/api/organizations/[orgSlug]/cxp/[payableId]/status/route.ts contains `makePayablesService(` invocation (updateStatus — 1 callsite)", () => {
    const source = fs.readFileSync(CXP_STATUS_ROUTE, "utf8");
    expect(source).toMatch(MAKE_PAYABLES_SERVICE_RE);
  });

  it("Test 4: app/(dashboard)/[orgSlug]/accounting/cxp/page.tsx contains `makePayablesService(` invocation (list RSC — 1 callsite)", () => {
    const source = fs.readFileSync(CXP_PAGE, "utf8");
    expect(source).toMatch(MAKE_PAYABLES_SERVICE_RE);
  });

  // ── B: attachContact[s] bridge invocation POSITIVE (Tests 5-8) ──────────
  // §13.A5-γ Opción A bridge NEW pattern emergent — preserves PayableSnapshotWithContact
  // contract via mapper interno cementado C1b-α canonical R4 exception path.

  it("Test 5: app/api/organizations/[orgSlug]/cxp/route.ts contains `attachContact` (word boundary — covers list→attachContacts plural + create→attachContact singular bridge invocation)", () => {
    const source = fs.readFileSync(CXP_ROUTE, "utf8");
    expect(source).toMatch(ATTACH_CONTACT_RE);
  });

  it("Test 6: app/api/organizations/[orgSlug]/cxp/[payableId]/route.ts contains `attachContact` (covers getById/update/void singular bridge invocations 3 callsites)", () => {
    const source = fs.readFileSync(CXP_BY_ID_ROUTE, "utf8");
    expect(source).toMatch(ATTACH_CONTACT_RE);
  });

  it("Test 7: app/api/organizations/[orgSlug]/cxp/[payableId]/status/route.ts contains `attachContact` (covers updateStatus singular bridge invocation 1 callsite)", () => {
    const source = fs.readFileSync(CXP_STATUS_ROUTE, "utf8");
    expect(source).toMatch(ATTACH_CONTACT_RE);
  });

  it("Test 8: app/(dashboard)/[orgSlug]/accounting/cxp/page.tsx contains `attachContacts` (plural specifically — list RSC method bridge invocation 1 callsite)", () => {
    const source = fs.readFileSync(CXP_PAGE, "utf8");
    expect(source).toMatch(ATTACH_CONTACTS_PLURAL_RE);
  });

  // ── C: Legacy class import ABSENT (Tests 9-12) ──────────────────────────
  // Cutover removes legacy `from "@/features/payables/server"` imports across
  // ALL 4 source archivos — bridge route uses hex barrel exclusively post-cutover.

  it("Test 9: app/api/organizations/[orgSlug]/cxp/route.ts does NOT import from `@/features/payables/server` (legacy class ctor pattern dropped post-cutover)", () => {
    const source = fs.readFileSync(CXP_ROUTE, "utf8");
    expect(source).not.toMatch(LEGACY_FEATURES_PAYABLES_SERVER_IMPORT_RE);
  });

  it("Test 10: app/api/organizations/[orgSlug]/cxp/[payableId]/route.ts does NOT import from `@/features/payables/server` (legacy class ctor pattern dropped post-cutover)", () => {
    const source = fs.readFileSync(CXP_BY_ID_ROUTE, "utf8");
    expect(source).not.toMatch(LEGACY_FEATURES_PAYABLES_SERVER_IMPORT_RE);
  });

  it("Test 11: app/api/organizations/[orgSlug]/cxp/[payableId]/status/route.ts does NOT import from `@/features/payables/server` (legacy class ctor pattern dropped post-cutover)", () => {
    const source = fs.readFileSync(CXP_STATUS_ROUTE, "utf8");
    expect(source).not.toMatch(LEGACY_FEATURES_PAYABLES_SERVER_IMPORT_RE);
  });

  it("Test 12: app/(dashboard)/[orgSlug]/accounting/cxp/page.tsx does NOT import from `@/features/payables/server` (legacy class ctor pattern dropped post-cutover)", () => {
    const source = fs.readFileSync(CXP_PAGE, "utf8");
    expect(source).not.toMatch(LEGACY_FEATURES_PAYABLES_SERVER_IMPORT_RE);
  });

  // ── D: vi.mock target swap §13.A4-η load-bearing render path coverage (Test 13) ──
  // Page tests vi.mock declarations swap paired con cutover OR runtime fail
  // post-GREEN (mock orphan = page imports unmocked hex barrel triggering Prisma
  // load chain). Paired sister precedent §13.A4-η cementada A4-D1 cumulative.

  it("Test 13: app/(dashboard)/[orgSlug]/accounting/cxp/__tests__/page.test.ts mocks `@/modules/payables/presentation/server` (NOT `@/features/payables/server`) — vi.mock §13.A4-η load-bearing render path coverage MANDATORY swap paired con cutover (Marco lock vi.mock confirmed pre-RED)", () => {
    const source = fs.readFileSync(CXP_PAGE_TEST, "utf8");
    expect(source).toMatch(VI_MOCK_HEX_BARREL_RE);
  });
});
