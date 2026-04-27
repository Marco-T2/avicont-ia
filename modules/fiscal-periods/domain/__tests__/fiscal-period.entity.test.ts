import { describe, it, expect } from "vitest";
import {
  FiscalPeriod,
  type CreateFiscalPeriodInput,
  type FiscalPeriodProps,
} from "../fiscal-period.entity";
import { FiscalPeriodStatus } from "../value-objects/fiscal-period-status";
import { MonthlyRange } from "../value-objects/monthly-range";
import {
  InvalidDateRange,
  NotMonthly,
} from "../errors/fiscal-period-errors";

const baseInput: CreateFiscalPeriodInput = {
  name: "Enero 2026",
  year: 2026,
  startDate: new Date(Date.UTC(2026, 0, 1)),
  endDate: new Date(Date.UTC(2026, 0, 31)),
  createdById: "user-1",
  organizationId: "org-1",
};

describe("FiscalPeriod.create", () => {
  it("creates a period with valid monthly input", () => {
    const fp = FiscalPeriod.create(baseInput);
    expect(fp.name).toBe("Enero 2026");
    expect(fp.year).toBe(2026);
    expect(fp.month).toBe(1);
    expect(fp.organizationId).toBe("org-1");
    expect(fp.createdById).toBe("user-1");
    expect(fp.id).toBeDefined();
    expect(fp.id.length).toBeGreaterThan(0);
  });

  it("starts in OPEN status by default", () => {
    const fp = FiscalPeriod.create(baseInput);
    expect(fp.isOpen()).toBe(true);
    expect(fp.status.value).toBe("OPEN");
  });

  it("has closedAt and closedBy null on creation", () => {
    const fp = FiscalPeriod.create(baseInput);
    expect(fp.closedAt).toBeNull();
    expect(fp.closedBy).toBeNull();
  });

  it("derives month from startDate UTC, not from input.year", () => {
    const fp = FiscalPeriod.create({
      ...baseInput,
      startDate: new Date(Date.UTC(2026, 5, 1)),
      endDate: new Date(Date.UTC(2026, 5, 30)),
    });
    expect(fp.month).toBe(6);
  });

  it("rejects when endDate <= startDate (InvalidDateRange before NotMonthly)", () => {
    expect(() =>
      FiscalPeriod.create({
        ...baseInput,
        startDate: new Date(Date.UTC(2026, 0, 31)),
        endDate: new Date(Date.UTC(2026, 0, 1)),
      }),
    ).toThrow(InvalidDateRange);
  });

  it("rejects non-monthly shape", () => {
    expect(() =>
      FiscalPeriod.create({
        ...baseInput,
        startDate: new Date(Date.UTC(2026, 0, 1)),
        endDate: new Date(Date.UTC(2026, 0, 30)),
      }),
    ).toThrow(NotMonthly);
  });
});

describe("FiscalPeriod.fromPersistence", () => {
  it("reconstructs an entity from persisted props without re-validating", () => {
    const props: FiscalPeriodProps = {
      id: "fp-persisted-1",
      organizationId: "org-1",
      name: "Diciembre 2025",
      range: MonthlyRange.of(
        new Date(Date.UTC(2025, 11, 1)),
        new Date(Date.UTC(2025, 11, 31)),
      ),
      status: FiscalPeriodStatus.of("CLOSED"),
      closedAt: new Date(Date.UTC(2026, 0, 5)),
      closedBy: "user-2",
      createdById: "user-1",
      createdAt: new Date(Date.UTC(2025, 11, 1)),
      updatedAt: new Date(Date.UTC(2026, 0, 5)),
    };
    const fp = FiscalPeriod.fromPersistence(props);
    expect(fp.id).toBe("fp-persisted-1");
    expect(fp.status.value).toBe("CLOSED");
    expect(fp.closedAt?.toISOString()).toBe("2026-01-05T00:00:00.000Z");
    expect(fp.closedBy).toBe("user-2");
  });
});

describe("FiscalPeriod.isCovering", () => {
  it("returns true for a date inside the range when OPEN", () => {
    const fp = FiscalPeriod.create({
      ...baseInput,
      startDate: new Date(Date.UTC(2026, 3, 1)),
      endDate: new Date(Date.UTC(2026, 3, 30)),
    });
    expect(fp.isCovering("2026-04-15")).toBe(true);
  });

  it("returns false for a date outside the range", () => {
    const fp = FiscalPeriod.create({
      ...baseInput,
      startDate: new Date(Date.UTC(2026, 3, 1)),
      endDate: new Date(Date.UTC(2026, 3, 30)),
    });
    expect(fp.isCovering("2026-05-01")).toBe(false);
  });

  it("returns false when CLOSED even if range covers the date", () => {
    const fp = FiscalPeriod.fromPersistence({
      id: "fp-closed",
      organizationId: "org-1",
      name: "Marzo 2026",
      range: MonthlyRange.of(
        new Date(Date.UTC(2026, 2, 1)),
        new Date(Date.UTC(2026, 2, 31)),
      ),
      status: FiscalPeriodStatus.of("CLOSED"),
      closedAt: new Date(Date.UTC(2026, 3, 5)),
      closedBy: "user-2",
      createdById: "user-1",
      createdAt: new Date(Date.UTC(2026, 2, 1)),
      updatedAt: new Date(Date.UTC(2026, 3, 5)),
    });
    expect(fp.isCovering("2026-03-15")).toBe(false);
  });
});

describe("FiscalPeriod.toSnapshot", () => {
  it("returns a plain object with primitive types", () => {
    const fp = FiscalPeriod.create(baseInput);
    const snap = fp.toSnapshot();
    expect(snap.id).toBe(fp.id);
    expect(snap.year).toBe(2026);
    expect(snap.month).toBe(1);
    expect(snap.status).toBe("OPEN");
    expect(snap.closedAt).toBeNull();
    expect(snap.closedBy).toBeNull();
  });

  it("preserves Date objects for date fields (not strings)", () => {
    const fp = FiscalPeriod.create(baseInput);
    const snap = fp.toSnapshot();
    expect(snap.startDate).toBeInstanceOf(Date);
    expect(snap.endDate).toBeInstanceOf(Date);
  });
});
