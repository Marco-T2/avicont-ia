/**
 * Purchase-pure-read sentinel (mirror sale-pure-read pilot):
 * purchases/[purchaseId]/page.tsx MUST NOT import `@/lib/prisma` (zero direct
 * Prisma reads — pure hexagonal page).
 *
 * The two direct reads (contact + payable-with-allocations) moved behind
 * purchase-module read ports (`PurchaseContactReaderPort` /
 * `PurchasePayableReaderPort`) with Prisma adapters in
 * `modules/purchase/infrastructure`, exposed via `makePurchaseReads()` in the
 * purchase composition-root.
 *
 * RED expected failure mode (per [[red_acceptance_failure_mode]]): page.tsx
 * imports `{ prisma } from "@/lib/prisma"` (L8) and invokes
 * `prisma.contact.findUnique` + `prisma.accountsPayable.findUnique`
 * (L49-82) → greps MUST be ZERO; FAILS today. GREEN: page consumes
 * `makePurchaseReads()` instead.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..", "..", "..", "..", "..", "..");
const PAGE = resolve(
  ROOT,
  "app/(dashboard)/[orgSlug]/purchases/[purchaseId]/page.tsx",
);

describe("purchase-pure-read — purchases/[purchaseId] hex purity", () => {
  it("page.tsx does NOT import @/lib/prisma nor reference the prisma client", () => {
    const src = readFileSync(PAGE, "utf8");
    expect(src).not.toMatch(/@\/lib\/prisma/);
    expect(src).not.toMatch(/\bprisma\./);
  });

  it("page.tsx consumes the purchase read facade (makePurchaseReads) from the composition-root", () => {
    const src = readFileSync(PAGE, "utf8");
    expect(src).toMatch(/\bmakePurchaseReads\b/);
  });
});
