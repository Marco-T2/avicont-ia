import { describe, expect, it, beforeEach, vi } from "vitest";
import { Lot } from "../lot.entity";
import { CannotCloseInactiveLot } from "../errors/lot-errors";
import { LotSummary } from "../value-objects/lot-summary";

describe("Lot entity behavioral", () => {
  const baseInput = {
    name: "Lote 01",
    barnNumber: 1,
    initialCount: 1000,
    startDate: new Date("2026-05-01T00:00:00Z"),
    farmId: "farm-cuid-1",
    organizationId: "org-cuid-1",
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-10T12:00:00Z"));
  });

  // α21
  it("Lot.create produces entity with id + status=ACTIVE default + endDate=null + timestamps + all fields", () => {
    const lot = Lot.create(baseInput);
    expect(lot.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(lot.name).toBe(baseInput.name);
    expect(lot.barnNumber).toBe(1);
    expect(lot.initialCount).toBe(1000);
    expect(lot.startDate).toEqual(baseInput.startDate);
    expect(lot.endDate).toBeNull();
    expect(lot.status).toBe("ACTIVE");
    expect(lot.farmId).toBe(baseInput.farmId);
    expect(lot.organizationId).toBe(baseInput.organizationId);
    expect(lot.createdAt).toEqual(new Date("2026-05-10T12:00:00Z"));
    expect(lot.updatedAt).toEqual(new Date("2026-05-10T12:00:00Z"));
  });

  // α22
  it("Lot getters expose all props", () => {
    const lot = Lot.create(baseInput);
    expect(typeof lot.id).toBe("string");
    expect(lot.name).toBe(baseInput.name);
    expect(typeof lot.barnNumber).toBe("number");
    expect(typeof lot.initialCount).toBe("number");
    expect(lot.startDate).toBeInstanceOf(Date);
    expect(lot.endDate).toBeNull();
    expect(lot.status).toBe("ACTIVE");
    expect(lot.farmId).toBe(baseInput.farmId);
    expect(lot.organizationId).toBe(baseInput.organizationId);
    expect(lot.createdAt).toBeInstanceOf(Date);
    expect(lot.updatedAt).toBeInstanceOf(Date);
  });

  // α23
  it("Lot.fromPersistence reconstructs entity preserving id + status=CLOSED + endDate", () => {
    const props = {
      id: "fixed-lot-id-1",
      name: "Lote Pre",
      barnNumber: 5,
      initialCount: 500,
      startDate: new Date("2026-01-01T00:00:00Z"),
      endDate: new Date("2026-04-01T00:00:00Z"),
      status: "CLOSED" as const,
      farmId: "farm-cuid-1",
      organizationId: "org-cuid-1",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-04-01T00:00:00Z"),
    };
    const lot = Lot.fromPersistence(props);
    expect(lot.id).toBe("fixed-lot-id-1");
    expect(lot.status).toBe("CLOSED");
    expect(lot.endDate).toEqual(new Date("2026-04-01T00:00:00Z"));
  });

  // α24
  it("Lot.close(endDate) on ACTIVE returns NEW entity status=CLOSED + endDate=given + refreshes updatedAt", () => {
    const lot = Lot.create(baseInput);
    vi.setSystemTime(new Date("2026-08-01T12:00:00Z"));
    const closeDate = new Date("2026-08-01T00:00:00Z");
    const closed = lot.close(closeDate);
    expect(closed).not.toBe(lot);
    expect(closed.status).toBe("CLOSED");
    expect(closed.endDate).toEqual(closeDate);
    expect(closed.updatedAt).toEqual(new Date("2026-08-01T12:00:00Z"));
  });

  // α25
  it("Lot.close on already CLOSED throws CannotCloseInactiveLot", () => {
    const lot = Lot.create(baseInput);
    const closed = lot.close(new Date("2026-08-01T00:00:00Z"));
    expect(() => closed.close(new Date("2026-09-01T00:00:00Z"))).toThrow(CannotCloseInactiveLot);
  });

  // α26
  it("Lot.toSnapshot serializes all fields including null endDate", () => {
    const lot = Lot.create(baseInput);
    const snap = lot.toSnapshot();
    expect(snap).toMatchObject({
      id: lot.id,
      name: baseInput.name,
      barnNumber: 1,
      initialCount: 1000,
      startDate: baseInput.startDate,
      endDate: null,
      status: "ACTIVE",
      farmId: baseInput.farmId,
      organizationId: baseInput.organizationId,
      createdAt: lot.createdAt,
      updatedAt: lot.updatedAt,
    });
  });

  // α27
  it("Lot.create with same barnNumber+farmId allowed twice (NO uniqueness check — preserves legacy EXACT)", () => {
    const lot1 = Lot.create({ ...baseInput, barnNumber: 3 });
    const lot2 = Lot.create({ ...baseInput, barnNumber: 3 });
    expect(lot1.id).not.toBe(lot2.id);
    expect(lot1.barnNumber).toBe(3);
    expect(lot2.barnNumber).toBe(3);
  });

  // α28
  it("Lot.computeSummary(expenses[], mortalityLogs[]) returns LotSummary instance (delegates to VO)", () => {
    const lot = Lot.create({ ...baseInput, initialCount: 1000 });
    const summary = lot.computeSummary(
      [{ amount: 100 }, { amount: 200 }],
      [{ count: 50 }],
    );
    expect(summary).toBeInstanceOf(LotSummary);
    expect(summary.totalExpenses).toBe(300);
    expect(summary.totalMortality).toBe(50);
    expect(summary.aliveCount).toBe(950);
    expect(summary.costPerChicken).toBeCloseTo(300 / 950);
  });
});
