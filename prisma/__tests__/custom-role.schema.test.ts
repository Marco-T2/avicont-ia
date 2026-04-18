/**
 * PR1.1 RED — CustomRole Prisma model schema tests
 *
 * Tests:
 * (a) Create + find round-trip for 1 system row
 * (b) Create + find round-trip for 1 custom row
 * (c) @@unique([organizationId, slug]) throws P2002 on duplicate insert
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";

// Use a test-only org id to avoid conflicts
const TEST_ORG_ID = `test-org-${Date.now()}`;

beforeAll(async () => {
  // Create a minimal Organization row to satisfy the FK
  await prisma.organization.create({
    data: {
      id: TEST_ORG_ID,
      clerkOrgId: `clerk-${TEST_ORG_ID}`,
      name: "Test Org",
      slug: `test-org-${Date.now()}`,
    },
  });
});

afterAll(async () => {
  // Cascade delete will clean up custom_roles
  await prisma.organization.delete({ where: { id: TEST_ORG_ID } });
});

describe("PR1.1 — CustomRole schema round-trips", () => {
  it("(a) creates and finds a system role row", async () => {
    const created = await prisma.customRole.create({
      data: {
        organizationId: TEST_ORG_ID,
        slug: "owner",
        name: "Owner",
        isSystem: true,
        permissionsRead: ["members", "sales"],
        permissionsWrite: ["members", "sales"],
        canPost: ["sales"],
      },
    });

    expect(created.id).toBeTruthy();
    expect(created.slug).toBe("owner");
    expect(created.isSystem).toBe(true);
    expect(created.permissionsRead).toContain("members");
    expect(created.canPost).toContain("sales");

    const found = await prisma.customRole.findUnique({
      where: { id: created.id },
    });
    expect(found).not.toBeNull();
    expect(found!.slug).toBe("owner");
  });

  it("(b) creates and finds a custom (non-system) role row", async () => {
    const created = await prisma.customRole.create({
      data: {
        organizationId: TEST_ORG_ID,
        slug: "facturador",
        name: "Facturador",
        isSystem: false,
        permissionsRead: ["sales"],
        permissionsWrite: [],
        canPost: [],
      },
    });

    expect(created.isSystem).toBe(false);
    expect(created.slug).toBe("facturador");

    const found = await prisma.customRole.findFirst({
      where: { organizationId: TEST_ORG_ID, slug: "facturador" },
    });
    expect(found).not.toBeNull();
  });

  it("(c) throws P2002 on duplicate (organizationId, slug) insert", async () => {
    // 'owner' was already inserted in test (a)
    await expect(
      prisma.customRole.create({
        data: {
          organizationId: TEST_ORG_ID,
          slug: "owner",
          name: "Owner Duplicate",
          isSystem: true,
          permissionsRead: [],
          permissionsWrite: [],
          canPost: [],
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });
});
