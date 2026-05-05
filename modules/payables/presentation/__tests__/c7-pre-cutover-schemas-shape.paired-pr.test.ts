/**
 * POC paired payables↔receivables C7-pre RED — barrel sub-import migration
 * prerequisite to wholesale delete (cxp side, paired sister mirror receivables).
 *
 * Axis: schemas zod cutover OUT of legacy barrel `@/features/payables` →
 * canonical hex home `@/modules/payables/presentation/validation` + DELETE
 * dead aspirational vi.mock declarations en contacts UI tests apuntando a
 * `@/features/payables/server` (Option A — no swap path, stubs declare
 * legacy class API que NO existe en hex modules + setters
 * `setReceivablesService`/`setPayablesService` "intentionally absent" per
 * `features/contacts/server.ts:21-25` JSDoc explícito; wiring vive en
 * `modules/contact-balances/composition-root.ts` post-C1b-α).
 *
 * NEW classification §13.A5-ζ-prerequisite emergent (cementación target D8 —
 * Marco lock #4 confirmed): cuando wholesale delete `features/{X}/` tiene
 * **barrel sub-imports vivos** (no solo `/server` factories cutover C3-C4 +
 * legacy POJO type defs cutover C5-C6), el wholesale delete C7 DEBE
 * descomponerse en sub-cycle previo C7-pre (cutover barrel sub-imports
 * residuales — schemas zod 4 símbolos per side + DELETE dead aspirational
 * vi.mock declarations) + sub-cycle final C7 (atomic delete wholesale per
 * Opción B EXACT mirror A4-C3 31ff403 + A5-C3 f9a1e06 precedent estricto).
 * Diferencia con A4-C3 (`features/voucher-types/`) y A5-C3 voucher-types-only:
 * allí los símbolos del barrel ya estaban migrados o no había consumers fuera
 * de `/server`. Aquí los **schemas zod validation** son el residuo barrel vivo
 * post C0+C1a+C1b-α+C3-C4+C5-C6 cumulative absorbed.
 *
 * 6 consumers productivos cutover INCLUIDOS Marco lock RED scope (3 cxp side
 * paired sister mirror 3 cxc):
 *   1. app/api/organizations/[orgSlug]/cxp/route.ts (createPayableSchema +
 *      payableFiltersSchema imports)
 *   2. app/api/organizations/[orgSlug]/cxp/[payableId]/route.ts
 *      (updatePayableSchema import)
 *   3. app/api/organizations/[orgSlug]/cxp/[payableId]/status/route.ts
 *      (payableStatusSchema import)
 *
 * 2 contacts UI test files vi.mock DELETE INCLUIDOS Marco lock RED scope
 * (mock hygiene named explícito en commit message GREEN per
 * `feedback_mock_hygiene_commit_scope` Marco lock #3 bundle commit único):
 *   4. app/(dashboard)/[orgSlug]/accounting/contacts/__tests__/page.test.ts
 *      (DELETE vi.mock("@/features/payables/server", ...) líneas 38-41 +
 *      cleanup `setPayablesService = vi.fn()` setter dead línea 28 from
 *      contacts mock factory)
 *   5. app/(dashboard)/[orgSlug]/accounting/contacts/[contactId]/__tests__/
 *      page-rbac.test.ts (DELETE vi.mock("@/features/payables/server", ...)
 *      líneas 45-48 + cleanup `setPayablesService = mockSetPayables` setter
 *      dead línea 35 from contacts mock factory)
 *
 * Marco lock final RED scope C7-pre (8 assertions α paired-payables side —
 * paired sister mirror receivables 8 assertions = 16 paired total Marco
 * confirmed pre-RED ~16 stretch vs C3-C4 26 — scope C7-pre menor justifica
 * menos assertions, NO §13.A4-η vi.mock load-bearing render path coverage
 * MATERIAL — los mocks C7-pre son DEAD removal, no SWAP):
 *
 *   ── A: Legacy barrel sub-import ABSENT (Tests 1-3) ──
 *     T1 cxp/route.ts does NOT import from `@/features/payables` (legacy
 *        barrel sub-import schemas zod dropped post-cutover)
 *     T2 cxp/[payableId]/route.ts does NOT import from `@/features/payables`
 *     T3 cxp/[payableId]/status/route.ts does NOT import from
 *        `@/features/payables`
 *
 *   ── B: Hex canonical home import POSITIVE (Tests 4-6) ──
 *   `features/payables/payables.validation.ts` ya es **pass-through re-export**
 *   de `@/modules/payables/presentation/validation` (canonical home schemas
 *   zod). Migración 1-to-1 rename de import path mecánico — cero código
 *   nuevo, cero shape change. Forward-looking positive asserts schemas
 *   importan canonical home directly post-cutover.
 *     T4 cxp/route.ts DOES import from `@/modules/payables/presentation/
 *        validation` (createPayableSchema + payableFiltersSchema canonical
 *        home post-cutover)
 *     T5 cxp/[payableId]/route.ts DOES import from `@/modules/payables/
 *        presentation/validation` (updatePayableSchema)
 *     T6 cxp/[payableId]/status/route.ts DOES import from `@/modules/
 *        payables/presentation/validation` (payableStatusSchema)
 *
 *   ── C: Dead aspirational vi.mock ABSENT (Tests 7-8) ──
 *   Per `feedback_aspirational_mock_signals_unimplemented_contract`: vi.mock
 *   declarations apuntando a `@/features/payables/server` con stub
 *   `class PayablesService {}` son aspirational mock dead signaling
 *   unimplemented contract que NO existe — `features/contacts/server.ts:21-25`
 *   JSDoc explícito declara `setPayablesService` "intentionally absent",
 *   wiring real vive en `modules/contact-balances/composition-root.ts`. NO
 *   production import path resolution depende de estos mocks (grep ANY-side
 *   `@/features/payables/server` outside test files = 0 hits). Cleanup DELETE
 *   entirely Marco lock #2 Option A — NO swap path defensivo (sin sustancia
 *   load-bearing).
 *     T7 contacts/__tests__/page.test.ts NOT contain
 *        `vi.mock("@/features/payables/server"` declaration (DELETE dead
 *        aspirational mock + cleanup `setPayablesService` dead setter en
 *        contacts mock factory)
 *     T8 contacts/[contactId]/__tests__/page-rbac.test.ts NOT contain
 *        `vi.mock("@/features/payables/server"` declaration (DELETE dead
 *        aspirational mock + cleanup `setPayablesService` dead setter)
 *
 * Marco locks aplicados pre-RED C7-pre:
 *   - L1 (Path C7-α split): C7 NO atomic delete wholesale as-bookmarked —
 *     6 consumers productivos vivos (schemas zod barrel sub-imports) + 4 dead
 *     aspirational vi.mock declarations exigen sub-cycle previo C7-pre.
 *     Granularity revisada 4 ciclos restantes: C7-pre + C7 + C8 + push D8.
 *     Path C7-α confirmed Marco lock — preserva mirror A4-C3 31ff403 +
 *     A5-C3 f9a1e06 precedent EXACT estricto Opción B forward-looking EN C7
 *     wholesale (defer atomic delete a C7 post C7-pre absorption residuos).
 *   - L2 (vi.mock disposition Option A DELETE): NO swap path defensivo
 *     `@/modules/payables/presentation/server`, NO swap shape factory mock —
 *     stubs son DEAD aspirational, NO load-bearing. Verification:
 *     `features/contacts/server.ts:21-25` JSDoc declara setters
 *     "intentionally absent" + grep production paths ANY-side
 *     `@/features/payables/server` outside test files = 0 hits + contacts
 *     page consume `ContactsService` legacy shim wraps hex
 *     (`modules/contacts/presentation/server` + `modules/contact-balances/
 *     presentation/server`) sin path through `features/{X}/server` (legacy
 *     wiring eliminada post-C1b-α composition root migration).
 *   - L3 (Bundle commit GREEN único + mock hygiene named): mock hygiene
 *     cleanup en mismo commit que cutover schemas zod, commit message GREEN
 *     debe nombrar EXPLÍCITO mock hygiene per
 *     `feedback_mock_hygiene_commit_scope` (no buried en wiring diffs).
 *     Bundle scope justified: schemas cutover routes + dead vi.mock cleanup
 *     contacts tests son MISMO axis residual barrel sub-import migration
 *     (per §13.A5-ζ-prerequisite NEW classification cohesion semántica).
 *   - L4 (NEW classification §13.A5-ζ-prerequisite cementación target D8):
 *     barrel sub-import migration as wholesale-delete prerequisite — NEW
 *     classification candidate emergent registered cementación target D8
 *     post-cumulative POC closure.
 *   - L5 (Test path confirmed): `modules/{payables,receivables}/presentation/
 *     __tests__/c7-pre-cutover-schemas-shape.paired-pr.test.ts` — mirror
 *     C3-C4 path EXACT estricto. Self-contained future-proof check ✓ test
 *     asserta paths consumer surface (`app/api/.../cxp/...` + `app/(dashboard)/
 *     .../contacts/__tests__/...`) que persisten post C7 wholesale delete
 *     `features/payables/`. Test vive en `modules/payables/presentation/
 *     __tests__/` — NO toca `features/payables/*` que C7 borrará.
 *
 * §13.A5-α paired sister sub-cycle continuation (10ma evidencia matures
 * cumulative cross-§13 same POC paired): A5-C2a (3ra) → A5-C2b (4ta) → A5-C2c
 * (5ta) → C0 (5ta sister continuation) → C1a (6ta paired sister Path α direct
 * Option B inverso 2da aplicación) → C1b-α (7ma paired sister Option A push
 * INTO infrastructure/ NEW kind + R5 honor + α-A3.B canonical R4 exception
 * path) → C3-C4 (8va paired sister Path α direct factory swap + attachContact
 * bridge §13.A5-γ Opción A NEW pattern emergent 4ta aplicación
 * post-cementación cumulative) → C5-C6 (9na paired sister Path C5C drop POJO
 * + Snapshot+Contact hex DTO §13.B-paired NEW classification 5ta aplicación
 * post-cementación cumulative) → **C7-pre (10ma paired sister barrel
 * sub-import migration prerequisite §13.A5-ζ-prerequisite NEW classification
 * 6ta aplicación post-cementación cumulative)**. Engram canonical home
 * `arch/§13/A5-alpha-multi-level-composition-root-delegation` (cementado
 * A5-C2a) — C7-pre NO require re-cementación canonical home; defer
 * §13.A5-ζ-prerequisite NEW sub-rule cementación post-cumulative D8.
 *
 * §13.A5-ζ-prerequisite MATERIAL barrel sub-import migration (NEW
 * classification emergent vs §13.A5-ζ wholesale partial precedent A4-C3 +
 * A5-C3):
 *   - Pre-cutover: routes consume schemas zod via legacy barrel
 *     `@/features/payables` (createPayableSchema, updatePayableSchema,
 *     payableStatusSchema, payableFiltersSchema). Barrel `index.ts` re-exporta
 *     `payables.validation.ts` que ES pass-through re-export de canonical
 *     home `@/modules/payables/presentation/validation`. Indirección barrel
 *     residual sin sustancia (schemas YA viven canónicamente en hex modules).
 *   - Post-cutover C7-pre: routes import directamente desde canonical home
 *     `@/modules/payables/presentation/validation` — mecánico path swap, cero
 *     shape change, cero código nuevo. Bridge no requerido (no hay DTO
 *     reconstruction como C3-C4 attachContact ni shape divergence como
 *     C5-C6).
 *   - Magnitude: 4 schemas referenced × 6 consumers = 6 import statements
 *     paired total (3 cxp + 3 cxc) + 4 vi.mock cleanup paired total (2
 *     contacts test files × 2 declarations each = 4 mock removals + 4 dead
 *     setters cleanup en mock factory contacts).
 *   - Cementación target D8 sub-rule §13.A5-ζ-prerequisite (barrel sub-import
 *     migration as wholesale-delete prerequisite — distinguir de A5-ζ
 *     wholesale partial precedent + A5-C3 atomic wholesale Opción B EXACT).
 *
 * §13.A4-η vi.mock factory load-bearing render path coverage MATERIAL:
 * DESCARTADO C7-pre (verified Step 0 expand) — vi.mock declarations contacts
 * tests son DEAD aspirational, NO load-bearing render path coverage. Disposition
 * DELETE entirely Marco lock #2 Option A — NO swap path defensivo (no
 * sustancia render path coverage signal). Diferencia vs C3-C4 vi.mock §13.A4-η
 * MANDATORY swap: ahí page tests requieren mock NEW import path post-cutover
 * OR runtime fail (mock orphan triggers Prisma load chain). Acá contacts page
 * NO importa de `@/features/payables/server` ni transitivamente — ContactsService
 * legacy shim wraps hex sin path through `features/{X}/server` (post-C1b-α
 * composition root migration). Mock orphan post-DELETE = no-op (zero
 * production code resolution depende).
 *
 * Sub-findings emergentes (Step 0 expand pre-RED):
 *   - EMERGENTE #1: bookmark composition divergencia surface — bookmark dijo
 *     "12 archivos paired (6 c/u: types + service + repository + index +
 *     server + paired-test si aplica)" pero realidad inventario: 6 archivos
 *     per side INCLUYEN `*.validation.ts` (NO mencionado bookmark) + NO
 *     paired-test inside dir (tests viven `modules/{X}/presentation/
 *     __tests__/`). Composition divergencia + 6 consumers productivos
 *     residuales son MISMO error de bookmark sub-calibrado pre-cycle-start.
 *     Path C7-α absorbe (sub-cycle previo C7-pre).
 *   - EMERGENTE #2: hex canonical home schemas zod ya completo pre-C7-pre —
 *     `modules/{X}/presentation/validation.ts` exporta los 4 schemas
 *     (createXSchema, updateXSchema, XStatusSchema, XFiltersSchema) listos
 *     para consumer. `features/{X}/{X}.validation.ts` es pass-through
 *     re-export, NO requiere cambio. Migración mecánica path swap.
 *   - EMERGENTE #3: §13.A5-ζ-prerequisite NEW classification candidate
 *     emergent (vs §13.A5-ζ wholesale partial precedent A4-C3 + A5-C3) —
 *     cementación target D8.
 *   - EMERGENTE #4: vi.mock declarations DEAD aspirational signal verified
 *     `features/contacts/server.ts:21-25` JSDoc explícito — setters
 *     `setReceivablesService`/`setPayablesService` "intentionally absent",
 *     wiring vive `modules/contact-balances/composition-root.ts`. Disposition
 *     DELETE Option A confirmed Marco lock #2.
 *   - EMERGENTE #5: REQ-FMB.5 baseline runtime ground truth = 3 violations
 *     (NOT 0 como bookmark declarado) — pero NINGUNA toca
 *     `@/features/payables/server` ni `@/features/receivables/server` (son
 *     ai-agent x2 + accounting x1). Interpretación bookmark "REQ-FMB.5 0"
 *     lee como delta-POC = 0 (POC paired NO introdujo nuevas violaciones)
 *     Marco lock confirmed. Las 3 baseline pre-POC quedan FUERA scope C7
 *     (cleanup defer POC futuro — no es dominio paired payables↔receivables).
 *
 * Expected RED failure mode pre-GREEN (per `feedback_red_acceptance_failure_mode`):
 *   - T1-T3 FAIL: routes hoy importan `from "@/features/payables"` legacy
 *     barrel — `not.toMatch` legacy import path expectation reverses (legacy
 *     path PRESENT pre-cutover). Test fails on unwanted match.
 *   - T4-T6 FAIL: routes hoy NO importan `from "@/modules/payables/
 *     presentation/validation"` (canonical home) — Regex match falla post
 *     pattern positive forward-looking.
 *   - T7-T8 FAIL: contacts tests hoy contienen `vi.mock("@/features/payables/
 *     server"` declaration dead aspirational — `not.toMatch` reverses (mock
 *     PRESENT pre-DELETE). Test fails on unwanted match.
 * Total expected FAIL pre-GREEN: 8/8 (Marco mandate failure mode honest
 * enumerated).
 *
 * Self-contained future-proof check (lección A6 #5 + Marco lock L5): shape
 * test asserta paths `app/api/organizations/[orgSlug]/cxp/...` + `app/
 * (dashboard)/[orgSlug]/accounting/contacts/...` que persisten post C7
 * wholesale delete `features/payables/`. Test vive en `modules/payables/
 * presentation/__tests__/` — NO toca `features/payables/*` que C7 borrará.
 * Self-contained vs future deletes ✓.
 *
 * Source-string assertion pattern: mirror precedent C5-C6 + C3-C4 + C1b-α +
 * C1a + C0 + A5-C2b (`fs.readFileSync` regex match) — keep pattern paired
 * POC. Departure note vs C5-C6: target asserciones shifts de hex DTO type
 * defs (modules/{X}/domain/) → consumer surface barrel sub-import paths
 * (app/api/.../cxp/... routes + app/(dashboard)/.../contacts/__tests__/...
 * vi.mock declarations).
 *
 * Cross-ref:
 *   - architecture.md §13.A5-α paired sister 10ma evidencia matures (cumulative
 *     POC paired post-C5-C6 closure)
 *   - architecture.md §13.A5-ζ wholesale partial precedent (A4-C3 + A5-C3
 *     atomic delete Opción B EXACT)
 *   - architecture.md §13.A5-ζ-prerequisite NEW classification candidate
 *     emergent (cementación target D8 — barrel sub-import migration as
 *     wholesale-delete prerequisite)
 *   - engram `arch/§13/A5-alpha-multi-level-composition-root-delegation` #1587
 *     (canonical home — paired sister 10ma evidencia matures cumulative this
 *     RED C7-pre)
 *   - engram `poc-nuevo/paired-payables-receivables/c5-c6-closed` #1624
 *     (cycle-start bookmark C7 heredado — bookmark composition sub-calibrado
 *     pre-cycle-start, Path C7-α split absorbe)
 *   - engram `poc-nuevo/paired-payables-receivables/c3-c4-closed` #1622
 *     (preceding cycle paired §13.A5-γ Opción A bridge precedent)
 *   - engram `poc-nuevo/paired-payables-receivables/c1b-alpha-closed` #1620
 *     (preceding cycle paired §13.A5-α paired sister 7ma evidencia +
 *     composition root migration — wiring vive
 *     `modules/contact-balances/composition-root.ts`)
 *   - engram `feedback/step-0-expand-eslint-restricted-imports-grep` (REFINED
 *     CR4+CR6 — Step 0 expand pre-RED grep ALL no-restricted-imports rules
 *     MANDATORY applied este turno)
 *   - engram `feedback_red_acceptance_failure_mode` (failure mode honest 8/8
 *     per side enumerated)
 *   - engram `feedback_canonical_rule_application_commit_body` (cite +
 *     rationale + cross-ref applied RED body — §13.A5-ζ-prerequisite NEW
 *     classification cementación target D8)
 *   - engram `feedback_aspirational_mock_signals_unimplemented_contract`
 *     (vi.mock disposition DELETE Option A — stubs declare legacy class API
 *     que NO existe en hex modules + setters "intentionally absent" per
 *     features/contacts/server.ts:21-25 JSDoc explícito)
 *   - engram `feedback_mock_hygiene_commit_scope` (Marco lock #3 — bundle
 *     commit GREEN único, mock hygiene named EXPLÍCITO en commit message,
 *     no buried en wiring diffs)
 *   - engram `feedback_retirement_reinventory_gate` (5-axis classification
 *     applied Step 0 expand: CONSUMER + TEST-MOCK-DECLARATION + RESIDUAL +
 *     DEAD-IMPORT + TEST-SHAPE-ASSERTION-NEGATIVE — 6 CONSUMER productivos
 *     identified + 4 TEST-MOCK-DECLARATION dead identified pre-RED)
 *   - engram `feedback_diagnostic_stash_gate_pattern` (Marco lock procedure
 *     PROACTIVE applied post-GREEN — cumulative cross-POC 8va evidencia este
 *     RED→GREEN turn anticipated)
 *   - engram `feedback_low_cost_verification_asymmetry` (single vitest gate
 *     suficiente post-RED Marco lock procedure)
 *   - engram `feedback_invariant_collision_elevation` (CR1-CR7 sequence
 *     catalog — applied retroactivo si RED→GREEN surfaces NEW collision)
 *   - app/api/organizations/[orgSlug]/cxp/route.ts (target — createPayableSchema +
 *     payableFiltersSchema barrel sub-import legacy → canonical home swap)
 *   - app/api/organizations/[orgSlug]/cxp/[payableId]/route.ts (target —
 *     updatePayableSchema swap)
 *   - app/api/organizations/[orgSlug]/cxp/[payableId]/status/route.ts (target —
 *     payableStatusSchema swap)
 *   - app/(dashboard)/[orgSlug]/accounting/contacts/__tests__/page.test.ts
 *     (target — DELETE vi.mock("@/features/payables/server", ...) líneas 38-41 +
 *     cleanup `setPayablesService` setter dead línea 28)
 *   - app/(dashboard)/[orgSlug]/accounting/contacts/[contactId]/__tests__/page-rbac.test.ts
 *     (target — DELETE vi.mock("@/features/payables/server", ...) líneas 45-48 +
 *     cleanup `setPayablesService` setter dead línea 35)
 *   - features/payables/index.ts (legacy barrel — preserved C7-pre scope, drop
 *     C7 wholesale delete)
 *   - features/payables/payables.validation.ts (pass-through re-export
 *     canonical home — preserved C7-pre scope, drop C7 wholesale delete)
 *   - modules/payables/presentation/validation.ts (canonical home schemas zod
 *     post-cutover — consumer surface ready)
 *   - features/contacts/server.ts:21-25 (JSDoc explícito declara setters
 *     setReceivablesService/setPayablesService "intentionally absent" — verifica
 *     vi.mock disposition DELETE Option A)
 *   - modules/receivables/presentation/__tests__/c7-pre-cutover-schemas-shape.paired-pr.test.ts
 *     (paired sister mirror RED this batch)
 *   - modules/payables/presentation/__tests__/c5-c6-drop-pojo-shape.paired-pr.test.ts
 *     (precedent shape C5-C6 RED `d5e626e` + GREEN `235b4d1`)
 *   - modules/payables/presentation/__tests__/c3-c4-cutover-shape.paired-pr.test.ts
 *     (precedent shape C3-C4 RED `a610ef6` + GREEN `2278b11`)
 *   - paired-pr-C5-C6 RED `d5e626e` + GREEN `235b4d1` master (preceding ciclo
 *     paired POC)
 *   - paired-pr-C3-C4 RED `a610ef6` + GREEN `2278b11` master (preceding ciclo
 *     paired POC)
 *   - paired-pr-C1b-α RED `ec83d7c` + GREEN `89e6441` master (preceding ciclo
 *     paired POC)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

// ── C7-pre cutover targets (5 archivos paired-payables side) ──

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
const CONTACTS_PAGE_TEST = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/accounting/contacts/__tests__/page.test.ts",
);
const CONTACTS_DETAIL_PAGE_RBAC_TEST = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/accounting/contacts/[contactId]/__tests__/page-rbac.test.ts",
);

// ── Regex patterns ───────────────────────────────────────────────────────────

const LEGACY_FEATURES_PAYABLES_BARREL_IMPORT_RE =
  /from\s+["']@\/features\/payables["']/;
const HEX_CANONICAL_VALIDATION_IMPORT_RE =
  /from\s+["']@\/modules\/payables\/presentation\/validation["']/;
const VI_MOCK_LEGACY_FEATURES_PAYABLES_SERVER_RE =
  /vi\.mock\s*\(\s*["']@\/features\/payables\/server["']/;

describe("POC paired payables↔receivables C7-pre — barrel sub-import migration prerequisite to wholesale delete (paired-payables side, §13.A5-ζ-prerequisite NEW classification candidate emergent + dead aspirational vi.mock cleanup Option A, 10ma evidencia §13.A5-α paired sister sub-cycle 6ta aplicación post-cementación cumulative)", () => {
  // ── A: Legacy barrel sub-import ABSENT (Tests 1-3) ──────────────────────
  // Cutover removes legacy `from "@/features/payables"` barrel sub-imports
  // across ALL 3 cxp routes — schemas zod consumed directly from canonical
  // hex home `@/modules/payables/presentation/validation` post-cutover.

  it("Test 1: app/api/organizations/[orgSlug]/cxp/route.ts does NOT import from `@/features/payables` (legacy barrel sub-import schemas zod dropped post-cutover — createPayableSchema + payableFiltersSchema migrate canonical home)", () => {
    const source = fs.readFileSync(CXP_ROUTE, "utf8");
    expect(source).not.toMatch(LEGACY_FEATURES_PAYABLES_BARREL_IMPORT_RE);
  });

  it("Test 2: app/api/organizations/[orgSlug]/cxp/[payableId]/route.ts does NOT import from `@/features/payables` (legacy barrel sub-import dropped post-cutover — updatePayableSchema migrate canonical home)", () => {
    const source = fs.readFileSync(CXP_BY_ID_ROUTE, "utf8");
    expect(source).not.toMatch(LEGACY_FEATURES_PAYABLES_BARREL_IMPORT_RE);
  });

  it("Test 3: app/api/organizations/[orgSlug]/cxp/[payableId]/status/route.ts does NOT import from `@/features/payables` (legacy barrel sub-import dropped post-cutover — payableStatusSchema migrate canonical home)", () => {
    const source = fs.readFileSync(CXP_STATUS_ROUTE, "utf8");
    expect(source).not.toMatch(LEGACY_FEATURES_PAYABLES_BARREL_IMPORT_RE);
  });

  // ── B: Hex canonical home import POSITIVE (Tests 4-6) ──────────────────
  // §13.A5-ζ-prerequisite NEW classification — schemas zod migrate from
  // legacy barrel `@/features/payables` (pass-through re-export indirección
  // residual sin sustancia) → canonical home `@/modules/payables/
  // presentation/validation` directly. Mecánico path swap, cero shape change.

  it("Test 4: app/api/organizations/[orgSlug]/cxp/route.ts DOES import from `@/modules/payables/presentation/validation` (canonical home — createPayableSchema + payableFiltersSchema post-cutover)", () => {
    const source = fs.readFileSync(CXP_ROUTE, "utf8");
    expect(source).toMatch(HEX_CANONICAL_VALIDATION_IMPORT_RE);
  });

  it("Test 5: app/api/organizations/[orgSlug]/cxp/[payableId]/route.ts DOES import from `@/modules/payables/presentation/validation` (canonical home — updatePayableSchema post-cutover)", () => {
    const source = fs.readFileSync(CXP_BY_ID_ROUTE, "utf8");
    expect(source).toMatch(HEX_CANONICAL_VALIDATION_IMPORT_RE);
  });

  it("Test 6: app/api/organizations/[orgSlug]/cxp/[payableId]/status/route.ts DOES import from `@/modules/payables/presentation/validation` (canonical home — payableStatusSchema post-cutover)", () => {
    const source = fs.readFileSync(CXP_STATUS_ROUTE, "utf8");
    expect(source).toMatch(HEX_CANONICAL_VALIDATION_IMPORT_RE);
  });

  // ── C: Dead aspirational vi.mock ABSENT (Tests 7-8) ────────────────────
  // Per `feedback_aspirational_mock_signals_unimplemented_contract`: vi.mock
  // declarations apuntando a `@/features/payables/server` con stub
  // `class PayablesService {}` son aspirational mock dead signaling
  // unimplemented contract que NO existe — `features/contacts/server.ts:21-25`
  // JSDoc explícito declara `setPayablesService` "intentionally absent",
  // wiring real vive en `modules/contact-balances/composition-root.ts`.
  // Disposition DELETE Option A — NO swap path defensivo (sin sustancia
  // load-bearing render path coverage signal).

  it("Test 7: app/(dashboard)/[orgSlug]/accounting/contacts/__tests__/page.test.ts NOT contain `vi.mock(\"@/features/payables/server\"` declaration (DELETE dead aspirational mock + cleanup `setPayablesService` dead setter en contacts mock factory — no production import path resolution depende, ContactsService legacy shim wraps hex sin path through features/{X}/server post-C1b-α composition root migration)", () => {
    const source = fs.readFileSync(CONTACTS_PAGE_TEST, "utf8");
    expect(source).not.toMatch(VI_MOCK_LEGACY_FEATURES_PAYABLES_SERVER_RE);
  });

  it("Test 8: app/(dashboard)/[orgSlug]/accounting/contacts/[contactId]/__tests__/page-rbac.test.ts NOT contain `vi.mock(\"@/features/payables/server\"` declaration (DELETE dead aspirational mock + cleanup `setPayablesService = mockSetPayables` dead setter en contacts mock factory)", () => {
    const source = fs.readFileSync(CONTACTS_DETAIL_PAGE_RBAC_TEST, "utf8");
    expect(source).not.toMatch(VI_MOCK_LEGACY_FEATURES_PAYABLES_SERVER_RE);
  });
});
