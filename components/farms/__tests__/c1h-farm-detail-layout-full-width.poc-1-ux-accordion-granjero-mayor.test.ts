/**
 * RED → GREEN — HOTFIX RETROACTIVO
 *
 * C1h — POC #1 UX accordion granjero mayor — farm-detail-client.tsx root wrapper
 * full-width edge-to-edge layout convention (paired sister codebase verify MANDATORY
 * SUPERSEDED D-POC-1-DESKTOP-LAYOUT Opt A "max-width centered" lock heredado).
 *
 * 3α minimal scope shape regex Opt A:
 *  - α1 (negative): root wrapper className NOT contains `max-w-` (full-width convention).
 *  - α2 (negative): root wrapper className NOT contains `mx-auto` (edge-to-edge no centering).
 *  - α3 (positive): root wrapper className contains `space-y-` (vertical rhythm paired sister preserved).
 *
 * Expected mode pre-GREEN: 2/3 FAIL (α1+α2 still contain max-w-5xl + mx-auto) + 1/3 PASS
 * (α3 heredado paired sister convention already preserved space-y-6).
 * Post-GREEN flip: 3/3 PASS.
 *
 * D-HOTFIX-C1h locks Marco-aprobados:
 *  - D-HOTFIX-C1h-CAUSE: evidence-supersedes-assumption-lock 52ma matures cumulative
 *    cross-POC — D-POC-1-DESKTOP-LAYOUT Opt A lock heredado SUPERSEDED por filesystem
 *    verified codebase paired sister convention (farms list page.tsx:49 + lot-detail-client.tsx:141
 *    + (dashboard)/layout.tsx:19 — all full-width edge-to-edge, NO max-w-* NO mx-auto).
 *  - D-HOTFIX-C1h-EXCEPTION: (orgSlug)/page.tsx:47 `mx-auto max-w-md py-16 text-center`
 *    excepción válida landing/empty state pattern — NO la regla codebase convention.
 *  - D-HOTFIX-C1h-SCOPE: 3α minimal scope (2 negative + 1 positive heredado) — paired sister
 *    precedent EXACT mirror RED+GREEN pattern hotfix retroactivo minimal scope.
 *  - D-HOTFIX-C1h-TEST-PATH: components/farms/__tests__/c1h-farm-detail-layout-full-width.poc-1-...
 *  - D-HOTFIX-C1h-GRANULARITY: 2-commit batch (RED-α-hotfix + GREEN-α-hotfix atomic single batch).
 *
 * Lecciones cumulative cross-POC matures aplicadas:
 *  - evidence-supersedes-assumption-lock 52ma matures — Marco surface honest SMOKE FAIL #1 UX
 *    runtime evidence SUPERSEDES heredado lock (D-POC-1-DESKTOP-LAYOUT Opt A) sin codebase verify.
 *  - textual-rule-verification 27ma matures — paired sister codebase filesystem verify MANDATORY
 *    pre-lock acceptance. Aplicación recursiva: lock visual UX requiere verify codebase actual
 *    routes paired sister, NO solo conceptual reasoning.
 *  - §13.UI/PATTERN NEW canonical home: max-width centered SUPERSEDED full-width edge-to-edge
 *    paired sister codebase convention (cementación D1 pendiente).
 *  - §13.UI/PATTERN NEW canonical home: Pre-write paired sister filesystem verify MANDATORY
 *    pre-lock acceptance (cementación D1 pendiente).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..", "..");

function readRepoFile(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), "utf-8");
}

function extractRootWrapperClass(src: string): string {
  // Match first `<div className="..."` after the `return (` of the default export render
  // (root wrapper convention paired sister precedent /lots/[lotId]/lot-detail-client.tsx:141).
  const match = src.match(/return\s*\(\s*<div\s+className=["']([^"']+)["']/);
  if (!match) {
    throw new Error("Root wrapper <div className=\"...\"> not found in source");
  }
  return match[1];
}

describe("C1h farm-detail layout full-width — POC #1 UX accordion granjero mayor (hotfix retroactivo)", () => {
  // α1 (negative) — root wrapper NOT contains `max-w-` (full-width convention paired sister)
  it("α1: farm-detail-client.tsx root wrapper className does NOT contain `max-w-` (full-width edge-to-edge convention paired sister farms list + lot-detail-client)", () => {
    const src = readRepoFile("app/(dashboard)/[orgSlug]/farms/[farmId]/farm-detail-client.tsx");
    const rootClass = extractRootWrapperClass(src);
    expect(rootClass).not.toMatch(/\bmax-w-/);
  });

  // α2 (negative) — root wrapper NOT contains `mx-auto` (edge-to-edge no centering paired sister)
  it("α2: farm-detail-client.tsx root wrapper className does NOT contain `mx-auto` (edge-to-edge no centering convention paired sister)", () => {
    const src = readRepoFile("app/(dashboard)/[orgSlug]/farms/[farmId]/farm-detail-client.tsx");
    const rootClass = extractRootWrapperClass(src);
    expect(rootClass).not.toMatch(/\bmx-auto\b/);
  });

  // α3 (positive heredado) — root wrapper contains `space-y-` (vertical rhythm paired sister preserved)
  it("α3: farm-detail-client.tsx root wrapper className contains `space-y-` (vertical rhythm convention paired sister preserved heredado)", () => {
    const src = readRepoFile("app/(dashboard)/[orgSlug]/farms/[farmId]/farm-detail-client.tsx");
    const rootClass = extractRootWrapperClass(src);
    expect(rootClass).toMatch(/\bspace-y-\d+\b/);
  });
});
