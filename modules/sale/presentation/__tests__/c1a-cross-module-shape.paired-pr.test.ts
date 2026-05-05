/**
 * POC paired payables↔receivables C1a — Cat 3 cross-module §13.A5-α path swap shape
 * (Path α'' atomic batch single-batch source 4 archivos cross-module).
 *
 * Axis: cleanup atomic 4 archivos cross-module consumers paired purchase↔sale
 * mirror — NO hex addition required (factories `makePayablesRepository` +
 * `makeReceivablesRepository` ya existen pre-RED post C0 commit `5f18aac` —
 * verified Step 0 expand cycle-start C1a). §13.A5-α paired sister sub-cycle
 * Path α direct Option B inverso 2da aplicación post-cementación cumulative
 * (mirror C0 EXACT estricto). 6ta evidencia matures cumulative cross-§13
 * same POC paired sister A5-C2a (3ra) → A5-C2b (4ta) → A5-C2c (5ta) → C0
 * (5ta + sister continuation) → C1a (6ta paired sister Path α direct uniform
 * Shape α).
 *
 * 4 archivos cross-module scope (verificados Step 0 expand cycle-start C1a):
 *   ── Shape α uniform path swap atomic (4 archivos paired purchase↔sale) ──
 *     - modules/purchase/presentation/composition-root.ts (L16 import + L76 ctor)
 *     - modules/purchase/infrastructure/prisma-purchase-unit-of-work.ts (L12 import + L97 ctor + L65 JSDoc refer-by-name)
 *     - modules/sale/presentation/composition-root.ts (L16 import + L73 ctor)
 *     - modules/sale/infrastructure/prisma-sale-unit-of-work.ts (L11 import + L85 ctor + L56 JSDoc refer-by-name)
 *
 * Marco lock final RED scope (10 assertions α — parsimonious sample-style vs
 * A5-C2b 13 asimétrico α/β/γ):
 *   ── Cross-module hex import POSITIVE (Tests 1-4) ──
 *     T1 purchase comp-root      → from "@/modules/payables/presentation/server"
 *     T2 purchase unit-of-work   → idem (paired-payables sister)
 *     T3 sale comp-root          → from "@/modules/receivables/presentation/server"
 *     T4 sale unit-of-work       → idem (paired-receivables sister mirror)
 *
 *   ── Cross-module legacy infrastructure import NEGATIVE (Tests 5-8) ──
 *     T5-T6 NO from "@/modules/payables/infrastructure/prisma-payables.repository"
 *     T7-T8 NO from "@/modules/receivables/infrastructure/prisma-receivables.repository"
 *
 *   ── Factory invocation representative sample (Tests 9-10) — Shape α uniform ──
 *   §13.A5-α resolution Option B inverso (factories pre-existing pre-RED — NO
 *   addition required, mirror C0 EXACT). Sample-style 1 per side cubre los 4
 *   archivos uniform — NO asimétrico α/β/γ vs A5-C2b 4 factory callsite separate:
 *       T9  purchase comp-root → makePayablesRepository() AND NOT new PrismaPayablesRepository() (Shape α sample purchase-side)
 *       T10 sale comp-root     → makeReceivablesRepository() AND NOT new PrismaReceivablesRepository() (Shape α sample sale-side mirror sister)
 *
 * §13.A5-α paired sister sub-cycle Path α direct Option B inverso 2da
 * aplicación post-cementación — 6ta evidencia matures cumulative cross-§13
 * same POC paired sister A5-C2a/C2b/C2c/C0/C1a. Engram canonical home
 * `arch/§13/A5-alpha-multi-level-composition-root-delegation` ya cementado
 * A5-C2a — C1a NO require re-cementación, solo paired sister cross-ref this
 * turn.
 *
 * §13.A5-γ DTO divergence — DESCARTADO uniform Shape α 4 archivos (verified
 * Step 0 expand): NO callsite narrow `.id`/.X primitive-only post-call (es
 * direct ctor → instance pasa a UnitOfWork/Service deps — NO method call con
 * return access primitive). Pattern §13.A5-γ requiere callsite narrow primitive
 * post-call; este caso instance-level pure DI NO method-result narrow.
 *
 * §13.A5-ε method-level signature divergence — DESCARTADO uniform Shape α
 * (verified Step 0 expand): factories `makePayablesRepository` +
 * `makeReceivablesRepository` retornan `PrismaPayablesRepository` +
 * `PrismaReceivablesRepository` exact match legacy class (mirror C0 exact
 * Path α direct). NO method shim divergent — direct factory return clase
 * concreta. NO §13.A5-ε aplica.
 *
 * Sub-finding pre-RED honest (Step 0 expand surface to Marco):
 *   - 2 archivos infrastructure tienen JSDoc refer-by-name textual de la legacy
 *     class (`PrismaPayablesRepository` purchase/infrastructure/prisma-purchase-
 *     unit-of-work.ts:65 + `PrismaReceivablesRepository` sale/infrastructure/
 *     prisma-sale-unit-of-work.ts:56). Marco lock #1 GREEN apply Opción A —
 *     limpiar atomic mismo GREEN per `feedback_jsdoc_atomic_revoke` MEMORY.md
 *     (refer-by-name grep-clean post-swap, NO contradicen signature).
 *   - NO RED C1a assertion JSDoc contains/absent — out of shape test scope
 *     (source-string assertions cleanup body, NO comment cleanup level).
 *
 * Expected RED failure mode pre-GREEN (per `feedback_red_acceptance_failure_mode`):
 *   - T1-T4 FAIL: 4 cross-module archivos todavía importan
 *     `@/modules/{payables,receivables}/infrastructure/prisma-{X}.repository`,
 *     regex match `@/modules/{payables,receivables}/presentation/server` falla.
 *   - T5-T8 FAIL: legacy infrastructure imports presentes, regex match
 *     negativo no se cumple.
 *   - T9 FAIL: `new PrismaPayablesRepository()` callsite presente y
 *     `makePayablesRepository()` ausente en purchase comp-root L76.
 *   - T10 FAIL: `new PrismaReceivablesRepository()` callsite presente y
 *     `makeReceivablesRepository()` ausente en sale comp-root L73.
 *  Total expected FAIL pre-GREEN: 10/10 (Marco mandate failure mode honest).
 *
 * Self-contained future-proof check (lección A6 #5): shape test asserta paths
 * que persisten post C7 atomic delete `features/{payables,receivables}/`
 * wholesale (mirror A5-C3 precedent EXACT estricto). NO toca features/
 * {payables,receivables}/* que C7 borrará. Self-contained vs future deletes ✓.
 *
 * Source-string assertion pattern: mirror precedent A5-C2b
 * `modules/voucher-types/presentation/__tests__/c2b-cross-module-shape.poc-nuevo-a5.test.ts`
 * (RED commit `d9e9517` + GREEN `14605bc`) — extends scope cross-module 5
 * archivos α/β/γ → cross-module 4 archivos paired uniform Shape α sample-style
 * 10 assertions parsimonious.
 *
 * Cross-ref:
 *   - architecture.md §13.7 #2/#10/#10-skippable/#12/#13/#14 (lecciones aplicadas RED scope)
 *   - architecture.md §13.A4-α DTO divergence (precedent paired sister §13.A5-γ NO aplica este caso)
 *   - engram `arch/§13/A5-alpha-multi-level-composition-root-delegation` #1587 (formal cementación A5-C2a — 6ta evidencia matures cumulative this RED C1a)
 *   - engram `poc-nuevo/paired-payables-receivables/c0-closed` #1615 (cycle-start bookmark C1a)
 *   - engram `feedback_jsdoc_atomic_revoke` (sub-finding JSDoc refer-by-name 2 archivos infrastructure GREEN apply Opción A)
 *   - engram `feedback_diagnostic_stash_gate_pattern` (PROACTIVE applied post-GREEN per Marco lock #3 4ta evidencia cross-POC)
 *   - modules/payables/presentation/server.ts (hex barrel — `makePayablesRepository` ya existe pre-RED)
 *   - modules/payables/presentation/composition-root.ts:26-27 (factory definida pre-RED)
 *   - modules/receivables/presentation/server.ts (hex barrel — `makeReceivablesRepository` ya existe pre-RED)
 *   - modules/receivables/presentation/composition-root.ts:26-27 (factory definida pre-RED)
 *   - modules/voucher-types/presentation/__tests__/c2b-cross-module-shape.poc-nuevo-a5.test.ts (precedent shape A5-C2b RED `d9e9517` + GREEN `14605bc`)
 *   - paired-pr-C0 RED `d6b9f4d` + GREEN `5f18aac` master (preceding ciclo POC paired)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

// ── Cat 3 source cleanup targets cross-module (4 archivos paired purchase↔sale uniform Shape α) ──

const PURCHASE_COMP_ROOT = path.join(
  REPO_ROOT,
  "modules/purchase/presentation/composition-root.ts",
);
const PURCHASE_UNIT_OF_WORK = path.join(
  REPO_ROOT,
  "modules/purchase/infrastructure/prisma-purchase-unit-of-work.ts",
);
const SALE_COMP_ROOT = path.join(
  REPO_ROOT,
  "modules/sale/presentation/composition-root.ts",
);
const SALE_UNIT_OF_WORK = path.join(
  REPO_ROOT,
  "modules/sale/infrastructure/prisma-sale-unit-of-work.ts",
);

// ── Regex patterns ───────────────────────────────────────────────────────────

const PAYABLES_HEX_SERVER_RE =
  /from\s*["']@\/modules\/payables\/presentation\/server["']/;
const PAYABLES_LEGACY_INFRA_RE =
  /from\s*["']@\/modules\/payables\/infrastructure\/prisma-payables\.repository["']/;

const RECEIVABLES_HEX_SERVER_RE =
  /from\s*["']@\/modules\/receivables\/presentation\/server["']/;
const RECEIVABLES_LEGACY_INFRA_RE =
  /from\s*["']@\/modules\/receivables\/infrastructure\/prisma-receivables\.repository["']/;

const MAKE_PAYABLES_FACTORY_RE = /makePayablesRepository\(\)/;
const NEW_PAYABLES_CTOR_RE = /new\s+PrismaPayablesRepository\s*\(/;
const MAKE_RECEIVABLES_FACTORY_RE = /makeReceivablesRepository\(\)/;
const NEW_RECEIVABLES_CTOR_RE = /new\s+PrismaReceivablesRepository\s*\(/;

describe("POC paired payables↔receivables C1a — Cat 3 cross-module cleanup shape (§13.A5-α matures 6ta evidencia paired sister sub-cycle Path α direct Option B inverso)", () => {
  // ── POSITIVE source-shape (Tests 1-4) — hex import present (4 cross-module paired) ──

  it("Test 1: purchase comp-root imports from hex payables/presentation/server (Shape α paired-payables)", () => {
    const source = fs.readFileSync(PURCHASE_COMP_ROOT, "utf8");
    expect(source).toMatch(PAYABLES_HEX_SERVER_RE);
  });

  it("Test 2: purchase unit-of-work imports from hex payables/presentation/server (Shape α paired-payables sister)", () => {
    const source = fs.readFileSync(PURCHASE_UNIT_OF_WORK, "utf8");
    expect(source).toMatch(PAYABLES_HEX_SERVER_RE);
  });

  it("Test 3: sale comp-root imports from hex receivables/presentation/server (Shape α paired-receivables mirror)", () => {
    const source = fs.readFileSync(SALE_COMP_ROOT, "utf8");
    expect(source).toMatch(RECEIVABLES_HEX_SERVER_RE);
  });

  it("Test 4: sale unit-of-work imports from hex receivables/presentation/server (Shape α paired-receivables sister mirror)", () => {
    const source = fs.readFileSync(SALE_UNIT_OF_WORK, "utf8");
    expect(source).toMatch(RECEIVABLES_HEX_SERVER_RE);
  });

  // ── NEGATIVE source-shape (Tests 5-8) — legacy infrastructure import absent (4 cross-module paired) ──

  it("Test 5: purchase comp-root does NOT import from legacy @/modules/payables/infrastructure/prisma-payables.repository", () => {
    const source = fs.readFileSync(PURCHASE_COMP_ROOT, "utf8");
    expect(source).not.toMatch(PAYABLES_LEGACY_INFRA_RE);
  });

  it("Test 6: purchase unit-of-work does NOT import from legacy @/modules/payables/infrastructure/prisma-payables.repository", () => {
    const source = fs.readFileSync(PURCHASE_UNIT_OF_WORK, "utf8");
    expect(source).not.toMatch(PAYABLES_LEGACY_INFRA_RE);
  });

  it("Test 7: sale comp-root does NOT import from legacy @/modules/receivables/infrastructure/prisma-receivables.repository", () => {
    const source = fs.readFileSync(SALE_COMP_ROOT, "utf8");
    expect(source).not.toMatch(RECEIVABLES_LEGACY_INFRA_RE);
  });

  it("Test 8: sale unit-of-work does NOT import from legacy @/modules/receivables/infrastructure/prisma-receivables.repository", () => {
    const source = fs.readFileSync(SALE_UNIT_OF_WORK, "utf8");
    expect(source).not.toMatch(RECEIVABLES_LEGACY_INFRA_RE);
  });

  // ── POSITIVE factory invocation representative sample (Tests 9-10) — Shape α uniform paired sister ──
  // §13.A5-α resolution Option B inverso (factories pre-existing — NO addition required pre-RED, mirror C0 EXACT).
  // Sample-style 1 per side (purchase + sale) cubre los 4 archivos uniform —
  // NO asimétrico α/β/γ vs A5-C2b 4 factory callsite separate (paired POC uniform Shape α único).

  it("Test 9: purchase comp-root uses makePayablesRepository() factory and NOT new PrismaPayablesRepository() (Shape α sample purchase-side)", () => {
    const source = fs.readFileSync(PURCHASE_COMP_ROOT, "utf8");
    expect(source).toMatch(MAKE_PAYABLES_FACTORY_RE);
    expect(source).not.toMatch(NEW_PAYABLES_CTOR_RE);
  });

  it("Test 10: sale comp-root uses makeReceivablesRepository() factory and NOT new PrismaReceivablesRepository() (Shape α sample sale-side mirror sister)", () => {
    const source = fs.readFileSync(SALE_COMP_ROOT, "utf8");
    expect(source).toMatch(MAKE_RECEIVABLES_FACTORY_RE);
    expect(source).not.toMatch(NEW_RECEIVABLES_CTOR_RE);
  });
});
