/**
 * POC nuevo A5-C2c — voucher-types Cat 4 cross-module integration tests cleanup
 * shape (Path α'' atomic batch single-batch 3 archivos cross-module integration
 * tests cutover).
 *
 * Axis: cleanup atomic 3 archivos cross-module integration test consumers — NO
 * hex addition required (factory `makeVoucherTypeRepository` ya existe post
 * A5-C2a commit `f1b9d9d` + verified A5-C2b commit `14605bc`). §13.A5-ζ formal
 * cementación PROACTIVE pre-RED A5-C2c — classification by-target-type drift
 * correction retroactivo cumulative POC A5 (paired sister #1579 + #1580 Cat 4
 * listing overcount 4→3 + bookmark heredado A5-C3 incoherence Cat 4 omitted).
 * Mirror §13.A5-α/γ/ε timing PROACTIVE pre-RED.
 *
 * 3 archivos cross-module integration tests scope (Cat 4 ground truth verified
 * Step 0 expand cycle-start A5-C3 PROJECT-scope grep — drift correction
 * retroactivo vs #1579/#1580 listing inicial "4 integration tests"):
 *   - modules/purchase/infrastructure/__tests__/prisma-purchase-unit-of-work.integration.test.ts (L13 import + L84 callsite buildAdapter helper inline)
 *   - modules/sale/infrastructure/__tests__/prisma-journal-entry-factory.adapter.integration.test.ts (L13 import + L234 callsite buildAdapter helper)
 *   - modules/sale/infrastructure/__tests__/prisma-sale-unit-of-work.integration.test.ts (L13 import + L77 callsite module-level singleton)
 *
 * Pattern UNIFORME cross-3-files (verified Step 0 expand individual reads):
 *   - `import { VoucherTypesRepository } from "@/features/voucher-types/server"` (L13 todos)
 *   - Instantiation `new VoucherTypesRepository()` como 2do arg al
 *     `AutoEntryGenerator` ctor (NO DI fallback, NO field signature, callsite
 *     directo puro)
 *   - Runtime signature parity post-A5-C2a: shim
 *     `VoucherTypesRepository = ModuleVoucherTypeRepository`
 *     (`features/voucher-types/server.ts:87-90`) — instance-type identical,
 *     solo cambia path import + factory call shape
 *
 * Marco lock final RED scope (10 tests, 13 assertions α — mirror A5-C2b shape):
 *   ── Cross-module integration tests cutover (Tests 1-9) ──
 *   - Tests 1-3 POSITIVE hex import present (3 archivos):
 *       T1 prisma-purchase-unit-of-work.integration.test.ts → from "@/modules/voucher-types/presentation/server"
 *       T2 prisma-journal-entry-factory.adapter.integration.test.ts → idem mirror
 *       T3 prisma-sale-unit-of-work.integration.test.ts → idem mirror
 *   - Tests 4-6 NEGATIVE legacy import absent (3 archivos):
 *       T4-T6 NO from "@/features/voucher-types/server"
 *
 *   ── Cross-module factory callsite uniform Shape α (Tests 7-9) ──
 *   §13.A5-α resolution Option B Marco lock — factory swap uniforme cross-3-files
 *   (NO asimétrico α/β/γ A5-C2b — pattern UNIFORM mirror Shape α sale+purchase
 *   comp-root):
 *       T7  purchase UoW                    → makeVoucherTypeRepository() AND NOT new VoucherTypesRepository()
 *       T8  journal-entry-factory adapter   → idem mirror
 *       T9  sale UoW                        → idem mirror
 *
 *   ── Cross-cutting safety net (Test 10) ──
 *   Per `feedback_red_acceptance_failure_mode` MEMORY.md — cumulative
 *   cross-3-files combined sanity. Asegura ningún drift parcial (1 file fixed
 *   2 missed). Mirror precedent shape safety net pattern paired sister.
 *
 * §13.A5-ζ formal cementación PROACTIVE pre-RED A5-C2c (engram canonical home
 * `arch/§13/A5-zeta-classification-by-target-type` + paired sister
 * `poc-nuevo/a5/13-zeta-classification-by-target-type` saved this batch):
 * - Pattern reusable cross-POC futuro: pre-recon comprehensive paired test
 *   cascade detection debe clasificar por TIPO source/unit-test/integration-test
 *   /mock-declaration, NO solo por PATH (Cat 1 routes/pages, Cat 2 unit-tests
 *   vi.mock, Cat 3 source).
 * - 1ra evidencia explicit drift correction retroactivo Cat 4 listing 4→3 +
 *   bookmark heredado A5-C3 incoherence Cat 4 omitted entirely (Cat 4 listed in
 *   #1579/#1580 pre-recon BUT items NO cubiertos in any ciclo A5-C1/C2a/C2b).
 * - 5ta evidencia §13.A5 cumulative cross-track Marco lock paired sister:
 *   §13.A5-α + §13.A5-γ + §13.A5-ε + §13.A5-ζ.
 *
 * Marco lock decisión Option 1 (A5-C2c paired sister NEW ciclo) vs Option 2
 * rechazada (A5-C3 scope expand 3 cutover + 3 delete atomic single batch
 * mezcla cutover semántico con delete físico, viola precedent A4-C3 puro
 * atomic-delete-wholesale, bisect menos clean):
 * - Granularity revisada 6 ciclos: A5-C1 ✅ + A5-C2a ✅ + A5-C2b ✅ +
 *   **A5-C2c NEW** + A5-C3 + A5-D1
 * - Mirror A5-C2a/C2b precedent EXACT — preserva bisect-friendly granularity
 *   asymmetric vs cross-feature/cross-module SOURCE
 * - A5-C3 atomic delete features/voucher-types/* wholesale puro PRESERVADO
 *   intacto (mirror A4-C3 commit `31ff403` precedent EXACT)
 *
 * Drift correction retroactivo Cat 4 (this RED — sub-finding §13.A5-ζ):
 * - #1579/#1580 Cat 4 listing original: "4 integration tests paired Cat 3 +
 *   1 audit test"
 * - Ground truth re-verify Step 0 expand A5-C3: 3 integration tests cross-module
 *   + 1 audit test absorbed A5-C2a Issue #1 §13.A5-ε
 * - Drift Cat 4 listing 4→3 unidad overcount inferential (mirror Cat 2 11→10
 *   pattern asymmetric direction)
 * - Bookmark heredado A5-C3 propagated supuesto "atomic single batch absorbed"
 *   sin verificar Cat 4 listing items
 *
 * Expected RED failure mode pre-GREEN (per feedback_red_acceptance_failure_mode):
 * - T1-T3 FAIL: 3 cross-module integration tests todavía importan
 *   @/features/voucher-types/server, regex match
 *   @/modules/voucher-types/presentation/server falla.
 * - T4-T6 FAIL: legacy imports presentes, regex match negativo no se cumple.
 * - T7-T9 FAIL: `new VoucherTypesRepository()` callsites todavía presentes y
 *   `makeVoucherTypeRepository()` ausente en los 3 integration tests.
 * - T10 FAIL: safety net cross-cutting cumulative — al menos 1 file todavía
 *   importa legacy y 1 file todavía instancia ctor directo.
 * Total expected FAIL pre-GREEN: 10/10 (Marco mandate failure mode honest).
 *
 * Self-contained future-proof check (lección A6 #5): shape test asserta paths
 * que persisten post A5-C3 atomic delete `features/voucher-types/` wholesale.
 * NO toca features/voucher-types/* que A5-C3 borra. Self-contained vs future
 * deletes ✓.
 *
 * Source-string assertion pattern: mirror precedent A5-C2b
 * `modules/voucher-types/presentation/__tests__/c2b-cross-module-shape.poc-nuevo-a5.test.ts`
 * (RED commit `d9e9517` + GREEN `14605bc`) — extends scope cross-module SOURCE
 * → cross-module INTEGRATION-TEST 3 archivos uniform Shape α.
 *
 * Lección #10-skippable applies pre-RED A5-C2c (SKIP dry-run):
 * - Target shape test fs.readFileSync source-string puro estructuralmente puro
 * - Sibling baseline clean cumulative cross-ciclos A5-C1+C2a+C2b verified
 * - Ambas condiciones cumplen → SKIP dry-run válido
 * - Post-GREEN ESLint runtime verify MANDATORY (lección #14 4 métricas)
 *
 * Cross-ref:
 *   - architecture.md §13.7 #2/#10/#10-skippable/#12/#13/#14 (lecciones aplicadas RED scope)
 *   - engram `arch/§13/A5-zeta-classification-by-target-type` (formal cementación PROACTIVE pre-RED — this batch save)
 *   - engram `poc-nuevo/a5/13-zeta-classification-by-target-type` (paired sister this batch save)
 *   - engram `arch/§13/A5-alpha-multi-level-composition-root-delegation` #1588 (precedent paired sister cumulative — multi-level composition-root delegation)
 *   - engram `arch/§13/A5-gamma-dto-divergence-runtime-path-coverage` #1582 (precedent paired sister cumulative — DTO divergence runtime path coverage)
 *   - engram `arch/§13/A5-epsilon-method-signature-shim-divergence` #1590 (precedent paired sister cumulative — method-on-class shim signature divergence)
 *   - engram `poc-nuevo/a5/pre-recon-comprehensive` #1579 (cross-ref append + Cat 4 drift correction retroactivo this batch)
 *   - engram `poc-futuro/a5-voucher-types/pre-recon-comprehensive` #1580 (cross-ref append + Cat 4 drift correction retroactivo this batch)
 *   - engram `poc-nuevo/a5/c2b-closed` #1596 (bookmark heredado A5-C3 que omitió Cat 4)
 *   - modules/voucher-types/presentation/server.ts (hex barrel — factory `makeVoucherTypeRepository` ya existe post A5-C2a)
 *   - modules/voucher-types/presentation/__tests__/c2a-cross-feature-shape.poc-nuevo-a5.test.ts (precedent shape A5-C2a RED `b853164` + GREEN `f1b9d9d`)
 *   - modules/voucher-types/presentation/__tests__/c2b-cross-module-shape.poc-nuevo-a5.test.ts (precedent shape A5-C2b RED `d9e9517` + GREEN `14605bc`)
 *   - modules/voucher-types/presentation/__tests__/c1-cutover-shape.poc-nuevo-a5.test.ts (precedent shape A5-C1)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

// ── Cat 4 cross-module integration tests cutover targets (3 archivos uniform) ─

const PURCHASE_UOW_INTEGRATION = path.join(
  REPO_ROOT,
  "modules/purchase/infrastructure/__tests__/prisma-purchase-unit-of-work.integration.test.ts",
);
const JOURNAL_ENTRY_FACTORY_INTEGRATION = path.join(
  REPO_ROOT,
  "modules/sale/infrastructure/__tests__/prisma-journal-entry-factory.adapter.integration.test.ts",
);
const SALE_UOW_INTEGRATION = path.join(
  REPO_ROOT,
  "modules/sale/infrastructure/__tests__/prisma-sale-unit-of-work.integration.test.ts",
);

// ── Regex patterns ───────────────────────────────────────────────────────────

const HEX_SERVER_RE =
  /from\s*["']@\/modules\/voucher-types\/presentation\/server["']/;
const LEGACY_SERVER_RE = /from\s*["']@\/features\/voucher-types\/server["']/;

const MAKE_REPO_FACTORY_RE = /makeVoucherTypeRepository\(\)/;
const NEW_REPO_CTOR_RE = /new\s+VoucherTypesRepository\s*\(\s*\)/;

describe("POC nuevo A5-C2c — voucher-types Cat 4 cross-module integration tests cleanup shape (§13.A5-ζ classification by-target-type + drift correction Cat 4)", () => {
  // ── POSITIVE source-shape (Tests 1-3) — hex import present (3 integration) ──

  it("Test 1: prisma-purchase-unit-of-work.integration.test.ts imports from hex presentation/server (Shape α)", () => {
    const source = fs.readFileSync(PURCHASE_UOW_INTEGRATION, "utf8");
    expect(source).toMatch(HEX_SERVER_RE);
  });

  it("Test 2: prisma-journal-entry-factory.adapter.integration.test.ts imports from hex presentation/server (Shape α mirror)", () => {
    const source = fs.readFileSync(JOURNAL_ENTRY_FACTORY_INTEGRATION, "utf8");
    expect(source).toMatch(HEX_SERVER_RE);
  });

  it("Test 3: prisma-sale-unit-of-work.integration.test.ts imports from hex presentation/server (Shape α mirror)", () => {
    const source = fs.readFileSync(SALE_UOW_INTEGRATION, "utf8");
    expect(source).toMatch(HEX_SERVER_RE);
  });

  // ── NEGATIVE source-shape (Tests 4-6) — legacy import absent (3 integration) ─

  it("Test 4: prisma-purchase-unit-of-work.integration.test.ts does NOT import from legacy @/features/voucher-types/server", () => {
    const source = fs.readFileSync(PURCHASE_UOW_INTEGRATION, "utf8");
    expect(source).not.toMatch(LEGACY_SERVER_RE);
  });

  it("Test 5: prisma-journal-entry-factory.adapter.integration.test.ts does NOT import from legacy @/features/voucher-types/server", () => {
    const source = fs.readFileSync(JOURNAL_ENTRY_FACTORY_INTEGRATION, "utf8");
    expect(source).not.toMatch(LEGACY_SERVER_RE);
  });

  it("Test 6: prisma-sale-unit-of-work.integration.test.ts does NOT import from legacy @/features/voucher-types/server", () => {
    const source = fs.readFileSync(SALE_UOW_INTEGRATION, "utf8");
    expect(source).not.toMatch(LEGACY_SERVER_RE);
  });

  // ── POSITIVE factory callsite uniform Shape α (Tests 7-9) ───────────────────
  // §13.A5-α resolution Option B uniform cross-3-files: factory swap mecánico
  // `new VoucherTypesRepository()` → `makeVoucherTypeRepository()`. Mirror
  // A5-C2b Shape α sale+purchase comp-root EXACT (pattern UNIFORM no asimétrico
  // α/β/γ A5-C2b — 3 integration tests todos usan misma instantiation pattern).

  it("Test 7: prisma-purchase-unit-of-work.integration.test.ts uses makeVoucherTypeRepository() factory and NOT new VoucherTypesRepository() (Shape α)", () => {
    const source = fs.readFileSync(PURCHASE_UOW_INTEGRATION, "utf8");
    expect(source).toMatch(MAKE_REPO_FACTORY_RE);
    expect(source).not.toMatch(NEW_REPO_CTOR_RE);
  });

  it("Test 8: prisma-journal-entry-factory.adapter.integration.test.ts uses makeVoucherTypeRepository() factory and NOT new VoucherTypesRepository() (Shape α mirror)", () => {
    const source = fs.readFileSync(JOURNAL_ENTRY_FACTORY_INTEGRATION, "utf8");
    expect(source).toMatch(MAKE_REPO_FACTORY_RE);
    expect(source).not.toMatch(NEW_REPO_CTOR_RE);
  });

  it("Test 9: prisma-sale-unit-of-work.integration.test.ts uses makeVoucherTypeRepository() factory and NOT new VoucherTypesRepository() (Shape α mirror)", () => {
    const source = fs.readFileSync(SALE_UOW_INTEGRATION, "utf8");
    expect(source).toMatch(MAKE_REPO_FACTORY_RE);
    expect(source).not.toMatch(NEW_REPO_CTOR_RE);
  });

  // ── Cross-cutting safety net (Test 10) ──────────────────────────────────────
  // Per `feedback_red_acceptance_failure_mode` MEMORY.md — cumulative cross-3-files
  // combined sanity. Asegura ningún drift parcial (1 file fixed 2 missed).
  // Mirror precedent shape safety net pattern paired sister.

  it("Test 10: safety net — cumulative cross-3-files NO contiene legacy path AND todos contienen hex factory invocation (combined sanity)", () => {
    const sources = [
      fs.readFileSync(PURCHASE_UOW_INTEGRATION, "utf8"),
      fs.readFileSync(JOURNAL_ENTRY_FACTORY_INTEGRATION, "utf8"),
      fs.readFileSync(SALE_UOW_INTEGRATION, "utf8"),
    ];
    const allLackLegacy = sources.every((s) => !LEGACY_SERVER_RE.test(s));
    const allHaveFactory = sources.every((s) => MAKE_REPO_FACTORY_RE.test(s));
    expect(allLackLegacy).toBe(true);
    expect(allHaveFactory).toBe(true);
  });
});
