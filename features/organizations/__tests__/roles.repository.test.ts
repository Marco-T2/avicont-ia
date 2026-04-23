/**
 * PR4.2 RED — RolesRepository: thin Prisma wrappers for CustomRole
 *
 * Covers:
 *   REQ-CR.1 — seeding foundation (data layer)
 *   REQ-R.4 — Data access layer
 *   D.1 — Prisma schema
 *
 * Strategy:
 *   Mock @/lib/prisma so each method's Prisma call can be asserted for
 *   correct shape (where / data / orderBy). No real DB.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customRole: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    organizationMember: {
      count: vi.fn(),
    },
    $disconnect: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { RolesRepository } from "../roles.repository";

const mockFindMany = vi.mocked(prisma.customRole.findMany);
const mockFindUnique = vi.mocked(prisma.customRole.findUnique);
const mockCreate = vi.mocked(prisma.customRole.create);
const mockUpdate = vi.mocked(prisma.customRole.update);
const mockDelete = vi.mocked(prisma.customRole.delete);
const mockMemberCount = vi.mocked(prisma.organizationMember.count);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RolesRepository — findAllByOrg", () => {
  it("calls customRole.findMany with where=organizationId + stable ordering", async () => {
    mockFindMany.mockResolvedValue([] as never);

    const repo = new RolesRepository();
    await repo.findAllByOrg("org_1");

    expect(mockFindMany).toHaveBeenCalledTimes(1);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { organizationId: "org_1" },
      orderBy: [{ isSystem: "desc" }, { slug: "asc" }],
    });
  });
});

describe("RolesRepository — findBySlug", () => {
  it("calls customRole.findUnique with composite (organizationId, slug)", async () => {
    mockFindUnique.mockResolvedValue(null as never);

    const repo = new RolesRepository();
    await repo.findBySlug("org_1", "facturador");

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { organizationId_slug: { organizationId: "org_1", slug: "facturador" } },
    });
  });
});

describe("RolesRepository — create", () => {
  it("calls customRole.create with exact input data", async () => {
    mockCreate.mockResolvedValue({ id: "r1" } as never);

    const data = {
      organizationId: "org_1",
      slug: "facturador",
      name: "Facturador",
      description: null,
      isSystem: false,
      permissionsRead: ["sales"],
      permissionsWrite: [],
      canPost: [],
    };

    const repo = new RolesRepository();
    await repo.create(data);

    expect(mockCreate).toHaveBeenCalledWith({ data });
  });
});

describe("RolesRepository — update", () => {
  it("calls customRole.update with where.id and data=patch", async () => {
    mockUpdate.mockResolvedValue({ id: "r1" } as never);

    const patch = {
      name: "Facturador Sr",
      permissionsWrite: ["sales", "reports"],
    };

    const repo = new RolesRepository();
    await repo.update("org_1", "r1", patch);

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "r1", organizationId: "org_1" },
      data: patch,
    });
  });
});

describe("RolesRepository — delete", () => {
  it("calls customRole.delete scoped by org + id", async () => {
    mockDelete.mockResolvedValue({ id: "r1" } as never);

    const repo = new RolesRepository();
    await repo.delete("org_1", "r1");

    expect(mockDelete).toHaveBeenCalledWith({
      where: { id: "r1", organizationId: "org_1" },
    });
  });
});

describe("RolesRepository — countMembers", () => {
  it("calls organizationMember.count scoped to org + role slug", async () => {
    mockMemberCount.mockResolvedValue(2 as never);

    const repo = new RolesRepository();
    const count = await repo.countMembers("facturador", "org_1");

    expect(count).toBe(2);
    expect(mockMemberCount).toHaveBeenCalledWith({
      where: { organizationId: "org_1", role: "facturador" },
    });
  });

  it("returns 0 when no members carry the role", async () => {
    mockMemberCount.mockResolvedValue(0 as never);

    const repo = new RolesRepository();
    const count = await repo.countMembers("unused-role", "org_1");

    expect(count).toBe(0);
  });
});
