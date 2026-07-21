/**
 * Audit-pure-read (Group B) sentinel: monthly-close/audit-trail/route.ts MUST
 * NOT import `@/lib/prisma` (zero direct Prisma reads — pure hexagonal route
 * handler). The repo has no dedicated route-sentinel pattern, so this mirrors
 * the page sentinel grep style of the sale-pure-read pilot
 * (`app/(dashboard)/[orgSlug]/sales/[saleId]/__tests__/page-hex-purity.test.ts`).
 *
 * The direct close-event audit read (`prisma.auditLog.findMany` by
 * correlationId) moved behind the audit-owned read port
 * (`AuditCloseEventReaderPort`) with a Prisma adapter in
 * `modules/audit/infrastructure`, exposed via `makeAuditReads()` in the audit
 * composition-root.
 *
 * RED expected failure mode: route.ts imports `{ prisma } from "@/lib/prisma"`
 * and invokes `prisma.auditLog.findMany` → greps MUST be ZERO; FAILS today.
 * GREEN: route consumes `makeAuditReads()` instead.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..", "..", "..", "..", "..", "..", "..");
const ROUTE = resolve(
  ROOT,
  "app/api/organizations/[orgSlug]/monthly-close/audit-trail/route.ts",
);

describe("audit-pure-read Group B — audit-trail route hex purity", () => {
  it("route.ts does NOT import @/lib/prisma nor reference the prisma client", () => {
    const src = readFileSync(ROUTE, "utf8");
    expect(src).not.toMatch(/@\/lib\/prisma/);
    expect(src).not.toMatch(/\bprisma\./);
  });

  it("route.ts consumes the audit read facade (makeAuditReads) from the composition-root", () => {
    const src = readFileSync(ROUTE, "utf8");
    expect(src).toMatch(/\bmakeAuditReads\b/);
  });
});
