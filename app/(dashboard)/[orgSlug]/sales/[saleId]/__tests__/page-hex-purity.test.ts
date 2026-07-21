/**
 * Sale-pure-read pilot sentinel: sales/[saleId]/page.tsx MUST NOT import
 * `@/lib/prisma` (zero direct Prisma reads — pure hexagonal page).
 *
 * The two direct reads (contact + receivable-with-allocations) moved behind
 * sale-module read ports (`SaleContactReaderPort` / `SaleReceivableReaderPort`)
 * with Prisma adapters in `modules/sale/infrastructure`, exposed via
 * `makeSaleReads()` in the sale composition-root.
 *
 * RED expected failure mode (per [[red_acceptance_failure_mode]]): page.tsx
 * imports `{ prisma } from "@/lib/prisma"` (L7) and invokes
 * `prisma.contact.findUnique` + `prisma.accountsReceivable.findUnique`
 * (L43-76) → greps MUST be ZERO; FAILS today. GREEN: page consumes
 * `makeSaleReads()` instead.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..", "..", "..", "..", "..", "..");
const PAGE = resolve(ROOT, "app/(dashboard)/[orgSlug]/sales/[saleId]/page.tsx");

describe("sale-pure-read pilot — sales/[saleId] hex purity", () => {
  it("page.tsx does NOT import @/lib/prisma nor reference the prisma client", () => {
    const src = readFileSync(PAGE, "utf8");
    expect(src).not.toMatch(/@\/lib\/prisma/);
    expect(src).not.toMatch(/\bprisma\./);
  });

  it("page.tsx consumes the sale read facade (makeSaleReads) from the composition-root", () => {
    const src = readFileSync(PAGE, "utf8");
    expect(src).toMatch(/\bmakeSaleReads\b/);
  });
});
