/**
 * RED → GREEN
 *
 * C1 — POC #1 UX accordion granjero mayor — farm-detail-client.tsx AccordionContent
 * expanded render shape regex Opt A existence-only (paired sister C0
 * c0-farm-detail-accordion-shape.poc-1-ux-accordion-granjero-mayor.test.ts EXACT mirror —
 * readFileSync source verify regex assertions).
 *
 * 12α enumerated explicit:
 *  - α1-α3 page.tsx server-slice expand:
 *      α1: sort desc by date + slice recent expenses per-lot (10 max)
 *      α2: sort desc by date + slice recent mortality per-lot (5 max)
 *      α3: propaga recentExpenses + recentMortality per-lot props a FarmDetailClient
 *  - α4-α12 farm-detail-client.tsx AccordionContent expand:
 *      α4: FarmDetailClientProps lots type expand { lot, summary, recentExpenses, recentMortality }
 *      α5: imports CreateExpenseForm + LogMortalityForm
 *      α6: AccordionContent renders 3 botones cluster (AI + Gasto manual + Mortalidad manual)
 *      α7: AccordionContent "Gastos recientes" heading
 *      α8: AccordionContent per-expense item Badge + currency + date
 *      α9: AccordionContent "Mortalidad reciente" heading
 *      α10: AccordionContent per-mortality item count + cause + date
 *      α11: AccordionContent "Ver más" Link → `/{orgSlug}/lots/{lot.id}`
 *      α12: RegistrarConIABoton per-lot contextHints lotId + lotName
 *
 * Expected mode pre-GREEN: 12/12 FAIL behavioral assertion mismatch (NO heredado PASS — C1
 * builds on C0 GREEN cementado directly, no Pre-C1 chore precede).
 * Post-GREEN flip: 12/12 PASS.
 *
 * D-RED-C1 locks Marco-aprobados:
 *  - D-RED-C1-SCOPE: 12α enumerated explicit Opt A shape regex (paired sister C0 EXACT mirror).
 *  - D-RED-C1-SLICE: server slice page.tsx (sort desc by date + top N per-lot).
 *  - D-RED-C1-TEST-PATH: components/farms/__tests__/c1-farm-detail-accordion-expanded.poc-1-...
 *  - D-RED-C1-GRANULARITY: 2-commit batch (RED-α + GREEN-α atomic single batch).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..", "..");

function readRepoFile(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), "utf-8");
}

describe("C1 farm-detail accordion expanded — POC #1 UX accordion granjero mayor (existence-only regex)", () => {
  // α1 — page.tsx server-slice recent expenses per-lot (sort desc by date + slice 10 max)
  it("α1: farms/[farmId]/page.tsx sorts expenses desc by date + slices recent 10 per-lot", () => {
    const src = readRepoFile("app/(dashboard)/[orgSlug]/farms/[farmId]/page.tsx");
    expect(src).toMatch(/\brecentExpenses\b/);
    expect(src).toMatch(/\.sort\([^)]*\)[\s\S]{0,200}\.slice\(\s*0\s*,\s*10\s*\)/);
  });

  // α2 — page.tsx server-slice recent mortality per-lot (sort desc by date + slice 5 max)
  it("α2: farms/[farmId]/page.tsx sorts mortality desc by date + slices recent 5 per-lot", () => {
    const src = readRepoFile("app/(dashboard)/[orgSlug]/farms/[farmId]/page.tsx");
    expect(src).toMatch(/\brecentMortality\b/);
    expect(src).toMatch(/\.sort\([^)]*\)[\s\S]{0,200}\.slice\(\s*0\s*,\s*5\s*\)/);
  });

  // α3 — page.tsx propagates recentExpenses + recentMortality per-lot via lots prop
  it("α3: farms/[farmId]/page.tsx propagates recentExpenses + recentMortality per-lot inside lots prop", () => {
    const src = readRepoFile("app/(dashboard)/[orgSlug]/farms/[farmId]/page.tsx");
    expect(src).toMatch(/recentExpenses\s*[:,]/);
    expect(src).toMatch(/recentMortality\s*[:,]/);
  });

  // α4 — FarmDetailClientProps lots type expands { lot, summary, recentExpenses, recentMortality }
  it("α4: FarmDetailClientProps lots field type expands `{ lot, summary, recentExpenses, recentMortality }`", () => {
    const src = readRepoFile("app/(dashboard)/[orgSlug]/farms/[farmId]/farm-detail-client.tsx");
    expect(src).toMatch(/lots:\s*(?:Array|ReadonlyArray)\s*<\s*\{[^}]*\blot\s*:\s*LotSnapshot[^}]*\bsummary\s*:\s*LotSummaryShape[^}]*\brecentExpenses\s*:[^}]*\brecentMortality\s*:[^}]*\}\s*>/m);
  });

  // α5 — farm-detail-client.tsx imports CreateExpenseForm + LogMortalityForm (manual action forms)
  it("α5: farm-detail-client.tsx imports CreateExpenseForm + LogMortalityForm (manual action forms heredado paired sister precedent)", () => {
    const src = readRepoFile("app/(dashboard)/[orgSlug]/farms/[farmId]/farm-detail-client.tsx");
    expect(src).toMatch(/^import\s+CreateExpenseForm\s+from\s+["']@\/components\/expenses\/create-expense-form["']/m);
    expect(src).toMatch(/^import\s+LogMortalityForm\s+from\s+["']@\/components\/mortality\/log-mortality-form["']/m);
  });

  // α6 — 3 botones cluster per-lot scoped inside AccordionContent (AI + CreateExpenseForm + LogMortalityForm)
  it("α6: farm-detail-client.tsx renders 3 botones cluster per-lot inside AccordionContent (RegistrarConIABoton + CreateExpenseForm + LogMortalityForm)", () => {
    const src = readRepoFile("app/(dashboard)/[orgSlug]/farms/[farmId]/farm-detail-client.tsx");
    // <AccordionContent> ... 3 components anywhere inside it before closing tag
    expect(src).toMatch(/<AccordionContent\b[\s\S]*?<RegistrarConIABoton[\s\S]*?<CreateExpenseForm[\s\S]*?<LogMortalityForm[\s\S]*?<\/AccordionContent>/);
  });

  // α7 — "Gastos recientes" heading inside AccordionContent
  it("α7: farm-detail-client.tsx renders 'Gastos recientes' heading inside AccordionContent", () => {
    const src = readRepoFile("app/(dashboard)/[orgSlug]/farms/[farmId]/farm-detail-client.tsx");
    expect(src).toMatch(/Gastos\s+recientes/i);
  });

  // α8 — per-expense item renders Badge (category) + formatCurrency + formatDate (paired sister lot-detail-client precedent)
  it("α8: farm-detail-client.tsx renders per-expense item with Badge (category) + formatCurrency + formatDate (paired sister lot-detail-client precedent)", () => {
    const src = readRepoFile("app/(dashboard)/[orgSlug]/farms/[farmId]/farm-detail-client.tsx");
    expect(src).toMatch(/recentExpenses\.map/);
    expect(src).toMatch(/\bformatDate\(/);
    expect(src).toMatch(/\bCATEGORY_CONFIG\b/);
  });

  // α9 — "Mortalidad reciente" heading inside AccordionContent
  it("α9: farm-detail-client.tsx renders 'Mortalidad reciente' heading inside AccordionContent", () => {
    const src = readRepoFile("app/(dashboard)/[orgSlug]/farms/[farmId]/farm-detail-client.tsx");
    expect(src).toMatch(/Mortalidad\s+reciente/i);
  });

  // α10 — per-mortality item renders count + cause + date (paired sister lot-detail-client precedent)
  it("α10: farm-detail-client.tsx renders per-mortality item with count + cause + date (paired sister lot-detail-client precedent)", () => {
    const src = readRepoFile("app/(dashboard)/[orgSlug]/farms/[farmId]/farm-detail-client.tsx");
    expect(src).toMatch(/recentMortality\.map/);
    expect(src).toMatch(/variant=["']destructive["']/);
  });

  // α11 — "Ver más" Link → `/{orgSlug}/lots/{lot.id}` (D-POC-1-NEW-LOTS-ROUTE-PRESERVATION sinergia)
  it("α11: farm-detail-client.tsx renders 'Ver más' Link → `/${orgSlug}/lots/${lot.id}` (D-POC-1-NEW-LOTS-ROUTE-PRESERVATION sinergia)", () => {
    const src = readRepoFile("app/(dashboard)/[orgSlug]/farms/[farmId]/farm-detail-client.tsx");
    expect(src).toMatch(/Ver\s+m[aá]s/i);
    expect(src).toMatch(/<Link\b[^>]*href=\{`?\/\$\{orgSlug\}\/lots\/\$\{lot\.id\}`?\}/);
  });

  // α12 — RegistrarConIABoton per-lot scoped contextHints lotId + lotName (heredado POC #2 cementado scoped pattern)
  it("α12: farm-detail-client.tsx renders RegistrarConIABoton per-lot inside AccordionContent with contextHints lotId + lotName (heredado POC #2 cementado scoped pattern)", () => {
    const src = readRepoFile("app/(dashboard)/[orgSlug]/farms/[farmId]/farm-detail-client.tsx");
    expect(src).toMatch(/<AccordionContent\b[\s\S]*?<RegistrarConIABoton[\s\S]*?lotId:\s*lot\.id[\s\S]*?lotName:\s*lot\.name[\s\S]*?<\/RegistrarConIABoton>|<AccordionContent\b[\s\S]*?<RegistrarConIABoton[\s\S]*?lotId:\s*lot\.id[\s\S]*?lotName:\s*lot\.name[\s\S]*?\/>/);
  });
});
