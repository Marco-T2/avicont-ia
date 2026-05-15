/**
 * POC: poc-dispatch-retirement-into-sales — Cycle C0 RED
 *
 * 4α sentinels asserting `/sales/page.tsx` reads cross-module
 * (Sale + Dispatch via twin-call Promise.all). Pre-GREEN ALL fail.
 *
 * Failure modes declared (per [[red_acceptance_failure_mode]]):
 *  α-C0-dispatch-import       regex MISMATCH (import not yet present)
 *  α-C0-no-hubservice         (sentinel PASSES — structural absence; gated as DECLARATIVE inversion-target)
 *  α-C0-twin-call             dispatchService.list call NOT yet present — text MISMATCH
 *  α-C0-three-types           source discriminator "sale"|"dispatch" merge NOT yet present — text MISMATCH
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(
  __dirname,
  "..",
  "page.tsx",
);

function readPageSource(): string {
  return readFileSync(PAGE_PATH, "utf8");
}

describe("POC dispatch-retirement-into-sales C0 — /sales cross-module twin-call (RED)", () => {
  it("α-C0-dispatch-import: /sales/page.tsx imports from @/modules/dispatch/presentation", () => {
    const src = readPageSource();
    expect(src).toMatch(
      /^import\s+\{[^}]*\}\s+from\s+"@\/modules\/dispatch\/presentation(?:\/[^"]*)?";?$/m,
    );
  });

  it("α-C0-no-hubservice: /sales/page.tsx does NOT import HubService (sentinel passes pre-GREEN; inversion-target for C1)", () => {
    // Structural absence check (sentinel pattern: regex on import statements only;
    // comments referencing "HubService" historically (§13.AC) are NOT inversion targets).
    const src = readPageSource();
    expect(src).not.toMatch(/^import\s+[^"]*\bHubService\b[^"]*from\s+"[^"]+";?$/m);
  });

  it("α-C0-twin-call: /sales/page.tsx calls dispatchService.list(Paginated)? in Promise.all twin-call", () => {
    // Broadened post-poc-sales-unified-pagination C2 cutover: dispatch
    // call migrated `list` → `listPaginated` (UNION pagination cascade).
    // Sentinel intent preserved: "twin-call wired"; regex accepts either
    // method name. Update bundled atomic per [[mock_hygiene_commit_scope]];
    // sister-cycle-update per [[paired_sister_default_no_surface]] (clear
    // text rename, no invariant collision).
    const src = readPageSource();
    expect(src).toMatch(/dispatchService\.list(?:Paginated)?\s*\(/);
    expect(src).toMatch(/Promise\.all\s*\(/);
  });

  it("α-C0-three-types: presentation merges source discriminator (sale|dispatch) for 3-type render", () => {
    const src = readPageSource();
    expect(src).toMatch(/source:\s*"sale"/);
    expect(src).toMatch(/source:\s*"dispatch"/);
  });
});
