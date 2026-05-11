/**
 * RED → GREEN
 *
 * C0 — POC #1 UX accordion granjero mayor — farm-detail-client.tsx shape regex Opt A
 * existence-only (paired sister modules/lot/__tests__/c0-domain-shape.poc-paired-farms-lots.test.ts
 * precedent EXACT mirror — readFileSync source verify regex assertions).
 *
 * 12α enumerated explicit:
 *  - α1 verify shadcn wrapper components/ui/accordion.tsx 4 exports (PASS post-pre-C0 chore install
 *    commit c2a42fe — wrapper file emerged via `npx shadcn add accordion`).
 *  - α2-α5 farm-detail-client.tsx imports + types expand (FAIL pre-GREEN — edits NO applied yet).
 *  - α6-α9 farm-detail-client.tsx render shape (FAIL pre-GREEN — Accordion + 3 granja-header
 *    cards + per-lot 4 collapsed metrics NO rendered yet).
 *  - α10-α12 page.tsx server-fetch expand Promise.all + farmMetrics aggregation + props pass
 *    (FAIL pre-GREEN — page.tsx edits NO applied yet).
 *
 * Expected mode pre-GREEN: 1/12 PASS (α1) + 11/12 FAIL behavioral assertion mismatch (α2-α12).
 * Post-GREEN flip: 12/12 PASS.
 *
 * D-RED-C0 locks Marco-aprobados:
 *  - D-RED-C0-SCOPE: 12α enumerated explicit Opt A shape regex (paired sister POC paired
 *    farms+lots C0 14α precedent reduced — POC #1 UX scope acotado vs domain shape complexity).
 *  - D-RED-C0-TEST-PATH: components/farms/__tests__/c0-farm-detail-accordion-shape.poc-1-...
 *  - D-RED-C0-GRANULARITY: 3-commit batch (pre-C0 chore c2a42fe ✓ + RED-α + GREEN-α).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..", "..");

function readRepoFile(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), "utf-8");
}

describe("C0 farm-detail accordion shape — POC #1 UX accordion granjero mayor (existence-only regex)", () => {
  // α1 — shadcn wrapper exports 4 components (PASS post-pre-C0 chore install c2a42fe)
  it("α1: components/ui/accordion.tsx exports Accordion + AccordionItem + AccordionTrigger + AccordionContent (shadcn canonical wrapper)", () => {
    const src = readRepoFile("components/ui/accordion.tsx");
    expect(src).toMatch(/^export\s*\{[^}]*\bAccordion\b[^}]*\bAccordionItem\b[^}]*\bAccordionTrigger\b[^}]*\bAccordionContent\b[^}]*\}/m);
  });

  // α2 — farm-detail-client.tsx imports Accordion from shadcn wrapper
  it("α2: farm-detail-client.tsx imports Accordion + AccordionItem + AccordionTrigger + AccordionContent from @/components/ui/accordion", () => {
    const src = readRepoFile("app/(dashboard)/[orgSlug]/farms/[farmId]/farm-detail-client.tsx");
    expect(src).toMatch(/^import\s+\{[^}]*\bAccordion\b[^}]*\bAccordionItem\b[^}]*\bAccordionTrigger\b[^}]*\bAccordionContent\b[^}]*\}\s+from\s+["']@\/components\/ui\/accordion["']/m);
  });

  // α3 — farm-detail-client.tsx imports LotSummaryShape type from hex server barrel
  it("α3: farm-detail-client.tsx imports LotSummaryShape type from @/modules/lot/presentation/server", () => {
    const src = readRepoFile("app/(dashboard)/[orgSlug]/farms/[farmId]/farm-detail-client.tsx");
    expect(src).toMatch(/^import\s+type\s+\{[^}]*\bLotSummaryShape\b[^}]*\}\s+from\s+["']@\/modules\/lot\/presentation\/server["']/m);
  });

  // α4 — FarmDetailClientProps lots field type expands per-lot summary
  it("α4: FarmDetailClientProps lots field type expands `Array<{ lot: LotSnapshot; summary: LotSummaryShape }>` per-lot summary injected", () => {
    const src = readRepoFile("app/(dashboard)/[orgSlug]/farms/[farmId]/farm-detail-client.tsx");
    expect(src).toMatch(/lots:\s*(?:Array|ReadonlyArray)\s*<\s*\{[^}]*\blot\s*:\s*LotSnapshot[^}]*\bsummary\s*:\s*LotSummaryShape[^}]*\}\s*>/m);
  });

  // α5 — FarmDetailClientProps NEW farmMetrics field type 3 granja-level metrics
  it("α5: FarmDetailClientProps farmMetrics field type `{ pollosTotales: number; gastoMes: number; mortalidadMes: number }`", () => {
    const src = readRepoFile("app/(dashboard)/[orgSlug]/farms/[farmId]/farm-detail-client.tsx");
    expect(src).toMatch(/farmMetrics:\s*\{[^}]*\bpollosTotales\s*:\s*number[^}]*\bgastoMes\s*:\s*number[^}]*\bmortalidadMes\s*:\s*number[^}]*\}/m);
  });

  // α6 — 3 granja-header metric cards render labels
  it("α6: farm-detail-client.tsx renders 3 granja-header metric labels (Pollos totales + Gasto del mes + Mortalidad del mes)", () => {
    const src = readRepoFile("app/(dashboard)/[orgSlug]/farms/[farmId]/farm-detail-client.tsx");
    expect(src).toMatch(/Pollos\s+totales/);
    expect(src).toMatch(/Gasto\s+(?:del\s+)?mes/i);
    expect(src).toMatch(/Mortalidad\s+(?:del\s+)?mes/i);
  });

  // α7 — Accordion wrapper replaces lots grid div
  it("α7: farm-detail-client.tsx renders `<Accordion type=\"single\" collapsible>` wrapping lots list", () => {
    const src = readRepoFile("app/(dashboard)/[orgSlug]/farms/[farmId]/farm-detail-client.tsx");
    expect(src).toMatch(/<Accordion\b[^>]*\btype=["']single["'][^>]*\bcollapsible\b/);
  });

  // α8 — AccordionItem per-lot keyed by lot.id
  it("α8: farm-detail-client.tsx renders `<AccordionItem value={lot.id}>` per-lot keyed by id", () => {
    const src = readRepoFile("app/(dashboard)/[orgSlug]/farms/[farmId]/farm-detail-client.tsx");
    expect(src).toMatch(/<AccordionItem\b[^>]*\bvalue=\{lot\.id\}/);
  });

  // α9 — AccordionTrigger per-lot renders 4 collapsed métricas labels
  it("α9: farm-detail-client.tsx renders 4 collapsed métricas labels per-lot (Galpón + Total gastado + Pollos vivos + Costo/pollo)", () => {
    const src = readRepoFile("app/(dashboard)/[orgSlug]/farms/[farmId]/farm-detail-client.tsx");
    expect(src).toMatch(/Galp[oó]n/i);
    expect(src).toMatch(/Total\s+gastad/i);
    expect(src).toMatch(/Pollos?\s*vivos?/i);
    expect(src).toMatch(/Costo\s*\/\s*pollo/i);
  });

  // α10 — page.tsx Promise.all per-lot aggregation server-fetch
  it("α10: farms/[farmId]/page.tsx invokes `Promise.all([...])` aggregating per-lot getSummary + listByLot(expenses) + listByLot(mortality)", () => {
    const src = readRepoFile("app/(dashboard)/[orgSlug]/farms/[farmId]/page.tsx");
    expect(src).toMatch(/Promise\.all\(/);
    expect(src).toMatch(/getSummary\(/);
    expect(src).toMatch(/listByLot\(/);
  });

  // α11 — page.tsx computes farmMetrics aggregation (sum aliveCount + filter month gastos + filter month mortalidad)
  it("α11: farms/[farmId]/page.tsx computes farmMetrics aggregation { pollosTotales, gastoMes, mortalidadMes }", () => {
    const src = readRepoFile("app/(dashboard)/[orgSlug]/farms/[farmId]/page.tsx");
    expect(src).toMatch(/\bfarmMetrics\b/);
    expect(src).toMatch(/\bpollosTotales\b/);
    expect(src).toMatch(/\bgastoMes\b/);
    expect(src).toMatch(/\bmortalidadMes\b/);
  });

  // α12 — page.tsx passes lots + farmMetrics props to FarmDetailClient
  it("α12: farms/[farmId]/page.tsx passes `farmMetrics={...}` prop to <FarmDetailClient />", () => {
    const src = readRepoFile("app/(dashboard)/[orgSlug]/farms/[farmId]/page.tsx");
    expect(src).toMatch(/<FarmDetailClient\b[\s\S]*?\bfarmMetrics=\{/);
  });
});
