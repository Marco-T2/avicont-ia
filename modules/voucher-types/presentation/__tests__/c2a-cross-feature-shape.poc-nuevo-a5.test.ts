/**
 * POC nuevo A5-C2a — voucher-types Cat 3 cross-feature cleanup shape
 * (Path α'' atomic batch single-batch source 4 archivos cross-feature).
 *
 * Axis: cleanup atomic 4 archivos cross-feature consumers + 2 archivos hex
 * addition new factory (composition-root export + server.ts re-export).
 * §13.A5-α formal cementación PROACTIVE pre-RED — multi-level composition-root
 * delegation pattern resolution via hex factory addition `makeVoucherTypeRepository()`.
 *
 * 4 archivos cross-feature scope (verificados Step 0 expand cycle-start A5-C2a):
 *   - features/accounting/journal.service.ts (line 32+83: VoucherTypesService import + new ctor default)
 *   - features/accounting/auto-entry-generator.ts (line 10: type-only VoucherTypesRepository import — NO new ctor)
 *   - features/dispatch/dispatch.service.ts (line 30+177: VoucherTypesRepository import + new ctor DI to AutoEntryGenerator)
 *   - features/organizations/organizations.service.ts (line 8+28: VoucherTypesService import + new ctor default)
 *
 * 2 archivos hex addition new factory (Marco lock Option B):
 *   - modules/voucher-types/presentation/composition-root.ts (NEW: makeVoucherTypeRepository factory)
 *   - modules/voucher-types/presentation/server.ts (NEW: export makeVoucherTypeRepository)
 *
 * Marco lock final RED scope (~13 assertions α — granular per callsite asimétrico):
 *   ── Cross-feature source cutover (Tests 1-6) ──
 *   - Tests 1-3 POSITIVE hex import present (3 concrete files):
 *       T1 journal.service.ts → from "@/modules/voucher-types/presentation/server"
 *       T2 dispatch.service.ts → idem
 *       T3 organizations.service.ts → idem
 *   - Tests 4-6 NEGATIVE legacy import absent (3 concrete files):
 *       T4-T6 NO from "@/features/voucher-types/server"
 *
 *   ── Cross-feature factory callsite asimétrico per-class-type (Tests 7-9) ──
 *   §13.A5-α resolution Option B: factory invocation distinto per consumer:
 *       T7 journal.service.ts → makeVoucherTypesService() AND NOT new VoucherTypesService()
 *       T8 organizations.service.ts → idem (mismo factory existing)
 *       T9 dispatch.service.ts → makeVoucherTypeRepository() AND NOT new VoucherTypesRepository()
 *           (factory NEW hex addition this commit Option B)
 *
 *   ── Type-only import (Tests 10-11) — §13.A5-δ candidate ──
 *   §13.A5-δ candidate type-only asymmetry DEFER A5-D1 cumulative — RED scope
 *   subset sin makeFactory porque type-only NO instancia (1ra evidencia sola NO
 *   justifica formal cementación PROACTIVE — sub-finding honest mention commit
 *   body, mirror precedent §13.7 entry #14 cumulative arithmetic 2 evidencias
 *   paired sister timing):
 *       T10 auto-entry-generator.ts → from "@/modules/voucher-types/presentation/server"
 *       T11 auto-entry-generator.ts → NOT from "@/features/voucher-types/server"
 *
 *   ── Hex factory addition (Tests 12-13) ──
 *   §13.A5-α resolution Option B: hex addition new factory `makeVoucherTypeRepository()`
 *   preserve granularity split A5-C2a 4 / A5-C2b 4 vs Option A signature cascade
 *   rechazada (forzaría merge atomic violating split lock #1):
 *       T12 modules/voucher-types/presentation/composition-root.ts contains
 *           `export function makeVoucherTypeRepository`
 *       T13 modules/voucher-types/presentation/server.ts re-exports
 *           `makeVoucherTypeRepository,` from composition-root
 *
 * §13.A5-α formal cementación PROACTIVE pre-RED A5-C2a — engram canonical
 * home `arch/§13/A5-alpha-multi-level-composition-root-delegation` paired
 * sister `poc-nuevo/a5/13-alpha-multi-level-composition-root` (Step 2 sequence
 * batch save this turn). Marco re-lock Option B confirmed pre-RED (Option A
 * signature cascade rechazada — cascade 5 archivos AutoEntryGenerator forzaría
 * merge A5-C2a+A5-C2b atomic violating granularity split lock #1).
 *
 * §13.A5-γ NO aplica A5-C2a (verified Step 0 expand): auto-entry-generator
 * accede `voucherType.id` primitive-only (line 131) post-cutover — mirror
 * engram #1582 "non-breaking primitive-only" pattern. Service `getByCode()`
 * retorna entity con VOs (`code: VoucherTypeCode`, `prefix: VoucherTypePrefix`)
 * pero callsite consume solo `.id` primitive — NO `.toSnapshot()` adapter
 * required.
 *
 * §13.A5-δ candidate type-only import asymmetry DEFER A5-D1 doc-only post-mortem
 * cumulative (Marco lock 2 cycle-start A5-C2a) — auto-entry-generator type-only
 * RED scope subset assertion 2 (sin makeFactory porque type-only NO instancia).
 * 1ra evidencia sola NO justifica formal cementación PROACTIVE — forward-applicable
 * hypothesis hasta 2da evidencia paired sister POC futuro. Sub-finding honest
 * mention commit body + cross-ref A5-D1 catalog candidate.
 *
 * Expected RED failure mode pre-GREEN (per feedback_red_acceptance_failure_mode):
 * - T1-T3 FAIL: 3 concrete archivos todavía importan @/features/voucher-types/server,
 *   regex match @/modules/voucher-types/presentation/server falla.
 * - T4-T6 FAIL: legacy imports presentes, regex match negativo no se cumple.
 * - T7-T8 FAIL: `new VoucherTypesService()` callsites todavía presentes
 *   y `makeVoucherTypesService()` ausente en journal.service + organizations.service.
 * - T9 FAIL: `new VoucherTypesRepository()` callsite presente y
 *   `makeVoucherTypeRepository()` ausente en dispatch.service.
 * - T10 FAIL: auto-entry-generator todavía importa legacy, hex regex match falla.
 * - T11 FAIL: legacy import presente.
 * - T12 FAIL: composition-root.ts NO contiene `export function makeVoucherTypeRepository`
 *   pre-cutover (factory NO existe — gap hex pre-RED identified Step 0 expand).
 * - T13 FAIL: server.ts NO re-exporta `makeVoucherTypeRepository` pre-cutover.
 * Total expected FAIL pre-GREEN: 13/13 (Marco mandate failure mode honest).
 *
 * Self-contained future-proof check (lección A6 #5): shape test asserta paths
 * que persisten post A5-C3 atomic delete `features/voucher-types/` wholesale.
 * NO toca features/voucher-types/* que A5-C3 borra. Self-contained vs future
 * deletes ✓.
 *
 * Source-string assertion pattern: mirror precedent A4-C2
 * `modules/org-settings/presentation/__tests__/c2-cleanup-shape.poc-nuevo-a4.test.ts`
 * (RED commit `3951d05` + GREEN `2a33993`) + A5-C1 precedent
 * `modules/voucher-types/presentation/__tests__/c1-cutover-shape.poc-nuevo-a5.test.ts`
 * (RED `9a4c51b` + GREEN `cfab7aa`).
 *
 * Drift correction commit hash bookmark prompt-level `2a33933` → ground truth
 * `2a33993` (1-char typo `9→3` posición 5) — re-resolved Step 0 expand via
 * `git log --grep "A4-C2 GREEN"` PROACTIVE. NO §13 emergente formal — drift
 * prompt-level NO master, historical accuracy mention commit body (mirror
 * §13.A3-D3-α pattern).
 *
 * Cross-ref:
 *   - architecture.md §13.7 #2/#10/#10-skippable/#12/#13/#14 (lecciones aplicadas RED scope)
 *   - architecture.md §13.A4-α DTO divergence (precedent paired sister §13.A5-γ)
 *   - engram `arch/§13/A5-alpha-multi-level-composition-root-delegation` (formal cementación PROACTIVE pre-RED — Step 2 batch this session)
 *   - engram `poc-nuevo/a5/13-alpha-multi-level-composition-root` (paired sister)
 *   - engram `arch/§13/A5-gamma-dto-divergence-runtime-path-coverage` #1582 (paired sister cumulative §13.A5-γ A5-C1)
 *   - engram `poc-nuevo/a5/c1-closed` #1585 (cycle-start bookmark A5-C2a)
 *   - engram `poc-nuevo/a5/pre-recon-comprehensive` #1579 (inventory + cross-ref §13.A5-α append this batch)
 *   - engram `poc-futuro/a5-voucher-types/pre-recon-comprehensive` #1580 (paired sister)
 *   - modules/voucher-types/presentation/server.ts (hex barrel + factory addition target)
 *   - modules/voucher-types/presentation/composition-root.ts (factory makeVoucherTypeRepository new addition)
 *   - modules/org-settings/presentation/__tests__/c2-cleanup-shape.poc-nuevo-a4.test.ts (precedent shape A4-C2 RED `3951d05` + GREEN `2a33993`)
 *   - modules/voucher-types/presentation/__tests__/c1-cutover-shape.poc-nuevo-a5.test.ts (precedent shape A5-C1)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

// ── Cat 3 source cleanup targets cross-feature (4 archivos) ──────────────────

const JOURNAL_SERVICE = path.join(
  REPO_ROOT,
  "features/accounting/journal.service.ts",
);
const AUTO_ENTRY_GENERATOR = path.join(
  REPO_ROOT,
  "features/accounting/auto-entry-generator.ts",
);
const DISPATCH_SERVICE = path.join(
  REPO_ROOT,
  "features/dispatch/dispatch.service.ts",
);
const ORGANIZATIONS_SERVICE = path.join(
  REPO_ROOT,
  "features/organizations/organizations.service.ts",
);

// ── Hex addition new factory targets (2 archivos) ────────────────────────────

const HEX_COMPOSITION_ROOT = path.join(
  REPO_ROOT,
  "modules/voucher-types/presentation/composition-root.ts",
);
const HEX_SERVER = path.join(
  REPO_ROOT,
  "modules/voucher-types/presentation/server.ts",
);

// ── Regex patterns ───────────────────────────────────────────────────────────

const HEX_SERVER_RE =
  /from\s*["']@\/modules\/voucher-types\/presentation\/server["']/;
const LEGACY_SERVER_RE = /from\s*["']@\/features\/voucher-types\/server["']/;

const MAKE_SERVICE_FACTORY_RE = /makeVoucherTypesService\(\)/;
const NEW_SERVICE_CTOR_RE = /new\s+VoucherTypesService\s*\(\s*\)/;
const MAKE_REPO_FACTORY_RE = /makeVoucherTypeRepository\(\)/;
const NEW_REPO_CTOR_RE = /new\s+VoucherTypesRepository\s*\(\s*\)/;

const HEX_FACTORY_EXPORT_RE = /export\s+function\s+makeVoucherTypeRepository/;
const HEX_FACTORY_REEXPORT_RE = /makeVoucherTypeRepository\s*,/;

describe("POC nuevo A5-C2a — voucher-types Cat 3 cross-feature cleanup shape (§13.A5-α factory hex addition Option B)", () => {
  // ── POSITIVE source-shape (Tests 1-3) — hex import present (3 concrete) ───

  it("Test 1: journal.service.ts imports VoucherTypesService factory from hex presentation/server", () => {
    const source = fs.readFileSync(JOURNAL_SERVICE, "utf8");
    expect(source).toMatch(HEX_SERVER_RE);
  });

  it("Test 2: dispatch.service.ts imports VoucherTypeRepository factory from hex presentation/server", () => {
    const source = fs.readFileSync(DISPATCH_SERVICE, "utf8");
    expect(source).toMatch(HEX_SERVER_RE);
  });

  it("Test 3: organizations.service.ts imports VoucherTypesService factory from hex presentation/server", () => {
    const source = fs.readFileSync(ORGANIZATIONS_SERVICE, "utf8");
    expect(source).toMatch(HEX_SERVER_RE);
  });

  // ── NEGATIVE source-shape (Tests 4-6) — legacy import absent (3 concrete) ─

  it("Test 4: journal.service.ts does NOT import from legacy @/features/voucher-types/server", () => {
    const source = fs.readFileSync(JOURNAL_SERVICE, "utf8");
    expect(source).not.toMatch(LEGACY_SERVER_RE);
  });

  it("Test 5: dispatch.service.ts does NOT import from legacy @/features/voucher-types/server", () => {
    const source = fs.readFileSync(DISPATCH_SERVICE, "utf8");
    expect(source).not.toMatch(LEGACY_SERVER_RE);
  });

  it("Test 6: organizations.service.ts does NOT import from legacy @/features/voucher-types/server", () => {
    const source = fs.readFileSync(ORGANIZATIONS_SERVICE, "utf8");
    expect(source).not.toMatch(LEGACY_SERVER_RE);
  });

  // ── POSITIVE factory callsite asimétrico per-class-type (Tests 7-9) ───────
  // §13.A5-α resolution Option B Marco lock — service factory existing
  // (T7-T8 makeVoucherTypesService) + repository factory new hex addition
  // (T9 dispatch.service makeVoucherTypeRepository).

  it("Test 7: journal.service.ts uses makeVoucherTypesService() factory and NOT new VoucherTypesService()", () => {
    const source = fs.readFileSync(JOURNAL_SERVICE, "utf8");
    expect(source).toMatch(MAKE_SERVICE_FACTORY_RE);
    expect(source).not.toMatch(NEW_SERVICE_CTOR_RE);
  });

  it("Test 8: organizations.service.ts uses makeVoucherTypesService() factory and NOT new VoucherTypesService()", () => {
    const source = fs.readFileSync(ORGANIZATIONS_SERVICE, "utf8");
    expect(source).toMatch(MAKE_SERVICE_FACTORY_RE);
    expect(source).not.toMatch(NEW_SERVICE_CTOR_RE);
  });

  it("Test 9: dispatch.service.ts uses makeVoucherTypeRepository() factory and NOT new VoucherTypesRepository() (§13.A5-α hex factory addition Option B)", () => {
    const source = fs.readFileSync(DISPATCH_SERVICE, "utf8");
    expect(source).toMatch(MAKE_REPO_FACTORY_RE);
    expect(source).not.toMatch(NEW_REPO_CTOR_RE);
  });

  // ── Type-only import (Tests 10-11) — auto-entry-generator §13.A5-δ cand ──
  // §13.A5-δ candidate type-only import asymmetry DEFER A5-D1 cumulative
  // (Marco lock 2 cycle-start A5-C2a). RED scope subset sin makeFactory
  // porque type-only NO instancia. Sub-finding honest mention commit body.

  it("Test 10: auto-entry-generator.ts imports VoucherTypeRepository type from hex presentation/server", () => {
    const source = fs.readFileSync(AUTO_ENTRY_GENERATOR, "utf8");
    expect(source).toMatch(HEX_SERVER_RE);
  });

  it("Test 11: auto-entry-generator.ts does NOT import from legacy @/features/voucher-types/server", () => {
    const source = fs.readFileSync(AUTO_ENTRY_GENERATOR, "utf8");
    expect(source).not.toMatch(LEGACY_SERVER_RE);
  });

  // ── Hex factory addition (Tests 12-13) — composition-root + server.ts ────
  // §13.A5-α resolution Option B Marco lock — factory new hex addition
  // `makeVoucherTypeRepository()` preserve granularity split A5-C2a 4 /
  // A5-C2b 4 vs Option A signature cascade rechazada (forzaría merge atomic
  // violating granularity split lock #1).

  it("Test 12: modules/voucher-types/presentation/composition-root.ts contains export function makeVoucherTypeRepository (§13.A5-α hex factory addition Option B)", () => {
    const source = fs.readFileSync(HEX_COMPOSITION_ROOT, "utf8");
    expect(source).toMatch(HEX_FACTORY_EXPORT_RE);
  });

  it("Test 13: modules/voucher-types/presentation/server.ts re-exports makeVoucherTypeRepository named export (§13.A5-α hex factory addition Option B)", () => {
    const source = fs.readFileSync(HEX_SERVER, "utf8");
    expect(source).toMatch(HEX_FACTORY_REEXPORT_RE);
  });
});
