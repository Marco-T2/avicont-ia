/**
 * Unit tests for PrismaAuditOrgMembersReaderAdapter (audit-pure-read Group B).
 *
 * Mocks @/lib/prisma to avoid DB dependency — mirror
 * `modules/sale/infrastructure/__tests__/prisma-sale-contact-reader.adapter.test.ts`
 * mock pattern. Covers: query shape (tenant-scoped `findMany` where active
 * members + user projection + name ordering), name ?? email fallback mapping,
 * and empty branch.
 *
 * RED acceptance failure mode: FAILS pre-implementación por module resolution
 * failure (`PrismaAuditOrgMembersReaderAdapter` no existe). Post-GREEN: PASSES
 * porque el adapter emite el where {organizationId, deactivatedAt: null} y
 * mapea a views {id, name} con fallback a email.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    organizationMember: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { PrismaAuditOrgMembersReaderAdapter } from "../prisma-audit-org-members-reader.adapter";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PrismaAuditOrgMembersReaderAdapter — listActive", () => {
  it("scopes the query by organizationId AND deactivatedAt null (tenant safety) ordered by user name", async () => {
    vi.mocked(prisma.organizationMember.findMany).mockResolvedValueOnce([]);

    const adapter = new PrismaAuditOrgMembersReaderAdapter();
    await adapter.listActive("org-1");

    expect(prisma.organizationMember.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.organizationMember.findMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1", deactivatedAt: null },
      select: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { user: { name: "asc" } },
    });
  });

  it("maps members to {id, name} views with email fallback when name is null", async () => {
    vi.mocked(prisma.organizationMember.findMany).mockResolvedValueOnce([
      { user: { id: "user-1", name: "Ana", email: "ana@acme.bo" } },
      { user: { id: "user-2", name: null, email: "beto@acme.bo" } },
    ] as never);

    const adapter = new PrismaAuditOrgMembersReaderAdapter();
    const result = await adapter.listActive("org-1");

    expect(result).toEqual([
      { id: "user-1", name: "Ana" },
      { id: "user-2", name: "beto@acme.bo" },
    ]);
  });

  it("returns [] when the organization has no active members", async () => {
    vi.mocked(prisma.organizationMember.findMany).mockResolvedValueOnce([]);

    const adapter = new PrismaAuditOrgMembersReaderAdapter();
    const result = await adapter.listActive("org-other");

    expect(result).toEqual([]);
  });
});
