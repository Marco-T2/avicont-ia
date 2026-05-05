/**
 * POC nuevo payment C3 RED — drop type axis PaymentWithRelations + hex local DTO
 * canonical home Path β-prod scope (mirror A3-C3 sale-with-details EXACT
 * precedent).
 *
 * Axis (4 ejes Path β-prod cohesivo single batch):
 *   1. Move PaymentWithRelations type definition desde
 *      features/payment/payment.types.ts:32-43 → NEW canonical home hex local
 *      modules/payment/presentation/dto/payment-with-relations.ts (mirror A3-C3
 *      sale-with-details EXACT precedent estructura type alias Omit<Payment,
 *      "amount"> & { ... 5 relations ... }).
 *   2. 2 prod callsites consumer cross-feature swap import path:
 *      - components/payments/payment-list.tsx:55 desde
 *        @/features/payment/payment.types → @/modules/payment/presentation/dto/
 *        payment-with-relations
 *      - components/payments/payment-form.tsx:27 desde
 *        @/features/payment/payment.types → @/modules/payment/presentation/dto/
 *        payment-with-relations
 *   3. Mapper hex Opción A type import resolved (cross-module reverse import
 *      desaparece NO-OP transitorio):
 *      - modules/payment/presentation/mappers/payment-with-relations.mapper.ts:5
 *        desde @/features/payment/payment.types → @/modules/payment/presentation/
 *        dto/payment-with-relations
 *   4. Internal shim cascade swap (forced cascade per drop axis — relative
 *      `./payment.types` import path break post-drop):
 *      - features/payment/payment.service.ts:13-20 desde "./payment.types"
 *        relative → @/modules/payment/presentation/dto/payment-with-relations
 *
 * Mirror precedent A3-C3 build hex DTO presentation EXACT scope:
 *   - modules/sale/presentation/dto/sale-with-details.ts (precedent A3-C3 build
 *     DTO canonical home — interface SaleWithDetails extends Omit<Sale,
 *     "totalAmount"> NO server.ts barrel re-export, prod consumers importan
 *     DIRECTO desde dto/ subdir path).
 *   - components/sales/sale-list.tsx:44 + sale-form.tsx:36 importan SaleWithDetails
 *     desde @/modules/sale/presentation/dto/sale-with-details (cross-feature swap
 *     EXACT mirror precedent prod consumer import path).
 *
 * §13.A NEW emergent classification "hex presentation TYPE-only import desde
 * legacy features/" cementación canonical home — Path β-prod resolves Opción A
 * NEW §13.A cross-module type-only import a NO-OP transitorio post-C3
 * (cross-module reverse import desaparece, hex local resolve estable post-C4
 * wholesale delete features/payment/). 2da evidencia formal post-cementación
 * canonical PROACTIVE pre-D1 (1ra evidencia POC nuevo payment C2 commit
 * `0c79740` GREEN). Marco lock #4 §13.A status tentativo PROACTIVE pre-D1 — OK
 * aplicar engram canonical home, NO lockear textual hasta D1 cementación
 * architecture.md. Cementación D1 documenta clase emergent + resolution Path
 * β-prod precedent forward-applicable cualquier feature single con DTO type
 * pendiente migration hex donde mapper extraction precede type drop axis (Path γ
 * + β-prod sequence pattern reusable cross-POC).
 *
 * §13.A5-γ DTO divergence runtime path coverage 6ta aplicación matures cumulative
 * cross-POC post-cementación canonical Marco lock #5 INCLUDE assertions runtime
 * path en payment-list/form RED scope (lección #12 6ta aplicación matures
 * cumulative cross-POC). Drop type axis cambia path 2 prod consumer callsites —
 * render path coverage MANDATORY per feedback_runtime_path_coverage_red_scope
 * (RED scope cutover debe incluir runtime path coverage status enums + null
 * branches, NO solo __tests__ paths). Mirror A3-C5 + paired C3-C4 §13.A4-η
 * load-bearing precedent EXACT pattern.
 *
 * Marco locks pre-RED C3 (Step 0 expand este turno):
 *   - L1 (User prompt set governs Path α/β/γ/δ definitions este turn vs bookmark
 *     engram #1641 cycle-close set) Marco lock #1: user prompt set más refinado,
 *     separa "WHERE el type vive" de "scope cleanup service".
 *   - L2 (Path β-prod confirmed) Marco lock #2: move PaymentWithRelations a
 *     modules/payment/presentation/dto/payment-with-relations.ts mirror A3-C3
 *     EXACT + 2 callsites swap + mapper hex Opción A resolved a hex local DTO
 *     (cross-module reverse import desaparece NO-OP transitorio).
 *     Razón:
 *     · Mirror A3-C3 precedent EXACT (build hex DTO canonical home + cross-feature
 *       swap).
 *     · Resolves Opción A NEW §13.A type-only escape hatch transitorio cleanly
 *       (cross-module import desaparece, hex local resolve).
 *     · Drop type axis features/payment/payment.types.ts (PaymentWithRelations
 *       definition removed) — pre-C4 wholesale natural cleanup.
 *     · Path α ambigua descartada (Snapshot+Relations composition complex, riesgo
 *       emergent §13 sub-variant sin precedent).
 *     · Path γ descartada (conflicto C2 #2 lock fetchWithRelations cleanup
 *       pertenece C4 wholesale).
 *     · Path δ minimum-scope viable pero defer service internals OK preserved C4
 *       (NO mid-cycle scope creep).
 *   - L3 (Tight scope solo PaymentWithRelations swap en 2 callsites prod
 *     consumer) Marco lock #3: PaymentDirection / PaymentMethod /
 *     CreditAllocationSource swap consolidated rejected.
 *     Razón:
 *     · PaymentDirection + CreditAllocationSource ya canonical home
 *       modules/payment/presentation/server (re-exports legacy passthrough work).
 *       Swap consumer cosmético sin valor scope C3.
 *     · PaymentMethod canonical Prisma client — swap consumer cross-module
 *       concern, NO drop axis target.
 *     · C4 wholesale absorbs cleanup natural cuando features/payment/* delete
 *       forces consumer migration final.
 *     · Tight scope preserves bisect-friendly granularity L1 ESTRICTO 5 ciclos.
 *   - L4 (§13.A status tentativo PROACTIVE confirmed) Marco lock #4: OK aplicar
 *     engram canonical home, NO lockear textual hasta D1 cementación
 *     architecture.md. Path β-prod resolves NEW §13.A NO-OP transitorio post-C3
 *     (cross-module type-only import desaparece, hex local resolve). Cementación
 *     D1 documenta clase emergent + resolution Path β-prod precedent
 *     forward-applicable.
 *   - L5 (Runtime path coverage §13.A5-γ 6ta aplicación INCLUDE assertions
 *     runtime path en payment-list/form RED scope) Marco lock #5: drop type axis
 *     cambia path 2 prod consumer callsites — render path coverage MANDATORY per
 *     feedback_runtime_path_coverage_red_scope lección #12 6ta aplicación matures
 *     cumulative. Mirror A3-C5 + paired C3-C4 §13.A4-η load-bearing precedent
 *     EXACT pattern.
 *
 * Marco lock final RED scope C3 (15 assertions α single side payment — NO paired
 * sister, single feature axis):
 *
 *   ── A: Hex DTO file existence + structure (Tests 1-3) ──
 *   NEW canonical home hex local DTO mirror A3-C3 sale-with-details EXACT.
 *     T1 hex DTO file EXISTS at canonical home path
 *        modules/payment/presentation/dto/payment-with-relations.ts (FAIL pre-RED
 *        file NO existe)
 *     T2 hex DTO type alias `export type PaymentWithRelations = Omit<Payment,
 *        "amount">` (FAIL pre-RED file NO existe)
 *     T3 hex DTO 5 relations contact + period + journalEntry + operationalDocType
 *        + allocations preserved (FAIL pre-RED file NO existe)
 *
 *   ── B: Drop transition features/payment/payment.types.ts (Test 4) ──
 *   PaymentWithRelations type definition removed desde legacy types file.
 *     T4 features/payment/payment.types.ts NO contains `export type
 *        PaymentWithRelations = Omit<Payment, "amount">` definition (FAIL pre-RED
 *        línea 32-43 def present)
 *
 *   ── C: Callsites consumer swap evidence (Tests 5-7) ──
 *   2 prod callsites + mapper hex Opción A resolved a hex local DTO path.
 *     T5 components/payments/payment-list.tsx imports `PaymentWithRelations`
 *        type from `@/modules/payment/presentation/dto/payment-with-relations`
 *        (FAIL pre-RED línea 55 imports desde @/features/payment/payment.types)
 *     T6 components/payments/payment-form.tsx imports `PaymentWithRelations`
 *        type from `@/modules/payment/presentation/dto/payment-with-relations`
 *        (FAIL pre-RED línea 27 imports desde @/features/payment/payment.types)
 *     T7 modules/payment/presentation/mappers/payment-with-relations.mapper.ts
 *        imports `PaymentWithRelations` type from
 *        `@/modules/payment/presentation/dto/payment-with-relations` (FAIL pre-RED
 *        línea 5 imports desde @/features/payment/payment.types Opción A NEW
 *        §13.A pre-resolution NO-OP transitorio)
 *
 *   ── D: Mapper hex Opción A type import resolved negative (Test 8) ──
 *   §13.A NEW emergent NO-OP transitorio resolved — cross-module type-only
 *   import desde legacy features/ desaparece post-C3.
 *     T8 mapper hex source NO contains `import type { PaymentWithRelations }
 *        from "@/features/payment/payment.types"` (Opción A NEW §13.A NO-OP
 *        transitorio resolved Marco lock #4 §13.A status tentativo PROACTIVE — FAIL
 *        pre-RED línea 5 contains Opción A pre-resolution)
 *
 *   ── E: Runtime path coverage payment-list/form 4 PRESERVATION (Tests 9-12) ──
 *   §13.A5-γ DTO divergence runtime path coverage 6ta aplicación matures
 *   cumulative cross-POC post-cementación. PRESERVATION TESTS — pre-RED PASS
 *   porque render paths existing PaymentWithRelations consumer textualmente
 *   idéntico pre/post drop type axis. Lock post-GREEN render path preservation
 *   guard (consumer paths NO removed accidentally durante cutover swap import).
 *     T9 payment-list.tsx renders `<VoucherStatusBadge status={payment.status}`
 *        (PRESERVATION runtime path coverage status enum render path línea 174
 *        textualmente idéntico post-swap §13.A5-γ 6ta aplicación matures)
 *     T10 payment-list.tsx invokes `payment.allocations.reduce` sum
 *         (PRESERVATION runtime path coverage allocations summary render path
 *         línea 130 textualmente idéntico post-swap §13.A5-γ 6ta matures)
 *     T11 payment-list.tsx renders `payment.contact?.name ?? "---"` fallback
 *         (PRESERVATION runtime path coverage contact null branch fallback línea
 *         158 textualmente idéntico post-swap §13.A5-γ 6ta matures)
 *     T12 payment-form.tsx renders `existingPayment?.period?.name` fallback
 *         (PRESERVATION runtime path coverage period null branch fallback línea
 *         1167 textualmente idéntico post-swap §13.A5-γ 6ta matures)
 *
 *   ── F: Runtime path coverage edge null branches 2 PRESERVATION (Tests 13-14) ──
 *   §13.A5-γ DTO divergence edge case branches preservation guard.
 *     T13 payment-list.tsx renders `payment.operationalDocType.code` null
 *         branch (PRESERVATION runtime path edge operationalDocType render path
 *         línea 165 textualmente idéntico post-swap §13.A5-γ 6ta matures edge)
 *     T14 payment-form.tsx renders `existingPayment.journalEntry.number` null
 *         branch (PRESERVATION runtime path edge journalEntry POSTED render path
 *         línea 1737 textualmente idéntico post-swap §13.A5-γ 6ta matures edge)
 *
 *   ── G: Safety net forward-looking shim cascade (Test 15) ──
 *   features/payment/payment.service.ts internal shim cascade swap evidence —
 *   drop type axis fuerza relative `./payment.types` import path migration a hex
 *   local DTO (cascade lockguard — relative import path break post-drop tsc 17
 *   baseline preservation MANDATORY).
 *     T15 features/payment/payment.service.ts imports `PaymentWithRelations`
 *         type from `@/modules/payment/presentation/dto/payment-with-relations`
 *         (cascade swap forward-looking safety net — FAIL pre-RED línea 13-20
 *         imports desde "./payment.types" relative)
 *
 * Failure mode honest pre-RED declared (per feedback_red_acceptance_failure_mode):
 *   9/15 FAIL (Tests 1-8 + T15 cascade) + 6/15 PASS preservation post-state lock
 *   (Tests 9-14 runtime path coverage existing source textualmente idéntico
 *   pre/post drop type axis).
 *
 * Self-contained future-proof check: shape test asserta paths que persisten post
 * C4 wholesale delete `features/payment/`:
 *   - modules/payment/presentation/dto/payment-with-relations.ts persiste post-C4
 *     (hex local — extracted target NEW canonical home).
 *   - components/payments/payment-list.tsx + payment-form.tsx persisten post-C4
 *     (prod consumers, NEW canonical home stable post-cutover).
 *   - modules/payment/presentation/mappers/payment-with-relations.mapper.ts
 *     persiste post-C4 (hex local — type import path resolves a hex local DTO
 *     stable post-C4 wholesale).
 *   - features/payment/payment.types.ts SE BORRA C4 wholesale — Test 4
 *     auto-trivializa post-C4 (file ABSENT trivialmente NO contains type def).
 *     Acceptable temporal scope C3 lock — forward eliminado al wholesale C4
 *     atomic delete.
 *   - features/payment/payment.service.ts SE BORRA C4 wholesale — Test 15
 *     auto-trivializa post-C4 (file ABSENT trivialmente NO contains import).
 *     Acceptable temporal scope C3 lock — forward eliminado al wholesale C4.
 *
 * Source-string assertion pattern: mirror precedent C0-pre + C1 + C2 + paired-pr
 * C7-pre + C5-C6 + C3-C4 + C1b-α + C1a + C0 + A5-C2b (`fs.readFileSync` regex
 * match).
 *
 * Cross-ref:
 *   - architecture.md §13.A5-γ DTO divergence runtime path coverage (6ta
 *     aplicación post-cementación matures cumulative cross-POC payment C3)
 *   - architecture.md §13.A NEW emergent "hex presentation TYPE-only import desde
 *     legacy features/" cementación target D1 doc-only (2da evidencia formal
 *     post-cementación canonical PROACTIVE — Path β-prod resolves Opción A NO-OP
 *     transitorio precedent forward-applicable)
 *   - engram canonical home `arch/§13/A5-gamma-dto-divergence-runtime-path-coverage`
 *     #1582 (precedent — POC nuevo payment §13.A5-γ MATERIAL forward C3 6ta
 *     aplicación post-cementación cumulative)
 *   - engram canonical home `arch/§13/A-features-legacy-type-only-import` #1640
 *     (precedent — POC nuevo payment 1ra evidencia formal C2 + 2da evidencia
 *     resolution C3 Path β-prod precedent forward-applicable cualquier feature
 *     single con DTO type pendiente migration hex donde mapper extraction
 *     precede type drop axis)
 *   - engram bookmark `poc-nuevo/payment/c2/closed` #1641 (preceding cycle POC
 *     nuevo payment C2 — bookmark cycle-start cycle precedent EXACT)
 *   - modules/sale/presentation/dto/sale-with-details.ts (precedent A3-C3 build
 *     DTO presentation hex local canonical home EXACT mirror — interface
 *     SaleWithDetails extends Omit<Sale, "totalAmount"> NO server.ts barrel
 *     re-export, prod consumers importan DIRECTO desde dto/ subdir)
 *   - components/sales/sale-list.tsx:44 + sale-form.tsx:36 (precedent A3-C3
 *     prod consumer cross-feature swap import path EXACT mirror)
 *   - features/payment/payment.types.ts línea 32-43 (PaymentWithRelations type
 *     definition pre-drop axis — extracted to hex local DTO C3)
 *   - components/payments/payment-list.tsx línea 55 (prod consumer pre-swap
 *     import desde @/features/payment/payment.types)
 *   - components/payments/payment-form.tsx línea 27 (prod consumer pre-swap
 *     import desde @/features/payment/payment.types)
 *   - modules/payment/presentation/mappers/payment-with-relations.mapper.ts
 *     línea 5 (Opción A NEW §13.A pre-resolution NO-OP transitorio)
 *   - features/payment/payment.service.ts línea 13-20 (shim internal cascade
 *     swap pre-RED relative `./payment.types`)
 *   - feedback `red_acceptance_failure_mode` (failure mode honest declared 9/15
 *     FAIL + 6/15 PASS preservation pre-RED per discipline)
 *   - feedback `canonical_rule_application_commit_body` (cite + rationale +
 *     cross-ref + why-now applied RED body — Path β-prod + §13.A5-γ MATERIAL
 *     6ta aplicación matures + §13.A NO-OP transitorio resolved 2da evidencia
 *     formal)
 *   - feedback `commit_body_calibration` (verbose justified RED body locks Path
 *     β-prod resolution Opción A NO-OP transitorio + failure mode honest
 *     declared non-obvious tradeoff cementación target D1)
 *   - feedback `runtime_path_coverage_red_scope` (lección #12 6ta aplicación
 *     matures cumulative cross-POC payment C3 — runtime path coverage MANDATORY
 *     en RED scope drop type axis)
 *   - feedback `engram_textual_rule_verification` (textual citations §13.A5-γ +
 *     §13.A status tentativo verified architecture.md §13 cementación + Marco
 *     lock #4 textual canonical home pre-RED verified status tentativo PROACTIVE)
 *   - feedback `step-0-expand-eslint-restricted-imports-grep` (8 axes verified
 *     pre-RED Step 0 expand — Path β-prod resolves cross-module type-only import
 *     direction hex→legacy features R-features-legacy-type-import 8th axis a
 *     NO-OP transitorio post-C3)
 *   - feedback `sub_phase_start_coherence_gate` (bookmark↔repo coherence verify
 *     pre-RED Step 0 cold — clean +6 unpushed log cierra exacto en `0c79740` C2
 *     GREEN)
 *   - feedback `sub_phase_closure_bookmark_shape` (bookmark heredado #1641 file+
 *     assumption pairs verified Step 0 expand este turno)
 *   - feedback `jsdoc_atomic_revoke` (NO aplica este turn — C2 lock #2
 *     fetchWithRelations cleanup descartado scope C3 per Marco lock #2 Path γ
 *     rejected, defer C4 wholesale natural cleanup, NO revoke retroactivo)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

// ── C3 drop type axis Path β-prod targets ─────────────────────────────────

const HEX_DTO_FILE = path.join(
  REPO_ROOT,
  "modules/payment/presentation/dto/payment-with-relations.ts",
);
const LEGACY_TYPES_FILE = path.join(
  REPO_ROOT,
  "features/payment/payment.types.ts",
);
const PAYMENT_LIST_FILE = path.join(
  REPO_ROOT,
  "components/payments/payment-list.tsx",
);
const PAYMENT_FORM_FILE = path.join(
  REPO_ROOT,
  "components/payments/payment-form.tsx",
);
const MAPPER_HEX_FILE = path.join(
  REPO_ROOT,
  "modules/payment/presentation/mappers/payment-with-relations.mapper.ts",
);
const SHIM_PAYMENT_SERVICE = path.join(
  REPO_ROOT,
  "features/payment/payment.service.ts",
);

// ── Regex patterns ────────────────────────────────────────────────────────

const HEX_DTO_TYPE_ALIAS_RE =
  /export\s+type\s+PaymentWithRelations\s*=\s*Omit<\s*Payment\s*,\s*["']amount["']\s*>/;
const HEX_DTO_5_RELATIONS_RE =
  /export\s+type\s+PaymentWithRelations[\s\S]*?contact\s*:[\s\S]*?period\s*:[\s\S]*?journalEntry\s*:[\s\S]*?operationalDocType\s*:[\s\S]*?allocations\s*:/;
const LEGACY_PAYMENT_WITH_RELATIONS_DEF_RE =
  /^export\s+type\s+PaymentWithRelations\s*=\s*Omit<\s*Payment\s*,\s*["']amount["']\s*>/m;
const HEX_LOCAL_DTO_IMPORT_RE =
  /import\s+type\s+\{[^}]*\bPaymentWithRelations\b[^}]*\}\s+from\s+["']@\/modules\/payment\/presentation\/dto\/payment-with-relations["']/;
const LEGACY_OPCION_A_IMPORT_RE =
  /import\s+type\s+\{[^}]*\bPaymentWithRelations\b[^}]*\}\s+from\s+["']@\/features\/payment\/payment\.types["']/;
const VOUCHER_STATUS_BADGE_PAYMENT_RE =
  /<VoucherStatusBadge\s+status=\{\s*payment\.status\s*\}/;
const ALLOCATIONS_REDUCE_RE = /payment\.allocations\.reduce\(/;
const CONTACT_NAME_FALLBACK_RE =
  /payment\.contact\?\.\s*name\s*\?\?\s*["']---["']/;
const PERIOD_NAME_FALLBACK_RE = /existingPayment\?\.\s*period\?\.\s*name/;
const OPERATIONAL_DOC_TYPE_CODE_RE = /payment\.operationalDocType\.code/;
const JOURNAL_ENTRY_NUMBER_RE = /existingPayment\.journalEntry\.number/;

describe("POC nuevo payment C3 — drop type axis PaymentWithRelations + hex local DTO canonical home Path β-prod scope (mirror A3-C3 sale-with-details EXACT) + 2 prod callsites consumer cross-feature swap + mapper hex Opción A NEW §13.A NO-OP transitorio resolved + §13.A5-γ DTO divergence runtime path coverage 6ta aplicación matures cumulative cross-POC + §13.A NEW emergent classification 2da evidencia formal post-cementación canonical PROACTIVE pre-D1", () => {
  // ── A: Hex DTO file existence + structure (Tests 1-3) ────────────────────
  // NEW canonical home hex local DTO mirror A3-C3 sale-with-details EXACT.

  it("Test 1: modules/payment/presentation/dto/payment-with-relations.ts EXISTS at canonical home path (Path β-prod Marco lock #2 mirror A3-C3 sale-with-details EXACT precedent)", () => {
    expect(fs.existsSync(HEX_DTO_FILE)).toBe(true);
  });

  it("Test 2: hex DTO file declares type alias `export type PaymentWithRelations = Omit<Payment, \"amount\">` (Marco lock #2 Path β-prod hex local DTO canonical home shape preserves Decimal → number coerción intersection)", () => {
    const source = fs.readFileSync(HEX_DTO_FILE, "utf8");
    expect(source).toMatch(HEX_DTO_TYPE_ALIAS_RE);
  });

  it("Test 3: hex DTO 5 relations contact + period + journalEntry + operationalDocType + allocations preserved (mirror legacy features/payment/payment.types.ts líneas 32-43 EXACT)", () => {
    const source = fs.readFileSync(HEX_DTO_FILE, "utf8");
    expect(source).toMatch(HEX_DTO_5_RELATIONS_RE);
  });

  // ── B: Drop transition features/payment/payment.types.ts (Test 4) ───────
  // PaymentWithRelations type definition removed desde legacy types file.

  it("Test 4: features/payment/payment.types.ts NO contains `export type PaymentWithRelations = Omit<Payment, \"amount\">` definition (drop type axis transition Marco lock #2 — extracted a hex local DTO C3 Path β-prod)", () => {
    const source = fs.readFileSync(LEGACY_TYPES_FILE, "utf8");
    expect(source).not.toMatch(LEGACY_PAYMENT_WITH_RELATIONS_DEF_RE);
  });

  // ── C: Callsites consumer swap evidence (Tests 5-7) ─────────────────────
  // 2 prod callsites + mapper hex Opción A resolved a hex local DTO path.

  it("Test 5: components/payments/payment-list.tsx imports `PaymentWithRelations` type from `@/modules/payment/presentation/dto/payment-with-relations` (Marco lock #3 tight scope cross-feature swap — mirror A3-C3 sale-list precedent EXACT)", () => {
    const source = fs.readFileSync(PAYMENT_LIST_FILE, "utf8");
    expect(source).toMatch(HEX_LOCAL_DTO_IMPORT_RE);
  });

  it("Test 6: components/payments/payment-form.tsx imports `PaymentWithRelations` type from `@/modules/payment/presentation/dto/payment-with-relations` (Marco lock #3 tight scope cross-feature swap — mirror A3-C3 sale-form precedent EXACT)", () => {
    const source = fs.readFileSync(PAYMENT_FORM_FILE, "utf8");
    expect(source).toMatch(HEX_LOCAL_DTO_IMPORT_RE);
  });

  it("Test 7: modules/payment/presentation/mappers/payment-with-relations.mapper.ts imports `PaymentWithRelations` type from `@/modules/payment/presentation/dto/payment-with-relations` (Marco lock #2 Path β-prod hex local DTO resolution — Opción A NEW §13.A cross-module type-only import desde legacy features/ desaparece NO-OP transitorio resolved)", () => {
    const source = fs.readFileSync(MAPPER_HEX_FILE, "utf8");
    expect(source).toMatch(HEX_LOCAL_DTO_IMPORT_RE);
  });

  // ── D: Mapper hex Opción A type import resolved negative (Test 8) ───────
  // §13.A NEW emergent NO-OP transitorio resolved.

  it("Test 8: mapper hex source NO contains `import type { PaymentWithRelations } from \"@/features/payment/payment.types\"` (Opción A NEW §13.A cross-module type-only import desde legacy features/ resuelta NO-OP transitorio post-C3 Marco lock #4 §13.A status tentativo PROACTIVE — Path β-prod cementación target D1 documenta resolution precedent forward-applicable)", () => {
    const source = fs.readFileSync(MAPPER_HEX_FILE, "utf8");
    expect(source).not.toMatch(LEGACY_OPCION_A_IMPORT_RE);
  });

  // ── E: Runtime path coverage payment-list/form 4 PRESERVATION (Tests 9-12) ──
  // §13.A5-γ DTO divergence runtime path coverage 6ta aplicación matures.

  it("Test 9: payment-list.tsx renders `<VoucherStatusBadge status={payment.status}` (PRESERVATION runtime path coverage — pre-RED PASS render status enum path línea 174 textualmente idéntico post-swap §13.A5-γ 6ta aplicación matures cumulative cross-POC)", () => {
    const source = fs.readFileSync(PAYMENT_LIST_FILE, "utf8");
    expect(source).toMatch(VOUCHER_STATUS_BADGE_PAYMENT_RE);
  });

  it("Test 10: payment-list.tsx invokes `payment.allocations.reduce` sum (PRESERVATION runtime path coverage — pre-RED PASS allocations summary render path línea 130 textualmente idéntico post-swap §13.A5-γ 6ta aplicación matures cumulative)", () => {
    const source = fs.readFileSync(PAYMENT_LIST_FILE, "utf8");
    expect(source).toMatch(ALLOCATIONS_REDUCE_RE);
  });

  it("Test 11: payment-list.tsx renders `payment.contact?.name ?? \"---\"` fallback (PRESERVATION runtime path coverage — pre-RED PASS contact null branch fallback línea 158 textualmente idéntico post-swap §13.A5-γ 6ta aplicación matures cumulative)", () => {
    const source = fs.readFileSync(PAYMENT_LIST_FILE, "utf8");
    expect(source).toMatch(CONTACT_NAME_FALLBACK_RE);
  });

  it("Test 12: payment-form.tsx renders `existingPayment?.period?.name` fallback (PRESERVATION runtime path coverage — pre-RED PASS period null branch fallback línea 1167 textualmente idéntico post-swap §13.A5-γ 6ta aplicación matures cumulative)", () => {
    const source = fs.readFileSync(PAYMENT_FORM_FILE, "utf8");
    expect(source).toMatch(PERIOD_NAME_FALLBACK_RE);
  });

  // ── F: Runtime path coverage edge null branches 2 PRESERVATION (Tests 13-14) ──
  // §13.A5-γ DTO divergence edge case branches preservation guard.

  it("Test 13: payment-list.tsx renders `payment.operationalDocType.code` null branch (PRESERVATION runtime path edge — pre-RED PASS operationalDocType render path línea 165 textualmente idéntico post-swap §13.A5-γ 6ta aplicación matures cumulative edge case)", () => {
    const source = fs.readFileSync(PAYMENT_LIST_FILE, "utf8");
    expect(source).toMatch(OPERATIONAL_DOC_TYPE_CODE_RE);
  });

  it("Test 14: payment-form.tsx renders `existingPayment.journalEntry.number` null branch (PRESERVATION runtime path edge — pre-RED PASS journalEntry POSTED render path línea 1737 textualmente idéntico post-swap §13.A5-γ 6ta aplicación matures cumulative edge case)", () => {
    const source = fs.readFileSync(PAYMENT_FORM_FILE, "utf8");
    expect(source).toMatch(JOURNAL_ENTRY_NUMBER_RE);
  });

  // ── G: Safety net forward-looking shim cascade (Test 15) ────────────────
  // features/payment/payment.service.ts internal shim cascade swap evidence.

  it("Test 15: features/payment/payment.service.ts imports `PaymentWithRelations` type from `@/modules/payment/presentation/dto/payment-with-relations` (cascade swap forward-looking safety net — drop type axis fuerza relative `./payment.types` import path migration a hex local DTO post-C3, tsc 17 baseline preservation MANDATORY)", () => {
    const source = fs.readFileSync(SHIM_PAYMENT_SERVICE, "utf8");
    expect(source).toMatch(HEX_LOCAL_DTO_IMPORT_RE);
  });
});
