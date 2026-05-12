/**
 * Unit tests for PrismaAccountsRepo (POC #3b) — filter/branch logic.
 *
 * Mocks @/lib/prisma to avoid DB dependency.
 * Covers REQ-011 (filter combo where-shape) and guard branches.
 * Paired-sister precedent: prisma-account-balances.repo.integration.test.ts mock pattern.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    account: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    journalLine: {
      count: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { PrismaAccountsRepo } from "../prisma-accounts.repo";

beforeEach(() => {
  vi.clearAllMocks();
});

// ── findAll filter where-shape ────────────────────────────────────────────────

describe("findAll filter where-shape", () => {
  it("no filter: where contains only organizationId", async () => {
    vi.mocked(prisma.account.findMany).mockResolvedValueOnce([]);
    const repo = new PrismaAccountsRepo();
    await repo.findAll("org-1");
    expect(prisma.account.findMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1" },
      orderBy: { code: "asc" },
    });
  });

  it("type filter: where includes type", async () => {
    vi.mocked(prisma.account.findMany).mockResolvedValueOnce([]);
    const repo = new PrismaAccountsRepo();
    await repo.findAll("org-1", { type: "ACTIVO" });
    expect(prisma.account.findMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1", type: "ACTIVO" },
      orderBy: { code: "asc" },
    });
  });

  it("subtype filter: where includes subtype", async () => {
    vi.mocked(prisma.account.findMany).mockResolvedValueOnce([]);
    const repo = new PrismaAccountsRepo();
    await repo.findAll("org-1", { subtype: "ACTIVO_CORRIENTE" });
    expect(prisma.account.findMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1", subtype: "ACTIVO_CORRIENTE" },
      orderBy: { code: "asc" },
    });
  });

  it("isDetail filter: where includes isDetail", async () => {
    vi.mocked(prisma.account.findMany).mockResolvedValueOnce([]);
    const repo = new PrismaAccountsRepo();
    await repo.findAll("org-1", { isDetail: true });
    expect(prisma.account.findMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1", isDetail: true },
      orderBy: { code: "asc" },
    });
  });

  it("isActive filter: where includes isActive", async () => {
    vi.mocked(prisma.account.findMany).mockResolvedValueOnce([]);
    const repo = new PrismaAccountsRepo();
    await repo.findAll("org-1", { isActive: false });
    expect(prisma.account.findMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1", isActive: false },
      orderBy: { code: "asc" },
    });
  });

  it("combination type+isDetail: where includes both", async () => {
    vi.mocked(prisma.account.findMany).mockResolvedValueOnce([]);
    const repo = new PrismaAccountsRepo();
    await repo.findAll("org-1", { type: "ACTIVO", isDetail: true });
    expect(prisma.account.findMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1", type: "ACTIVO", isDetail: true },
      orderBy: { code: "asc" },
    });
  });
});

// ── findDetailChildrenByParentCodes OR clause ─────────────────────────────────

describe("findDetailChildrenByParentCodes OR clause shape", () => {
  it("builds OR with startsWith for each code AND in-set for parent codes themselves", async () => {
    vi.mocked(prisma.account.findMany).mockResolvedValueOnce([]);
    const repo = new PrismaAccountsRepo();
    await repo.findDetailChildrenByParentCodes("org-1", ["1.1", "2"]);
    expect(prisma.account.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1",
        isDetail: true,
        isActive: true,
        OR: [
          { code: { startsWith: "1.1." } },
          { code: { startsWith: "2." } },
          { code: { in: ["1.1", "2"] } },
        ],
      },
      orderBy: { code: "asc" },
    });
  });
});

// ── findManyByIds empty guard ─────────────────────────────────────────────────

describe("findManyByIds empty guard", () => {
  it("returns [] immediately without calling findMany when ids is empty", async () => {
    const repo = new PrismaAccountsRepo();
    const result = await repo.findManyByIds("org-1", []);
    expect(result).toEqual([]);
    expect(prisma.account.findMany).not.toHaveBeenCalled();
  });
});
