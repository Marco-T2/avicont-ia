/**
 * PR8.1 RED — syncOrganization webhook seeds 5 system roles on new org creation
 *
 * Tests:
 * (a) NEW org created → prisma.customRole.createMany called with 5 system role payloads + skipDuplicates:true
 * (b) EXISTING org returned (no create) → createMany NOT called
 * (c) createMany receives correct orgId (the DB-assigned id, not the Clerk id)
 * (d) Missing required fields → 400, createMany NOT called
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Clerk auth
vi.mock("@/features/shared/middleware", () => ({
  requireAuth: vi.fn(),
  handleError: vi.fn((err: unknown) =>
    Response.json({ error: String(err) }, { status: 500 }),
  ),
}));

// Mock VoucherTypesService to avoid unrelated DB calls
vi.mock("@/features/voucher-types/server", () => {
  class VoucherTypesService {
    seedForOrg = vi.fn().mockResolvedValue([]);
  }
  return { VoucherTypesService };
});

// Mock prisma
vi.mock("@/lib/prisma", () => {
  const prismaMock: Record<string, unknown> = {
    organization: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    organizationMember: {
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
    customRole: {
      createMany: vi.fn().mockResolvedValue({ count: 5 }),
    },
    voucherType: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    voucherTypeTemplate: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
  // $transaction invokes the callback with the same client so mocked methods
  // work identically whether called on `prisma` or on the tx client.
  prismaMock.$transaction = vi
    .fn()
    .mockImplementation(async (cb: (tx: unknown) => unknown) => cb(prismaMock));
  return { prisma: prismaMock };
});

import { POST } from "../route";
import { requireAuth } from "@/features/shared/middleware";
import { prisma } from "@/lib/prisma";
import { SYSTEM_ROLES } from "@/features/permissions";

const mockedRequireAuth = vi.mocked(requireAuth);
const mockedCreateMany = vi.mocked(prisma.customRole.createMany);
const mockedOrgFindUnique = vi.mocked(prisma.organization.findUnique);
const mockedOrgCreate = vi.mocked(prisma.organization.create);
const mockedUserFindUnique = vi.mocked(prisma.user.findUnique);
const mockedUserFindFirst = vi.mocked(prisma.user.findFirst);
const mockedUserCreate = vi.mocked(prisma.user.create);

const CLERK_USER_ID = "user_clerk_123";
const CLERK_ORG_ID = "org_clerk_abc";
const DB_ORG_ID = "db-org-uuid-001";

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/organizations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeOrg(id = DB_ORG_ID) {
  return {
    id,
    clerkOrgId: CLERK_ORG_ID,
    name: "Acme Corp",
    slug: "acme",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeUser() {
  return {
    id: "user-db-001",
    clerkUserId: CLERK_USER_ID,
    email: "user@temp.com",
    name: "User",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedRequireAuth.mockResolvedValue({ userId: CLERK_USER_ID } as never);
});

describe("PR8.1 — POST /api/organizations seeds 5 system roles on new org", () => {
  it("(a) new org created → createMany called with 5 system roles + skipDuplicates:true", async () => {
    // Org does not exist yet → findUnique returns null
    mockedOrgFindUnique.mockResolvedValue(null);
    mockedOrgCreate.mockResolvedValue(makeOrg());
    // UsersService.findOrCreate: findByClerkUserId → null, findByEmail → null, then create
    mockedUserFindUnique.mockResolvedValue(null);
    mockedUserFindFirst.mockResolvedValue(null);
    mockedUserCreate.mockResolvedValue(makeUser() as never);
    // member create — ignore
    vi.mocked(prisma.organizationMember.create).mockResolvedValue({} as never);

    const req = makeRequest({
      clerkOrgId: CLERK_ORG_ID,
      name: "Acme Corp",
      slug: "acme",
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.created).toBe(true);

    // createMany MUST have been called
    expect(mockedCreateMany).toHaveBeenCalledTimes(1);

    const call = mockedCreateMany.mock.calls[0]?.[0];
    expect(call).toBeDefined();
    expect(call!.skipDuplicates).toBe(true);

    // Must produce exactly 5 rows
    const data = call!.data as Array<{ slug: string; organizationId: string; isSystem: boolean }>;
    expect(data).toHaveLength(5);

    // Each row has the correct orgId and isSystem:true
    for (const row of data) {
      expect(row.organizationId).toBe(DB_ORG_ID);
      expect(row.isSystem).toBe(true);
    }

    // All 5 system role slugs present
    const slugs = data.map((r) => r.slug).sort();
    expect(slugs).toEqual([...SYSTEM_ROLES].sort());
  });

  it("(b) existing org returned → createMany NOT called", async () => {
    // Org already exists
    mockedOrgFindUnique.mockResolvedValue(makeOrg());

    const req = makeRequest({
      clerkOrgId: CLERK_ORG_ID,
      name: "Acme Corp",
      slug: "acme",
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.created).toBe(false);

    // No roles should be seeded for existing orgs
    expect(mockedCreateMany).not.toHaveBeenCalled();
  });

  it("(c) createMany receives DB org id (not clerk id)", async () => {
    const customDbId = "custom-db-id-xyz";
    mockedOrgFindUnique.mockResolvedValue(null);
    mockedOrgCreate.mockResolvedValue(makeOrg(customDbId));
    mockedUserFindUnique.mockResolvedValue(null);
    mockedUserFindFirst.mockResolvedValue(null);
    mockedUserCreate.mockResolvedValue(makeUser() as never);
    vi.mocked(prisma.organizationMember.create).mockResolvedValue({} as never);

    const req = makeRequest({
      clerkOrgId: CLERK_ORG_ID,
      name: "Test Org",
      slug: "test-org",
    });
    await POST(req);

    const call = mockedCreateMany.mock.calls[0]?.[0];
    expect(call).toBeDefined();
    const data = call!.data as Array<{ organizationId: string }>;
    for (const row of data) {
      expect(row.organizationId).toBe(customDbId);
      expect(row.organizationId).not.toBe(CLERK_ORG_ID);
    }
  });

  it("(d) missing clerkOrgId → 400, createMany NOT called", async () => {
    const req = makeRequest({ name: "Acme Corp" });
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(mockedCreateMany).not.toHaveBeenCalled();
  });
});
