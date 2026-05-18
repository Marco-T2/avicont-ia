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
  farmName: "Pocona",
  memberId: "member-1",
  createdAt: new Date("2026-04-01"),
  updatedAt: new Date("2026-04-15"),
  ...override,
});

describe("lot mapper (post retire-farm-collapse-to-lot F5-final)", () => {
  describe("toDomain()", () => {
    it("hydrates a Lot with farmName + memberId; no legacy farmId surface", () => {
      const l = toDomain(row());
      expect(l).toBeInstanceOf(Lot);
      expect(l.id).toBe("lot-1");
      expect(l.name).toBe("Lote A");
      expect(l.farmName).toBe("Pocona");
      expect(l.memberId).toBe("member-1");
      // Post-F5-final: legacy `_legacyFarmId` accessor + `farmId` column dropped.
      expect(
        (l as unknown as { _legacyFarmId?: unknown })._legacyFarmId,
      ).toBeUndefined();
    });

    it("preserves Prisma status enum 1:1 (ACTIVE | INACTIVE)", () => {
      const active = toDomain(row({ status: "ACTIVE" }));
      const inactive = toDomain(
        row({ status: "INACTIVE", endDate: new Date("2026-05-01") }),
      );
      expect(active.status).toBe("ACTIVE");
      expect(inactive.status).toBe("INACTIVE");
    });

    it("preserves endDate null vs Date", () => {
      const active = toDomain(row({ endDate: null }));
      const inactive = toDomain(
        row({ status: "INACTIVE", endDate: new Date("2026-05-01") }),
      );
      expect(active.endDate).toBeNull();
      expect(inactive.endDate).toBeInstanceOf(Date);
    });

    it("preserves barnNumber+initialCount integer values", () => {
      const l = toDomain(row({ barnNumber: 7, initialCount: 5000 }));
      expect(l.barnNumber).toBe(7);
      expect(l.initialCount).toBe(5000);
    });
  });

  describe("toPersistence()", () => {
    it("returns a ChickenLot Prisma payload with farmName + memberId; no legacy farmId field", () => {
      const entity = Lot.create({
        organizationId: "org-1",
        name: "Lote A",
        barnNumber: 1,
        initialCount: 1000,
        startDate: new Date("2026-04-01"),
        farmName: "Pocona",
        memberId: "member-1",
      });
      const data = toPersistence(entity);
      expect(data.id).toBe(entity.id);
      expect(data.name).toBe("Lote A");
      expect(data.barnNumber).toBe(1);
      expect(data.initialCount).toBe(1000);
      expect(data.farmName).toBe("Pocona");
      expect(data.memberId).toBe("member-1");
      // Post-F5-final: legacy `farmId` column dropped — payload no lo incluye.
      expect("farmId" in data).toBe(false);
    });

    it("status pass-through 1:1 (ACTIVE | INACTIVE)", () => {
      const entity = Lot.create({
        organizationId: "org-1",
        name: "Lote A",
        barnNumber: 1,
        initialCount: 1000,
        startDate: new Date("2026-04-01"),
        farmName: "Pocona",
        memberId: "member-1",
      });
      expect(toPersistence(entity).status).toBe("ACTIVE");
      const inactive = entity.deactivate(new Date("2026-05-01"));
      expect(toPersistence(inactive).status).toBe("INACTIVE");
    });

    it("preserves endDate null when ACTIVE", () => {
      const entity = Lot.create({
        organizationId: "org-1",
        name: "Lote A",
        barnNumber: 1,
        initialCount: 1000,
        startDate: new Date("2026-04-01"),
        farmName: "Pocona",
        memberId: "member-1",
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
        farmName: "Pocona",
        memberId: "member-1",
      });
      const data = toPersistence(entity);
      expect(data.createdAt).toBeInstanceOf(Date);
      expect(data.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("roundtrip", () => {
    it("toPersistence(toDomain(row)) yields equivalent payload for ACTIVE (farmName + memberId)", () => {
      const original = row();
      const entity = toDomain(original);
      const data = toPersistence(entity);
      expect(data.id).toBe(original.id);
      expect(data.name).toBe(original.name);
      expect(data.barnNumber).toBe(original.barnNumber);
      expect(data.initialCount).toBe(original.initialCount);
      expect(data.status).toBe(original.status);
      expect(data.farmName).toBe(original.farmName);
      expect(data.memberId).toBe(original.memberId);
      expect(data.startDate.getTime()).toBe(original.startDate.getTime());
    });

    it("INACTIVE roundtrip stays INACTIVE (1:1 enum mapping)", () => {
      const original = row({ status: "INACTIVE" });
      const entity = toDomain(original);
      const data = toPersistence(entity);
      expect(data.status).toBe("INACTIVE");
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
