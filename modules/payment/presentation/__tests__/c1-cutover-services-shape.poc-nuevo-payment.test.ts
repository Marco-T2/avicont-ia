/**
 * POC nuevo payment C1 RED — cross-feature/cross-module presentation cutover
 * routes + pages + vi.mock targets PaymentService + PaymentRepository hex
 * barrel (single feature axis, NO paired sister — payment is a single feature,
 * no symmetric counterpart like payables↔receivables).
 *
 * Axis: PaymentService + PaymentRepository class identity cutover OUT of legacy
 * barrel `@/features/payment/server` → canonical hex barrel
 * `@/modules/payment/presentation/server`. Mirror precedent paired-pr C3-C4 RED
 * `a610ef6` + GREEN `2278b11` (cutover paired UI pages + API routes hex factory
 * + bridge `attachContact[s]` from canonical R4 exception path post-C1b-α).
 *
 * §13.A5-α multi-level composition-root delegation 13ma evidencia matures
 * cumulative cross-POC sub-cycle continuation post paired-pr cumulative
 * cementación. Engram canonical home `arch/§13/A5-alpha-multi-level-composition-root-delegation`
 * #1587 — C1 NO require re-cementación canonical home; matures cumulative
 * cross-POC sub-cycle precedent (C0-pre 12ma + C1 13ma forward C2-C3-C4
 * cumulative).
 *
 * §13.A5-ε method-on-class shim signature divergence 2da evidencia matures
 * cumulative cross-POC post-cementación canonical (1ra evidencia A5-C2c
 * cementada `arch/§13/A5-epsilon-method-on-class-shim-signature-divergence`
 * commit `f1b9d9d`). PaymentRepository legacy
 * `features/payment/payment.repository.ts` is a wrapper class
 * `extends PrismaPaymentsRepository` adding ONE method-alias
 * `findUnappliedPayments(orgId, contactId, excludePaymentId) →
 * this.findUnappliedByContact(orgId, contactId, excludePaymentId)` (signature
 * IDENTICAL 3 args same order). Marco lock #2 Opción B drop alias — single
 * callsite consumer changes method name `findUnappliedPayments` →
 * `findUnappliedByContact` (mirror precedent A5-C2c §13.A5-ε drop method-on-class
 * shim simpler + supersedes shim cleanup C4 wholesale safety).
 *
 * Marco locks pre-RED C1 (Step 0 expand este turno):
 *   - L1 (Opción A re-export legacy class de hex barrel) Marco lock #1: minimum
 *     scope, NO scope creep, preserva DTO contract `PaymentWithRelations` (defer
 *     transformación C2 mapper centralizado per Marco lock L3 original).
 *     Mirror precedent paired C1a path swap pure factory (Cat 3 cross-module).
 *     Hex barrel `modules/payment/presentation/server.ts` ADD re-export
 *     `export { PaymentService, PaymentRepository } from "@/features/payment/server"`
 *     — features → hex circular module import mitigated single-direction class
 *     re-export sin circular type collision (verify Step 0 expand grep pre-RED
 *     si emerge). Si circular emerge GREEN apply: invariant collision elevation
 *     R-circular escala → Opción E bridge prep cycle expand Marco lock L1
 *     retroactive (mirror paired C1b-α precedent EXACT).
 *     PaymentService/PaymentRepository wholesale delete defer C4 wholesale per
 *     Marco lock L1 ESTRICTO.
 *   - L2 (§13.A5-ε Opción B drop alias `findUnappliedPayments`) Marco lock #2:
 *     callsite consumer cambia a `findUnappliedByContact`. Mirror precedent
 *     A5-C2c §13.A5-ε drop method-on-class shim signature divergence cementado
 *     canonical. 1 callsite único (api/contacts/[contactId]/unapplied-payments/route.ts)
 *     — minimum cost. Simpler + supersedes shim cleanup C4 wholesale safety.
 *     Cumulative §13.A5-ε 2da evidencia matures post-cementación.
 *   - L3 (Trust bookmark `8102acb` post-GREEN verified) Marco lock #3: skip
 *     suite full pre-RED. Mirror paired-pr-C7 Marco lock L2 precedent EXACT.
 *     Working tree clean post-commit, no edits intermedios. Cost-benefit
 *     asymmetry: re-run ~minutos vs trust bookmark verified mismo turno.
 *   - L4 (Granularity 5 ciclos preserved Marco lock L1 ESTRICTO): Opción E
 *     expand defer si circular emerge GREEN apply (retroactive collision
 *     elevation). C0-pre + C1 + C2 + C3 + C4 wholesale + D1 doc-only forward.
 *
 * Marco lock final RED scope C1 (14 assertions α single side payment — NO
 * paired sister, mirror paired C3-C4 26 paired = 13 per side scaled +1
 * §13.A5-ε alias absent assertion paired):
 *
 *   ── A: Hex canonical barrel import POSITIVE per callsite (Tests 1-8) ──
 *   8 callsites (7 PaymentService routes/pages + 1 PaymentRepository route)
 *   swap import path `@/features/payment/server` → `@/modules/payment/presentation/server`.
 *   Hex barrel modules/payment/presentation/server.ts post-GREEN re-exports
 *   { PaymentService, PaymentRepository } from "@/features/payment/server"
 *   (Opción A Marco lock #1) — class identity preserved, DTO contract
 *   PaymentWithRelations preserved (defer C2 mapper per Marco lock L3).
 *     T1 app/api/organizations/[orgSlug]/payments/route.ts
 *        imports PaymentService FROM hex barrel
 *     T2 app/api/organizations/[orgSlug]/payments/[paymentId]/route.ts
 *        imports PaymentService FROM hex barrel
 *     T3 app/api/organizations/[orgSlug]/payments/[paymentId]/status/route.ts
 *        imports PaymentService FROM hex barrel
 *     T4 app/api/organizations/[orgSlug]/payments/[paymentId]/allocations/route.ts
 *        imports PaymentService FROM hex barrel
 *     T5 app/api/organizations/[orgSlug]/payments/apply-credits/route.ts
 *        imports PaymentService FROM hex barrel
 *     T6 app/(dashboard)/[orgSlug]/payments/page.tsx
 *        imports PaymentService FROM hex barrel
 *     T7 app/(dashboard)/[orgSlug]/payments/[paymentId]/page.tsx
 *        imports PaymentService FROM hex barrel
 *     T8 app/api/organizations/[orgSlug]/contacts/[contactId]/unapplied-payments/route.ts
 *        imports PaymentRepository FROM hex barrel
 *
 *   ── B: Legacy `from "@/features/payment/server"` ABSENT (Test 9) ──
 *   PROJECT-scope grep app/ paths consolidated single assertion — post-cutover
 *   8 callsites NO importan from legacy barrel. Test reads assert ALL 8 callsite
 *   sources collectively (joined string) and asserts NO match legacy import
 *   pattern. Single assertion replaces 8 per-callsite negatives (consolidated
 *   for 14-total target estricto Marco lock).
 *     T9 PROJECT-scope 8 callsite sources collectively NO contain
 *        `from "@/features/payment/server"` (legacy barrel sub-import dropped
 *        post-cutover ALL 8 callsites consolidated)
 *
 *   ── C: §13.A5-ε method-on-class shim signature divergence drop alias (Tests 10-11) ──
 *   Marco lock #2 Opción B — drop method-on-class shim alias. Callsite consumer
 *   cambia a `findUnappliedByContact` (hex method directly), legacy alias
 *   `findUnappliedPayments` removed from callsite. PaymentRepository wrapper
 *   class wholesale delete defer C4 (per Marco lock L1 ESTRICTO).
 *     T10 api/contacts/[contactId]/unapplied-payments/route.ts uses
 *         `findUnappliedByContact` method invocation (hex direct, drop alias)
 *     T11 api/contacts/[contactId]/unapplied-payments/route.ts does NOT contain
 *         `findUnappliedPayments` alias (legacy method-on-class shim drop)
 *
 *   ── D: §13.A4-η vi.mock factory load-bearing render path coverage swap (Tests 12-13) ──
 *   2 vi.mock declarations target swap MANDATORY paired §13.A4-η — page tests
 *   mock target swap from `@/features/payment/server` → `@/modules/payment/presentation/server`.
 *   Class identity preserved (Opción A re-export) — vi.mock shape `class PaymentService { method = mock }`
 *   stays unchanged. Only target path swaps. NO orphan post-cutover.
 *     T12 app/(dashboard)/[orgSlug]/payments/__tests__/page.test.ts
 *         vi.mock target `@/modules/payment/presentation/server` (factory pattern
 *         §13.A4-η LOAD-BEARING render path coverage MATERIAL — page renders
 *         require PaymentService class with `list` method mocked)
 *     T13 app/(dashboard)/[orgSlug]/payments/[paymentId]/__tests__/page-rbac.test.ts
 *         vi.mock target `@/modules/payment/presentation/server` (factory pattern
 *         §13.A4-η LOAD-BEARING — page-rbac renders require PaymentService class
 *         with `getById` method mocked)
 *
 *   ── E: Hex barrel canonical Opción A re-export legacy classes sanity (Test 14) ──
 *   Opción A Marco lock #1 — hex barrel re-export legacy class identity
 *   `{ PaymentService, PaymentRepository }` from `@/features/payment/server`.
 *   Single direction re-export sin circular type collision (verify pre-RED
 *   Step 0 expand grep — features/payment/payment.service.ts imports
 *   makePaymentsService from hex via `inner: makePaymentsService()` line 58, NO
 *   PaymentService class re-import). Single-direction class re-export TS module
 *   resolution acepta sin circular collision.
 *     T14 modules/payment/presentation/server.ts contains
 *         `export { PaymentService, PaymentRepository } from "@/features/payment/server"`
 *         (canonical Opción A re-export legacy classes — preserves DTO contract
 *         PaymentWithRelations defer C2 mapper centralizado Marco lock L3)
 *
 * §13.A5-α paired sister sub-cycle continuation tracking (POC nuevo payment
 * single feature axis 13ma evidencia matures cumulative cross-POC sub-cycle):
 * mirror canonical home cumulative §13.A5-α pattern — multi-level composition
 * root delegation external callsite → PaymentService legacy class → makePaymentsService
 * factory hex → PaymentsService hex inner. Path swap (Opción A) preserves class
 * identity, hex factory disponible NO requires factory addition pre-RED.
 *
 * §13.A5-ε MATERIAL — method-on-class shim signature divergence drop alias 2da
 * evidencia matures cumulative cross-POC post-cementación canonical (1ra
 * cementada A5-C2c). Distinguir vs A5-C2c: aquí 1 callsite único drop method
 * name; A5-C2c era voucher-types service.seedForOrg → seedDefaultsForOrg (2
 * callsites + DI mock fixture cascade). Magnitude factor C1 ~30% A5-C2c —
 * minimum cost mirror precedent canonical estricto.
 *
 * §13.A4-η vi.mock factory load-bearing render path coverage MATERIAL — 2 page
 * tests target swap paired MANDATORY (NO orphan post-cutover). Class identity
 * preserved Opción A re-export — vi.mock shape `class PaymentService { method }`
 * NO requires factory shape swap (vs paired C3-C4 factory shape swap with
 * `attachContact[s]` bridge prep). Forward-applicable: cuando Opción A
 * re-export class identity preserved, vi.mock target swap paired solo path
 * (NO shape swap factory required).
 *
 * Sub-findings emergentes (Step 0 expand pre-RED este turno):
 *   - EMERGENTE #1: 5-axis classification consumers `features/payment/*`
 *     verified Step 0 expand: CONSUMER 8 (7 PaymentService routes/pages + 1
 *     PaymentRepository route) + CONSUMER 2 (TYPE imports
 *     `@/features/payment/payment.types` defer C2 §13.A5-γ NEW DTO mapper) +
 *     TEST-MOCK-DECLARATION 2 (page.test.ts + page-rbac.test.ts §13.A4-η
 *     LOAD-BEARING) + RESIDUAL 0 + DEAD-IMPORT 0 + TEST-SHAPE-ASSERTION-NEGATIVE 0.
 *   - EMERGENTE #2: PaymentService legacy ctor zero-arg con args ignored
 *     (`_repo?, _orgSettingsService?, ..., _journalRepo?` 7 unknown ignored) —
 *     ALL 8 callsites use ZERO-ARG `new PaymentService()` o `new PaymentRepository()`.
 *     Sub-Opción 1 tx-aware ctor pattern NO aplica — paired-pr precedent C1a
 *     sub-Opción 1 emergent specific tx-aware. Aquí cutover mecánico path swap
 *     puro Opción A.
 *   - EMERGENTE #3: §13.A5-α multi-level composition-root delegation 13ma
 *     evidencia matures cumulative cross-POC sub-cycle (post C0-pre 12ma + paired
 *     11 cumulative). Hex factory `makePaymentsService()` + `makePaymentsServiceForTx(tx)`
 *     disponible composition-root.ts NO requires factory addition pre-RED.
 *   - EMERGENTE #4: §13.A5-ε method-on-class shim signature divergence — 1
 *     callsite único api/contacts/[contactId]/unapplied-payments/route.ts uses
 *     `findUnappliedPayments(orgId, contactId, excludePaymentId)` (line 18).
 *     Hex `findUnappliedByContact(orgId, contactId, excludePaymentId)` signature
 *     IDENTICAL 3 args. Opción B drop alias minimum cost — callsite cambia
 *     method name únicamente.
 *   - EMERGENTE #5: ESLint R1+R2+R4+R5 baseline preservation predicted —
 *     R1-R5 apply ONLY `modules/<glob>/{domain,application,presentation}/`. C1
 *     edits viven en `app/<glob>` (routes + pages) NO afectado por R1-R5 rules.
 *     banServerBarrels guard `components/<glob>` + `app/<glob>/<X>-client.{ts,tsx}` —
 *     pages page.tsx + route.ts NO son `*-client` allowed. Predicted 0 new
 *     ESLint violations baseline 10e/13w preserved post-C1 GREEN.
 *   - EMERGENTE #6: NO §13.B-paired aplica — payment es single feature, sin
 *     sister symmetric (paired POC payables↔receivables fue caso especial paired
 *     axis emergente §13.B NEW top-level letter cementación).
 *   - EMERGENTE #7: Hex barrel `modules/payment/presentation/server.ts` ya
 *     re-exporta `PrismaPaymentsRepository` directly (línea 6 + 13). Opción A
 *     re-export legacy class identity ADD `export { PaymentService, PaymentRepository } from "@/features/payment/server"`
 *     mantiene compat post-cutover routes/pages — DTO contract PaymentWithRelations
 *     preservado defer C2 mapper centralizado.
 *
 * Expected RED failure mode pre-GREEN (per `feedback_red_acceptance_failure_mode`):
 *   - T1-T8 FAIL: 8 callsites hoy importan `from "@/features/payment/server"`
 *     legacy barrel — `toMatch` hex canonical pattern fails (hex import path NO
 *     present pre-cutover). Test fails on missing positive match.
 *   - T9 FAIL: 8 callsite sources collectively contain `from "@/features/payment/server"`
 *     pre-cutover — `not.toMatch` legacy pattern reverses. Test fails on
 *     unwanted match (legacy import path PRESENT pre-cutover).
 *   - T10 FAIL: api/contacts/[contactId]/unapplied-payments/route.ts hoy invoca
 *     `paymentRepository.findUnappliedPayments(...)` (line 18) — `toMatch`
 *     `findUnappliedByContact` pattern fails (hex method name NO present
 *     pre-cutover).
 *   - T11 FAIL: api/contacts/[contactId]/unapplied-payments/route.ts hoy contiene
 *     `findUnappliedPayments` (line 18) — `not.toMatch` legacy alias reverses.
 *     Test fails on unwanted match (legacy method name PRESENT pre-cutover).
 *   - T12-T13 FAIL: page.test.ts:26 + page-rbac.test.ts:39 hoy contienen
 *     `vi.mock("@/features/payment/server", ...)` — `toMatch` hex target pattern
 *     fails (hex vi.mock target NO present pre-cutover).
 *   - T14 FAIL: hex barrel `modules/payment/presentation/server.ts` hoy NO
 *     contiene `export { PaymentService, PaymentRepository } from "@/features/payment/server"`
 *     pre-GREEN (re-export añadido GREEN scope). Test fails on missing positive
 *     match canonical Opción A re-export.
 * Total expected FAIL pre-GREEN: 14/14 (Marco mandate failure mode honest
 * enumerated).
 *
 * Self-contained future-proof check (lección A6 #5 + Marco lock L6 heredado
 * mismo path C0-pre): shape test asserta paths
 * `app/api/organizations/[orgSlug]/...`, `app/(dashboard)/[orgSlug]/payments/...`,
 * `modules/payment/presentation/server.ts` que persisten post C4 wholesale
 * delete `features/payment/`. Test vive en
 * `modules/payment/presentation/__tests__/` — NO toca `features/payment/*` que
 * C4 borrará. Self-contained vs future deletes ✓.
 *
 * Source-string assertion pattern: mirror precedent C0-pre + paired-pr C7-pre +
 * C5-C6 + C3-C4 + C1b-α + C1a + C0 + A5-C2b (`fs.readFileSync` regex match) —
 * keep pattern POC nuevo payment. Target asserciones consumer surface paths +
 * hex barrel canonical re-export shape.
 *
 * Cross-ref:
 *   - architecture.md §13.A5-α multi-level composition delegation (13ma
 *     evidencia matures cumulative cross-POC sub-cycle continuation post C0-pre
 *     12ma + paired 11 cumulative)
 *   - architecture.md §13.A5-ε method-on-class shim signature divergence drop
 *     alias (2da evidencia matures cumulative cross-POC post-cementación A5-C2c)
 *   - architecture.md §13.A4-η vi.mock factory load-bearing render path coverage
 *     MATERIAL (paired sister precedent A4-C1 cementada cumulative — Opción A
 *     re-export class identity preserved, target path swap only NO shape swap)
 *   - engram `arch/§13/A5-alpha-multi-level-composition-root-delegation` #1587
 *     (canonical home — POC nuevo payment 13ma evidencia matures cumulative)
 *   - engram `arch/§13/A5-epsilon-method-on-class-shim-signature-divergence`
 *     (canonical home — POC nuevo payment 2da evidencia matures cumulative
 *     post-cementación A5-C2c)
 *   - engram `paired/payables-receivables/poc-closed` #1632 (precedent paired
 *     POC closure — bookmark cycle-start este turno heredado)
 *   - engram `poc-nuevo/payment/c0-pre/closed` #1635 (preceding cycle POC nuevo
 *     payment — bookmark cycle-start cycle precedent EXACT)
 *   - engram `feedback/step-0-expand-eslint-restricted-imports-grep` (Step 0
 *     expand pre-RED 5-axis classification + cross-feature deps + §13.A5
 *     patterns aplicabilidad + R1-R5 baseline preservation predicted applied
 *     este turno)
 *   - engram `feedback_red_acceptance_failure_mode` (failure mode honest 14/14
 *     enumerated single side payment)
 *   - engram `feedback_canonical_rule_application_commit_body` (cite +
 *     rationale + cross-ref applied RED body — §13.A5-α 13ma + §13.A5-ε 2da +
 *     §13.A4-η LOAD-BEARING matures cumulative)
 *   - engram `feedback_retirement_reinventory_gate` (5-axis classification
 *     applied Step 0 expand: CONSUMER 8 + TYPE-CONSUMER 2 (defer C2) +
 *     TEST-MOCK-DECLARATION 2 + RESIDUAL 0 + DEAD-IMPORT 0 +
 *     TEST-SHAPE-ASSERTION-NEGATIVE 0 identified pre-RED)
 *   - engram `feedback_diagnostic_stash_gate_pattern` (Marco lock procedure
 *     PROACTIVE applied post-GREEN — cumulative cross-POC 10ma evidencia
 *     anticipated this RED→GREEN turn)
 *   - engram `feedback_low_cost_verification_asymmetry` (single vitest gate
 *     suficiente post-RED Marco lock procedure + trust bookmark `8102acb`
 *     post-GREEN baseline pre-RED skip suite full Marco lock #3 mirror paired
 *     C7 L2 EXACT)
 *   - engram `feedback_textual_rule_verification` (Marco lock textual canonical
 *     home pre-RED §13.A5-α + §13.A5-ε verified architecture.md §13 cementación
 *     paired-pr C8 commit `6b5a7e1`)
 *   - app/api/organizations/[orgSlug]/payments/route.ts (target T1 — PaymentService
 *     factory hex swap)
 *   - app/api/organizations/[orgSlug]/payments/[paymentId]/route.ts (target T2)
 *   - app/api/organizations/[orgSlug]/payments/[paymentId]/status/route.ts
 *     (target T3)
 *   - app/api/organizations/[orgSlug]/payments/[paymentId]/allocations/route.ts
 *     (target T4)
 *   - app/api/organizations/[orgSlug]/payments/apply-credits/route.ts (target T5)
 *   - app/(dashboard)/[orgSlug]/payments/page.tsx (target T6)
 *   - app/(dashboard)/[orgSlug]/payments/[paymentId]/page.tsx (target T7)
 *   - app/api/organizations/[orgSlug]/contacts/[contactId]/unapplied-payments/route.ts
 *     (target T8 + T10 + T11 — PaymentRepository factory hex swap +
 *     findUnappliedByContact method swap drop alias)
 *   - app/(dashboard)/[orgSlug]/payments/__tests__/page.test.ts (target T12 —
 *     vi.mock target swap §13.A4-η LOAD-BEARING)
 *   - app/(dashboard)/[orgSlug]/payments/[paymentId]/__tests__/page-rbac.test.ts
 *     (target T13 — vi.mock target swap §13.A4-η LOAD-BEARING)
 *   - modules/payment/presentation/server.ts (target T14 — hex barrel canonical
 *     Opción A re-export legacy classes ADD `export { PaymentService, PaymentRepository } from "@/features/payment/server"`)
 *   - features/payment/payment.service.ts (legacy shim PaymentService class —
 *     preserved C1 scope as canonical Opción A source, drop C4 wholesale delete)
 *   - features/payment/payment.repository.ts (legacy shim PaymentRepository
 *     wrapper class extends PrismaPaymentsRepository alias `findUnappliedPayments` —
 *     preserved C1 scope as canonical Opción A source, drop C4 wholesale delete)
 *   - features/payment/server.ts (legacy barrel re-export — preserved C1 scope
 *     as canonical Opción A source, drop C4 wholesale delete)
 *   - modules/payment/presentation/__tests__/c0-pre-cutover-schemas-shape.poc-nuevo-payment.test.ts
 *     (precedent shape POC nuevo payment C0-pre RED `7f61154` + GREEN `8102acb`)
 *   - modules/payables/presentation/__tests__/c3-c4-cutover-shape.paired-pr.test.ts
 *     (precedent shape paired-pr C3-C4 RED `a610ef6` + GREEN `2278b11` 26
 *     paired = 13 per side — payment single feature 14 estricto)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

// ── C1 cutover targets (10 archivos POC nuevo payment side, NO paired) ──

const PAYMENTS_ROUTE = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/payments/route.ts",
);
const PAYMENTS_BY_ID_ROUTE = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/payments/[paymentId]/route.ts",
);
const PAYMENTS_STATUS_ROUTE = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/payments/[paymentId]/status/route.ts",
);
const PAYMENTS_ALLOCATIONS_ROUTE = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/payments/[paymentId]/allocations/route.ts",
);
const PAYMENTS_APPLY_CREDITS_ROUTE = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/payments/apply-credits/route.ts",
);
const PAYMENTS_PAGE = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/payments/page.tsx",
);
const PAYMENT_DETAIL_PAGE = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/payments/[paymentId]/page.tsx",
);
const UNAPPLIED_PAYMENTS_ROUTE = path.join(
  REPO_ROOT,
  "app/api/organizations/[orgSlug]/contacts/[contactId]/unapplied-payments/route.ts",
);
const PAYMENTS_PAGE_TEST = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/payments/__tests__/page.test.ts",
);
const PAYMENT_DETAIL_PAGE_RBAC_TEST = path.join(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/payments/[paymentId]/__tests__/page-rbac.test.ts",
);
// ── Regex patterns ───────────────────────────────────────────────────────────

const HEX_CANONICAL_SERVER_IMPORT_RE =
  /from\s+["']@\/modules\/payment\/presentation\/server["']/;
const LEGACY_FEATURES_PAYMENT_SERVER_IMPORT_RE =
  /from\s+["']@\/features\/payment\/server["']/;
const LEGACY_FEATURES_PAYMENT_SERVER_VI_MOCK_RE =
  /vi\.mock\(\s*["']@\/features\/payment\/server["']/;
const HEX_CANONICAL_SERVER_VI_MOCK_RE =
  /vi\.mock\(\s*["']@\/modules\/payment\/presentation\/server["']/;
const HEX_FIND_UNAPPLIED_BY_CONTACT_INVOCATION_RE = /\.findUnappliedByContact\s*\(/;
const LEGACY_FIND_UNAPPLIED_PAYMENTS_INVOCATION_RE = /\.findUnappliedPayments\s*\(/;
// HEX_BARREL_SERVER + HEX_BARREL_LEGACY_CLASSES_REEXPORT_RE removed — exclusive
// consumers were Test 14 (dropped en C4-α GREEN per Collision #2 absorption
// Opción α). Section E preamble note explica rationale.

describe("POC nuevo payment C1 — cross-feature/cross-module presentation cutover routes + pages + vi.mock targets PaymentService + PaymentRepository hex barrel (single feature axis NO paired, §13.A5-α 13ma evidencia matures cumulative cross-POC sub-cycle continuation + §13.A5-ε 2da evidencia matures post-cementación canonical Opción B drop alias + §13.A4-η LOAD-BEARING render path coverage MATERIAL Opción A re-export class identity preserved)", () => {
  // ── A: Hex canonical barrel import POSITIVE per callsite (Tests 1-8) ────
  // Opción A Marco lock #1 — hex barrel re-exporta { PaymentService, PaymentRepository }
  // from "@/features/payment/server" (post-GREEN canonical re-export). 8
  // callsites swap import path únicamente — class identity preserved, DTO
  // contract PaymentWithRelations preservado defer C2 mapper centralizado.

  it("Test 1: app/api/organizations/[orgSlug]/payments/route.ts DOES import from `@/modules/payment/presentation/server` (PaymentService factory hex post-cutover Opción A canonical re-export class identity preserved)", () => {
    const source = fs.readFileSync(PAYMENTS_ROUTE, "utf8");
    expect(source).toMatch(HEX_CANONICAL_SERVER_IMPORT_RE);
  });

  it("Test 2: app/api/organizations/[orgSlug]/payments/[paymentId]/route.ts DOES import from `@/modules/payment/presentation/server` (PaymentService factory hex post-cutover)", () => {
    const source = fs.readFileSync(PAYMENTS_BY_ID_ROUTE, "utf8");
    expect(source).toMatch(HEX_CANONICAL_SERVER_IMPORT_RE);
  });

  it("Test 3: app/api/organizations/[orgSlug]/payments/[paymentId]/status/route.ts DOES import from `@/modules/payment/presentation/server` (PaymentService factory hex post-cutover)", () => {
    const source = fs.readFileSync(PAYMENTS_STATUS_ROUTE, "utf8");
    expect(source).toMatch(HEX_CANONICAL_SERVER_IMPORT_RE);
  });

  it("Test 4: app/api/organizations/[orgSlug]/payments/[paymentId]/allocations/route.ts DOES import from `@/modules/payment/presentation/server` (PaymentService factory hex post-cutover)", () => {
    const source = fs.readFileSync(PAYMENTS_ALLOCATIONS_ROUTE, "utf8");
    expect(source).toMatch(HEX_CANONICAL_SERVER_IMPORT_RE);
  });

  it("Test 5: app/api/organizations/[orgSlug]/payments/apply-credits/route.ts DOES import from `@/modules/payment/presentation/server` (PaymentService factory hex post-cutover)", () => {
    const source = fs.readFileSync(PAYMENTS_APPLY_CREDITS_ROUTE, "utf8");
    expect(source).toMatch(HEX_CANONICAL_SERVER_IMPORT_RE);
  });

  it("Test 6: app/(dashboard)/[orgSlug]/payments/page.tsx DOES import from `@/modules/payment/presentation/server` (PaymentService factory hex post-cutover)", () => {
    const source = fs.readFileSync(PAYMENTS_PAGE, "utf8");
    expect(source).toMatch(HEX_CANONICAL_SERVER_IMPORT_RE);
  });

  it("Test 7: app/(dashboard)/[orgSlug]/payments/[paymentId]/page.tsx DOES import from `@/modules/payment/presentation/server` (PaymentService factory hex post-cutover)", () => {
    const source = fs.readFileSync(PAYMENT_DETAIL_PAGE, "utf8");
    expect(source).toMatch(HEX_CANONICAL_SERVER_IMPORT_RE);
  });

  it("Test 8: app/api/organizations/[orgSlug]/contacts/[contactId]/unapplied-payments/route.ts DOES import from `@/modules/payment/presentation/server` (PaymentRepository factory hex post-cutover Opción A canonical re-export class identity preserved)", () => {
    const source = fs.readFileSync(UNAPPLIED_PAYMENTS_ROUTE, "utf8");
    expect(source).toMatch(HEX_CANONICAL_SERVER_IMPORT_RE);
  });

  // ── B: Legacy `from "@/features/payment/server"` ABSENT consolidated (Test 9) ──
  // PROJECT-scope grep app/ paths consolidated single assertion — 8 callsite
  // sources collectively NO contain legacy barrel import. Single assertion
  // replaces 8 per-callsite negatives (consolidated 14-total target estricto).

  it("Test 9: 8 callsite sources collectively NO contain `from \"@/features/payment/server\"` (legacy barrel import dropped post-cutover ALL 8 callsites consolidated PROJECT-scope grep app/ paths)", () => {
    const sources = [
      fs.readFileSync(PAYMENTS_ROUTE, "utf8"),
      fs.readFileSync(PAYMENTS_BY_ID_ROUTE, "utf8"),
      fs.readFileSync(PAYMENTS_STATUS_ROUTE, "utf8"),
      fs.readFileSync(PAYMENTS_ALLOCATIONS_ROUTE, "utf8"),
      fs.readFileSync(PAYMENTS_APPLY_CREDITS_ROUTE, "utf8"),
      fs.readFileSync(PAYMENTS_PAGE, "utf8"),
      fs.readFileSync(PAYMENT_DETAIL_PAGE, "utf8"),
      fs.readFileSync(UNAPPLIED_PAYMENTS_ROUTE, "utf8"),
    ].join("\n");
    expect(sources).not.toMatch(LEGACY_FEATURES_PAYMENT_SERVER_IMPORT_RE);
  });

  // ── C: §13.A5-ε method-on-class shim signature divergence drop alias (Tests 10-11) ──
  // Marco lock #2 Opción B — drop method-on-class shim alias. Callsite consumer
  // cambia a `findUnappliedByContact` (hex method directly), legacy alias
  // `findUnappliedPayments` removed from callsite. PaymentRepository wrapper
  // class wholesale delete defer C4 (per Marco lock L1 ESTRICTO).

  it("Test 10: api/contacts/[contactId]/unapplied-payments/route.ts uses `findUnappliedByContact` method invocation (hex direct, drop alias §13.A5-ε Opción B Marco lock #2)", () => {
    const source = fs.readFileSync(UNAPPLIED_PAYMENTS_ROUTE, "utf8");
    expect(source).toMatch(HEX_FIND_UNAPPLIED_BY_CONTACT_INVOCATION_RE);
  });

  it("Test 11: api/contacts/[contactId]/unapplied-payments/route.ts does NOT contain `findUnappliedPayments` alias (legacy method-on-class shim drop §13.A5-ε 2da evidencia matures post-cementación canonical A5-C2c)", () => {
    const source = fs.readFileSync(UNAPPLIED_PAYMENTS_ROUTE, "utf8");
    expect(source).not.toMatch(LEGACY_FIND_UNAPPLIED_PAYMENTS_INVOCATION_RE);
  });

  // ── D: §13.A4-η vi.mock factory load-bearing render path coverage swap (Tests 12-13) ──
  // 2 vi.mock declarations target swap MANDATORY paired §13.A4-η — page tests
  // mock target swap from `@/features/payment/server` → `@/modules/payment/presentation/server`.
  // Class identity preserved (Opción A re-export) — vi.mock shape `class PaymentService { method = mock }`
  // stays unchanged. Only target path swaps.

  it("Test 12: app/(dashboard)/[orgSlug]/payments/__tests__/page.test.ts vi.mock target `@/modules/payment/presentation/server` (factory pattern §13.A4-η LOAD-BEARING render path coverage MATERIAL — page renders require PaymentService class with `list` method mocked, target path swap Opción A class identity preserved)", () => {
    const source = fs.readFileSync(PAYMENTS_PAGE_TEST, "utf8");
    expect(source).toMatch(HEX_CANONICAL_SERVER_VI_MOCK_RE);
    expect(source).not.toMatch(LEGACY_FEATURES_PAYMENT_SERVER_VI_MOCK_RE);
  });

  it("Test 13: app/(dashboard)/[orgSlug]/payments/[paymentId]/__tests__/page-rbac.test.ts vi.mock target `@/modules/payment/presentation/server` (factory pattern §13.A4-η LOAD-BEARING — page-rbac renders require PaymentService class with `getById` method mocked, target path swap Opción A class identity preserved)", () => {
    const source = fs.readFileSync(PAYMENT_DETAIL_PAGE_RBAC_TEST, "utf8");
    expect(source).toMatch(HEX_CANONICAL_SERVER_VI_MOCK_RE);
    expect(source).not.toMatch(LEGACY_FEATURES_PAYMENT_SERVER_VI_MOCK_RE);
  });

  // ── E: Test 14 SUPERSEDED por C4-α GREEN drop línea 86 ──
  // Original Test 14 asserted Opción A re-export `export { PaymentService,
  // PaymentRepository } from "@/features/payment/server"`. Superseded por C4-α
  // commit (Adapter Layer presentation/ delegate via reader port + composition-root
  // chain canonical R4 exception path EXACT mirror α-A3.B). Línea 86 dropped +
  // chain via composition-root (callsite → server → composition-root →
  // payment-service.adapter). C4-α RED Test 11 + C4-α GREEN cementan el chain
  // post-cutover. Test 14 dropped en mismo C4-α GREEN batch (Collision #2
  // absorption Opción α — cleanup superseded tests mismo batch que origina
  // cascade). Cumulative cross-POC mirror paired C7 Opción B EXACT precedent.
});
