/**
 * POC paired payables↔receivables C0 — dispatch receivables RESIDUAL cleanup
 * shape (Path α direct factory swap atomic 2 archivos, makeReceivablesRepository
 * factory ya existe hex barrel — NO factory addition).
 *
 * Axis: cleanup atomic 2 archivos cross-feature consumers (1 source dispatch
 * service + 1 audit test type-only). §13.A5-ζ partial subset receivables
 * RESIDUAL cleanup absorb DENTRO POC paired más eficiente que POC mini aparte
 * (Marco lock #1610 absorb pattern: ≤2 archivos cross-feature). §13.A5-α paired
 * sister sub-cycle — factory invocation ya disponible hex (mirror inverso
 * A5-C2a Option B donde hex factory addition required).
 *
 * 2 archivos C0 scope (verificados Step 0 expand cycle-start C0):
 *   - features/dispatch/dispatch.service.ts:32 (legacy `ReceivablesRepository`
 *     import + line 171 `new ReceivablesRepository()` ctor default)
 *   - features/dispatch/__tests__/dispatch.service.audit.test.ts:28 (legacy
 *     `ReceivablesRepository` type-only import + line 163 type cast)
 *
 * Marco lock final RED scope (6 assertions α — 2 hex + 2 legacy absent + 2 makeFactory):
 *   ── Hex import positive (Tests 1-2) ──
 *       T1 dispatch.service.ts → from "@/modules/receivables/presentation/server"
 *       T2 audit.test.ts → idem
 *   ── Legacy import absent (Tests 3-4) ──
 *       T3 dispatch.service.ts → NOT from "@/features/receivables/server"
 *       T4 audit.test.ts → idem
 *   ── makeFactory invocation (Tests 5-6) — dispatch.service.ts only ──
 *   §13.A5-α paired sister: factory `makeReceivablesRepository()` ya existe en
 *   hex `modules/receivables/presentation/composition-root.ts:26` + barrel
 *   re-export `presentation/server.ts:6` — NO factory addition required, mirror
 *   inverso A5-C2a Option B (donde factory addition required pre-RED).
 *       T5 dispatch.service.ts → makeReceivablesRepository()
 *       T6 dispatch.service.ts → NOT new ReceivablesRepository()
 *
 * Audit test type-only NO incluye makeFactory assertion (mirror A5-C2a T10-T11
 * type-only auto-entry-generator precedent — type-only NO instancia).
 *
 * Mirror A5-C2a precedent EXACT estricto: source-string assertion fs.readFileSync
 * regex match (lección #10-skippable applies — target shape test sin parse,
 * baseline runtime cumulative cross-A5 cumulative verified pre-RED).
 *
 * Expected RED failure mode pre-GREEN (per feedback_red_acceptance_failure_mode):
 * - T1-T2 FAIL: 2 archivos todavía importan @/features/receivables/server,
 *   regex match @/modules/receivables/presentation/server falla.
 * - T3-T4 FAIL: legacy imports presentes, regex match negativo no se cumple.
 * - T5 FAIL: dispatch.service.ts NO contiene `makeReceivablesRepository()` callsite.
 * - T6 FAIL: dispatch.service.ts todavía contiene `new ReceivablesRepository()`
 *   ctor (line 171).
 * Total expected FAIL pre-GREEN: 6/6 (failure mode honest enumerated).
 *
 * Self-contained future-proof check (lección A6 #5): shape test asserta paths
 * que persisten post C7 wholesale delete `features/receivables/`. Test vive
 * en modules/receivables/presentation/__tests__/ — NO toca features/receivables/*
 * que C7 borra. Self-contained vs future deletes ✓.
 *
 * Cross-ref:
 *   - architecture.md §13.7 #2/#10/#10-skippable/#12/#13/#14 (lecciones aplicadas RED scope)
 *   - architecture.md §13.A5-α multi-level composition-root delegation (5 evidencias canonical, C0 paired sister sub-cycle Path α direct)
 *   - architecture.md §13.A5-ζ classification by-target-type (5ta evidencia matures cumulative, C0 partial subset receivables RESIDUAL)
 *   - engram `arch/§13/A5-alpha-multi-level-composition-root-delegation` (canonical home — paired sister §13.A5-α sub-cycle)
 *   - engram `arch/§13/A5-zeta-classification-by-target-type` (canonical home — C0 partial subset ζ)
 *   - engram `poc-nuevo/paired-payables-receivables/step-0-closed` #1613 (bookmark cycle-start cold C0 RED apply)
 *   - engram `poc-nuevo/paired-payables-receivables/pre-recon-comprehensive` #1612 (Step 0 5-axis classification)
 *   - modules/voucher-types/presentation/__tests__/c2a-cross-feature-shape.poc-nuevo-a5.test.ts (precedent shape A5-C2a RED `b853164` + GREEN `f1b9d9d`)
 *   - modules/receivables/presentation/server.ts (hex barrel — `makeReceivablesRepository` already exported)
 *   - modules/receivables/presentation/composition-root.ts:26 (factory existing — NO addition required)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

// ── C0 source cleanup targets (2 archivos) ───────────────────────────────────

const DISPATCH_SERVICE = path.join(
  REPO_ROOT,
  "features/dispatch/dispatch.service.ts",
);
const DISPATCH_AUDIT_TEST = path.join(
  REPO_ROOT,
  "features/dispatch/__tests__/dispatch.service.audit.test.ts",
);

// ── Regex patterns ───────────────────────────────────────────────────────────

const HEX_SERVER_RE =
  /from\s*["']@\/modules\/receivables\/presentation\/server["']/;
const LEGACY_SERVER_RE = /from\s*["']@\/features\/receivables\/server["']/;

const MAKE_REPO_FACTORY_RE = /makeReceivablesRepository\(\)/;
const NEW_REPO_CTOR_RE = /new\s+ReceivablesRepository\s*\(\s*\)/;

describe("POC paired payables↔receivables C0 — dispatch receivables RESIDUAL cleanup shape (§13.A5-ζ partial + §13.A5-α paired sister)", () => {
  // ── Hex import positive (Tests 1-2) ─────────────────────────────────────

  it("Test 1: dispatch.service.ts imports from hex @/modules/receivables/presentation/server", () => {
    const source = fs.readFileSync(DISPATCH_SERVICE, "utf8");
    expect(source).toMatch(HEX_SERVER_RE);
  });

  it("Test 2: dispatch.service.audit.test.ts imports from hex @/modules/receivables/presentation/server", () => {
    const source = fs.readFileSync(DISPATCH_AUDIT_TEST, "utf8");
    expect(source).toMatch(HEX_SERVER_RE);
  });

  // ── Legacy import absent (Tests 3-4) ────────────────────────────────────

  it("Test 3: dispatch.service.ts does NOT import from legacy @/features/receivables/server", () => {
    const source = fs.readFileSync(DISPATCH_SERVICE, "utf8");
    expect(source).not.toMatch(LEGACY_SERVER_RE);
  });

  it("Test 4: dispatch.service.audit.test.ts does NOT import from legacy @/features/receivables/server", () => {
    const source = fs.readFileSync(DISPATCH_AUDIT_TEST, "utf8");
    expect(source).not.toMatch(LEGACY_SERVER_RE);
  });

  // ── makeFactory invocation (Tests 5-6) — dispatch.service.ts only ──────
  // §13.A5-α paired sister: factory `makeReceivablesRepository()` ya existe
  // hex barrel — mirror inverso A5-C2a Option B (NO factory addition required).

  it("Test 5: dispatch.service.ts uses makeReceivablesRepository() factory (§13.A5-α paired sister)", () => {
    const source = fs.readFileSync(DISPATCH_SERVICE, "utf8");
    expect(source).toMatch(MAKE_REPO_FACTORY_RE);
  });

  it("Test 6: dispatch.service.ts does NOT contain new ReceivablesRepository() ctor (§13.A5-α paired sister)", () => {
    const source = fs.readFileSync(DISPATCH_SERVICE, "utf8");
    expect(source).not.toMatch(NEW_REPO_CTOR_RE);
  });
});
