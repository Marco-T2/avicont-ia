import { describe, it, expect, beforeEach } from "vitest";
import { LotService } from "../lot.service";
import { Lot } from "../../domain/lot.entity";
import { LotSummary } from "../../domain/value-objects/lot-summary";
import { InMemoryLotRepository } from "../fakes/in-memory-lot.repository";
import {
  CannotCloseInactiveLot,
  LotNameDuplicate,
} from "../../domain/errors/lot-errors";
import { NotFoundError } from "@/features/shared/errors";

const ORG = "org-1";
const FARM = "farm-1";

const baseInput = (
  override: Partial<{
    name: string;
    barnNumber: number;
    initialCount: number;
    startDate: Date;
    farmId: string;
  }> = {},
) => ({
  name: override.name ?? "Lote 001",
  barnNumber: override.barnNumber ?? 1,
  initialCount: override.initialCount ?? 1000,
  startDate: override.startDate ?? new Date("2026-01-01"),
  farmId: override.farmId ?? FARM,
});

describe("LotService", () => {
  let repo: InMemoryLotRepository;
  let svc: LotService;

  beforeEach(() => {
    repo = new InMemoryLotRepository();
    svc = new LotService(repo);
  });

  describe("list", () => {
    // α28
    it("returns lots scoped to org", async () => {
      const l = await svc.create(ORG, baseInput());
      const items = await svc.list(ORG);
      expect(items).toHaveLength(1);
      expect(items[0]?.id).toBe(l.id);
    });

    // α29
    it("returns empty when no lots in org", async () => {
      const items = await svc.list(ORG);
      expect(items).toEqual([]);
    });
  });

  describe("listByFarm", () => {
    // α30
    it("returns lots for the given farm only", async () => {
      const l = await svc.create(ORG, baseInput());
      await svc.create(ORG, {
        ...baseInput({ name: "Lote 002" }),
        farmId: "farm-2",
      });
      const items = await svc.listByFarm(ORG, FARM);
      expect(items).toHaveLength(1);
      expect(items[0]?.id).toBe(l.id);
    });

    // α31
    it("returns empty when no lots in farm", async () => {
      const items = await svc.listByFarm(ORG, FARM);
      expect(items).toEqual([]);
    });
  });

  describe("getById", () => {
    // α32
    it("returns the lot when found", async () => {
      const l = await svc.create(ORG, baseInput());
      const found = await svc.getById(ORG, l.id);
      expect(found.id).toBe(l.id);
    });

    // α33
    it("throws NotFoundError when missing", async () => {
      await expect(svc.getById(ORG, "missing")).rejects.toThrow(NotFoundError);
    });
  });

  describe("create", () => {
    // α34
    it("returns ACTIVE Lot with all fields", async () => {
      const l = await svc.create(
        ORG,
        baseInput({ name: "Nuevo", initialCount: 500 }),
      );
      expect(l).toBeInstanceOf(Lot);
      expect(l.status).toBe("ACTIVE");
      expect(l.name).toBe("Nuevo");
      expect(l.initialCount).toBe(500);
      expect(l.endDate).toBeNull();
      expect(l.organizationId).toBe(ORG);
      expect(l.farmId).toBe(FARM);
    });
  });

  describe("close", () => {
    // α35
    it("throws NotFoundError when lot missing", async () => {
      await expect(
        svc.close(ORG, "missing", { endDate: new Date() }),
      ).rejects.toThrow(NotFoundError);
    });

    // α36
    it("transitions ACTIVE → CLOSED with endDate", async () => {
      const l = await svc.create(ORG, baseInput());
      const endDate = new Date("2026-06-30");
      const closed = await svc.close(ORG, l.id, { endDate });
      expect(closed.status).toBe("CLOSED");
      expect(closed.endDate).toEqual(endDate);
    });

    // α37
    it("propagates CannotCloseInactiveLot when lot already CLOSED", async () => {
      const l = await svc.create(ORG, baseInput());
      await svc.close(ORG, l.id, { endDate: new Date("2026-06-30") });
      await expect(
        svc.close(ORG, l.id, { endDate: new Date("2026-07-01") }),
      ).rejects.toThrow(CannotCloseInactiveLot);
    });
  });

  describe("update", () => {
    // α41
    it("persists updated name + barnNumber and returns the new entity", async () => {
      const created = await svc.create(ORG, baseInput({ name: "Lote A" }));

      const updated = await svc.update(ORG, created.id, {
        name: "Lote A modificado",
        barnNumber: 9,
      });

      expect(updated.name).toBe("Lote A modificado");
      expect(updated.barnNumber).toBe(9);
      const reloaded = await svc.getById(ORG, created.id);
      expect(reloaded.name).toBe("Lote A modificado");
    });

    // α42
    it("throws NotFoundError when lot does not exist", async () => {
      await expect(
        svc.update(ORG, "missing-id", { name: "X" }),
      ).rejects.toThrow(NotFoundError);
    });

    // α43
    it("throws LotNameDuplicate when another lot in the same org already uses the name", async () => {
      const a = await svc.create(ORG, baseInput({ name: "Galpón A" }));
      await svc.create(ORG, baseInput({ name: "Galpón B", barnNumber: 2 }));

      await expect(
        svc.update(ORG, a.id, { name: "Galpón B" }),
      ).rejects.toThrow(LotNameDuplicate);
    });

    // α44
    it("allows update where the new name equals the lot's own current name (idempotent)", async () => {
      const created = await svc.create(ORG, baseInput({ name: "Lote único" }));

      const updated = await svc.update(ORG, created.id, {
        name: "Lote único",
        barnNumber: 7,
      });

      expect(updated.name).toBe("Lote único");
      expect(updated.barnNumber).toBe(7);
    });
  });

  describe("getDeletePreview", () => {
    // α45
    it("returns expensesCount + mortalityCount for the lot", async () => {
      const lot = await svc.create(ORG, baseInput());
      repo.preloadChildCounts(lot.id, { expenses: 4, mortality: 7 });

      const preview = await svc.getDeletePreview(ORG, lot.id);

      expect(preview).toEqual({ expensesCount: 4, mortalityCount: 7 });
    });

    // α46
    it("returns zero counts when there are no children", async () => {
      const lot = await svc.create(ORG, baseInput());

      const preview = await svc.getDeletePreview(ORG, lot.id);

      expect(preview).toEqual({ expensesCount: 0, mortalityCount: 0 });
    });

    // α47
    it("throws NotFoundError when lot does not exist", async () => {
      await expect(
        svc.getDeletePreview(ORG, "missing-id"),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("delete", () => {
    // α48
    it("removes the lot via repo.delete", async () => {
      const lot = await svc.create(ORG, baseInput());

      await svc.delete(ORG, lot.id);

      await expect(svc.getById(ORG, lot.id)).rejects.toThrow(NotFoundError);
    });

    // α49
    it("throws NotFoundError when lot does not exist", async () => {
      await expect(svc.delete(ORG, "missing-id")).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe("getSummary", () => {
    // α38
    it("throws NotFoundError when lot missing", async () => {
      await expect(svc.getSummary(ORG, "missing")).rejects.toThrow(
        NotFoundError,
      );
    });

    // α39
    it("returns { lot: Lot, summary: LotSummary } clean shape", async () => {
      const l = await svc.create(ORG, baseInput({ initialCount: 1000 }));
      repo.preloadRelations(l.id, {
        expenses: [{ amount: 500 }],
        mortalityLogs: [{ count: 100 }],
      });
      const result = await svc.getSummary(ORG, l.id);
      expect(result.lot).toBeInstanceOf(Lot);
      expect(result.summary).toBeInstanceOf(LotSummary);
      expect(result.lot.id).toBe(l.id);
    });

    // α40
    it("computes summary correctly via entity.computeSummary", async () => {
      const l = await svc.create(ORG, baseInput({ initialCount: 1000 }));
      repo.preloadRelations(l.id, {
        expenses: [{ amount: 300 }, { amount: 200 }],
        mortalityLogs: [{ count: 50 }, { count: 50 }],
      });
      const result = await svc.getSummary(ORG, l.id);
      expect(result.summary.totalExpenses).toBe(500);
      expect(result.summary.totalMortality).toBe(100);
      expect(result.summary.aliveCount).toBe(900);
      expect(result.summary.costPerChicken).toBeCloseTo(500 / 900);
    });
  });
});
