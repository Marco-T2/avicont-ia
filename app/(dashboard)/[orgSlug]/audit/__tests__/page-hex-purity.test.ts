/**
 * Audit-pure-read (Group B) sentinel: audit/page.tsx MUST NOT import
 * `@/lib/prisma` (zero direct Prisma reads — pure hexagonal page). Mirror the
 * sale-pure-read pilot sentinel
 * (`app/(dashboard)/[orgSlug]/sales/[saleId]/__tests__/page-hex-purity.test.ts`).
 *
 * The direct members read (`prisma.organizationMember.findMany` for the user
 * filter select) moved behind the audit-owned read port
 * (`AuditOrgMembersReaderPort`) with a Prisma adapter in
 * `modules/audit/infrastructure`, exposed via `makeAuditReads()` in the audit
 * composition-root.
 *
 * RED expected failure mode: page.tsx imports `{ prisma } from "@/lib/prisma"`
 * and invokes `prisma.organizationMember.findMany` → greps MUST be ZERO; FAILS
 * today. GREEN: page consumes `makeAuditReads()` instead.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..", "..", "..", "..", "..");
const PAGE = resolve(ROOT, "app/(dashboard)/[orgSlug]/audit/page.tsx");

describe("audit-pure-read Group B — audit page hex purity", () => {
  it("page.tsx does NOT import @/lib/prisma nor reference the prisma client", () => {
    const src = readFileSync(PAGE, "utf8");
    expect(src).not.toMatch(/@\/lib\/prisma/);
    expect(src).not.toMatch(/\bprisma\./);
  });

  it("page.tsx consumes the audit read facade (makeAuditReads) from the composition-root", () => {
    const src = readFileSync(PAGE, "utf8");
    expect(src).toMatch(/\bmakeAuditReads\b/);
  });
});
