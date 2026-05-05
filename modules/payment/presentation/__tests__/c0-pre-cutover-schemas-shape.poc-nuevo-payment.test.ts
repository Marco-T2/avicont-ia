/**
 * POC nuevo payment C0-pre RED — barrel sub-import migration prerequisite to
 * wholesale delete (single feature axis, NO paired sister — payment is a
 * single feature, no symmetric counterpart like payables↔receivables).
 *
 * Axis: schemas zod cutover OUT of legacy barrel `@/features/payment` →
 * canonical hex home `@/modules/payment/presentation/validation`. Mirror
 * precedent paired-pr C7-pre RED `179da6d` + GREEN `fbb66e3`
 * (`feedback_canonical_rule_application_commit_body` cited applied).
 *
 * §13.A5-ζ-prerequisite NEW classification 2da evidencia matures
 * post-cementación canonical (1ra evidencia paired-pr C7-pre cementada
 * `arch/§13/A5-zeta-prerequisite-barrel-sub-import-migration-prerequisite`
 * commit `6b5a7e1`). When wholesale delete `features/{X}/` has live barrel
 * sub-imports (here: 4 schemas zod consumed via `@/features/payment`
 * barrel index re-export), the wholesale delete C4 MUST be preceded by
 * sub-cycle C0-pre (cutover barrel sub-imports residuales — schemas zod
 * 4 símbolos). Mirror A4-C3 31ff403 + A5-C3 f9a1e06 + paired-pr C7
 * 60fa450 estricto Opción B preserved en C4 wholesale (defer atomic delete
 * a C4 post C0-pre absorption residuos).
 *
 * Departure from paired-pr C7-pre precedent:
 *   - paired-pr C7-pre: `features/{payables,receivables}/{X}.validation.ts`
 *     ya era pass-through re-export de canonical home — migración mecánica
 *     path swap (cero shape change, cero código nuevo).
 *   - POC nuevo payment C0-pre: `features/payment/payment.validation.ts`
 *     contiene los 4 schemas DIRECTLY (NO pass-through). GREEN scope debe
 *     CREATE canonical home `modules/payment/presentation/validation.ts`
 *     con copia de schemas + barrel export `presentation/server.ts` antes
 *     de routes path swap. RED test asserta solo consumer surface (3 routes)
 *     — el GREEN absorbe creación canonical home + pass-through downgrade
 *     legacy validation.ts. Shape RED EXACT mirror paired (consumer surface
 *     paths assertions).
 *
 * 3 consumers productivos cutover INCLUIDOS Marco lock RED scope (single
 * side payment, NO paired):
 *   1. app/api/organizations/[orgSlug]/payments/route.ts
 *      (createPaymentSchema + paymentFiltersSchema imports)
 *   2. app/api/organizations/[orgSlug]/payments/[paymentId]/route.ts
 *      (updatePaymentSchema import)
 *   3. app/api/organizations/[orgSlug]/payments/[paymentId]/allocations/route.ts
 *      (updateAllocationsSchema import)
 *
 * NO contacts UI test files vi.mock DELETE en scope C0-pre payment — los
 * 2 vi.mock declarations existentes son `vi.mock("@/features/payment/server", ...)`
 * en pages tests (page.test.ts + page-rbac.test.ts). Esos son LOAD-BEARING
 * para page rendering (page.tsx importa `PaymentService` from
 * `@/features/payment/server` directly), NO dead aspirational. Se actualizan
 * en C1 cutover routes/pages (PaymentService callsites swap factory
 * `@/features/payment/server` → `makePaymentsService` hex). Diferencia vs
 * paired-pr C7-pre donde vi.mock contacts eran DEAD aspirational disposition
 * Option A DELETE (verified per `feedback_aspirational_mock_signals_unimplemented_contract`).
 *
 * Marco lock final RED scope C0-pre (6 assertions α single side payment —
 * NO paired sister, half magnitude vs paired C7-pre 16 assertions):
 *
 *   ── A: Legacy barrel sub-import ABSENT (Tests 1-3) ──
 *     T1 payments/route.ts does NOT import from `@/features/payment` (legacy
 *        barrel sub-import schemas zod dropped post-cutover — createPaymentSchema +
 *        paymentFiltersSchema migrate canonical home)
 *     T2 payments/[paymentId]/route.ts does NOT import from `@/features/payment`
 *        (legacy barrel sub-import dropped — updatePaymentSchema migrate canonical home)
 *     T3 payments/[paymentId]/allocations/route.ts does NOT import from
 *        `@/features/payment` (legacy barrel sub-import dropped —
 *        updateAllocationsSchema migrate canonical home)
 *
 *   ── B: Hex canonical home import POSITIVE (Tests 4-6) ──
 *   GREEN scope CREATE canonical home `@/modules/payment/presentation/validation`
 *   con 4 schemas zod (createPaymentSchema, updatePaymentSchema, paymentFiltersSchema,
 *   updateAllocationsSchema) + barrel export `presentation/server.ts`. Routes
 *   import directly desde canonical home post-cutover.
 *     T4 payments/route.ts DOES import from `@/modules/payment/presentation/validation`
 *        (canonical home — createPaymentSchema + paymentFiltersSchema post-cutover)
 *     T5 payments/[paymentId]/route.ts DOES import from
 *        `@/modules/payment/presentation/validation` (canonical home —
 *        updatePaymentSchema post-cutover)
 *     T6 payments/[paymentId]/allocations/route.ts DOES import from
 *        `@/modules/payment/presentation/validation` (canonical home —
 *        updateAllocationsSchema post-cutover)
 *
 * Marco locks aplicados pre-RED C0-pre (Step 0 expand este turno):
 *   - L1 (Granularity 5 ciclos atomic + 1 doc-only confirmed): C0-pre + C1 +
 *     C2 + C3 + C4 wholesale + D1 doc-only. Mirror A4+A5+paired precedent
 *     EXACT estricto bisect-friendly. Engram lock cycle-start este turno.
 *   - L2 (Schemas hex location flat): `modules/payment/presentation/validation.ts`
 *     flat — mirror paired EXACT (contigüidad temporal precedent
 *     §13.A5-ζ-prerequisite cementación 1ra evidencia, simplicidad). Departure
 *     vs sale `modules/sale/presentation/schemas/sale.schemas.ts` carpeta
 *     dedicada — Marco lock simplicidad.
 *   - L3 (DTO mapper strategy C2 NEW payment-with-relations.mapper.ts): mirror
 *     sale-to-with-details.mapper precedent A3-C5 EXACT. 7 callsites devuelven
 *     WithCorrelation<PaymentWithRelations>, mapper centralizado vs re-fetching
 *     inline 7 veces (DRY + testability + consistency). NO scope C0-pre,
 *     defer C2 cycle.
 *   - L4 (Push timing DEFER batch cumulative POC entero closure): mirror
 *     A1+A2+A3+A4+A5+paired EXACT precedent. Estimado 12+ commits batch single
 *     push post-D1.
 *   - L5 (Side residuals features/{payables,receivables,sale,voucher-types}
 *     DEFER audit post-POC payment closure): NO scope creep mid-POC. Si
 *     emergen genuine regresiones cross-POC, surface engram dedicated post-payment
 *     closure. NO bloquea payment scope.
 *   - L6 (Test path confirmed): `modules/payment/presentation/__tests__/
 *     c0-pre-cutover-schemas-shape.poc-nuevo-payment.test.ts` — mirror paired
 *     C7-pre path EXACT estricto. Self-contained future-proof check ✓ test
 *     asserta paths consumer surface (`app/api/.../payments/...` routes) que
 *     persisten post C4 wholesale delete `features/payment/`. Test vive en
 *     `modules/payment/presentation/__tests__/` — NO toca `features/payment/*`
 *     que C4 borrará.
 *
 * §13.A5-α paired sister sub-cycle continuation tracking (POC nuevo payment
 * single feature axis, single-side counterpart paired POC paired-pr 10ma
 * evidencia): este RED C0-pre matures cumulative cross-POC §13.A5-α multi-level
 * composition delegation 12ma evidencia (C0-pre prerequisite emergent post
 * paired-pr cumulative cementación). Engram canonical home
 * `arch/§13/A5-alpha-multi-level-composition-root-delegation` (cementado
 * A5-C2a) — C0-pre NO require re-cementación canonical home; matures cumulative
 * cross-POC sub-cycle precedent.
 *
 * §13.A5-ζ-prerequisite MATERIAL barrel sub-import migration (NEW
 * classification 2da evidencia matures vs §13.A5-ζ wholesale partial
 * precedent A4-C3 + A5-C3 + paired-pr C7):
 *   - Pre-cutover: 3 routes consume schemas zod via legacy barrel
 *     `@/features/payment` (createPaymentSchema, updatePaymentSchema,
 *     paymentFiltersSchema, updateAllocationsSchema). Barrel `index.ts`
 *     re-exporta `payment.validation.ts` que contiene schemas DIRECTLY
 *     (NO pass-through como paired precedent).
 *   - Post-cutover C0-pre: routes import directamente desde canonical home
 *     `@/modules/payment/presentation/validation`. GREEN scope CREATE
 *     canonical home + barrel re-export en `presentation/server.ts` +
 *     features/payment/payment.validation.ts a pass-through re-export.
 *   - Magnitude: 4 schemas referenced × 3 consumers = 4 import statements
 *     single side (3 routes payments + 0 contacts vi.mock cleanup — no aplica
 *     payment).
 *   - Distinguir vs paired-pr C7-pre: schemas viven directly en
 *     `features/payment/payment.validation.ts` (NO pass-through preexistente),
 *     GREEN scope adds canonical home creation. Shape RED EXACT mirror paired
 *     consumer surface paths.
 *
 * §13.A4-η vi.mock factory load-bearing render path coverage:
 * NO APLICA C0-pre. 2 vi.mock existentes (`page.test.ts:26` +
 * `page-rbac.test.ts:39`) target `@/features/payment/server` (PaymentService
 * factory) NOT `@/features/payment` barrel index — esos son LOAD-BEARING para
 * page rendering, NO dead aspirational. Se actualizan en C1 cutover (vi.mock
 * target swap a `@/modules/payment/presentation/server` factory). Diferencia
 * vs paired-pr C7-pre Option A DELETE entirely.
 *
 * Sub-findings emergentes (Step 0 expand pre-RED este turno):
 *   - EMERGENTE #1: features/payment/ es shim wrapper thin completo
 *     (NO legacy puro) — payment.types.ts re-exporta hex types,
 *     payment.repository.ts extends PrismaPaymentsRepository hex con UN
 *     método-alias findUnappliedPayments→findUnappliedByContact,
 *     payment.service.ts es facade thin con 11 métodos delegating a
 *     `inner: makePaymentsService()` + fetchWithRelations re-fetch Prisma
 *     legacy shape. Mirror EXACT precedent paired payables/receivables shim
 *     shape — confirma POC payment cutover scope viable 5 ciclos atomic.
 *   - EMERGENTE #2: Cross-feature adapter deps post-paired CLOSED — 4 adapters
 *     hex puros (LegacyPayablesAdapter + LegacyReceivablesAdapter +
 *     LegacyOrgSettingsAdapter + LegacyContactReadAdapter), 2 adapters
 *     híbridos legacy/hex (LegacyFiscalPeriodsAdapter + LegacyAccountingAdapter).
 *     NO bloquea POC payment — adapters Legacy* permanecen como wrappers
 *     thin a otros features pendientes (fiscal-periods + accounting POC futuros).
 *   - EMERGENTE #3: §13.A5-ζ-prerequisite NEW classification 2da evidencia
 *     matures cumulative cross-POC post-cementación canonical (1ra evidencia
 *     paired-pr C7-pre cementada commit 6b5a7e1). NO re-cementación canonical
 *     home; matures cumulative.
 *   - EMERGENTE #4: 5-axis classification consumers `features/payment/*`
 *     verified Step 0 expand: CONSUMER 10 + TEST-MOCK-DECLARATION 2 +
 *     RESIDUAL 0 (4 hits intra-hex son JSDoc lineage citations FALSO
 *     POSITIVO) + DEAD-IMPORT 0 + TEST-SHAPE-ASSERTION-NEGATIVE 0.
 *   - EMERGENTE #5: schemas convention precedent split — payables/receivables
 *     `validation.ts` flat, sale `schemas/sale.schemas.ts` carpeta dedicada,
 *     voucher-types `voucher-type.validation.ts` named. Marco lock #2 simplicidad
 *     `validation.ts` flat (mirror paired EXACT contigüidad temporal precedent).
 *   - EMERGENTE #6: NO §13.B-paired aplica — payment es single feature,
 *     sin sister symmetric (paired POC payables↔receivables fue caso especial
 *     paired axis emergente §13.B NEW top-level letter cementación).
 *
 * Expected RED failure mode pre-GREEN (per `feedback_red_acceptance_failure_mode`):
 *   - T1-T3 FAIL: routes hoy importan `from "@/features/payment"` legacy
 *     barrel — `not.toMatch` legacy import path expectation reverses (legacy
 *     path PRESENT pre-cutover). Test fails on unwanted match.
 *   - T4-T6 FAIL: routes hoy NO importan
 *     `from "@/modules/payment/presentation/validation"` (canonical home no
 *     existe pre-GREEN) — Regex match falla post pattern positive forward-looking.
 * Total expected FAIL pre-GREEN: 6/6 (Marco mandate failure mode honest
 * enumerated).
 *
 * Self-contained future-proof check (lección A6 #5 + Marco lock L6): shape
 * test asserta paths `app/api/organizations/[orgSlug]/payments/...` que
 * persisten post C4 wholesale delete `features/payment/`. Test vive en
 * `modules/payment/presentation/__tests__/` — NO toca `features/payment/*`
 * que C4 borrará. Self-contained vs future deletes ✓.
 *
 * Source-string assertion pattern: mirror precedent paired-pr C7-pre + C5-C6 +
 * C3-C4 + C1b-α + C1a + C0 + A5-C2b (`fs.readFileSync` regex match) — keep
 * pattern POC nuevo payment. Target asserciones consumer surface barrel
 * sub-import paths (app/api/.../payments/... routes).
 *
 * Cross-ref:
 *   - architecture.md §13.A5-α multi-level composition delegation (12ma
 *     evidencia matures cumulative cross-POC C0-pre prerequisite emergent
 *     post paired-pr cumulative cementación)
 *   - architecture.md §13.A5-ζ wholesale partial precedent (A4-C3 + A5-C3 +
 *     paired-pr C7 atomic delete Opción B EXACT)
 *   - architecture.md §13.A5-ζ-prerequisite NEW classification 2da evidencia
 *     matures (1ra cementada paired-pr C7-pre commit 6b5a7e1)
 *   - engram `arch/§13/A5-alpha-multi-level-composition-root-delegation` #1587
 *     (canonical home — POC nuevo payment 12ma evidencia matures cumulative)
 *   - engram `arch/§13/A5-zeta-prerequisite-barrel-sub-import-migration-prerequisite`
 *     #1629 (canonical home — POC nuevo payment 2da evidencia matures cumulative)
 *   - engram `paired/payables-receivables/poc-closed` #1632 (precedent paired
 *     POC closure — bookmark cycle-start este turno heredado)
 *   - engram `feedback/step-0-expand-eslint-restricted-imports-grep` (Step 0
 *     expand pre-RED 5-axis classification + cross-feature deps + §13.A5
 *     patterns aplicabilidad applied este turno)
 *   - engram `feedback_red_acceptance_failure_mode` (failure mode honest 6/6
 *     enumerated single side payment)
 *   - engram `feedback_canonical_rule_application_commit_body` (cite +
 *     rationale + cross-ref applied RED body — §13.A5-ζ-prerequisite 2da
 *     evidencia matures cumulative)
 *   - engram `feedback_retirement_reinventory_gate` (5-axis classification
 *     applied Step 0 expand: CONSUMER 10 + TEST-MOCK-DECLARATION 2 +
 *     RESIDUAL 0 + DEAD-IMPORT 0 + TEST-SHAPE-ASSERTION-NEGATIVE 0
 *     identified pre-RED)
 *   - engram `feedback_diagnostic_stash_gate_pattern` (Marco lock procedure
 *     PROACTIVE applied post-GREEN — cumulative cross-POC 10ma evidencia
 *     este RED→GREEN turn anticipated)
 *   - engram `feedback_low_cost_verification_asymmetry` (single vitest gate
 *     suficiente post-RED Marco lock procedure)
 *   - app/api/organizations/[orgSlug]/payments/route.ts (target — createPaymentSchema +
 *     paymentFiltersSchema barrel sub-import legacy → canonical home swap)
 *   - app/api/organizations/[orgSlug]/payments/[paymentId]/route.ts (target —
 *     updatePaymentSchema swap)
 *   - app/api/organizations/[orgSlug]/payments/[paymentId]/allocations/route.ts
 *     (target — updateAllocationsSchema swap)
 *   - features/payment/index.ts (legacy barrel — preserved C0-pre scope, drop
 *     C4 wholesale delete)
 *   - features/payment/payment.validation.ts (schemas DIRECTLY — preserved
 *     C0-pre scope as pass-through downgrade post-GREEN, drop C4 wholesale
 *     delete)
 *   - modules/payment/presentation/validation.ts (canonical home schemas zod
 *     post-cutover — GREEN CREATE this batch)
 *   - modules/payment/presentation/server.ts (barrel export schemas — GREEN
 *     UPDATE this batch)
 *   - modules/payables/presentation/__tests__/c7-pre-cutover-schemas-shape.paired-pr.test.ts
 *     (precedent shape paired-pr C7-pre RED `179da6d` + GREEN `fbb66e3`)
 *   - paired-pr-C7-pre RED `179da6d` + GREEN `fbb66e3` master (preceding
 *     cycle paired POC — §13.A5-ζ-prerequisite 1ra evidencia cementada)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

// ── C0-pre cutover targets (3 archivos POC nuevo payment side, NO paired) ──

const PAYMENTS_ROUTE = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/payments/route.ts",
);
const PAYMENTS_BY_ID_ROUTE = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/payments/[paymentId]/route.ts",
);
const PAYMENTS_ALLOCATIONS_ROUTE = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/payments/[paymentId]/allocations/route.ts",
);

// ── Regex patterns ───────────────────────────────────────────────────────────

const LEGACY_FEATURES_PAYMENT_BARREL_IMPORT_RE =
  /from\s+["']@\/features\/payment["']/;
const HEX_CANONICAL_VALIDATION_IMPORT_RE =
  /from\s+["']@\/modules\/payment\/presentation\/validation["']/;

describe("POC nuevo payment C0-pre — barrel sub-import migration prerequisite to wholesale delete (single feature axis NO paired, §13.A5-ζ-prerequisite NEW classification 2da evidencia matures cumulative cross-POC post-cementación canonical, 12ma evidencia §13.A5-α multi-level composition delegation cumulative cross-POC sub-cycle continuation)", () => {
  // ── A: Legacy barrel sub-import ABSENT (Tests 1-3) ──────────────────────
  // Cutover removes legacy `from "@/features/payment"` barrel sub-imports
  // across ALL 3 payments routes — schemas zod consumed directly from
  // canonical hex home `@/modules/payment/presentation/validation` post-cutover.

  it("Test 1: app/api/organizations/[orgSlug]/payments/route.ts does NOT import from `@/features/payment` (legacy barrel sub-import schemas zod dropped post-cutover — createPaymentSchema + paymentFiltersSchema migrate canonical home)", () => {
    const source = fs.readFileSync(PAYMENTS_ROUTE, "utf8");
    expect(source).not.toMatch(LEGACY_FEATURES_PAYMENT_BARREL_IMPORT_RE);
  });

  it("Test 2: app/api/organizations/[orgSlug]/payments/[paymentId]/route.ts does NOT import from `@/features/payment` (legacy barrel sub-import dropped post-cutover — updatePaymentSchema migrate canonical home)", () => {
    const source = fs.readFileSync(PAYMENTS_BY_ID_ROUTE, "utf8");
    expect(source).not.toMatch(LEGACY_FEATURES_PAYMENT_BARREL_IMPORT_RE);
  });

  it("Test 3: app/api/organizations/[orgSlug]/payments/[paymentId]/allocations/route.ts does NOT import from `@/features/payment` (legacy barrel sub-import dropped post-cutover — updateAllocationsSchema migrate canonical home)", () => {
    const source = fs.readFileSync(PAYMENTS_ALLOCATIONS_ROUTE, "utf8");
    expect(source).not.toMatch(LEGACY_FEATURES_PAYMENT_BARREL_IMPORT_RE);
  });

  // ── B: Hex canonical home import POSITIVE (Tests 4-6) ──────────────────
  // §13.A5-ζ-prerequisite NEW classification 2da evidencia matures — schemas
  // zod migrate from legacy barrel `@/features/payment` (re-exporta
  // payment.validation.ts contiene schemas DIRECTLY, NO pass-through
  // preexistente vs paired precedent) → canonical home
  // `@/modules/payment/presentation/validation` directly. GREEN scope CREATE
  // canonical home + barrel re-export `presentation/server.ts`.

  it("Test 4: app/api/organizations/[orgSlug]/payments/route.ts DOES import from `@/modules/payment/presentation/validation` (canonical home — createPaymentSchema + paymentFiltersSchema post-cutover)", () => {
    const source = fs.readFileSync(PAYMENTS_ROUTE, "utf8");
    expect(source).toMatch(HEX_CANONICAL_VALIDATION_IMPORT_RE);
  });

  it("Test 5: app/api/organizations/[orgSlug]/payments/[paymentId]/route.ts DOES import from `@/modules/payment/presentation/validation` (canonical home — updatePaymentSchema post-cutover)", () => {
    const source = fs.readFileSync(PAYMENTS_BY_ID_ROUTE, "utf8");
    expect(source).toMatch(HEX_CANONICAL_VALIDATION_IMPORT_RE);
  });

  it("Test 6: app/api/organizations/[orgSlug]/payments/[paymentId]/allocations/route.ts DOES import from `@/modules/payment/presentation/validation` (canonical home — updateAllocationsSchema post-cutover)", () => {
    const source = fs.readFileSync(PAYMENTS_ALLOCATIONS_ROUTE, "utf8");
    expect(source).toMatch(HEX_CANONICAL_VALIDATION_IMPORT_RE);
  });
});
