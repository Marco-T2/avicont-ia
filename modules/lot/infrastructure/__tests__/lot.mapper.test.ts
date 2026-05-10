import { describe, it, expect } from "vitest";
import { type ChickenLot } from "@/generated/prisma/client";
import {
  toDomain,
  toPersistence,
  toLotWithRelationsSnapshot,
} from "../lot.mapper";
import { Lot } from "../../domain/lot.entity";

const row = (override: Partial<ChickenLot> = {}): ChickenLot => ({
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

describe("lot mapper", () => {
  describe("toDomain()", () => {
    it("hydrates a Lot from a ChickenLot Prisma row (name asymmetry mapper)", () => {
      const l = toDomain(row());
      expect(l).toBeInstanceOf(Lot);
      expect(l.id).toBe("lot-1");
      expect(l.name).toBe("Lote A");
      expect(l.farmId).toBe("farm-1");
    });

    it("preserves status enum (ACTIVE/CLOSED)", () => {
      const active = toDomain(row({ status: "ACTIVE" }));
      const closed = toDomain(
        row({ status: "CLOSED", endDate: new Date("2026-05-01") }),
      );
      expect(active.status).toBe("ACTIVE");
      expect(closed.status).toBe("CLOSED");
    });

    it("preserves endDate null vs Date", () => {
      const active = toDomain(row({ endDate: null }));
      const closed = toDomain(
        row({ status: "CLOSED", endDate: new Date("2026-05-01") }),
      );
      expect(active.endDate).toBeNull();
      expect(closed.endDate).toBeInstanceOf(Date);
    });

    it("preserves barnNumber+initialCount integer values", () => {
      const l = toDomain(row({ barnNumber: 7, initialCount: 5000 }));
      expect(l.barnNumber).toBe(7);
      expect(l.initialCount).toBe(5000);
    });
  });

  describe("toPersistence()", () => {
    it("returns a ChickenLot Prisma payload", () => {
      const entity = Lot.create({
        organizationId: "org-1",
        name: "Lote A",
        barnNumber: 1,
        initialCount: 1000,
        startDate: new Date("2026-04-01"),
        farmId: "farm-1",
      });
      const data = toPersistence(entity);
      expect(data.id).toBe(entity.id);
      expect(data.name).toBe("Lote A");
      expect(data.barnNumber).toBe(1);
      expect(data.initialCount).toBe(1000);
      expect(data.farmId).toBe("farm-1");
    });

    it("preserves status enum (ACTIVE on create, CLOSED after close)", () => {
      const entity = Lot.create({
        organizationId: "org-1",
        name: "Lote A",
        barnNumber: 1,
        initialCount: 1000,
        startDate: new Date("2026-04-01"),
        farmId: "farm-1",
      });
      expect(toPersistence(entity).status).toBe("ACTIVE");
      const closed = entity.close(new Date("2026-05-01"));
      expect(toPersistence(closed).status).toBe("CLOSED");
    });

    it("preserves endDate null when ACTIVE", () => {
      const entity = Lot.create({
        organizationId: "org-1",
        name: "Lote A",
        barnNumber: 1,
        initialCount: 1000,
        startDate: new Date("2026-04-01"),
        farmId: "farm-1",
      });
      const data = toPersistence(entity);
      expect(data.endDate).toBeNull();
    });

    it("preserves all timestamps (createdAt+updatedAt)", () => {
      const entity = Lot.create({
        organizationId: "org-1",
        name: "Lote A",
        barnNumber: 1,
        initialCount: 1000,
        startDate: new Date("2026-04-01"),
        farmId: "farm-1",
      });
      const data = toPersistence(entity);
      expect(data.createdAt).toBeInstanceOf(Date);
      expect(data.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("roundtrip", () => {
    it("toPersistence(toDomain(row)) yields equivalent payload", () => {
      const original = row();
      const entity = toDomain(original);
      const data = toPersistence(entity);
      expect(data.id).toBe(original.id);
      expect(data.name).toBe(original.name);
      expect(data.barnNumber).toBe(original.barnNumber);
      expect(data.initialCount).toBe(original.initialCount);
      expect(data.status).toBe(original.status);
      expect(data.startDate.getTime()).toBe(original.startDate.getTime());
    });
  });

  describe("toLotWithRelationsSnapshot()", () => {
    it("transforms flat row + expenses[] + mortalityLogs[] → tuple { lot, expenses, mortalityLogs }", () => {
      const expensesIn = [
        {
          id: "e-1",
          amount: { toString: () => "100.00" },
          category: "FEED",
          description: null,
          date: new Date(),
          lotId: "lot-1",
          organizationId: "org-1",
          createdById: "u-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      const mortalityIn = [
        {
          id: "m-1",
          count: 3,
          date: new Date(),
          lotId: "lot-1",
          organizationId: "org-1",
          createdById: "u-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      const snapshot = toLotWithRelationsSnapshot({
        ...row(),
        expenses: expensesIn,
        mortalityLogs: mortalityIn,
      } as never);

      expect(snapshot.lot).toBeInstanceOf(Lot);
      expect(snapshot.lot.id).toBe("lot-1");
      expect(snapshot.expenses).toHaveLength(1);
      expect(snapshot.mortalityLogs).toHaveLength(1);
    });

    it("subset projection drops irrelevant fields (category/description/date/createdById)", () => {
      const expensesIn = [
        {
          id: "e-1",
          amount: { toString: () => "200.00" },
          category: "FEED",
          description: "x",
          date: new Date(),
          lotId: "lot-1",
          organizationId: "org-1",
          createdById: "u-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      const mortalityIn = [
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
      ];
      const snapshot = toLotWithRelationsSnapshot({
        ...row(),
        expenses: expensesIn,
        mortalityLogs: mortalityIn,
      } as never);

      expect(snapshot.expenses[0]).toEqual({ amount: 200 });
      expect(snapshot.mortalityLogs[0]).toEqual({ count: 5 });
      expect(Object.keys(snapshot.expenses[0]!)).toEqual(["amount"]);
      expect(Object.keys(snapshot.mortalityLogs[0]!)).toEqual(["count"]);
    });
  });
});
