import { describe, it, expect, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { PrismaProductTypesRepository } from "../prisma-product-types.repository";
import { ProductType } from "../../domain/product-type.entity";
import { ProductTypeDuplicateCodeError } from "../../domain/errors/product-type-errors";

const dbWith = (
  ptOverrides: Record<string, unknown>,
): PrismaClient =>
  ({
    productType: ptOverrides,
  }) as unknown as PrismaClient;

const buildEntity = () =>
  ProductType.create({
    organizationId: "org-1",
    code: "POLLO",
    name: "Pollo Entero",
    sortOrder: 0,
  });

const buildRow = (override: Record<string, unknown> = {}) => ({
  id: "pt-1",
  organizationId: "org-1",
  code: "POLLO",
  name: "Pollo Entero",
  isActive: true,
  sortOrder: 0,
  createdAt: new Date("2026-01-15"),
  updatedAt: new Date("2026-01-15"),
  ...override,
});

describe("PrismaProductTypesRepository", () => {
  describe("findAll", () => {
    // α27
    it("scopes by organizationId and orders by sortOrder asc + name asc, applies isActive filter", async () => {
      const findMany = vi.fn().mockResolvedValueOnce([buildRow()]);
      const repo = new PrismaProductTypesRepository(dbWith({ findMany }));

      const result = await repo.findAll("org-1", { isActive: true });

      expect(findMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1", isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
      expect(result).toHaveLength(1);
      expect(result[0]?.organizationId).toBe("org-1");
    });
  });

  describe("findById", () => {
    // α28
    it("returns null when no row found", async () => {
      const findFirst = vi.fn().mockResolvedValueOnce(null);
      const repo = new PrismaProductTypesRepository(dbWith({ findFirst }));

      const result = await repo.findById("org-1", "pt-1");

      expect(findFirst).toHaveBeenCalledWith({
        where: { id: "pt-1", organizationId: "org-1" },
      });
      expect(result).toBeNull();
    });

    // α29
    it("returns a ProductType domain entity via toDomain when found", async () => {
      const findFirst = vi.fn().mockResolvedValueOnce(buildRow());
      const repo = new PrismaProductTypesRepository(dbWith({ findFirst }));

      const result = await repo.findById("org-1", "pt-1");

      expect(result?.id).toBe("pt-1");
      expect(result?.code).toBe("POLLO");
    });
  });

  describe("findByCode", () => {
    // α30
    it("scopes by organizationId + code and returns domain entity", async () => {
      const findFirst = vi.fn().mockResolvedValueOnce(buildRow());
      const repo = new PrismaProductTypesRepository(dbWith({ findFirst }));

      const result = await repo.findByCode("org-1", "POLLO");

      expect(findFirst).toHaveBeenCalledWith({
        where: { organizationId: "org-1", code: "POLLO" },
      });
      expect(result?.code).toBe("POLLO");
    });
  });

  describe("save", () => {
    // α31
    it("upserts with the persistence payload of the entity", async () => {
      const upsert = vi.fn().mockResolvedValueOnce(undefined);
      const repo = new PrismaProductTypesRepository(dbWith({ upsert }));

      const entity = buildEntity();
      await repo.save(entity);

      expect(upsert).toHaveBeenCalledTimes(1);
      const callArg = upsert.mock.calls[0]?.[0];
      expect(callArg.where.id).toBe(entity.id);
      expect(callArg.create.code).toBe("POLLO");
      expect(callArg.update.name).toBe("Pollo Entero");
    });

    // α32
    it("catches Prisma P2002 unique constraint and throws ProductTypeDuplicateCodeError", async () => {
      const p2002Error = Object.assign(new Error("Unique constraint"), {
        code: "P2002",
      });
      const upsert = vi.fn().mockRejectedValueOnce(p2002Error);
      const repo = new PrismaProductTypesRepository(dbWith({ upsert }));

      const entity = buildEntity();
      await expect(repo.save(entity)).rejects.toThrow(
        ProductTypeDuplicateCodeError,
      );
    });
  });
});
