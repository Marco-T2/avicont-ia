/**
 * RED → GREEN
 *
 * C2 — POC #1 UX accordion granjero mayor — farm-detail-client.tsx responsive
 * Tailwind breakpoints lock cumulative + hotfix granja-header grid mobile-stack.
 *
 * 7α enumerated explicit shape regex Opt A:
 *  - α1 (NEW positive): granja header 3-card grid contains `grid-cols-1 sm:grid-cols-3`
 *    (mobile-stack 1col → sm desktop 3col). Hotfix scope L170 `grid-cols-3` fijo → responsive.
 *  - α2-α7 (heredados positive): lock cumulative responsive convention C0+C1+C1h preserved.
 *
 * Expected mode pre-GREEN: 1/7 FAIL (α1 src still has `grid-cols-3` fijo without sm: prefix)
 * + 6/7 PASS (heredados). Post-GREEN flip: 7/7 PASS.
 *
 * D-POC-1-C2 locks Marco-aprobados:
 *  - D-C2-SCOPE: minimal hotfix L170 granja header `grid-cols-3` → `grid-cols-1 sm:grid-cols-3`
 *    (mobile portrait 360-375px aprieta con 3 cards horizontales — paired sister lot-detail
 *    convention `grid-cols-2 md:grid-cols-4` precedent ya stack mobile).
 *  - D-C2-CONVENTION: farm-detail mantiene `sm:` breakpoint (heredado C0+C1) — alignment vs
 *    paired sister `md:` deferred (no fix scope C2, surface §13 candidate D1 cementación).
 *  - D-C2-GRANULARITY: 2-commit batch (RED-α + GREEN-α atomic single batch EXACT mirror C1h).
 *  - D-C2-TEST-PATH: components/farms/__tests__/c2-farm-detail-responsive-breakpoints.poc-1-...
 *  - D-C2-SMOKE: smoke runtime mobile portrait (360-375px) + desktop (1024px+) Marco-side
 *    CONFIRMED MANDATORY post-GREEN pre-D1 cementación.
 *
 * Lecciones cumulative cross-POC matures aplicadas:
 *  - evidence-supersedes-assumption-lock 52ma matures — `grid-cols-3` fijo lock asumido OK
 *    desktop SUPERSEDED por mobile portrait constraint runtime aprieta (Marco runtime feedback
 *    + paired sister lot-detail-client `grid-cols-2 md:grid-cols-4` mobile-stack convention).
 *  - textual-rule-verification 27ma matures — pre-write paired sister codebase verify MANDATORY
 *    lot-detail-client.tsx:177 `grid grid-cols-2 md:grid-cols-4` + farms-client.tsx:60
 *    `grid gap-4 md:grid-cols-2 lg:grid-cols-3` — mobile-stack convention codebase consistente.
 *  - cross-cycle-red-test-cementación-gate 5ma matures — C2 scope responsive breakpoints axis
 *    distinct vs C0 shape (4 métricas + 3 header globales) + C1 expanded (10 expenses + 5
 *    mortality + 3 botones + Ver más) + C1h layout convention (NOT max-w- + NOT mx-auto).
 *    Zero collision overlap verified pre-RED.
 *  - §13.UI/PATTERN candidate D1: responsive Tailwind breakpoints mobile-first stack pattern
 *    (cementación D1 pendiente — sub-§ axis distinct).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const FARM_DETAIL_PATH = "app/(dashboard)/[orgSlug]/farms/[farmId]/farm-detail-client.tsx";

function readRepoFile(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), "utf-8");
}

describe("C2 farm-detail responsive breakpoints — POC #1 UX accordion granjero mayor", () => {
  // α1 (NEW positive) — granja header 3-card grid mobile-stack: `grid-cols-1 sm:grid-cols-3`
  it("α1: granja header 3-card grid contains `grid-cols-1 sm:grid-cols-3` (mobile-stack 1col → sm desktop 3col, paired sister mobile-stack convention)", () => {
    const src = readRepoFile(FARM_DETAIL_PATH);
    expect(src).toMatch(/\bgrid-cols-1 sm:grid-cols-3\b/);
  });

  // α2 (heredado positive) — h1 farm name responsive: `text-2xl sm:text-3xl`
  it("α2: farm h1 contains `text-2xl sm:text-3xl` (responsive heading mobile compact → desktop large, heredado C0)", () => {
    const src = readRepoFile(FARM_DETAIL_PATH);
    expect(src).toMatch(/\btext-2xl sm:text-3xl\b/);
  });

  // α3 (heredado positive) — header botones cluster stack mobile: `flex flex-col sm:flex-row`
  it("α3: header botones wrapper contains `flex flex-col sm:flex-row` (mobile-stack botones → desktop horizontal, heredado C0)", () => {
    const src = readRepoFile(FARM_DETAIL_PATH);
    expect(src).toMatch(/\bflex flex-col sm:flex-row\b/);
  });

  // α4 (heredado positive) — granja header cards padding responsive: `pt-4 sm:pt-6`
  it("α4: granja header CardContent contains `pt-4 sm:pt-6` (responsive padding compact mobile → spacious desktop, heredado C0)", () => {
    const src = readRepoFile(FARM_DETAIL_PATH);
    expect(src).toMatch(/\bpt-4 sm:pt-6\b/);
  });

  // α5 (heredado positive) — granja header values responsive: `text-lg sm:text-2xl`
  it("α5: granja header values contains `text-lg sm:text-2xl` (responsive value text mobile compact → desktop large, heredado C0)", () => {
    const src = readRepoFile(FARM_DETAIL_PATH);
    expect(src).toMatch(/\btext-lg sm:text-2xl\b/);
  });

  // α6 (heredado positive) — 4 métricas collapsed per-lote: `grid-cols-2 sm:grid-cols-4`
  it("α6: 4 métricas collapsed per-lote contains `grid-cols-2 sm:grid-cols-4` (mobile 2x2 → desktop 1x4, heredado C0)", () => {
    const src = readRepoFile(FARM_DETAIL_PATH);
    expect(src).toMatch(/\bgrid-cols-2 sm:grid-cols-4\b/);
  });

  // α7 (heredado positive) — 3 botones cluster expanded wrap mobile: `flex flex-wrap gap-2`
  it("α7: 3 botones cluster expanded contains `flex flex-wrap gap-2` (mobile wrap → desktop horizontal, heredado C1)", () => {
    const src = readRepoFile(FARM_DETAIL_PATH);
    expect(src).toMatch(/\bflex flex-wrap gap-2\b/);
  });
});
