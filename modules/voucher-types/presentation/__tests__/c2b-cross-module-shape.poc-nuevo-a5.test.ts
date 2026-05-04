/**
 * POC nuevo A5-C2b — voucher-types Cat 3 cross-module cleanup shape
 * (Path α'' atomic batch single-batch source 4 archivos cross-module).
 *
 * Axis: cleanup atomic 4 archivos cross-module consumers — NO hex addition
 * required (factories `makeVoucherTypeRepository` + `makeVoucherTypesService`
 * ya existen post A5-C2a commit `f1b9d9d`). §13.A5-α formal continuation
 * cementada A5-C2a (4ta evidencia matures cumulative cross-§13 same POC) —
 * resolution mecánica path swap + factory swap + type swap. NO §13 emergentes
 * nuevos pre-RED A5-C2b (signature parity verify Shape β confirmed parity
 * Step 0 expand este turno — hex `getById(orgId, id) → Promise<VoucherType>`
 * 100% signature-parity legacy shim, divergence solo return-type (entity con
 * VOs vs POJO `VoucherTypeCfg`) NO §13.A5-γ aplica callsite voucher-types-read
 * .adapter L19 narrow `{ id: voucherType.id }` primitive-only access — mirror
 * engram #1582 pattern non-breaking primitive-only).
 *
 * 4 archivos cross-module scope (verificados Step 0 expand cycle-start A5-C2b):
 *   ── Shape α composition-root cross-module Repository concreto directo (2 archivos) ──
 *     - modules/sale/presentation/composition-root.ts (L5: VoucherTypesRepository import + L55: new ctor singleton + L56 pasa a AutoEntryGenerator ctor)
 *     - modules/purchase/presentation/composition-root.ts (L5+L59 mirror exacto sale)
 *
 *   ── Shape β read adapter cross-module Service concreto directo (1 archivo) ──
 *     - modules/accounting/infrastructure/voucher-types-read.adapter.ts (L1: VoucherTypesService import + L7: new ctor singleton module-level + L18: legacy.getById narrow 8→1 field)
 *
 *   ── Shape γ optional fallback Repository type+concreto mixto (1 archivo) — sub-shape nuevo NO precedent EXACT A5-C2a ──
 *     - modules/payment/infrastructure/adapters/legacy-accounting.adapter.ts (L9: VoucherTypesRepository import + L43: voucherTypesRepo?: VoucherTypesRepository plural type signature ctor deps + L51: ?? new VoucherTypesRepository() fallback default ctor pasa a AutoEntryGenerator)
 *
 * Marco lock final RED scope (13 assertions α — granular per callsite asimétrico α/β/γ):
 *   ── Cross-module source cutover (Tests 1-8) ──
 *   - Tests 1-4 POSITIVE hex import present (4 archivos):
 *       T1 sale comp-root → from "@/modules/voucher-types/presentation/server"
 *       T2 purchase comp-root → idem mirror
 *       T3 voucher-types-read.adapter → idem
 *       T4 legacy-accounting.adapter → idem
 *   - Tests 5-8 NEGATIVE legacy import absent (4 archivos):
 *       T5-T8 NO from "@/features/voucher-types/server"
 *
 *   ── Cross-module factory callsite asimétrico α/β/γ (Tests 9-12) ──
 *   §13.A5-α resolution Option B Marco lock — factory swap distinto per consumer:
 *       T9  sale comp-root      → makeVoucherTypeRepository() AND NOT new VoucherTypesRepository() (Shape α)
 *       T10 purchase comp-root  → idem mirror Shape α
 *       T11 voucher-types-read.adapter → makeVoucherTypesService() AND NOT new VoucherTypesService() (Shape β)
 *       T12 legacy-accounting.adapter  → makeVoucherTypeRepository() AND NOT new VoucherTypesRepository() (Shape γ fallback ?? cleanest Marco lock #1 cycle-start A5-C2b — factory swap fallback NO constructor directo residual)
 *
 *   ── Type signature swap Shape γ (Test 13) — legacy-accounting deps ctor ──
 *   Mirror A5-C2a auto-entry-generator type swap pattern (engram #1588 cite):
 *   `type VoucherTypesRepository` → `type VoucherTypeRepository` singular hex
 *   port name. En legacy-accounting field es opcional ctor deps signature (L43)
 *   NO type-only import puro como auto-entry-generator (eso es solo type
 *   signature en interface, runtime type-only):
 *       T13 legacy-accounting.adapter → voucherTypesRepo?: VoucherTypeRepository singular
 *           AND NOT voucherTypesRepo?: VoucherTypesRepository plural
 *
 * §13.A5-α matures cumulative cross-evidencia 4ta (post A4-α + A5-α A5-C2a 3ra)
 * — pattern multi-level composition-root delegation + hex factory addition
 * resolution Option B + 1ra evidencia formal cementación cross-§13 same POC
 * paired sister A5-C2a A5-C2b. Engram canonical home `arch/§13/A5-alpha-multi-
 * level-composition-root-delegation` ya cementado A5-C2a — A5-C2b NO require
 * re-cementación, solo paired sister cross-ref this turn.
 *
 * §13.A5-γ DTO divergence — DESCARTADO Shape β este callsite específico
 * (verified Step 0 expand): voucher-types-read.adapter L19 narrow `{ id:
 * voucherType.id }` primitive-only post-call. Hex entity `VoucherType` expone
 * `.id` como primitive (mirror engram #1588 "auto-entry-generator accede
 * `voucherType.id` primitive-only" + #1582 "Non-breaking primitive-only
 * `.id`/`.name`/`.isActive` primitives entity props"). NO `.toSnapshot()`
 * adapter required.
 *
 * §13.A5-ε method-level signature divergence — DESCARTADO Shape β este callsite
 * (verified Step 0 expand): legacy shim `VoucherTypesService.getById` 100%
 * delegado al hex (L37-38 features/voucher-types/server.ts: `const entity =
 * await makeVoucherTypesService().getById(orgId, id); return toLegacyShape(
 * entity);`) — NO embedded shim logic (NO defaults injection NO tx-aware
 * factory branching). Pattern §13.A5-ε requiere shim NO-100% delegado con
 * embedded logic — este caso 100% delegado solo `toLegacyShape(entity)`
 * post-call narrow. Method+args+throws parity confirmed Step 0 expand.
 *
 * Sub-shape γ optional fallback NO precedent EXACT A5-C2a — combinación
 * type-only signature (mirror auto-entry-generator A5-C2a §13.A5-δ candidate
 * deferred A5-D1) + concreto fallback (`?? new` defaulting mirror dispatch
 * .service A5-C2a Shape α). 1ra evidencia sola NO justifica formal cementación
 * §13 nueva — sub-finding honest mention commit body GREEN A5-C2b.
 *
 * Expected RED failure mode pre-GREEN (per feedback_red_acceptance_failure_mode):
 * - T1-T4 FAIL: 4 cross-module archivos todavía importan @/features/voucher-types
 *   /server, regex match @/modules/voucher-types/presentation/server falla.
 * - T5-T8 FAIL: legacy imports presentes, regex match negativo no se cumple.
 * - T9-T10 FAIL: `new VoucherTypesRepository()` callsites todavía presentes
 *   y `makeVoucherTypeRepository()` ausente en sale + purchase comp-roots.
 * - T11 FAIL: `new VoucherTypesService()` callsite presente y `makeVoucherTypesService()`
 *   ausente en voucher-types-read.adapter.
 * - T12 FAIL: `?? new VoucherTypesRepository()` fallback callsite presente y
 *   `makeVoucherTypeRepository()` ausente en legacy-accounting.adapter.
 * - T13 FAIL: `voucherTypesRepo?: VoucherTypesRepository` plural type signature
 *   pre-cutover, regex match `VoucherTypeRepository` singular hex port falla.
 * Total expected FAIL pre-GREEN: 13/13 (Marco mandate failure mode honest).
 *
 * Self-contained future-proof check (lección A6 #5): shape test asserta paths
 * que persisten post A5-C3 atomic delete `features/voucher-types/` wholesale.
 * NO toca features/voucher-types/* que A5-C3 borra. Self-contained vs future
 * deletes ✓.
 *
 * Source-string assertion pattern: mirror precedent A5-C2a
 * `modules/voucher-types/presentation/__tests__/c2a-cross-feature-shape.poc-nuevo-a5.test.ts`
 * (RED commit `b853164` + GREEN `f1b9d9d`) — extends scope cross-feature →
 * cross-module 4 archivos asimétrico α/β/γ.
 *
 * Cross-ref:
 *   - architecture.md §13.7 #2/#10/#10-skippable/#12/#13/#14 (lecciones aplicadas RED scope)
 *   - architecture.md §13.A4-α DTO divergence (precedent paired sister §13.A5-γ A5-C1)
 *   - engram `arch/§13/A5-alpha-multi-level-composition-root-delegation` (formal cementación A5-C2a — 4ta evidencia matures cumulative this RED A5-C2b)
 *   - engram `poc-nuevo/a5/13-alpha-multi-level-composition-root` (paired sister)
 *   - engram `poc-nuevo/a5/c2a-closed` #1591 (cycle-start bookmark A5-C2b)
 *   - engram `poc-nuevo/a5/pre-recon-comprehensive` #1579 (inventory full Cat 1+2+3+4)
 *   - engram `arch/§13/A5-epsilon-method-signature-shim-divergence` #1590 (precedent paired sister verify Shape β NO §13.A5-ε continuation)
 *   - engram `arch/§13/A5-gamma-dto-divergence-runtime-path-coverage` #1582 (precedent paired sister verify Shape β NO §13.A5-γ continuation)
 *   - modules/voucher-types/presentation/server.ts (hex barrel — factory ya existe post A5-C2a)
 *   - modules/voucher-types/presentation/composition-root.ts (factory makeVoucherTypeRepository ya existe post A5-C2a)
 *   - modules/voucher-types/presentation/__tests__/c2a-cross-feature-shape.poc-nuevo-a5.test.ts (precedent shape A5-C2a RED `b853164` + GREEN `f1b9d9d`)
 *   - modules/voucher-types/presentation/__tests__/c1-cutover-shape.poc-nuevo-a5.test.ts (precedent shape A5-C1)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

// ── Cat 3 source cleanup targets cross-module (4 archivos α/β/γ) ─────────────

const SALE_COMP_ROOT = path.join(
  REPO_ROOT,
  "modules/sale/presentation/composition-root.ts",
);
const PURCHASE_COMP_ROOT = path.join(
  REPO_ROOT,
  "modules/purchase/presentation/composition-root.ts",
);
const VOUCHER_TYPES_READ_ADAPTER = path.join(
  REPO_ROOT,
  "modules/accounting/infrastructure/voucher-types-read.adapter.ts",
);
const LEGACY_ACCOUNTING_ADAPTER = path.join(
  REPO_ROOT,
  "modules/payment/infrastructure/adapters/legacy-accounting.adapter.ts",
);

// ── Regex patterns ───────────────────────────────────────────────────────────

const HEX_SERVER_RE =
  /from\s*["']@\/modules\/voucher-types\/presentation\/server["']/;
const LEGACY_SERVER_RE = /from\s*["']@\/features\/voucher-types\/server["']/;

const MAKE_SERVICE_FACTORY_RE = /makeVoucherTypesService\(\)/;
const NEW_SERVICE_CTOR_RE = /new\s+VoucherTypesService\s*\(\s*\)/;
const MAKE_REPO_FACTORY_RE = /makeVoucherTypeRepository\(\)/;
const NEW_REPO_CTOR_RE = /new\s+VoucherTypesRepository\s*\(\s*\)/;

const TYPE_HEX_REPO_RE = /voucherTypesRepo\?:\s*VoucherTypeRepository\b/;
const TYPE_LEGACY_REPO_RE = /voucherTypesRepo\?:\s*VoucherTypesRepository\b/;

describe("POC nuevo A5-C2b — voucher-types Cat 3 cross-module cleanup shape (§13.A5-α matures 4ta evidencia paired sister A5-C2a)", () => {
  // ── POSITIVE source-shape (Tests 1-4) — hex import present (4 cross-module) ──

  it("Test 1: sale comp-root imports from hex presentation/server (Shape α)", () => {
    const source = fs.readFileSync(SALE_COMP_ROOT, "utf8");
    expect(source).toMatch(HEX_SERVER_RE);
  });

  it("Test 2: purchase comp-root imports from hex presentation/server (Shape α mirror)", () => {
    const source = fs.readFileSync(PURCHASE_COMP_ROOT, "utf8");
    expect(source).toMatch(HEX_SERVER_RE);
  });

  it("Test 3: voucher-types-read.adapter imports from hex presentation/server (Shape β)", () => {
    const source = fs.readFileSync(VOUCHER_TYPES_READ_ADAPTER, "utf8");
    expect(source).toMatch(HEX_SERVER_RE);
  });

  it("Test 4: legacy-accounting.adapter imports from hex presentation/server (Shape γ)", () => {
    const source = fs.readFileSync(LEGACY_ACCOUNTING_ADAPTER, "utf8");
    expect(source).toMatch(HEX_SERVER_RE);
  });

  // ── NEGATIVE source-shape (Tests 5-8) — legacy import absent (4 cross-module) ─

  it("Test 5: sale comp-root does NOT import from legacy @/features/voucher-types/server", () => {
    const source = fs.readFileSync(SALE_COMP_ROOT, "utf8");
    expect(source).not.toMatch(LEGACY_SERVER_RE);
  });

  it("Test 6: purchase comp-root does NOT import from legacy @/features/voucher-types/server", () => {
    const source = fs.readFileSync(PURCHASE_COMP_ROOT, "utf8");
    expect(source).not.toMatch(LEGACY_SERVER_RE);
  });

  it("Test 7: voucher-types-read.adapter does NOT import from legacy @/features/voucher-types/server", () => {
    const source = fs.readFileSync(VOUCHER_TYPES_READ_ADAPTER, "utf8");
    expect(source).not.toMatch(LEGACY_SERVER_RE);
  });

  it("Test 8: legacy-accounting.adapter does NOT import from legacy @/features/voucher-types/server", () => {
    const source = fs.readFileSync(LEGACY_ACCOUNTING_ADAPTER, "utf8");
    expect(source).not.toMatch(LEGACY_SERVER_RE);
  });

  // ── POSITIVE factory callsite asimétrico α/β/γ (Tests 9-12) ─────────────────
  // §13.A5-α resolution Option B Marco lock — factory swap distinto per consumer:
  // Shape α sale+purchase composition-root → makeVoucherTypeRepository (factory hex addition cementada A5-C2a)
  // Shape β voucher-types-read.adapter    → makeVoucherTypesService (factory existente)
  // Shape γ legacy-accounting.adapter ??  → makeVoucherTypeRepository (fallback cleanest Marco lock #1 cycle-start A5-C2b)

  it("Test 9: sale comp-root uses makeVoucherTypeRepository() factory and NOT new VoucherTypesRepository() (Shape α)", () => {
    const source = fs.readFileSync(SALE_COMP_ROOT, "utf8");
    expect(source).toMatch(MAKE_REPO_FACTORY_RE);
    expect(source).not.toMatch(NEW_REPO_CTOR_RE);
  });

  it("Test 10: purchase comp-root uses makeVoucherTypeRepository() factory and NOT new VoucherTypesRepository() (Shape α mirror)", () => {
    const source = fs.readFileSync(PURCHASE_COMP_ROOT, "utf8");
    expect(source).toMatch(MAKE_REPO_FACTORY_RE);
    expect(source).not.toMatch(NEW_REPO_CTOR_RE);
  });

  it("Test 11: voucher-types-read.adapter uses makeVoucherTypesService() factory and NOT new VoucherTypesService() (Shape β)", () => {
    const source = fs.readFileSync(VOUCHER_TYPES_READ_ADAPTER, "utf8");
    expect(source).toMatch(MAKE_SERVICE_FACTORY_RE);
    expect(source).not.toMatch(NEW_SERVICE_CTOR_RE);
  });

  it("Test 12: legacy-accounting.adapter uses makeVoucherTypeRepository() factory in fallback ?? and NOT new VoucherTypesRepository() (Shape γ fallback cleanest Marco lock #1 cycle-start A5-C2b)", () => {
    const source = fs.readFileSync(LEGACY_ACCOUNTING_ADAPTER, "utf8");
    expect(source).toMatch(MAKE_REPO_FACTORY_RE);
    expect(source).not.toMatch(NEW_REPO_CTOR_RE);
  });

  // ── Type signature swap Shape γ (Test 13) — legacy-accounting deps ctor ────
  // Mirror A5-C2a auto-entry-generator type swap pattern (engram #1588):
  // `VoucherTypesRepository` plural class → `VoucherTypeRepository` singular hex port.

  it("Test 13: legacy-accounting.adapter ctor deps signature uses VoucherTypeRepository singular hex port (NOT VoucherTypesRepository plural) (Shape γ type swap)", () => {
    const source = fs.readFileSync(LEGACY_ACCOUNTING_ADAPTER, "utf8");
    expect(source).toMatch(TYPE_HEX_REPO_RE);
    expect(source).not.toMatch(TYPE_LEGACY_REPO_RE);
  });
});
