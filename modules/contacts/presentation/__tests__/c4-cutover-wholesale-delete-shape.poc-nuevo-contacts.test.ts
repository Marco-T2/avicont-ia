/**
 * POC nuevo contacts C4 RED — wholesale delete features/contacts/* atomic single
 * batch cross-feature/cross-module cumulative cutover + DROP línea 13
 * modules/contacts/presentation/server.ts Opción A re-export + 5 components
 * TYPE swap (Contact + ContactFilters + ContactWithBalance) + 2 ai-agent tests
 * TYPE swap (Sub-B inline `ReturnType<typeof makeContactsService>` cast pattern
 * Marco lock 2 + Sub-B confirmed NO hex barrel surface contamination
 * cast-silenced equivalent structurally).
 *
 * Marco lock D-β-c4 2 commits totales (C4 RED + C4 GREEN — C4-pre `15aeb89` ya
 * commited dual-axis prep work). D1 doc-only post-mortem cementación canonical
 * defer post-C4 GREEN cumulative mirror payment + mortality precedent EXACT.
 *
 * §13.A reverse direction TYPE-only/existence-only 6ta evidencia esperada
 * wholesale delete cumulative cross-POC (mortality C1 4ta + payment C4-β 5ta
 * + contacts C4 6ta).
 *
 * Cross-cycle-red-test-cementacion-gate 4ta evidencia PROACTIVE matures
 * cumulative cross-POC (1ra C3 retroactive + 2da C4-pre PROACTIVE + 3ra C5-pre
 * PROACTIVE + 4ta C4 PROACTIVE — gate funcionó forward). Verify CLEAN pre-RED:
 * C1 Tests 3-5 retired C3-pre `40276d3` + C1 Tests 6+12 retired C5-pre `1ea5bb7`
 * + C1 Test 14 retired C4-pre `15aeb89` + C0-pre/C2/C3/C5 NEGATIVE assertions
 * STRONGER POST-C4 + D1 doc-only NO code overlap.
 *
 * 18α single test file homogeneous granularity per archivo bisect-friendly:
 *   Section A — EXISTENCE delete features/contacts/{index,contacts.types,server}.ts (3 POS)
 *   Section B — Opción A línea 13 DROP modules/contacts/presentation/server.ts (1 NEG)
 *   Section C — 5 components TYPE swap (5 POS hex barrel + 5 NEG legacy = 10α)
 *   Section D — 2 ai-agent tests TYPE swap Sub-B inline (2 POS hex + 2 NEG legacy = 4α)
 *
 * Test file location modules/contacts/presentation/__tests__/ — target hex
 * ownership mirror precedent c1/c0-pre EXACT — self-contained future-proof
 * NO toca features/contacts/* que C4 borrará.
 *
 * Expected failure mode pre-GREEN: 18/18 FAIL enumerated explicit per
 * feedback_red_acceptance_failure_mode (T1-T3 EXISTENCE files currently exist
 * + T4 línea 13 currently present + T5/T7/T9/T11/T13 POS hex barrel currently
 * absent + T6/T8/T10/T12/T14 NEG legacy currently present + T15/T17 POS Sub-B
 * inline currently absent + T16/T18 NEG legacy currently present).
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../../..");

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("POC nuevo contacts C4 — wholesale delete features/contacts/* atomic single batch", () => {
  // ── Section A: EXISTENCE delete features/contacts/* ──

  it("Test 1: features/contacts/index.ts NO existe (wholesale delete target)", () => {
    expect(existsSync(resolve(ROOT, "features/contacts/index.ts"))).toBe(false);
  });

  it("Test 2: features/contacts/contacts.types.ts NO existe (wholesale delete target)", () => {
    expect(existsSync(resolve(ROOT, "features/contacts/contacts.types.ts"))).toBe(false);
  });

  it("Test 3: features/contacts/server.ts NO existe (wholesale delete target legacy shim ContactsService class)", () => {
    expect(existsSync(resolve(ROOT, "features/contacts/server.ts"))).toBe(false);
  });

  // ── Section B: Opción A línea 13 DROP ──

  it("Test 4: modules/contacts/presentation/server.ts NO contains legacy Opción A re-export `export { ContactsService } from \"@/features/contacts/server\"` (DROP línea 13 post-cutover Marco lock C1 Test 14 retired C4-pre)", () => {
    const src = read("modules/contacts/presentation/server.ts");
    expect(src).not.toMatch(
      /export\s*\{\s*ContactsService\s*\}\s*from\s*["']@\/features\/contacts\/server["']/,
    );
  });

  // ── Section C: 5 components TYPE swap (hex barrel @/modules/contacts/presentation/index target) ──

  // contact-form.tsx — Contact
  it("Test 5: contact-form.tsx contains hex barrel import `from \"@/modules/contacts/presentation/index\"` (POSITIVE TYPE swap target post-cutover)", () => {
    const src = read("components/contacts/contact-form.tsx");
    expect(src).toMatch(
      /^import type \{ Contact \} from "@\/modules\/contacts\/presentation\/index";$/m,
    );
  });
  it("Test 6: contact-form.tsx NO contains legacy import `from \"@/features/contacts\"` (NEGATIVE legacy barrel dropped post-cutover)", () => {
    const src = read("components/contacts/contact-form.tsx");
    expect(src).not.toMatch(/from\s*["']@\/features\/contacts["']/);
  });

  // contact-detail.tsx — ContactWithBalance
  it("Test 7: contact-detail.tsx contains hex barrel import `from \"@/modules/contacts/presentation/index\"` (POSITIVE TYPE swap target post-cutover)", () => {
    const src = read("components/contacts/contact-detail.tsx");
    expect(src).toMatch(
      /^import type \{ ContactWithBalance \} from "@\/modules\/contacts\/presentation\/index";$/m,
    );
  });
  it("Test 8: contact-detail.tsx NO contains legacy import `from \"@/features/contacts\"` (NEGATIVE legacy barrel dropped post-cutover)", () => {
    const src = read("components/contacts/contact-detail.tsx");
    expect(src).not.toMatch(/from\s*["']@\/features\/contacts["']/);
  });

  // contact-selector.tsx — Contact
  it("Test 9: contact-selector.tsx contains hex barrel import `from \"@/modules/contacts/presentation/index\"` (POSITIVE TYPE swap target post-cutover)", () => {
    const src = read("components/contacts/contact-selector.tsx");
    expect(src).toMatch(
      /^import type \{ Contact \} from "@\/modules\/contacts\/presentation\/index";$/m,
    );
  });
  it("Test 10: contact-selector.tsx NO contains legacy import `from \"@/features/contacts\"` (NEGATIVE legacy barrel dropped post-cutover)", () => {
    const src = read("components/contacts/contact-selector.tsx");
    expect(src).not.toMatch(/from\s*["']@\/features\/contacts["']/);
  });

  // contact-filters.tsx — ContactFilters
  it("Test 11: contact-filters.tsx contains hex barrel import `from \"@/modules/contacts/presentation/index\"` (POSITIVE TYPE swap target post-cutover)", () => {
    const src = read("components/contacts/contact-filters.tsx");
    expect(src).toMatch(
      /^import type \{ ContactFilters \} from "@\/modules\/contacts\/presentation\/index";$/m,
    );
  });
  it("Test 12: contact-filters.tsx NO contains legacy import `from \"@/features/contacts\"` (NEGATIVE legacy barrel dropped post-cutover)", () => {
    const src = read("components/contacts/contact-filters.tsx");
    expect(src).not.toMatch(/from\s*["']@\/features\/contacts["']/);
  });

  // contact-list.tsx — ContactWithBalance + ContactFilters + Contact
  it("Test 13: contact-list.tsx contains hex barrel import `from \"@/modules/contacts/presentation/index\"` (POSITIVE TYPE swap target post-cutover multi-name preserve precedent)", () => {
    const src = read("components/contacts/contact-list.tsx");
    expect(src).toMatch(
      /^import type \{ ContactWithBalance, ContactFilters, Contact \} from "@\/modules\/contacts\/presentation\/index";$/m,
    );
  });
  it("Test 14: contact-list.tsx NO contains legacy import `from \"@/features/contacts\"` (NEGATIVE legacy barrel dropped post-cutover)", () => {
    const src = read("components/contacts/contact-list.tsx");
    expect(src).not.toMatch(/from\s*["']@\/features\/contacts["']/);
  });

  // ── Section D: 2 ai-agent tests TYPE swap Sub-B inline ReturnType<typeof makeContactsService> ──

  // tools.find-contact.test.ts
  it("Test 15: tools.find-contact.test.ts contains Sub-B inline `as unknown as ReturnType<typeof makeContactsService>` cast pattern hex barrel target (POSITIVE TYPE swap Marco lock 2 + Sub-B confirmed NO hex barrel surface contamination)", () => {
    const src = read("features/ai-agent/__tests__/tools.find-contact.test.ts");
    expect(src).toMatch(
      /as\s+unknown\s+as\s+ReturnType<typeof\s+makeContactsService>/,
    );
  });
  it("Test 16: tools.find-contact.test.ts NO contains legacy import `from \"@/features/contacts/server\"` (NEGATIVE legacy shim path dropped post-cutover)", () => {
    const src = read("features/ai-agent/__tests__/tools.find-contact.test.ts");
    expect(src).not.toMatch(/from\s*["']@\/features\/contacts\/server["']/);
  });

  // tools.parse-operation.test.ts
  it("Test 17: tools.parse-operation.test.ts contains Sub-B inline `as unknown as ReturnType<typeof makeContactsService>` cast pattern hex barrel target (POSITIVE TYPE swap Marco lock 2 + Sub-B confirmed NO hex barrel surface contamination)", () => {
    const src = read("features/ai-agent/__tests__/tools.parse-operation.test.ts");
    expect(src).toMatch(
      /as\s+unknown\s+as\s+ReturnType<typeof\s+makeContactsService>/,
    );
  });
  it("Test 18: tools.parse-operation.test.ts NO contains legacy import `from \"@/features/contacts/server\"` (NEGATIVE legacy shim path dropped post-cutover)", () => {
    const src = read("features/ai-agent/__tests__/tools.parse-operation.test.ts");
    expect(src).not.toMatch(/from\s*["']@\/features\/contacts\/server["']/);
  });
});
