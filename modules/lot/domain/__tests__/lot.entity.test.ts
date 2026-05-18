import { describe, expect, it, beforeEach, vi } from "vitest";
import { Lot } from "../lot.entity";
import {
  CannotDeactivateInactiveLot,
  LotCannotUpdateInactive,
} from "../errors/lot-errors";
import { LotSummary } from "../value-objects/lot-summary";

describe("Lot entity behavioral (post-collapse REQ-200/201/203/INV-04)", () => {
  const baseInput = {
    name: "Lote 01",
    barnNumber: 1,
    initialCount: 1000,
    startDate: new Date("2026-05-01T00:00:00Z"),
    farmName: "Capinota Arriba",
    memberId: "member-cuid-1",
    organizationId: "org-cuid-1",
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-10T12:00:00Z"));
  });

  // α21
  it("Lot.create produces entity with id + status=ACTIVE default + endDate=null + farmName + memberId + timestamps", () => {
    const lot = Lot.create(baseInput);
    expect(lot.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(lot.name).toBe(baseInput.name);
    expect(lot.barnNumber).toBe(1);
    expect(lot.initialCount).toBe(1000);
    expect(lot.startDate).toEqual(baseInput.startDate);
    expect(lot.endDate).toBeNull();
    expect(lot.status).toBe("ACTIVE");
    expect(lot.farmName).toBe("Capinota Arriba");
    expect(lot.memberId).toBe("member-cuid-1");
    expect(lot.organizationId).toBe(baseInput.organizationId);
    expect(lot.createdAt).toEqual(new Date("2026-05-10T12:00:00Z"));
    expect(lot.updatedAt).toEqual(new Date("2026-05-10T12:00:00Z"));
  });

  // α22
  it("Lot getters expose all post-collapse props (no farmId getter)", () => {
    const lot = Lot.create(baseInput);
    expect(typeof lot.id).toBe("string");
    expect(lot.name).toBe(baseInput.name);
    expect(typeof lot.barnNumber).toBe("number");
    expect(typeof lot.initialCount).toBe("number");
    expect(lot.startDate).toBeInstanceOf(Date);
    expect(lot.endDate).toBeNull();
    expect(lot.status).toBe("ACTIVE");
    expect(lot.farmName).toBe(baseInput.farmName);
    expect(lot.memberId).toBe(baseInput.memberId);
    expect(lot.organizationId).toBe(baseInput.organizationId);
    expect(lot.createdAt).toBeInstanceOf(Date);
    expect(lot.updatedAt).toBeInstanceOf(Date);
    // public surface NO `farmId` getter (REQ-200 dropped FK)
    expect((lot as unknown as { farmId?: unknown }).farmId).toBeUndefined();
  });

  // α23
  it("Lot.fromPersistence reconstructs entity preserving id + status=INACTIVE + endDate + farmName + memberId + internal farmId", () => {
    const props = {
      id: "fixed-lot-id-1",
      name: "Lote Pre",
      barnNumber: 5,
      initialCount: 500,
      startDate: new Date("2026-01-01T00:00:00Z"),
      endDate: new Date("2026-04-01T00:00:00Z"),
      status: "INACTIVE" as const,
      farmId: "legacy-farm-1",
      farmName: "Pocona",
      memberId: "member-cuid-1",
      organizationId: "org-cuid-1",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-04-01T00:00:00Z"),
    };
    const lot = Lot.fromPersistence(props);
    expect(lot.id).toBe("fixed-lot-id-1");
    expect(lot.status).toBe("INACTIVE");
    expect(lot.endDate).toEqual(new Date("2026-04-01T00:00:00Z"));
    expect(lot.farmName).toBe("Pocona");
    expect(lot.memberId).toBe("member-cuid-1");
    expect(lot._legacyFarmId).toBe("legacy-farm-1");
  });

  // α24
  it("Lot.deactivate(endDate) on ACTIVE returns NEW entity status=INACTIVE + endDate=given + refreshes updatedAt", () => {
    const lot = Lot.create(baseInput);
    vi.setSystemTime(new Date("2026-08-01T12:00:00Z"));
    const endDate = new Date("2026-08-01T00:00:00Z");
    const inactive = lot.deactivate(endDate);
    expect(inactive).not.toBe(lot);
    expect(inactive.status).toBe("INACTIVE");
    expect(inactive.endDate).toEqual(endDate);
    expect(inactive.updatedAt).toEqual(new Date("2026-08-01T12:00:00Z"));
  });

  // α25
  it("Lot.deactivate on already INACTIVE throws CannotDeactivateInactiveLot", () => {
    const lot = Lot.create(baseInput);
    const inactive = lot.deactivate(new Date("2026-08-01T00:00:00Z"));
    expect(() => inactive.deactivate(new Date("2026-09-01T00:00:00Z"))).toThrow(
      CannotDeactivateInactiveLot,
    );
  });

  // α26
  it("Lot.toSnapshot serializes all post-collapse fields (no farmId in snapshot)", () => {
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
      farmName: baseInput.farmName,
      memberId: baseInput.memberId,
      organizationId: baseInput.organizationId,
      createdAt: lot.createdAt,
      updatedAt: lot.updatedAt,
    });
    // INV-04: farmId is NOT part of the public projection
    expect((snap as unknown as { farmId?: unknown }).farmId).toBeUndefined();
  });

  // α27
  it("Lot.create with same barnNumber+farmName allowed twice (NO uniqueness check — preserves legacy EXACT)", () => {
    const lot1 = Lot.create({ ...baseInput, barnNumber: 3 });
    const lot2 = Lot.create({ ...baseInput, barnNumber: 3 });
    expect(lot1.id).not.toBe(lot2.id);
    expect(lot1.barnNumber).toBe(3);
    expect(lot2.barnNumber).toBe(3);
  });

  // α29 Lot.update — happy path immutable
  it("Lot.update returns a new instance with updated name + barnNumber + farmName", () => {
    const lot = Lot.create(baseInput);

    const updated = lot.update({
      name: "Galpón B",
      barnNumber: 2,
      farmName: "Pocona Nueva",
    });

    expect(updated).not.toBe(lot);
    expect(updated.name).toBe("Galpón B");
    expect(updated.barnNumber).toBe(2);
    expect(updated.farmName).toBe("Pocona Nueva");
    expect(lot.name).toBe(baseInput.name); // original unchanged
  });

  // α30 Lot.update preserves immutable invariants (INV-04 post-collapse)
  it("Lot.update preserves id, initialCount, status, memberId, organizationId, createdAt (INV-04)", () => {
    const lot = Lot.create(baseInput);

    const updated = lot.update({ name: "Galpón B" });

    expect(updated.id).toBe(lot.id);
    expect(updated.initialCount).toBe(lot.initialCount);
    expect(updated.status).toBe(lot.status);
    expect(updated.memberId).toBe(lot.memberId);
    expect(updated.organizationId).toBe(lot.organizationId);
    expect(updated.createdAt).toEqual(lot.createdAt);
  });

  // α31 Lot.update partial — barnNumber only
  it("Lot.update partial keeps prior values when fields omitted", () => {
    const lot = Lot.create(baseInput);

    const updated = lot.update({ barnNumber: 9 });

    expect(updated.barnNumber).toBe(9);
    expect(updated.name).toBe(baseInput.name);
    expect(updated.farmName).toBe(baseInput.farmName);
  });

  // α32 Lot.update bumps updatedAt
  it("Lot.update advances updatedAt on every call", () => {
    const lot = Lot.create(baseInput);
    vi.setSystemTime(new Date("2026-05-10T13:00:00Z"));

    const updated = lot.update({ name: "X" });

    expect(updated.updatedAt).toEqual(new Date("2026-05-10T13:00:00Z"));
    expect(updated.updatedAt.getTime()).toBeGreaterThan(
      lot.updatedAt.getTime(),
    );
  });

  // α33 Lot.update rejects INACTIVE
  it("Lot.update throws LotCannotUpdateInactive when status is INACTIVE", () => {
    const lot = Lot.create(baseInput).deactivate(
      new Date("2026-06-30T00:00:00Z"),
    );

    expect(() => lot.update({ name: "X" })).toThrow(LotCannotUpdateInactive);
  });

  // INV-04.2 — farmName mutable via update
  it("Lot.update accepts farmName change (INV-04.2 mutable post-collapse)", () => {
    const lot = Lot.create(baseInput);
    const updated = lot.update({ farmName: "Pocona Nueva" });
    expect(updated.farmName).toBe("Pocona Nueva");
    expect(updated.name).toBe(baseInput.name);
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
