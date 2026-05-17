/**
 * PR1.5 RED — seed-system-roles.ts unit tests
 *
 * Mocks prisma.organization.findMany to return 2 orgs.
 * Asserts prisma.customRole.createMany is called once per org
 * with 5 system role payloads derived from current static maps.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @/lib/prisma before importing the seed module
vi.mock("@/lib/prisma", () => ({
  prisma: {
    organization: {
      findMany: vi.fn(),
    },
    customRole: {
      createMany: vi.fn(),
    },
    $disconnect: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { seedSystemRoles } from "@/prisma/seed-system-roles";

const mockFindMany = vi.mocked(prisma.organization.findMany);
const mockCreateMany = vi.mocked(prisma.customRole.createMany);

const MOCK_ORGS = [
  { id: "org-alpha", slug: "alpha", name: "Alpha", clerkOrgId: "clerk-alpha", createdAt: new Date() },
  { id: "org-beta", slug: "beta", name: "Beta", clerkOrgId: "clerk-beta", createdAt: new Date() },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockFindMany.mockResolvedValue(MOCK_ORGS as never);
  mockCreateMany.mockResolvedValue({ count: 6 } as never);
});

describe("PR1.5 — seedSystemRoles", () => {
  it("calls createMany once per org (2 orgs → 2 calls)", async () => {
    await seedSystemRoles();
    expect(mockCreateMany).toHaveBeenCalledTimes(2);
  });

  it("calls createMany with skipDuplicates: true for each org", async () => {
    await seedSystemRoles();
    for (const call of mockCreateMany.mock.calls) {
      expect(call[0]).toMatchObject({ skipDuplicates: true });
    }
  });

  it("each createMany call contains exactly 5 system role payloads", async () => {
    await seedSystemRoles();
    for (const call of mockCreateMany.mock.calls) {
      const { data } = call[0] as { data: unknown[] };
      expect(data).toHaveLength(5);
    }
  });

  it("each payload has isSystem=true, correct slug, and correct organizationId", async () => {
    await seedSystemRoles();

    const SYSTEM_SLUGS = ["owner", "admin", "contador", "cobrador", "member"];

    for (let orgIdx = 0; orgIdx < MOCK_ORGS.length; orgIdx++) {
      const org = MOCK_ORGS[orgIdx];
      const { data } = mockCreateMany.mock.calls[orgIdx][0] as { data: Array<{ slug: string; organizationId: string; isSystem: boolean }> };

      expect(data.every((r) => r.isSystem === true)).toBe(true);
      expect(data.every((r) => r.organizationId === org.id)).toBe(true);
      expect(data.map((r) => r.slug).sort()).toEqual(SYSTEM_SLUGS.sort());
    }
  });

  it("each payload contains permissionsRead, permissionsWrite, canPost arrays", async () => {
    await seedSystemRoles();
    for (const call of mockCreateMany.mock.calls) {
      const { data } = call[0] as { data: Array<{ permissionsRead: string[]; permissionsWrite: string[]; canPost: string[] }> };
      for (const row of data) {
        expect(Array.isArray(row.permissionsRead)).toBe(true);
        expect(Array.isArray(row.permissionsWrite)).toBe(true);
        expect(Array.isArray(row.canPost)).toBe(true);
      }
    }
  });

  it("financial-statements:read is granted to owner/admin/contador and denied to cobrador/member", async () => {
    await seedSystemRoles();

    const { data } = mockCreateMany.mock.calls[0][0] as {
      data: Array<{ slug: string; permissionsRead: string[] }>;
    };
    const bySlug = new Map(data.map((r) => [r.slug, r.permissionsRead]));

    expect(bySlug.get("owner")).toContain("financial-statements");
    expect(bySlug.get("admin")).toContain("financial-statements");
    expect(bySlug.get("contador")).toContain("financial-statements");
    expect(bySlug.get("cobrador")).not.toContain("financial-statements");
    expect(bySlug.get("member")).not.toContain("financial-statements");
  });
});
