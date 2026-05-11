/**
 * RED → GREEN — HOTFIX RETROACTIVO
 *
 * C2h — POC #1 UX accordion granjero mayor — farm-detail-client.tsx remove header
 * farm-level AI button (`RegistrarConIABoton` farm-level contextHints { farmId, farmName })
 * single source of truth contextHints per-lote scope EXACT.
 *
 * 3α minimal scope shape regex Opt A:
 *  - α1 (negative NEW): src NOT contains `farmName: farm.name` (header-level property removed).
 *  - α2 (positive heredado): src contains `lotName: lot.name` (per-lote scope preserved heredado C1).
 *  - α3 (positive heredado): src contains `<RegistrarConIABoton` (component still used per-lote heredado C1).
 *
 * Expected mode pre-GREEN: 1/3 FAIL (α1 src still contains farmName: farm.name header)
 * + 2/3 PASS (α2+α3 heredados per-lote scope preserved). Post-GREEN flip: 3/3 PASS.
 *
 * D-HOTFIX-C2h locks Marco-aprobados:
 *  - D-HOTFIX-C2h-CAUSE: Marco visual intuition runtime smoke catches UX button context
 *    ambiguity granjero mayor — header farm-level contextHints { farmId, farmName }
 *    insuficiente cuando granja tiene ≥2 lotes activos. AI agent post-tap header re-prompt
 *    disambiguation lote → 1 step extra workflow violation simplicidad UX granjero mayor.
 *    Cementación engrams: §13.UX button-context-ambiguity-axis-distinct +
 *    §13.UX single-source-of-truth-context-hints-axis-distinct + Marco-visual-intuition-
 *    button-context-ambiguity-pre-cementation-runtime-smoke-verify cumulative cross-POC.
 *  - D-HOTFIX-C2h-OPT-C: Opt C (remove botón header farm-level) ACEPTADO vs Opt A (modal
 *    scope picker tras tap → 1 step extra granjero violation) + Opt B (conditional render
 *    1-lote-only → lógica complejidad anti-pattern scope creep).
 *  - D-HOTFIX-C2h-SCOPE: 3α minimal scope shape regex Opt A (1 negative + 2 positive
 *    heredados) — paired sister C1h precedent EXACT mirror RED+GREEN pattern hotfix retroactivo.
 *  - D-HOTFIX-C2h-PRESERVE: per-lote RegistrarConIABoton inside AccordionContent expanded
 *    preserved EXACT (heredado C1 cementado contextHints { lotId, lotName, farmId } single
 *    source of truth per-lote scope).
 *  - D-HOTFIX-C2h-TEST-PATH: components/farms/__tests__/c2h-farm-detail-no-farm-level-ai-button.poc-1-...
 *  - D-HOTFIX-C2h-GRANULARITY: 2-commit batch (RED-α-hotfix + GREEN-α-hotfix atomic single batch).
 *  - D-HOTFIX-C2h-SMOKE: smoke runtime mobile + desktop Marco-side post-GREEN MANDATORY
 *    pre-D1 cementación (functional + UX granjero cognitive load axis distinct).
 *
 * Lecciones cumulative cross-POC matures aplicadas:
 *  - Marco-visual-intuition-button-context-ambiguity-pre-cementation-runtime-smoke-verify
 *    1ra evidencia POC #1 hotfix C2h — runtime smoke Marco-side ES última capa verify UX
 *    granjero, tests unitarios shape NO detectan UX cognitive load decisión-context.
 *  - evidence-supersedes-assumption-lock 52ma matures recursive — D-POC-1 header AI button
 *    scope farm-level lock heredado SUPERSEDED por Marco runtime smoke UX intuition catch
 *    ambiguity latente.
 *  - paired-sister-filesystem-verify 1ma matures — POC #2 cementado contextHints
 *    COMPLETOS requirement axis-distinct preserved forward (per-lote scope EXACT).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const FARM_DETAIL_PATH = "app/(dashboard)/[orgSlug]/farms/[farmId]/farm-detail-client.tsx";

function readRepoFile(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), "utf-8");
}

describe("C2h farm-detail no farm-level AI button — POC #1 UX accordion granjero mayor (hotfix retroactivo)", () => {
  // α1 (negative NEW) — src NOT contains `farmName: farm.name` (header farm-level removed)
  it("α1: farm-detail-client.tsx does NOT contain `farmName: farm.name` (header farm-level AI button removed — single source of truth contextHints per-lote)", () => {
    const src = readRepoFile(FARM_DETAIL_PATH);
    expect(src).not.toMatch(/farmName:\s*farm\.name/);
  });

  // α2 (positive heredado) — src contains `lotName: lot.name` (per-lote scope preserved C1)
  it("α2: farm-detail-client.tsx contains `lotName: lot.name` (per-lote scope contextHints preserved heredado C1)", () => {
    const src = readRepoFile(FARM_DETAIL_PATH);
    expect(src).toMatch(/lotName:\s*lot\.name/);
  });

  // α3 (positive heredado) — src contains `<RegistrarConIABoton` (per-lote component preserved C1)
  it("α3: farm-detail-client.tsx contains `<RegistrarConIABoton` (per-lote component still used inside AccordionContent expanded preserved heredado C1)", () => {
    const src = readRepoFile(FARM_DETAIL_PATH);
    expect(src).toMatch(/<RegistrarConIABoton/);
  });
});
