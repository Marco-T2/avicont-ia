/**
 * T3.1 — OrgProfileRepository tests.
 *
 * Strategy: inject a mocked PrismaClient via the BaseRepository DI constructor
 * and assert query shape. No real DB.
 *
 * Covers REQ-OP.1 (getOrCreate, partial update) and REQ-OP.7 (orgId scoping).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { OrgProfileRepository } from "../org-profile.repository";

type DbStub = {
  orgProfile: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

function makeDbStub(): DbStub {
  return {
    orgProfile: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("OrgProfileRepository — findByOrgId", () => {
  it("queries Prisma with where: { organizationId } — scopes by orgId", async () => {
    const db = makeDbStub();
    db.orgProfile.findUnique.mockResolvedValue(null);

    const repo = new OrgProfileRepository(db as unknown as PrismaClient);
    await repo.findByOrgId("org-1");

    expect(db.orgProfile.findUnique).toHaveBeenCalledTimes(1);
    expect(db.orgProfile.findUnique).toHaveBeenCalledWith({
      where: { organizationId: "org-1" },
    });
  });

  it("returns the row when Prisma finds a match", async () => {
    const db = makeDbStub();
    const row = {
      id: "p-1",
      organizationId: "org-2",
      razonSocial: "Empresa A",
    };
    db.orgProfile.findUnique.mockResolvedValue(row);

    const repo = new OrgProfileRepository(db as unknown as PrismaClient);
    const result = await repo.findByOrgId("org-2");

    expect(result).toBe(row);
  });

  it("returns null when Prisma finds no match", async () => {
    const db = makeDbStub();
    db.orgProfile.findUnique.mockResolvedValue(null);

    const repo = new OrgProfileRepository(db as unknown as PrismaClient);
    const result = await repo.findByOrgId("org-missing");

    expect(result).toBeNull();
  });
});

describe("OrgProfileRepository — create", () => {
  it("inserts a row with the orgId and all string defaults empty", async () => {
    const db = makeDbStub();
    db.orgProfile.create.mockResolvedValue({ id: "p-1", organizationId: "org-1" });

    const repo = new OrgProfileRepository(db as unknown as PrismaClient);
    await repo.create("org-1");

    expect(db.orgProfile.create).toHaveBeenCalledWith({
      data: { organizationId: "org-1" },
    });
  });
});

describe("OrgProfileRepository — update", () => {
  it("sets only provided fields (razonSocial + ciudad)", async () => {
    const db = makeDbStub();
    db.orgProfile.update.mockResolvedValue({ id: "p-1", organizationId: "org-1" });

    const repo = new OrgProfileRepository(db as unknown as PrismaClient);
    await repo.update("org-1", {
      razonSocial: "Empresa X",
      ciudad: "Sucre",
    });

    expect(db.orgProfile.update).toHaveBeenCalledTimes(1);
    const call = db.orgProfile.update.mock.calls[0][0];
    expect(call.where).toEqual({ organizationId: "org-1" });
    expect(call.data).toEqual({
      razonSocial: "Empresa X",
      ciudad: "Sucre",
    });
    // Must not touch omitted fields
    expect(call.data).not.toHaveProperty("nit");
    expect(call.data).not.toHaveProperty("direccion");
  });

  it("sets only logoUrl when that is the sole change", async () => {
    const db = makeDbStub();
    db.orgProfile.update.mockResolvedValue({ id: "p-1", organizationId: "org-1" });

    const repo = new OrgProfileRepository(db as unknown as PrismaClient);
    await repo.update("org-1", {
      logoUrl: "https://blob.example.com/logo.png",
    });

    const call = db.orgProfile.update.mock.calls[0][0];
    expect(call.data).toEqual({
      logoUrl: "https://blob.example.com/logo.png",
    });
  });

  it("passes null through so nullable fields can be cleared (nroPatronal)", async () => {
    const db = makeDbStub();
    db.orgProfile.update.mockResolvedValue({ id: "p-1", organizationId: "org-1" });

    const repo = new OrgProfileRepository(db as unknown as PrismaClient);
    await repo.update("org-1", { nroPatronal: null });

    const call = db.orgProfile.update.mock.calls[0][0];
    expect(call.data).toEqual({ nroPatronal: null });
  });

  it("issues no-op data block when patch is empty", async () => {
    const db = makeDbStub();
    db.orgProfile.update.mockResolvedValue({ id: "p-1", organizationId: "org-1" });

    const repo = new OrgProfileRepository(db as unknown as PrismaClient);
    await repo.update("org-1", {});

    const call = db.orgProfile.update.mock.calls[0][0];
    expect(call.where).toEqual({ organizationId: "org-1" });
    expect(call.data).toEqual({});
  });
});
