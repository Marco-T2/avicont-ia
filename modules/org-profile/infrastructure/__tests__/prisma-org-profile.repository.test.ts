import { describe, it, expect, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { PrismaOrgProfileRepository } from "../prisma-org-profile.repository";
import { OrgProfile } from "../../domain/org-profile.entity";

const dbWith = (
  opOverrides: Record<string, unknown>,
): PrismaClient =>
  ({
    orgProfile: opOverrides,
  }) as unknown as PrismaClient;

const buildRow = (override: Record<string, unknown> = {}) => ({
  id: "op-1",
  organizationId: "org-1",
  razonSocial: "Empresa A",
  nit: "123456",
  direccion: "Calle 1",
  ciudad: "Sucre",
  telefono: "78123456",
  representanteLegal: "Juan Perez",
  nroPatronal: null,
  logoUrl: null,
  createdAt: new Date("2026-01-15"),
  updatedAt: new Date("2026-01-15"),
  ...override,
});

describe("PrismaOrgProfileRepository", () => {
  describe("findByOrgId", () => {
    // α23
    it("queries Prisma with where: { organizationId } — scopes by orgId", async () => {
      const findUnique = vi.fn().mockResolvedValueOnce(buildRow());
      const repo = new PrismaOrgProfileRepository(dbWith({ findUnique }));

      const result = await repo.findByOrgId("org-1");

      expect(findUnique).toHaveBeenCalledWith({
        where: { organizationId: "org-1" },
      });
      expect(result?.organizationId).toBe("org-1");
    });

    // α24
    it("returns null when no row found", async () => {
      const findUnique = vi.fn().mockResolvedValueOnce(null);
      const repo = new PrismaOrgProfileRepository(dbWith({ findUnique }));

      const result = await repo.findByOrgId("org-missing");
      expect(result).toBeNull();
    });
  });

  describe("save", () => {
    // α25
    it("upserts by organizationId unique key", async () => {
      const upsert = vi.fn().mockResolvedValueOnce(undefined);
      const repo = new PrismaOrgProfileRepository(dbWith({ upsert }));

      const entity = OrgProfile.create("org-1");
      await repo.save(entity);

      expect(upsert).toHaveBeenCalledTimes(1);
      const callArg = upsert.mock.calls[0]?.[0];
      expect(callArg.where).toEqual({ organizationId: "org-1" });
      expect(callArg.create.organizationId).toBe("org-1");
      expect(callArg.update.razonSocial).toBe("");
    });
  });
});
