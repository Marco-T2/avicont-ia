import { describe, it, expect, vi } from "vitest";
import { type PrismaClient } from "@/generated/prisma/client";
import { PrismaLotRepository } from "../prisma-lot.repository";
import { Lot } from "../../domain/lot.entity";
import { LotForFarmAtDateExists } from "../../domain/errors/lot-errors";

const dbWith = (overrides: Record<string, unknown>): PrismaClient =>
  ({ chickenLot: overrides }) as unknown as PrismaClient;

/**
 * Builds a PrismaClient mock that includes chickenLot + expense +
 * mortalityLog tables plus a $transaction implementation. The
 * $transaction here just executes the array of pre-built promises
 * sequentially (mirrors Prisma's array-form contract).
 */
const dbWithCascade = (overrides: {
  chickenLot?: Record<string, unknown>;
  expense?: Record<string, unknown>;
  mortalityLog?: Record<string, unknown>;
  $transaction?: (operations: Promise<unknown>[]) => Promise<unknown[]>;
}): PrismaClient =>
  ({
    chickenLot: overrides.chickenLot ?? {},
    expense: overrides.expense ?? {},
    mortalityLog: overrides.mortalityLog ?? {},
    $transaction:
      overrides.$transaction ??
      ((ops: Promise<unknown>[]) => Promise.all(ops)),
  }) as unknown as PrismaClient;

const buildEntity = () =>
  Lot.create({
    organizationId: "org-1",
    initialCount: 1000,
    startDate: new Date("2026-04-01"),
    farmName: "Pocona",
    memberId: "member-1",
  });

