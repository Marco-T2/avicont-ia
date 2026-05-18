import { describe, expect, it, beforeEach, vi } from "vitest";
import { Lot } from "../lot.entity";
import {
  CannotDeactivateInactiveLot,
  LotCannotUpdateInactive,
} from "../errors/lot-errors";
import { LotSummary } from "../value-objects/lot-summary";

describe("Lot entity behavioral (post simplify-lot-identifier — REQ-200/201/203/INV-04)", () => {
  const baseInput = {
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

  // α22 — getter surface post simplify-lot-identifier (no name, no barnNumber)
  it("Lot getters expose all post-simplify props (no name, no barnNumber, no farmId; displayName derived)", () => {
    const lot = Lot.create(baseInput);
    expect(typeof lot.id).toBe("string");
    expect(typeof lot.initialCount).toBe("number");
    expect(lot.startDate).toBeInstanceOf(Date);
    expect(lot.endDate).toBeNull();
    expect(lot.status).toBe("ACTIVE");
    expect(lot.farmName).toBe(baseInput.farmName);
    expect(lot.memberId).toBe(baseInput.memberId);
    expect(lot.organizationId).toBe(baseInput.organizationId);
    expect(lot.createdAt).toBeInstanceOf(Date);
    expect(lot.updatedAt).toBeInstanceOf(Date);
    // dropped surfaces: name + barnNumber + farmId all gone post-simplify
    expect((lot as unknown as { name?: unknown }).name).toBeUndefined();
    expect(
      (lot as unknown as { barnNumber?: unknown }).barnNumber,
    ).toBeUndefined();
    expect((lot as unknown as { farmId?: unknown }).farmId).toBeUndefined();
  });

  // NEW — displayName format invariant: "{farmName} - DD/MM/YYYY"
  it("Lot.displayName derives '{farmName} - DD/MM/YYYY' from farmName + startDate (formatDateBO)", () => {
    const lot = Lot.create(baseInput);
    expect(lot.displayName).toBe("Capinota Arriba - 01/05/2026");
  });

  // α23 — post-simplify: LotProps no name/barnNumber.
  it("Lot.fromPersistence reconstructs entity preserving id + status=INACTIVE + endDate + farmName + memberId", () => {
    const props = {
      id: "fixed-lot-id-1",
      initialCount: 500,
      startDate: new Date("2026-01-01T00:00:00Z"),
      endDate: new Date("2026-04-01T00:00:00Z"),
      status: "INACTIVE" as const,
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
    expect(lot.displayName).toBe("Pocona - 01/01/2026");
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

  // α26 — snapshot surface post simplify-lot-identifier
  it("Lot.toSnapshot serializes farmName + displayName; no name/barnNumber/farmId", () => {
    const lot = Lot.create(baseInput);
    const snap = lot.toSnapshot();
    expect(snap).toMatchObject({
      id: lot.id,
      initialCount: 1000,
      startDate: baseInput.startDate,
      endDate: null,
      status: "ACTIVE",
      farmName: baseInput.farmName,
      displayName: "Capinota Arriba - 01/05/2026",
      memberId: baseInput.memberId,
      organizationId: baseInput.organizationId,
      createdAt: lot.createdAt,
      updatedAt: lot.updatedAt,
    });
    // Dropped projections: name + barnNumber + farmId are gone
    expect((snap as unknown as { name?: unknown }).name).toBeUndefined();
    expect(
      (snap as unknown as { barnNumber?: unknown }).barnNumber,
    ).toBeUndefined();
    expect((snap as unknown as { farmId?: unknown }).farmId).toBeUndefined();
  });

  // α29 Lot.update — only farmName editable post simplify-lot-identifier
  it("Lot.update returns a new instance with updated farmName (displayName recomputed)", () => {
    const lot = Lot.create(baseInput);

    const updated = lot.update({ farmName: "Pocona Nueva" });

    expect(updated).not.toBe(lot);
    expect(updated.farmName).toBe("Pocona Nueva");
    expect(updated.displayName).toBe("Pocona Nueva - 01/05/2026");
    expect(lot.farmName).toBe(baseInput.farmName); // original unchanged
  });

  // α30 Lot.update preserves immutable invariants (INV-04 + startDate immutable post-simplify)
  it("Lot.update preserves id, initialCount, startDate, status, memberId, organizationId, createdAt", () => {
    const lot = Lot.create(baseInput);

    const updated = lot.update({ farmName: "X" });

    expect(updated.id).toBe(lot.id);
    expect(updated.initialCount).toBe(lot.initialCount);
    expect(updated.startDate).toEqual(lot.startDate);
    expect(updated.status).toBe(lot.status);
    expect(updated.memberId).toBe(lot.memberId);
    expect(updated.organizationId).toBe(lot.organizationId);
    expect(updated.createdAt).toEqual(lot.createdAt);
  });

  // α31 Lot.update partial — farmName omitted keeps prior value
  it("Lot.update partial keeps prior farmName when omitted", () => {
    const lot = Lot.create(baseInput);

    const updated = lot.update({});

    expect(updated.farmName).toBe(baseInput.farmName);
  });

  // α32 Lot.update bumps updatedAt
  it("Lot.update advances updatedAt on every call", () => {
    const lot = Lot.create(baseInput);
    vi.setSystemTime(new Date("2026-05-10T13:00:00Z"));

    const updated = lot.update({ farmName: "X" });

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

    expect(() => lot.update({ farmName: "X" })).toThrow(
      LotCannotUpdateInactive,
    );
  });

  // INV-04.2 — farmName mutable via update
  it("Lot.update accepts farmName change (INV-04.2 mutable post-collapse)", () => {
    const lot = Lot.create(baseInput);
    const updated = lot.update({ farmName: "Pocona Nueva" });
    expect(updated.farmName).toBe("Pocona Nueva");
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
