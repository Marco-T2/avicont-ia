/**
 * POC nuevo payment C2 RED — DTO mapper centralizado payment-with-relations
 * extraction Path γ scope (mapper extraction only, NO drop type axis defer C3).
 *
 * Axis: extraer paymentInclude constant (líneas 18-29) + toPaymentWithRelations
 * function (líneas 281-294) desde features/payment/payment.service.ts shim →
 * NEW canonical home modules/payment/presentation/mappers/payment-with-relations.mapper.ts.
 * Mirror precedent A3-C5 sale-to-with-details.mapper EXACT scope (mapper extraction
 * only, NO type drop). Shim continúa invocando prisma.payment.findMany/findFirst
 * internamente (R5 NO aplica features/) + importa paymentInclude +
 * toPaymentWithRelations from hex mapper (DRY canonical single source of truth).
 * fetchWithRelations helper STAYS en shim layer (Prisma runtime query container —
 * R5 honored estricto en hex presentation mapper layer pure transformation row →
 * DTO sin runtime queries).
 *
 * §13.A NEW emergent classification "hex presentation TYPE-only import desde
 * legacy features/" 1ra evidencia formal — Marco lock §13 emergente pre-RED
 * Opción A confirmed (`import type { PaymentWithRelations } from
 * "@/features/payment/payment.types"`). Distinto §13.A5-α multi-level composition
 * delegation (VALUE class chain) + §13.A5-γ DTO divergence (runtime path coverage)
 * + §13 R-name-collision (TYPE-vs-VALUE re-export ambiguity). Cementación target
 * D1 doc-only post-mortem cumulative POC nuevo payment closure. Forward-applicable
 * cualquier feature legacy con DTO type pendiente migration hex donde mapper
 * extraction precede type drop axis (Path γ pattern reusable). Allow type-only
 * carve-out §13.V analog applicable a R-features-legacy-type-import — temporal
 * pre-wholesale-delete C4.
 *
 * §13.A5-γ DTO divergence runtime path coverage MATERIAL precedent A5-C1 5ta
 * aplicación post-cementación canonical cumulative cross-POC matures.
 * PaymentWithRelations legacy POJO (Omit<Payment, "amount"> & relations) preserva
 * DTO contract defer drop type axis a C3 (Path γ Marco lock confirmed minimum
 * scope).
 *
 * Marco locks pre-RED C2 (Step 0 expand este turno):
 *   - L1 (Path γ confirmed mapper extraction only) Marco lock #1: minimum scope,
 *     NO drop type axis defer C3 expand. Mirror precedent A3-C5 EXACT scope.
 *     Razón: granularity bisect-friendly L1 ESTRICTO 5 ciclos preserved.
 *   - L2 (Mapper signature Opción mixta) Marco lock #2: paymentInclude +
 *     toPaymentWithRelations puro mapper exports. NO exportar fetchWithRelations
 *     helper (R5 banPrismaInPresentation honored estricto — mapper hex SOLO
 *     type-only Prisma carve-out §13.V allowTypeImports si needed). Shim sigue
 *     invocando prisma queries internamente (features/ NO aplica R5).
 *   - L3 (§13 emergente Opción A cross-module type-only import) Marco lock #3:
 *     `import type { PaymentWithRelations } from "@/features/payment/payment.types"`
 *     en mapper hex. Type-only NO violates R5 banPrismaInPresentation pattern
 *     (allowTypeImports §13.V analog applicable a R-features-legacy-type-import).
 *     NEW classification candidate cementación target D1 §13.A NEW emergent.
 *   - L4 (Trust bookmark `a14505d` post-GREEN verified) Marco lock #4: skip suite
 *     full pre-RED. Mirror paired-pr-C7 + C0-pre + C1 Marco lock precedent EXACT
 *     trust si working tree clean post-commit.
 *   - L5 (RED scope α 13 assertions single side) Marco lock #5: aritmética
 *     correcta post §13 emergente Opción A type import integration. Failure mode
 *     honest declared 11/13 FAIL + 2/13 PASS preservation pre-RED (Tests 12-13
 *     mapper invocation present pre-extract textualmente idéntico post-extract —
 *     preservation post-state lock guard, NO material RED change per
 *     feedback_red_acceptance_failure_mode discipline declare honest).
 *
 * Marco lock final RED scope C2 (13 assertions α single side payment — NO paired
 * sister, single feature axis):
 *
 *   ── A: Mapper file existence + structure (Tests 1-3) ──
 *   NEW canonical home mapper hex exports paymentInclude + toPaymentWithRelations.
 *     T1 mapper file EXISTS at canonical home path (FAIL pre-RED file NO existe)
 *     T2 mapper file exports `paymentInclude` constant (FAIL pre-RED)
 *     T3 mapper file exports `toPaymentWithRelations` function (FAIL pre-RED)
 *
 *   ── B: Mapper hex shape (Tests 4-5) ──
 *   Signature row → PaymentWithRelations + paymentInclude shape preserves 5
 *   relations (contact + period + journalEntry + operationalDocType + allocations).
 *     T4 toPaymentWithRelations signature returns `PaymentWithRelations` explicit
 *        (FAIL pre-RED)
 *     T5 paymentInclude shape preserves 5 relations contact + period +
 *        journalEntry + operationalDocType + allocations (FAIL pre-RED)
 *
 *   ── C: R5 banPrismaInPresentation honored (Test 6) ──
 *   Mapper hex NO runtime Prisma value imports — type-only carve-out §13.V allowed.
 *     T6 mapper file source NO contains `import { Prisma }` value import (FAIL
 *        pre-RED file NO existe)
 *
 *   ── D: §13 emergente Opción A type import positive (Test 7) ──
 *   Cross-module type-only import desde legacy features/.
 *     T7 mapper file imports `PaymentWithRelations` type from
 *        `@/features/payment/payment.types` (FAIL pre-RED file NO existe)
 *
 *   ── E: Shim swap evidencia (Tests 8-11) ──
 *   features/payment/payment.service.ts post-extract: imports paymentInclude +
 *   toPaymentWithRelations from hex mapper, inline definitions absent.
 *     T8 shim imports `paymentInclude` from hex mapper (FAIL pre-RED no import)
 *     T9 shim imports `toPaymentWithRelations` from hex mapper (FAIL pre-RED)
 *     T10 shim inline `const paymentInclude = {` definition ABSENT (FAIL pre-RED
 *         inline def líneas 18-29 present)
 *     T11 shim inline `function toPaymentWithRelations(` definition ABSENT (FAIL
 *         pre-RED inline def líneas 281-294 present)
 *
 *   ── F: Callsites mapper invocation positive sample (Tests 12-13 PRESERVATION) ──
 *   Sample 2 callsites in shim invocation positive `toPaymentWithRelations(`
 *   present. PRESERVATION TESTS — pre-RED PASS porque invocaciones a función
 *   local YA presentes textualmente idéntico post-extract a función importada del
 *   hex mapper. Lock post-GREEN state preservation guard (mapper invocation NO
 *   removed accidentally during extract).
 *     T12 shim list method invokes `rows.map(toPaymentWithRelations)` (PASS
 *         pre-RED preservation post-state lock — invocación local línea 86
 *         idéntico textualmente post-extract a invocación importada)
 *     T13 shim fetchWithRelations helper invokes `toPaymentWithRelations(row)`
 *         (PASS pre-RED preservation post-state lock — invocación local línea
 *         278 idéntico textualmente post-extract)
 *
 * Failure mode honest pre-RED declared (per feedback_red_acceptance_failure_mode):
 *   11/13 FAIL (Tests 1-11) + 2/13 PASS preservation post-state lock (Tests 12-13).
 *
 * Self-contained future-proof check: shape test asserta paths que persisten post
 * C4 wholesale delete `features/payment/`:
 *   - modules/payment/presentation/mappers/payment-with-relations.mapper.ts
 *     persiste post-C4 (hex local — extracted target).
 *   - features/payment/payment.service.ts SE BORRA C4 wholesale — Tests 7-13
 *     auto-fallan post-C4 (shim NO existe + mapper hex type import path swap a
 *     destination canonical home post-drop-type-axis C3). Acceptable temporal
 *     scope C2 lock — forward eliminado al wholesale C4 atomic delete + drop
 *     type axis C3.
 *
 * Source-string assertion pattern: mirror precedent C0-pre + C1 + paired-pr
 * C7-pre + C5-C6 + C3-C4 + C1b-α + C1a + C0 + A5-C2b (`fs.readFileSync` regex
 * match).
 *
 * Cross-ref:
 *   - architecture.md §13.A5-γ DTO divergence runtime path coverage (5ta
 *     aplicación post-cementación matures cumulative cross-POC payment C2)
 *   - architecture.md §13.A NEW emergent "hex presentation TYPE-only import desde
 *     legacy features/" cementación target D1 doc-only (1ra evidencia formal POC
 *     nuevo payment C2)
 *   - engram canonical home `arch/§13/A5-gamma-dto-divergence-runtime-path-coverage`
 *     #1582 (precedent — POC nuevo payment §13.A5-γ MATERIAL forward C2 5ta
 *     aplicación post-cementación cumulative)
 *   - engram canonical home `arch/§13/A-features-legacy-type-only-import` (NEW
 *     canonical home target — POC nuevo payment 1ra evidencia formal cementación
 *     PROACTIVE pre-D1 — save post-GREEN canonical home this batch C2 cumulative)
 *   - engram canonical home `arch/§13/R-name-collision-type-vs-value-shadowing`
 *     #1638 (precedent NEW classification PROACTIVE timing pattern post-GREEN
 *     mid-cycle)
 *   - engram bookmark `poc-nuevo/payment/c1/closed` #1637 (preceding cycle POC
 *     nuevo payment — bookmark cycle-start cycle precedent EXACT)
 *   - modules/sale/presentation/mappers/sale-to-with-details.mapper.ts (precedent
 *     A3-C5 build mappers presentation EXACT scope — caller-passes-deps pattern,
 *     C2 mirror EXACT scope mapper extraction only Path γ Marco lock #1)
 *   - features/payment/payment.service.ts líneas 18-29 (paymentInclude inline
 *     def — extracted to hex mapper C2)
 *   - features/payment/payment.service.ts líneas 281-294 (toPaymentWithRelations
 *     inline def — extracted to hex mapper C2)
 *   - features/payment/payment.types.ts línea 32 (PaymentWithRelations type
 *     definition preserved — defer drop axis C3 per Marco lock #1 Path γ)
 *   - feedback `red_acceptance_failure_mode` (failure mode honest declared 11/13
 *     FAIL + 2/13 PASS preservation pre-RED per discipline)
 *   - feedback `canonical_rule_application_commit_body` (cite + rationale +
 *     cross-ref + why-now applied RED body — Path γ + §13 emergente Opción A type
 *     import + §13.A5-γ MATERIAL + §13.A NEW classification candidate)
 *   - feedback `commit_body_calibration` (verbose justified RED body locks NEW
 *     §13.A NEW emergent classification candidate + Opción A §13 emergente
 *     resolution + failure mode honest declared non-obvious tradeoff)
 *   - feedback `invariant_collision_elevation` (escalación applied este turn —
 *     surface honest §13 emergente cross-module type-only import asimetría vs
 *     precedent A3-C5 EXACT, NO silent resolve, Marco lock #3 Opción A)
 *   - feedback `engram_textual_rule_verification` (textual citations §13.A5-γ +
 *     §13 emergente NEW classification verified architecture.md §13 cementación
 *     paired-pr C8 commit `6b5a7e1` precedent + Marco lock textual canonical
 *     home pre-RED verified)
 *   - feedback `step-0-expand-eslint-restricted-imports-grep` (REFINED este turn
 *     8th axis NEW: cross-module type-only import direction hex→legacy features
 *     R-features-legacy-type-import allowed temporal pre-wholesale-delete)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

// ── C2 mapper extraction targets ──────────────────────────────────────────

const MAPPER_HEX_FILE = path.join(
  REPO_ROOT,
  "modules/payment/presentation/mappers/payment-with-relations.mapper.ts",
);
const SHIM_PAYMENT_SERVICE = path.join(
  REPO_ROOT,
  "features/payment/payment.service.ts",
);

// ── Regex patterns ────────────────────────────────────────────────────────

const PAYMENT_INCLUDE_EXPORT_RE = /export\s+const\s+paymentInclude\b/;
const TO_PAYMENT_WITH_RELATIONS_EXPORT_RE =
  /export\s+function\s+toPaymentWithRelations\b/;
const TO_PAYMENT_WITH_RELATIONS_RETURN_TYPE_RE =
  /function\s+toPaymentWithRelations\s*\([^)]*\)\s*:\s*PaymentWithRelations\b/;
const PAYMENT_INCLUDE_5_RELATIONS_RE =
  /paymentInclude\s*=\s*\{[\s\S]*?contact\s*:[\s\S]*?period\s*:[\s\S]*?journalEntry\s*:[\s\S]*?operationalDocType\s*:[\s\S]*?allocations\s*:[\s\S]*?\}\s*as\s*const/;
const PRISMA_VALUE_IMPORT_RE =
  /^import\s+\{[^}]*\bPrisma\b[^}]*\}\s+from\s+["']@\/generated\/prisma\/client["']/m;
const PAYMENT_WITH_RELATIONS_TYPE_IMPORT_RE =
  /import\s+type\s+\{[^}]*\bPaymentWithRelations\b[^}]*\}\s+from\s+["']@\/features\/payment\/payment\.types["']/;
const SHIM_IMPORTS_PAYMENT_INCLUDE_RE =
  /import\s+\{[^}]*\bpaymentInclude\b[^}]*\}\s+from\s+["']@\/modules\/payment\/presentation\/mappers\/payment-with-relations\.mapper["']/;
const SHIM_IMPORTS_TO_PAYMENT_WITH_RELATIONS_RE =
  /import\s+\{[^}]*\btoPaymentWithRelations\b[^}]*\}\s+from\s+["']@\/modules\/payment\/presentation\/mappers\/payment-with-relations\.mapper["']/;
const SHIM_INLINE_PAYMENT_INCLUDE_DEF_RE = /^const\s+paymentInclude\s*=\s*\{/m;
const SHIM_INLINE_TO_PAYMENT_WITH_RELATIONS_DEF_RE =
  /^function\s+toPaymentWithRelations\s*\(/m;
const ROWS_MAP_TO_PAYMENT_WITH_RELATIONS_RE =
  /rows\.map\(\s*toPaymentWithRelations\s*\)/;
const FETCH_WITH_RELATIONS_TO_PAYMENT_INVOCATION_RE =
  /toPaymentWithRelations\s*\(\s*row\s*\)/;

describe("POC nuevo payment C2 — DTO mapper centralizado payment-with-relations extraction Path γ (mapper extraction only NO drop type axis defer C3) + §13.A5-γ DTO divergence runtime path coverage 5ta aplicación matures + §13.A NEW emergent classification 'hex presentation TYPE-only import desde legacy features/' 1ra evidencia formal cementación target D1", () => {
  // ── A: Mapper file existence + structure (Tests 1-3) ───────────────────
  // NEW canonical home mapper hex exports paymentInclude + toPaymentWithRelations.

  it("Test 1: modules/payment/presentation/mappers/payment-with-relations.mapper.ts EXISTS at canonical home path (Path γ Marco lock #1 mapper extraction only)", () => {
    expect(fs.existsSync(MAPPER_HEX_FILE)).toBe(true);
  });

  it("Test 2: mapper file exports `paymentInclude` constant (Marco lock #2 Opción mixta paymentInclude export from hex mapper DRY canonical single source of truth)", () => {
    const source = fs.readFileSync(MAPPER_HEX_FILE, "utf8");
    expect(source).toMatch(PAYMENT_INCLUDE_EXPORT_RE);
  });

  it("Test 3: mapper file exports `toPaymentWithRelations` function (Marco lock #2 Opción mixta toPaymentWithRelations export from hex mapper)", () => {
    const source = fs.readFileSync(MAPPER_HEX_FILE, "utf8");
    expect(source).toMatch(TO_PAYMENT_WITH_RELATIONS_EXPORT_RE);
  });

  // ── B: Mapper hex shape (Tests 4-5) ────────────────────────────────────
  // Signature row → PaymentWithRelations + paymentInclude shape preserves 5 relations.

  it("Test 4: toPaymentWithRelations signature returns `PaymentWithRelations` explicit (mapper hex pure transformation function row → DTO)", () => {
    const source = fs.readFileSync(MAPPER_HEX_FILE, "utf8");
    expect(source).toMatch(TO_PAYMENT_WITH_RELATIONS_RETURN_TYPE_RE);
  });

  it("Test 5: paymentInclude shape preserves 5 relations contact + period + journalEntry + operationalDocType + allocations (mirror legacy shim líneas 18-29 EXACT)", () => {
    const source = fs.readFileSync(MAPPER_HEX_FILE, "utf8");
    expect(source).toMatch(PAYMENT_INCLUDE_5_RELATIONS_RE);
  });

  // ── C: R5 banPrismaInPresentation honored (Test 6) ─────────────────────
  // Mapper hex NO runtime Prisma value imports — type-only carve-out §13.V allowed.

  it("Test 6: mapper file source NO contains `import { Prisma }` value import (R5 banPrismaInPresentation honored — type-only carve-out §13.V allowTypeImports si needed)", () => {
    const source = fs.readFileSync(MAPPER_HEX_FILE, "utf8");
    expect(source).not.toMatch(PRISMA_VALUE_IMPORT_RE);
  });

  // ── D: §13 emergente Opción A type import positive (Test 7) ────────────
  // Cross-module type-only import desde legacy features/ (§13.A NEW emergent).

  it("Test 7: mapper file imports `PaymentWithRelations` type from `@/features/payment/payment.types` (Marco lock #3 §13 emergente Opción A cross-module type-only import — §13.A NEW emergent classification 1ra evidencia formal cementación target D1)", () => {
    const source = fs.readFileSync(MAPPER_HEX_FILE, "utf8");
    expect(source).toMatch(PAYMENT_WITH_RELATIONS_TYPE_IMPORT_RE);
  });

  // ── E: Shim swap evidencia (Tests 8-11) ────────────────────────────────
  // Shim imports paymentInclude + toPaymentWithRelations from hex mapper, inline defs absent.

  it("Test 8: shim features/payment/payment.service.ts imports `paymentInclude` from hex mapper (Marco lock #2 Opción mixta DRY canonical single source of truth)", () => {
    const source = fs.readFileSync(SHIM_PAYMENT_SERVICE, "utf8");
    expect(source).toMatch(SHIM_IMPORTS_PAYMENT_INCLUDE_RE);
  });

  it("Test 9: shim features/payment/payment.service.ts imports `toPaymentWithRelations` from hex mapper (Marco lock #2 Opción mixta DRY canonical)", () => {
    const source = fs.readFileSync(SHIM_PAYMENT_SERVICE, "utf8");
    expect(source).toMatch(SHIM_IMPORTS_TO_PAYMENT_WITH_RELATIONS_RE);
  });

  it("Test 10: shim inline `const paymentInclude = {` definition ABSENT (líneas 18-29 pre-extract — extracted to hex mapper C2 Marco lock #1 Path γ)", () => {
    const source = fs.readFileSync(SHIM_PAYMENT_SERVICE, "utf8");
    expect(source).not.toMatch(SHIM_INLINE_PAYMENT_INCLUDE_DEF_RE);
  });

  it("Test 11: shim inline `function toPaymentWithRelations(` definition ABSENT (líneas 281-294 pre-extract — extracted to hex mapper C2 Marco lock #1 Path γ)", () => {
    const source = fs.readFileSync(SHIM_PAYMENT_SERVICE, "utf8");
    expect(source).not.toMatch(SHIM_INLINE_TO_PAYMENT_WITH_RELATIONS_DEF_RE);
  });

  // ── F: Callsites mapper invocation positive sample (Tests 12-13 PRESERVATION) ──
  // PRESERVATION TESTS — pre-RED PASS porque invocaciones a función local YA
  // presentes textualmente idéntico post-extract a función importada del hex
  // mapper. Lock post-GREEN state preservation guard.

  it("Test 12: shim list method invokes `rows.map(toPaymentWithRelations)` (PRESERVATION post-state lock — pre-RED PASS invocación local línea 86 idéntico textualmente post-extract a invocación importada del hex mapper)", () => {
    const source = fs.readFileSync(SHIM_PAYMENT_SERVICE, "utf8");
    expect(source).toMatch(ROWS_MAP_TO_PAYMENT_WITH_RELATIONS_RE);
  });

  it("Test 13: shim fetchWithRelations helper invokes `toPaymentWithRelations(row)` (PRESERVATION post-state lock — pre-RED PASS invocación local línea 278 idéntico textualmente post-extract)", () => {
    const source = fs.readFileSync(SHIM_PAYMENT_SERVICE, "utf8");
    expect(source).toMatch(FETCH_WITH_RELATIONS_TO_PAYMENT_INVOCATION_RE);
  });
});
