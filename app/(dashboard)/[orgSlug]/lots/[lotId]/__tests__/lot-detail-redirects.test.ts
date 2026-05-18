/**
 * T20 [RED → GREEN] — lot-detail redirects + farmName rendering
 * (REQ-200, F4 retire-farm-collapse-to-lot).
 *
 * After T20:
 *  1. `app/.../lots/[lotId]/page.tsx` getSummary catch redirects
 *     to `/${orgSlug}/lots` (NOT `/farms`). The /farms hierarchy is
 *     retired in T22, so any redirect target there would 404.
 *  2. `lot-detail-client.tsx`:
 *     - Back-link points at `/${orgSlug}/lots` (the new list page
 *       from T18), NOT `/${orgSlug}/farms/${farmId}`.
 *     - C3 stub `const farmId: string | null = null;` is removed.
 *     - `farmName` from LotSnapshot is actually rendered (the C3
 *       stub kept the prop available but hid it because the back
 *       link was conditional on the now-null farmId).
 *     - `router.push('/${orgSlug}/farms')` in DeleteLotDialog
 *       onDeleted callback rewritten to `/${orgSlug}/lots`.
 *
 * Cementación via fs.readFileSync + regex (sister pattern to
 * modules/lot/presentation/__tests__/c5-pages-cutover-shape...).
 *
 * Expected failure mode (RED): current files at HEAD `c0f4dbcf`
 * still carry the C3 stub + /farms paths. All 4 negative assertions
 * fire; positive assertions miss. GREEN after T20 lands the
 * rewrites in both page.tsx and lot-detail-client.tsx.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE = resolve(
  __dirname,
  "../page.tsx",
);
const CLIENT = resolve(
  __dirname,
  "../lot-detail-client.tsx",
);

describe("T20 — lot-detail page.tsx redirect target", () => {
  const src = readFileSync(PAGE, "utf-8");

  it("redirect on getSummary failure targets /${orgSlug}/lots (not /farms)", () => {
    expect(src).toMatch(/redirect\(`\/\$\{orgSlug\}\/lots`\)/);
    expect(src).not.toMatch(/redirect\(`\/\$\{orgSlug\}\/farms`\)/);
  });
});

describe("T20 — lot-detail-client.tsx farmName + redirects", () => {
  const src = readFileSync(CLIENT, "utf-8");

  it("back-link points at /${orgSlug}/lots (not /farms/...)", () => {
    // Positive: at least one Link href={`/${orgSlug}/lots`}
    expect(src).toMatch(/href=\{`\/\$\{orgSlug\}\/lots`\}/);
    // Negative: no surviving /${orgSlug}/farms templates in JSX
    expect(src).not.toMatch(/`\/\$\{orgSlug\}\/farms[`/]/);
  });

  it("renders lot.farmName as visible text (REQ-200)", () => {
    // `{lot.farmName}` appears in JSX (not just as a prop pass-through
    // to the AI button). Matches both `{lot.farmName}` standalone or
    // template-string contexts.
    expect(src).toMatch(/\{lot\.farmName\}/);
  });

  it("DeleteLotDialog onDeleted bounces to /${orgSlug}/lots (not /farms)", () => {
    expect(src).toMatch(/router\.push\(`\/\$\{orgSlug\}\/lots`\)/);
    expect(src).not.toMatch(/router\.push\(`\/\$\{orgSlug\}\/farms`\)/);
  });

  it("C3 stub `const farmId: string | null = null` removed", () => {
    expect(src).not.toMatch(/const\s+farmId\s*:\s*string\s*\|\s*null/);
  });
});
