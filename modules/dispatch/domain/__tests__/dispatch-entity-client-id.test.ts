/**
 * TDD RED → GREEN — Change C: Dispatch entity accepts and exposes clientId.
 */
import { describe, it, expect } from "vitest";
import { Dispatch } from "../dispatch.entity";

describe("Dispatch entity — clientId (change C)", () => {
  it("createDraft stores clientId when provided", () => {
    const dispatch = Dispatch.createDraft({
      organizationId: "org-1",
      dispatchType: "NOTA_DESPACHO",
      contactId: "c-1",
      periodId: "p-1",
      date: new Date("2026-05-19"),
      description: "Despacho test",
      createdById: "user-1",
      clientId: "550e8400-e29b-41d4-a716-446655440000",
      details: [],
    });
    expect(dispatch.clientId).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("createDraft stores null when clientId is omitted", () => {
    const dispatch = Dispatch.createDraft({
      organizationId: "org-1",
      dispatchType: "NOTA_DESPACHO",
      contactId: "c-1",
      periodId: "p-1",
      date: new Date("2026-05-19"),
      description: "Despacho test",
      createdById: "user-1",
      details: [],
    });
    expect(dispatch.clientId).toBeNull();
  });

  it("fromPersistence maps clientId correctly", () => {
    const now = new Date();
    const dispatch = Dispatch.fromPersistence({
      id: "d-1",
      organizationId: "org-1",
      dispatchType: "NOTA_DESPACHO",
      status: "DRAFT",
      sequenceNumber: 0,
      date: now,
      contactId: "c-1",
      periodId: "p-1",
      description: "Test",
      referenceNumber: null,
      notes: null,
      totalAmount: 0,
      journalEntryId: null,
      receivableId: null,
      createdById: "u-1",
      createdAt: now,
      updatedAt: now,
      details: [],
      receivable: null,
      farmOrigin: null,
      chickenCount: null,
      shrinkagePct: null,
      avgKgPerChicken: null,
      totalGrossKg: null,
      totalNetKg: null,
      totalShrinkKg: null,
      totalShortageKg: null,
      totalRealNetKg: null,
      clientId: "mobile-uuid-123",
    });
    expect(dispatch.clientId).toBe("mobile-uuid-123");
  });

  it("fromPersistence maps clientId as null when not set", () => {
    const now = new Date();
    const dispatch = Dispatch.fromPersistence({
      id: "d-1",
      organizationId: "org-1",
      dispatchType: "NOTA_DESPACHO",
      status: "DRAFT",
      sequenceNumber: 0,
      date: now,
      contactId: "c-1",
      periodId: "p-1",
      description: "Test",
      referenceNumber: null,
      notes: null,
      totalAmount: 0,
      journalEntryId: null,
      receivableId: null,
      createdById: "u-1",
      createdAt: now,
      updatedAt: now,
      details: [],
      receivable: null,
      farmOrigin: null,
      chickenCount: null,
      shrinkagePct: null,
      avgKgPerChicken: null,
      totalGrossKg: null,
      totalNetKg: null,
      totalShrinkKg: null,
      totalShortageKg: null,
      totalRealNetKg: null,
      clientId: null,
    });
    expect(dispatch.clientId).toBeNull();
  });

  it("toSnapshot includes clientId", () => {
    const dispatch = Dispatch.createDraft({
      organizationId: "org-1",
      dispatchType: "NOTA_DESPACHO",
      contactId: "c-1",
      periodId: "p-1",
      date: new Date("2026-05-19"),
      description: "Test",
      createdById: "user-1",
      clientId: "snap-client-id",
      details: [],
    });
    const snap = dispatch.toSnapshot();
    expect(snap.clientId).toBe("snap-client-id");
  });
});