const buildRow = (override: Record<string, unknown> = {}) => ({
  id: "lot-1",
  organizationId: "org-1",
  initialCount: 1000,
  startDate: new Date("2026-04-01"),
  endDate: null,
  status: "ACTIVE",
  farmName: "Pocona",
  memberId: "member-1",
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

describe("PrismaLotRepository (post simplify-lot-identifier)", () => {
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
      expect(result?.farmName).toBe("Pocona");
      expect(result?.displayName).toBe("Pocona - 01/04/2026");
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
    it("creates with persistence payload (farmName + memberId; no legacy name/barnNumber/farmId post-simplify)", async () => {
      const create = vi.fn().mockResolvedValueOnce(undefined);
      const repo = new PrismaLotRepository(dbWith({ create }));

      const entity = buildEntity();
      await repo.save(entity);

      expect(create).toHaveBeenCalledTimes(1);
      const callArg = create.mock.calls[0]?.[0];
      expect(callArg.data.id).toBe(entity.id);
      expect(callArg.data.initialCount).toBe(1000);
      expect(callArg.data.farmName).toBe("Pocona");
      expect(callArg.data.memberId).toBe("member-1");
      expect("name" in callArg.data).toBe(false);
      expect("barnNumber" in callArg.data).toBe(false);
      expect("farmId" in callArg.data).toBe(false);
    });

    // P2002 mapping on the (orgId, farmName, startDate) unique index
    it("maps Prisma P2002 on chicken_lots_organizationId_farmName_startDate_key → LotForFarmAtDateExists", async () => {
      const p2002 = Object.assign(new Error("Unique constraint"), {
        code: "P2002",
        meta: {
          target: "chicken_lots_organizationId_farmName_startDate_key",
        },
      });
      const create = vi.fn().mockRejectedValueOnce(p2002);
      const repo = new PrismaLotRepository(dbWith({ create }));

      await expect(repo.save(buildEntity())).rejects.toThrow(
        LotForFarmAtDateExists,
      );
    });

    it("maps P2002 with field-name target array → LotForFarmAtDateExists (newer Prisma shape)", async () => {
      const p2002 = Object.assign(new Error("Unique constraint"), {
        code: "P2002",
        meta: { target: ["organizationId", "farmName", "startDate"] },
      });
      const create = vi.fn().mockRejectedValueOnce(p2002);
      const repo = new PrismaLotRepository(dbWith({ create }));

      await expect(repo.save(buildEntity())).rejects.toThrow(
        LotForFarmAtDateExists,
      );
    });

    it("rethrows non-P2002 errors unchanged", async () => {
      const boom = new Error("oops");
      const create = vi.fn().mockRejectedValueOnce(boom);
      const repo = new PrismaLotRepository(dbWith({ create }));

      await expect(repo.save(buildEntity())).rejects.toBe(boom);
    });
  });

  describe("findChildCounts", () => {
    it("returns counts via Promise.all of two count queries scoped by org+lot", async () => {
      const expenseCount = vi.fn().mockResolvedValueOnce(4);
      const mortalityCount = vi.fn().mockResolvedValueOnce(7);
      const repo = new PrismaLotRepository(
        dbWithCascade({
          expense: { count: expenseCount },
          mortalityLog: { count: mortalityCount },
        }),
      );

      const counts = await repo.findChildCounts("org-1", "lot-1");

      expect(counts).toEqual({ expenses: 4, mortality: 7 });
      expect(expenseCount).toHaveBeenCalledWith({
        where: { organizationId: "org-1", lotId: "lot-1" },
      });
      expect(mortalityCount).toHaveBeenCalledWith({
        where: { organizationId: "org-1", lotId: "lot-1" },
      });
    });
  });

  describe("delete (cascade tx)", () => {
    it("invokes $transaction with 3 operations: expense.deleteMany, mortalityLog.deleteMany, chickenLot.delete in that order", async () => {
      const callOrder: string[] = [];
      const expenseDeleteMany = vi.fn(() => {
        callOrder.push("expense.deleteMany");
        return Promise.resolve({ count: 0 });
      });
      const mortalityDeleteMany = vi.fn(() => {
        callOrder.push("mortalityLog.deleteMany");
        return Promise.resolve({ count: 0 });
      });
      const chickenLotDelete = vi.fn(() => {
        callOrder.push("chickenLot.delete");
        return Promise.resolve({});
      });
      const $transaction = vi.fn((ops: Promise<unknown>[]) =>
        Promise.all(ops),
      );

      const repo = new PrismaLotRepository(
        dbWithCascade({
          chickenLot: { delete: chickenLotDelete },
          expense: { deleteMany: expenseDeleteMany },
          mortalityLog: { deleteMany: mortalityDeleteMany },
          $transaction,
        }),
      );

      await repo.delete("org-1", "lot-1");

      // $transaction MUST receive an array of 3 promises.
      expect($transaction).toHaveBeenCalledTimes(1);
      const passedOps = $transaction.mock.calls[0]?.[0] as unknown[];
      expect(passedOps).toHaveLength(3);

      // Each table call MUST be scoped by org+lot, in the expected order.
      expect(expenseDeleteMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1", lotId: "lot-1" },
      });
      expect(mortalityDeleteMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1", lotId: "lot-1" },
      });
      expect(chickenLotDelete).toHaveBeenCalledWith({
        where: { id: "lot-1", organizationId: "org-1" },
      });
      expect(callOrder).toEqual([
        "expense.deleteMany",
        "mortalityLog.deleteMany",
        "chickenLot.delete",
      ]);
    });
  });

  describe("update", () => {
    it("scopes update by id+org with status transition + writes farmName; no legacy name/barnNumber/farmId (post-simplify)", async () => {
      const update = vi.fn().mockResolvedValueOnce(undefined);
      const repo = new PrismaLotRepository(dbWith({ update }));
      const entity = buildEntity().deactivate(new Date("2026-05-01"));

      await repo.update(entity);

      const callArg = update.mock.calls[0]?.[0];
      expect(callArg.where).toEqual({ id: entity.id, organizationId: "org-1" });
      expect(callArg.data.status).toBe("INACTIVE");
      expect(callArg.data.endDate).toBeInstanceOf(Date);
      expect(callArg.data.farmName).toBe("Pocona");
      expect("name" in callArg.data).toBe(false);
      expect("barnNumber" in callArg.data).toBe(false);
      expect("farmId" in callArg.data).toBe(false);
      // startDate stays out of the update payload (it's part of the
      // identity tuple post-simplify).
      expect("startDate" in callArg.data).toBe(false);
    });

    it("preserves initialCount (still in payload, but immutable from service)", async () => {
      const update = vi.fn().mockResolvedValueOnce(undefined);
      const repo = new PrismaLotRepository(dbWith({ update }));
      const entity = buildEntity().deactivate(new Date("2026-05-01"));

      await repo.update(entity);

      const callArg = update.mock.calls[0]?.[0];
      expect(callArg.data.initialCount).toBe(1000);
    });

    it("maps Prisma P2002 on update → LotForFarmAtDateExists", async () => {
      const p2002 = Object.assign(new Error("Unique constraint"), {
        code: "P2002",
        meta: {
          target: "chicken_lots_organizationId_farmName_startDate_key",
        },
      });
      const update = vi.fn().mockRejectedValueOnce(p2002);
      const repo = new PrismaLotRepository(dbWith({ update }));

      await expect(repo.update(buildEntity())).rejects.toThrow(
        LotForFarmAtDateExists,
      );
    });
  });
});
