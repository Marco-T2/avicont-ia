import { describe, it, expect, beforeEach } from "vitest";
import { LotService } from "../lot.service";
import { Lot } from "../../domain/lot.entity";
import { LotSummary } from "../../domain/value-objects/lot-summary";
import { InMemoryLotRepository } from "../fakes/in-memory-lot.repository";
import { CannotDeactivateInactiveLot } from "../../domain/errors/lot-errors";
import { NotFoundError } from "@/features/shared/errors";

const ORG = "org-1";
const MEMBER = "member-1";
const FARM_NAME = "Pocona";

const baseInput = (
  override: Partial<{
    initialCount: number;
    startDate: Date;
    farmName: string;
    memberId: string;
  }> = {},
) => ({
  initialCount: override.initialCount ?? 1000,
  startDate: override.startDate ?? new Date("2026-01-01"),
  farmName: override.farmName ?? FARM_NAME,
  memberId: override.memberId ?? MEMBER,
});

describe("LotService (post simplify-lot-identifier — REQ-200/201/203/204)", () => {
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
    it("returns ACTIVE Lot with farmName + memberId fields", async () => {
      const l = await svc.create(
        ORG,
        baseInput({ initialCount: 500 }),
      );
      expect(l).toBeInstanceOf(Lot);
      expect(l.status).toBe("ACTIVE");
      expect(l.initialCount).toBe(500);
      expect(l.endDate).toBeNull();
      expect(l.organizationId).toBe(ORG);
      expect(l.farmName).toBe(FARM_NAME);
      expect(l.memberId).toBe(MEMBER);
      expect(l.displayName).toBe(`${FARM_NAME} - 01/01/2026`);
    });
  });

  describe("deactivate", () => {
    // α35
    it("throws NotFoundError when lot missing", async () => {
      await expect(
        svc.deactivate(ORG, "missing", { endDate: new Date() }),
      ).rejects.toThrow(NotFoundError);
    });

    // α36
    it("transitions ACTIVE → INACTIVE with endDate", async () => {
      const l = await svc.create(ORG, baseInput());
      const endDate = new Date("2026-06-30");
      const inactive = await svc.deactivate(ORG, l.id, { endDate });
      expect(inactive.status).toBe("INACTIVE");
      expect(inactive.endDate).toEqual(endDate);
    });

    // α37
    it("propagates CannotDeactivateInactiveLot when lot already INACTIVE", async () => {
      const l = await svc.create(ORG, baseInput());
      await svc.deactivate(ORG, l.id, { endDate: new Date("2026-06-30") });
      await expect(
        svc.deactivate(ORG, l.id, { endDate: new Date("2026-07-01") }),
      ).rejects.toThrow(CannotDeactivateInactiveLot);
    });
  });

  describe("update", () => {
    // α41 — only farmName editable post simplify-lot-identifier; the
    // old (farmName, startDate) uniqueness collision is enforced by
    // the DB unique index and surfaced as LotForFarmAtDateExists by
    // the repo adapter (covered in prisma-lot.repository.test.ts), so
    // the in-memory service test no longer asserts the collision path.
    it("persists updated farmName and returns the new entity", async () => {
      const created = await svc.create(ORG, baseInput());

      const updated = await svc.update(ORG, created.id, {
        farmName: "Pocona Nueva",
      });

      expect(updated.farmName).toBe("Pocona Nueva");
      const reloaded = await svc.getById(ORG, created.id);
      expect(reloaded.farmName).toBe("Pocona Nueva");
    });

    // α42
    it("throws NotFoundError when lot does not exist", async () => {
      await expect(
        svc.update(ORG, "missing-id", { farmName: "X" }),
      ).rejects.toThrow(NotFoundError);
    });

    // α44 idempotent: same farmName is a no-op semantically
    it("allows update where the new farmName equals the current one (idempotent)", async () => {
      const created = await svc.create(ORG, baseInput());

      const updated = await svc.update(ORG, created.id, {
        farmName: created.farmName,
      });

      expect(updated.farmName).toBe(created.farmName);
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
