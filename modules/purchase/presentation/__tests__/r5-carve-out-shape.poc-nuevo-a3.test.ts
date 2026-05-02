/**
 * POC nuevo A3-C1.5 — ESLint R5 carve-out shape (§13.V resolution paired follow-up).
 *
 * Axis: eslint.config.mjs R5 carve-out for presentation/ layer type-only Prisma
 * imports. Axis-orthogonal vs A3-C1 asymmetry-shape (build hex file/export shape) —
 * mirror A2-C2 Q4 precedent NUEVO archivo distinct axis.
 *
 * §13.V emergente background (POST-A3-C1 GREEN write durante pre-commit verify):
 * `purchase-with-details.ts` mirror sale precedent reproduce R5 violation simétrica
 * (`sale-with-details.ts` viola R5 inherited POC #11.0a A5 β Ciclo 3). ESLint
 * baseline 11→12 errors regression aceptada A3-C1 GREEN (commit 83af4d3).
 * Resolution paired A3-C1.5 RED+GREEN: opción nativa ESLint `allowTypeImports:
 * true` añadida a presentation layer rules — type imports permitidos (read-side
 * DTO hydration via Omit/extends Prisma types) sin afectar runtime value imports
 * (R5 strict preserved value imports + domain + application layers).
 *
 * Expected post-GREEN baseline: 12 → 10 errors (-2 = sale precedent inherited
 * removal -1 + purchase A3-C1 removal -1 = -1 NETO improvement vs heredado 11).
 *
 * 2 assertions β (Marco lock Q3):
 *   - Test 1 RED: eslint.config.mjs defines `banPrismaInPresentation` const con
 *     `allowTypeImports: true` (carve-out cementación). FALLA pre-GREEN porque
 *     el const no existe; sólo `banPrismaInDomain` strict declarado L32-38.
 *   - Test 2 RED: presentation R4 block usa `banPrismaInPresentation` +
 *     domain/application R1+R2 blocks usan `banPrismaInDomain` strict (scope
 *     boundary cementación). FALLA pre-GREEN porque presentation block referencia
 *     `banPrismaInDomain` (L156) — post-GREEN cambia a `banPrismaInPresentation`.
 *
 * GREEN approach (Q1 lock Marco): augment `banPrismaInDomain` array via map
 * spread añadiendo `allowTypeImports: true` por pattern object — DRY const
 * variant. Architectural intent: "presentation/ DTOs MAY hydrate read-side via
 * Prisma TYPE imports — runtime value imports remain banned per R5 strict
 * (composition-root.ts continúa ignored separately L152 para runtime Prisma
 * instance access)".
 *
 * Self-contained future-proof check (lección A6 #5): shape test asserta
 * `eslint.config.mjs` (root file) que persiste post-A3-C2..C8. NO toca
 * features/{sale,purchase}/* que A3-C7/C8 borran wholesale ✅.
 *
 * Cementación architecture.md decision (Marco lock Q4): defer A3-C8 doc-only
 * post-mortem cumulative (NO architecture.md update este ciclo).
 *
 * Cross-ref:
 * - A3-C1 RED commit 0781f98 (asymmetry-shape 10 assertions α)
 * - A3-C1 GREEN commit 83af4d3 (build hex purchase presentation 4 archivos +
 *   §13.V emergente surfaced ESLint baseline +1 regression aceptada temporal)
 * - eslint.config.mjs L32-38 banPrismaInDomain strict + L147-159 R4 layer block
 * - mirror A2-C2 Q4 precedent vi-mock-legacy-cleanup-shape archivo NUEVO axis distinct
 * - mirror A2-C1.5 §13.H+I follow-up paired RED+GREEN precedent (POC siguiente)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const ESLINT_CONFIG_PATH = path.join(REPO_ROOT, "eslint.config.mjs");

/**
 * Helper: extract a layer-rules block from `eslint.config.mjs` source by
 * matching the comment header `Hexagonal RX, R5 — LAYER/ layer` and capturing
 * until the next Hexagonal block header or the closing `]);` of `eslintConfig`.
 * Multi-line via `[\s\S]` + lazy quantifier; lookahead defines stop boundary.
 */
function extractLayerBlock(
  source: string,
  layer: "R1" | "R2" | "R4",
): string {
  const re = new RegExp(
    `Hexagonal\\s+${layer}[\\s\\S]*?(?=Hexagonal\\s+R[124]|^\\s*\\]\\s*\\);)`,
    "m",
  );
  const match = source.match(re);
  if (!match) {
    throw new Error(`extractLayerBlock: layer ${layer} block not found`);
  }
  return match[0];
}

describe("POC nuevo A3-C1.5 — ESLint R5 carve-out shape (§13.V resolution)", () => {
  it("Test 1: eslint.config.mjs defines banPrismaInPresentation const with allowTypeImports: true (R5 carve-out cementación)", () => {
    const source = fs.readFileSync(ESLINT_CONFIG_PATH, "utf8");
    expect(source).toMatch(
      /banPrismaInPresentation\s*=[\s\S]*?allowTypeImports\s*:\s*true/,
    );
  });

  it("Test 2: presentation block uses banPrismaInPresentation + domain/application blocks use banPrismaInDomain strict (scope boundary cementación)", () => {
    const source = fs.readFileSync(ESLINT_CONFIG_PATH, "utf8");
    const domainBlock = extractLayerBlock(source, "R1");
    const applicationBlock = extractLayerBlock(source, "R2");
    const presentationBlock = extractLayerBlock(source, "R4");
    expect({
      presentationCarveOut: /banPrismaInPresentation/.test(presentationBlock),
      domainStrict:
        /banPrismaInDomain\b/.test(domainBlock) &&
        !/banPrismaInPresentation/.test(domainBlock),
      applicationStrict:
        /banPrismaInDomain\b/.test(applicationBlock) &&
        !/banPrismaInPresentation/.test(applicationBlock),
    }).toEqual({
      presentationCarveOut: true,
      domainStrict: true,
      applicationStrict: true,
    });
  });
});
