import { describe, it, expect, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { PrismaOperationalDocTypesRepository } from "../prisma-operational-doc-types.repository";
import { OperationalDocType } from "../../domain/operational-doc-type.entity";
import { OperationalDocTypeDuplicateCodeError } from "../../domain/errors/operational-doc-type-errors";

const dbWith = (
  odtOverrides: Record<string, unknown>,
  paymentOverrides?: Record<string, unknown>,
): PrismaClient =>
  ({
    operationalDocType: odtOverrides,
    payment: paymentOverrides ?? {},
  }) as unknown as PrismaClient;

const buildEntity = () =>
  OperationalDocType.create({
    organizationId: "org-1",
    code: "FACT-A",
    name: "Factura A",
    direction: "PAGO",
  });

const buildRow = (override: Record<string, unknown> = {}) => ({
  id: "odt-1",
  organizationId: "org-1",
  code: "FACT-A",
  name: "Factura A",
  direction: "PAGO" as const,
  isActive: true,
  createdAt: new Date("2026-01-15"),
  updatedAt: new Date("2026-01-15"),
  ...override,
});

describe("PrismaOperationalDocTypesRepository", () => {
  describe("findAll", () => {
    // α28
    it("scopes by organizationId and orders by code asc, applies isActive filter", async () => {
      const findMany = vi.fn().mockResolvedValueOnce([buildRow()]);
      const repo = new PrismaOperationalDocTypesRepository(
        dbWith({ findMany }),
      );

      const result = await repo.findAll("org-1", { isActive: true });

      expect(findMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1", isActive: true },
        orderBy: [{ code: "asc" }],
      });
      expect(result).toHaveLength(1);
      expect(result[0]?.organizationId).toBe("org-1");
    });
  });

  describe("findById", () => {
    // α29
    it("returns null when no row found", async () => {
      const findFirst = vi.fn().mockResolvedValueOnce(null);
      const repo = new PrismaOperationalDocTypesRepository(
        dbWith({ findFirst }),
      );

      const result = await repo.findById("org-1", "odt-1");

      expect(findFirst).toHaveBeenCalledWith({
        where: { id: "odt-1", organizationId: "org-1" },
      });
      expect(result).toBeNull();
    });

    // α30
    it("returns an OperationalDocType domain entity via toDomain when found", async () => {
      const findFirst = vi.fn().mockResolvedValueOnce(buildRow());
      const repo = new PrismaOperationalDocTypesRepository(
        dbWith({ findFirst }),
      );

      const result = await repo.findById("org-1", "odt-1");

      expect(result?.id).toBe("odt-1");
      expect(result?.code).toBe("FACT-A");
    });
  });

  describe("findByCode", () => {
    // α31
    it("scopes by organizationId + code and returns domain entity", async () => {
      const findFirst = vi.fn().mockResolvedValueOnce(buildRow());
      const repo = new PrismaOperationalDocTypesRepository(
        dbWith({ findFirst }),
      );

      const result = await repo.findByCode("org-1", "FACT-A");

      expect(findFirst).toHaveBeenCalledWith({
        where: { organizationId: "org-1", code: "FACT-A" },
      });
      expect(result?.code).toBe("FACT-A");
    });
  });

  describe("save", () => {
    // α32
    it("upserts with the persistence payload of the entity", async () => {
      const upsert = vi.fn().mockResolvedValueOnce(undefined);
      const repo = new PrismaOperationalDocTypesRepository(
        dbWith({ upsert }),
      );

      const entity = buildEntity();
      await repo.save(entity);

      expect(upsert).toHaveBeenCalledTimes(1);
      const callArg = upsert.mock.calls[0]?.[0];
      expect(callArg.where.id).toBe(entity.id);
      expect(callArg.create.code).toBe("FACT-A");
      expect(callArg.update.name).toBe("Factura A");
    });

    // α33
    it("catches Prisma P2002 unique constraint and throws OperationalDocTypeDuplicateCodeError", async () => {
      const p2002Error = Object.assign(new Error("Unique constraint"), {
        code: "P2002",
      });
      const upsert = vi.fn().mockRejectedValueOnce(p2002Error);
      const repo = new PrismaOperationalDocTypesRepository(
        dbWith({ upsert }),
      );

      const entity = buildEntity();
      await expect(repo.save(entity)).rejects.toThrow(
        OperationalDocTypeDuplicateCodeError,
      );
    });
  });

  describe("countActivePayments", () => {
    // α34
    it("counts non-VOIDED payments scoped by organizationId + operationalDocTypeId", async () => {
      const count = vi.fn().mockResolvedValueOnce(5);
      const repo = new PrismaOperationalDocTypesRepository(
        dbWith({}, { count }),
      );

      const result = await repo.countActivePayments("org-1", "odt-1");

      expect(count).toHaveBeenCalledWith({
        where: {
          organizationId: "org-1",
          operationalDocTypeId: "odt-1",
          status: { not: "VOIDED" },
        },
      });
      expect(result).toBe(5);
    });
  });
});
