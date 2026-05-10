import { describe, it, expect, vi } from "vitest";
import { type PrismaClient } from "@/generated/prisma/client";
import { PrismaFarmRepository } from "../prisma-farm.repository";
import { Farm } from "../../domain/farm.entity";

const dbWith = (overrides: Record<string, unknown>): PrismaClient =>
  ({ farm: overrides }) as unknown as PrismaClient;

const buildEntity = () =>
  Farm.create({
    organizationId: "org-1",
    name: "Granja Norte",
    location: "Buenos Aires",
    memberId: "member-1",
  });

const buildRow = (override: Record<string, unknown> = {}) => ({
  id: "farm-1",
  organizationId: "org-1",
  name: "Granja Norte",
  location: "Buenos Aires",
  memberId: "member-1",
  createdAt: new Date("2026-04-01"),
  updatedAt: new Date("2026-04-15"),
  ...override,
});

describe("PrismaFarmRepository", () => {
  describe("findAll", () => {
    it("scopes by organizationId and orders by name asc (no filters)", async () => {
      const findMany = vi.fn().mockResolvedValueOnce([buildRow()]);
      const repo = new PrismaFarmRepository(dbWith({ findMany }));

      const result = await repo.findAll("org-1");

      expect(findMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1" },
        orderBy: { name: "asc" },
      });
      expect(result).toHaveLength(1);
      expect(result[0]?.organizationId).toBe("org-1");
    });

    it("applies optional memberId filter", async () => {
      const findMany = vi.fn().mockResolvedValueOnce([]);
      const repo = new PrismaFarmRepository(dbWith({ findMany }));

      await repo.findAll("org-1", { memberId: "m-1" });

      expect(findMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1", memberId: "m-1" },
        orderBy: { name: "asc" },
      });
    });
  });

  describe("findById", () => {
    it("returns null when no row found", async () => {
      const findFirst = vi.fn().mockResolvedValueOnce(null);
      const repo = new PrismaFarmRepository(dbWith({ findFirst }));

      const result = await repo.findById("org-1", "farm-1");

      expect(findFirst).toHaveBeenCalledWith({
        where: { id: "farm-1", organizationId: "org-1" },
      });
      expect(result).toBeNull();
    });

    it("returns a Farm domain entity via toDomain when found", async () => {
      const findFirst = vi.fn().mockResolvedValueOnce(buildRow());
      const repo = new PrismaFarmRepository(dbWith({ findFirst }));

      const result = await repo.findById("org-1", "farm-1");

      expect(result?.id).toBe("farm-1");
      expect(result?.name).toBe("Granja Norte");
    });
  });

  describe("findByName", () => {
    it("returns null when no row matches", async () => {
      const findFirst = vi.fn().mockResolvedValueOnce(null);
      const repo = new PrismaFarmRepository(dbWith({ findFirst }));

      const result = await repo.findByName("org-1", "Inexistente");

      expect(findFirst).toHaveBeenCalledWith({
        where: { organizationId: "org-1", name: "Inexistente" },
      });
      expect(result).toBeNull();
    });

    it("returns a Farm scoped by org+name when found", async () => {
      const findFirst = vi.fn().mockResolvedValueOnce(buildRow());
      const repo = new PrismaFarmRepository(dbWith({ findFirst }));

      const result = await repo.findByName("org-1", "Granja Norte");

      expect(result?.name).toBe("Granja Norte");
    });
  });

  describe("save", () => {
    it("creates with the persistence payload of the entity", async () => {
      const create = vi.fn().mockResolvedValueOnce(undefined);
      const repo = new PrismaFarmRepository(dbWith({ create }));

      const entity = buildEntity();
      await repo.save(entity);

      expect(create).toHaveBeenCalledTimes(1);
      const callArg = create.mock.calls[0]?.[0];
      expect(callArg.data.id).toBe(entity.id);
      expect(callArg.data.organizationId).toBe("org-1");
      expect(callArg.data.name).toBe("Granja Norte");
      expect(callArg.data.memberId).toBe("member-1");
    });
  });

  describe("update", () => {
    it("scopes update by id+organizationId and applies patch", async () => {
      const update = vi.fn().mockResolvedValueOnce(undefined);
      const repo = new PrismaFarmRepository(dbWith({ update }));
      const entity = buildEntity().update({ name: "Granja Sur", location: null });

      await repo.update(entity);

      const callArg = update.mock.calls[0]?.[0];
      expect(callArg.where).toEqual({ id: entity.id, organizationId: "org-1" });
      expect(callArg.data.name).toBe("Granja Sur");
      expect(callArg.data.location).toBeNull();
    });
  });

  describe("delete", () => {
    it("scopes delete by id+organizationId", async () => {
      const deleteFn = vi.fn().mockResolvedValueOnce(undefined);
      const repo = new PrismaFarmRepository(dbWith({ delete: deleteFn }));

      await repo.delete("org-1", "farm-1");

      expect(deleteFn).toHaveBeenCalledWith({
        where: { id: "farm-1", organizationId: "org-1" },
      });
    });
  });
});
