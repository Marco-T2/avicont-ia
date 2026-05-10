import { describe, it, expect, vi } from "vitest";
import { type PrismaClient } from "@/generated/prisma/client";
import { PrismaLotRepository } from "../prisma-lot.repository";
import { Lot } from "../../domain/lot.entity";

const dbWith = (overrides: Record<string, unknown>): PrismaClient =>
  ({ chickenLot: overrides }) as unknown as PrismaClient;

const buildEntity = () =>
  Lot.create({
    organizationId: "org-1",
    name: "Lote A",
    barnNumber: 1,
    initialCount: 1000,
    startDate: new Date("2026-04-01"),
    farmId: "farm-1",
  });

const buildRow = (override: Record<string, unknown> = {}) => ({
  id: "lot-1",
  organizationId: "org-1",
  name: "Lote A",
  barnNumber: 1,
  initialCount: 1000,
  startDate: new Date("2026-04-01"),
  endDate: null,
  status: "ACTIVE",
  farmId: "farm-1",
  createdAt: new Date("2026-04-01"),
  updatedAt: new Date("2026-04-15"),
  ...override,
});

const buildRowWithRelations = (override: Record<string, unknown> = {}) => ({
  ...buildRow(),
  expenses: [
    {
      id: "e-1",
      amount: { toString: () => "150.50" },
      category: "FEED",
      description: "Feed",
      date: new Date(),
      lotId: "lot-1",
      organizationId: "org-1",
      createdById: "u-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  mortalityLogs: [
    {
      id: "m-1",
      count: 5,
      date: new Date(),
      lotId: "lot-1",
      organizationId: "org-1",
      createdById: "u-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  ...override,
});

describe("PrismaLotRepository", () => {
  describe("findAll", () => {
    it("scopes by organizationId and orders by createdAt desc", async () => {
      const findMany = vi.fn().mockResolvedValueOnce([buildRow()]);
      const repo = new PrismaLotRepository(dbWith({ findMany }));

      const result = await repo.findAll("org-1");

      expect(findMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1" },
        orderBy: { createdAt: "desc" },
      });
      expect(result).toHaveLength(1);
      expect(result[0]?.organizationId).toBe("org-1");
    });
  });

  describe("findById", () => {
    it("returns null when no row found", async () => {
      const findFirst = vi.fn().mockResolvedValueOnce(null);
      const repo = new PrismaLotRepository(dbWith({ findFirst }));

      const result = await repo.findById("org-1", "lot-1");

      expect(findFirst).toHaveBeenCalledWith({
        where: { id: "lot-1", organizationId: "org-1" },
      });
      expect(result).toBeNull();
    });

    it("returns a Lot domain entity via toDomain when found", async () => {
      const findFirst = vi.fn().mockResolvedValueOnce(buildRow());
      const repo = new PrismaLotRepository(dbWith({ findFirst }));

      const result = await repo.findById("org-1", "lot-1");

      expect(result?.id).toBe("lot-1");
      expect(result?.name).toBe("Lote A");
    });
  });

  describe("findByFarm", () => {
    it("scopes by farmId+organizationId and orders by createdAt desc", async () => {
      const findMany = vi.fn().mockResolvedValueOnce([buildRow()]);
      const repo = new PrismaLotRepository(dbWith({ findMany }));

      await repo.findByFarm("org-1", "farm-1");

      expect(findMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1", farmId: "farm-1" },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("findByIdWithRelations", () => {
    it("returns null when no row found", async () => {
      const findFirst = vi.fn().mockResolvedValueOnce(null);
      const repo = new PrismaLotRepository(dbWith({ findFirst }));

      const result = await repo.findByIdWithRelations("org-1", "lot-missing");

      expect(result).toBeNull();
    });

    it("returns LotWithRelationsSnapshot tuple { lot, expenses, mortalityLogs }", async () => {
      const findFirst = vi.fn().mockResolvedValueOnce(buildRowWithRelations());
      const repo = new PrismaLotRepository(dbWith({ findFirst }));

      const result = await repo.findByIdWithRelations("org-1", "lot-1");

      expect(result).not.toBeNull();
      expect(result?.lot.id).toBe("lot-1");
      expect(result?.expenses).toHaveLength(1);
      expect(result?.mortalityLogs).toHaveLength(1);
    });

    it("expenses subset { amount: number } only (drops category/description/date)", async () => {
      const findFirst = vi.fn().mockResolvedValueOnce(buildRowWithRelations());
      const repo = new PrismaLotRepository(dbWith({ findFirst }));

      const result = await repo.findByIdWithRelations("org-1", "lot-1");

      expect(result?.expenses[0]).toEqual({ amount: 150.5 });
    });

    it("mortalityLogs subset { count: number } only (drops date/createdById)", async () => {
      const findFirst = vi.fn().mockResolvedValueOnce(buildRowWithRelations());
      const repo = new PrismaLotRepository(dbWith({ findFirst }));

      const result = await repo.findByIdWithRelations("org-1", "lot-1");

      expect(result?.mortalityLogs[0]).toEqual({ count: 5 });
    });

    it("Decimal→number conversion for expenses.amount at boundary", async () => {
      const findFirst = vi.fn().mockResolvedValueOnce(
        buildRowWithRelations({
          expenses: [
            {
              id: "e-1",
              amount: { toString: () => "1234.56" },
              category: "FEED",
              description: "x",
              date: new Date(),
              lotId: "lot-1",
              organizationId: "org-1",
              createdById: "u-1",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
          mortalityLogs: [],
        }),
      );
      const repo = new PrismaLotRepository(dbWith({ findFirst }));

      const result = await repo.findByIdWithRelations("org-1", "lot-1");

      expect(result?.expenses[0]?.amount).toBe(1234.56);
      expect(typeof result?.expenses[0]?.amount).toBe("number");
    });
  });

  describe("save", () => {
    it("creates with the persistence payload of the entity", async () => {
      const create = vi.fn().mockResolvedValueOnce(undefined);
      const repo = new PrismaLotRepository(dbWith({ create }));

      const entity = buildEntity();
      await repo.save(entity);

      expect(create).toHaveBeenCalledTimes(1);
      const callArg = create.mock.calls[0]?.[0];
      expect(callArg.data.id).toBe(entity.id);
      expect(callArg.data.name).toBe("Lote A");
      expect(callArg.data.barnNumber).toBe(1);
      expect(callArg.data.initialCount).toBe(1000);
    });
  });

  describe("update", () => {
    it("scopes update by id+organizationId with status transition ACTIVE→CLOSED+endDate", async () => {
      const update = vi.fn().mockResolvedValueOnce(undefined);
      const repo = new PrismaLotRepository(dbWith({ update }));
      const entity = buildEntity().close(new Date("2026-05-01"));

      await repo.update(entity);

      const callArg = update.mock.calls[0]?.[0];
      expect(callArg.where).toEqual({ id: entity.id, organizationId: "org-1" });
      expect(callArg.data.status).toBe("CLOSED");
      expect(callArg.data.endDate).toBeInstanceOf(Date);
    });

    it("preserves other fields (name+barnNumber+initialCount unchanged)", async () => {
      const update = vi.fn().mockResolvedValueOnce(undefined);
      const repo = new PrismaLotRepository(dbWith({ update }));
      const entity = buildEntity().close(new Date("2026-05-01"));

      await repo.update(entity);

      const callArg = update.mock.calls[0]?.[0];
      expect(callArg.data.name).toBe("Lote A");
      expect(callArg.data.barnNumber).toBe(1);
      expect(callArg.data.initialCount).toBe(1000);
    });
  });
});
