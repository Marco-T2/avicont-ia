/**
 * list-pages-pure-read sentinel (Group C): purchases/page.tsx MUST NOT import
 * `@/lib/prisma` (zero direct Prisma reads — pure hexagonal page).
 *
 * The two direct batch hydrations (contact + fiscalPeriod `findMany` with
 * `id IN (...)`) are dumb lookups that do NOT deserve new read ports
 * (architect rule: reuse existing module services, no ceremony for a
 * `<select>`). The page reuses the EXISTING `makeContactsService().list()`
 * and `makeFiscalPeriodsService().list()` (same services the sale detail
 * page consumes) and filters in-memory to the ids present in the current
 * page-window, preserving the prior `id IN (...)` projection.
 *
 * RED expected failure mode (per [[red_acceptance_failure_mode]]): page.tsx
 * imports `{ prisma } from "@/lib/prisma"` and invokes
 * `prisma.contact.findMany` + `prisma.fiscalPeriod.findMany` → greps MUST be
 * ZERO; FAILS pre-GREEN. GREEN: page consumes the contacts + fiscal-periods
 * presentation server facades instead.
 *
 * Supersedes (flip documented in-place): c6a-cutover-null-guard-shape Test 7
 * (`modules/purchase/presentation/__tests__/c6a-cutover-null-guard-shape.poc-nuevo-a3.test.ts`)
 * which asserted the prisma import MUST be present (Prisma-direct batch lock).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..", "..", "..", "..", "..");
const PAGE = resolve(ROOT, "app/(dashboard)/[orgSlug]/purchases/page.tsx");

describe("list-pages-pure-read — /purchases list page hex purity", () => {
  it("page.tsx does NOT import @/lib/prisma nor reference the prisma client", () => {
    const src = readFileSync(PAGE, "utf8");
    expect(src).not.toMatch(/@\/lib\/prisma/);
    expect(src).not.toMatch(/\bprisma\./);
  });

  it("page.tsx consumes the existing contacts + fiscal-periods services (no new ports)", () => {
    const src = readFileSync(PAGE, "utf8");
    expect(src).toMatch(
      /import\s*\{[^}]*\bmakeContactsService\b[^}]*\}\s*from\s*["']@\/modules\/contacts\/presentation\/server["']/,
    );
    expect(src).toMatch(
      /import\s*\{[^}]*\bmakeFiscalPeriodsService\b[^}]*\}\s*from\s*["']@\/modules\/fiscal-periods\/presentation\/server["']/,
    );
  });
});
