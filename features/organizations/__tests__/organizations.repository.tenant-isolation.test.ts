/**
 * RED test — OrganizationsRepository tenant-isolation (I-8 compliance).
 *
 * Expected failure mode at commit time:
 *   - `hardDelete` assertions fail with "repo.hardDelete is not a function"
 *     because the method does not exist.
 *   - `reactivateMember` assertions with the new `(organizationId, memberId,
 *     role)` signature fail because current signature is `(memberId, role)`:
 *     the Prisma `update` call is made without an `organizationId` in the
 *     WHERE clause. `expect(mockUpdate).toHaveBeenCalledWith(where:{id,organizationId},...)`
 *     fails because the actual call is `where:{id}`.
 *
 * T7 (GREEN) extends `reactivateMember` to
 * `reactivateMember(organizationId, memberId, role, tx?)` and adds
 * `hardDelete(organizationId, memberId, tx?)`.
 *
 * Covers: SF-2 (reactivateMember signature change), I-8 (tenant isolation
 * for hardDelete), design.md §9 R-2 / R-6.
 *
 * Strategy: same mock-Prisma pattern as `roles.repository.test.ts` — assert
 * the WHERE clause shape so cross-org calls become impossible at the query
 * level.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    organizationMember: {
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    $disconnect: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { OrganizationsRepository } from "../organizations.repository";

const mockUpdate = vi.mocked(prisma.organizationMember.update);
const mockDelete = vi.mocked(prisma.organizationMember.delete);
const mockDeleteMany = vi.mocked(prisma.organizationMember.deleteMany);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("OrganizationsRepository.reactivateMember — tenant isolation (I-8, SF-2)", () => {
  it("updates with where={id, organizationId} (not just {id})", async () => {
    mockUpdate.mockResolvedValue({ id: "m-1" } as never);
    const repo = new OrganizationsRepository();

    await repo.reactivateMember("org_1", "m-1", "contador");

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "m-1", organizationId: "org_1" },
      data: { deactivatedAt: null, role: "contador" },
    });
  });

  it("rejects a blank organizationId (requireOrg guard)", async () => {
    const repo = new OrganizationsRepository();
    await expect(repo.reactivateMember("", "m-1", "contador")).rejects.toThrow();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("accepts an optional Prisma transaction client (tx?)", async () => {
    const txUpdate = vi.fn().mockResolvedValue({ id: "m-1" });
    const tx = {
      organizationMember: { update: txUpdate },
    } as unknown as Parameters<OrganizationsRepository["reactivateMember"]>[3];
    const repo = new OrganizationsRepository();

    await repo.reactivateMember("org_1", "m-1", "admin", tx);

    expect(txUpdate).toHaveBeenCalledWith({
      where: { id: "m-1", organizationId: "org_1" },
      data: { deactivatedAt: null, role: "admin" },
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("OrganizationsRepository.hardDelete — new method, tenant-scoped (I-8)", () => {
  it("deletes with where={id, organizationId} via deleteMany", async () => {
    mockDeleteMany.mockResolvedValue({ count: 1 } as never);
    const repo = new OrganizationsRepository();

    await repo.hardDelete("org_1", "m-1");

    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { id: "m-1", organizationId: "org_1" },
    });
  });

  it("rejects a blank organizationId (requireOrg guard)", async () => {
    const repo = new OrganizationsRepository();
    await expect(repo.hardDelete("", "m-1")).rejects.toThrow();
    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  it("accepts an optional Prisma transaction client (tx?)", async () => {
    const txDeleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = {
      organizationMember: { deleteMany: txDeleteMany },
    } as unknown as Parameters<OrganizationsRepository["hardDelete"]>[2];
    const repo = new OrganizationsRepository();

    await repo.hardDelete("org_1", "m-1", tx);

    expect(txDeleteMany).toHaveBeenCalledWith({
      where: { id: "m-1", organizationId: "org_1" },
    });
    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  it("does NOT use single-record delete (deleteMany is safer when the row may already be gone)", async () => {
    mockDeleteMany.mockResolvedValue({ count: 0 } as never);
    const repo = new OrganizationsRepository();

    // Should not throw even if nothing matched — deleteMany returns count=0.
    await expect(repo.hardDelete("org_1", "m-missing")).resolves.toBeDefined();
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
