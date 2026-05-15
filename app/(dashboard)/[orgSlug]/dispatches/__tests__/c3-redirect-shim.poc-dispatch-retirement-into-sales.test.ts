/**
 * POC: poc-dispatch-retirement-into-sales — Cycle C3 RED
 *
 * 3α sentinels asserting `/dispatches/page.tsx` becomes a `permanentRedirect`
 * shim and the sidebar registry repoints "Ventas" entry to `/sales`.
 *
 * Failure modes declared (per [[red_acceptance_failure_mode]]):
 *  α-C3-redirect-present  page.tsx body has NOT been replaced — `permanentRedirect`
 *                          call MISSING → regex MISMATCH → FAIL ✓
 *  α-C3-sidebar-href      sidebar registry line 87 still `/dispatches` →
 *                          inversion-target regex MATCH on old path → FAIL ✓
 *  α-C3-no-data-fetch     page.tsx still calls `hubService.listHub` →
 *                          regex MATCH on banned call → FAIL ✓
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DISPATCHES_PAGE_PATH = resolve(__dirname, "..", "page.tsx");
const SIDEBAR_REGISTRY_PATH = resolve(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "..",
  "..",
  "components",
  "sidebar",
  "modules",
  "registry.ts",
);

function readSrc(p: string): string {
  return readFileSync(p, "utf8");
}

describe("POC dispatch-retirement-into-sales C3 — /dispatches redirect shim + sidebar repoint (RED)", () => {
  it("α-C3-redirect-present: /dispatches/page.tsx calls permanentRedirect with /${orgSlug}/sales", () => {
    const src = readSrc(DISPATCHES_PAGE_PATH);
    expect(src).toMatch(
      /^import\s+\{[^}]*\bpermanentRedirect\b[^}]*\}\s+from\s+"next\/navigation";?$/m,
    );
    expect(src).toMatch(/permanentRedirect\s*\(\s*`\/\$\{orgSlug\}\/sales`\s*\)/);
  });

  it("α-C3-sidebar-href: sidebar registry Ventas entry href = /sales (not /dispatches)", () => {
    const src = readSrc(SIDEBAR_REGISTRY_PATH);
    expect(src).not.toMatch(/href:\s*\(orgSlug\)\s*=>\s*`\/\$\{orgSlug\}\/dispatches`/);
    expect(src).toMatch(/href:\s*\(orgSlug\)\s*=>\s*`\/\$\{orgSlug\}\/sales`/);
  });

  it("α-C3-no-data-fetch: /dispatches/page.tsx has NO HubService import and NO listHub call", () => {
    const src = readSrc(DISPATCHES_PAGE_PATH);
    expect(src).not.toMatch(/\bHubService\b/);
    expect(src).not.toMatch(/\.listHub\s*\(/);
  });
});
