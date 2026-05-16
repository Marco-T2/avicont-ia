/**
 * Phase 2.6a RED — FiscalYear entity shape: create, fromPersistence, markClosed,
 * idempotency guard (W-3), toSnapshot.
 *
 * Spec REQ-1.1 (fields), REQ-1.2 (OPEN→CLOSED only, FiscalYearAlreadyClosedError
 * on re-close), design rev 2 §3 (entity skeleton signature).
 *
 * Declared failure mode per [[red_acceptance_failure_mode]]:
 *   Module `../../domain/fiscal-year.entity` does not exist at HEAD 774464f5.
 *   Vitest reports a module-resolution failure; no it() block executes.
 *   Phase 2.6b GREEN creates the file.
 */

import { describe, expect, it } from "vitest";
import { FiscalYear } from "../../domain/fiscal-year.entity";
import { Year } from "../../domain/value-objects/year";
import { FiscalYearStatus } from "../../domain/value-objects/fiscal-year-status";
import { FiscalYearAlreadyClosedError } from "../../domain/errors/annual-close-errors";

describe("FiscalYear entity", () => {
  describe("FiscalYear.create", () => {
    it("returns an OPEN aggregate with NULL close-bookkeeping fields", () => {
      const fy = FiscalYear.create({
        organizationId: "org_1",
        year: Year.of(2026),
        createdById: "user_1",
      });
      expect(fy.organizationId).toBe("org_1");
      expect(fy.year.value).toBe(2026);
      expect(fy.status.isOpen()).toBe(true);
      expect(fy.status.value).toBe("OPEN");
      expect(fy.closedAt).toBeNull();
      expect(fy.closedBy).toBeNull();
      expect(fy.closingEntryId).toBeNull();
      expect(fy.openingEntryId).toBeNull();
      expect(typeof fy.id).toBe("string");
      expect(fy.id.length).toBeGreaterThan(0);
      expect(fy.createdAt).toBeInstanceOf(Date);
      expect(fy.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("FiscalYear.fromPersistence", () => {
    it("reconstructs an aggregate from snapshot-shaped props", () => {
      const createdAt = new Date("2026-01-01T12:00:00Z");
      const updatedAt = new Date("2026-12-31T12:00:00Z");
      const closedAt = new Date("2026-12-31T20:00:00Z");
      const fy = FiscalYear.fromPersistence({
        id: "fy_42",
        organizationId: "org_1",
        year: Year.of(2026),
        status: FiscalYearStatus.closed(),
        closedAt,
        closedBy: "user_2",
        closingEntryId: "je_cc",
        openingEntryId: "je_ca",
        createdAt,
        updatedAt,
      });
      expect(fy.id).toBe("fy_42");
      expect(fy.year.value).toBe(2026);
      expect(fy.status.isClosed()).toBe(true);
      expect(fy.closedAt).toEqual(closedAt);
      expect(fy.closedBy).toBe("user_2");
      expect(fy.closingEntryId).toBe("je_cc");
      expect(fy.openingEntryId).toBe("je_ca");
      expect(fy.createdAt).toEqual(createdAt);
      expect(fy.updatedAt).toEqual(updatedAt);
    });
  });

  describe("FiscalYear.markClosed", () => {
    it("transitions OPEN → CLOSED, setting all close-bookkeeping fields atomically", () => {
      const fy = FiscalYear.create({
        organizationId: "org_1",
        year: Year.of(2026),
        createdById: "user_1",
      });
      const beforeUpdated = fy.updatedAt;

      const closed = fy.markClosed({
        closedBy: "user_2",
        closingEntryId: "je_cc",
        openingEntryId: "je_ca",
      });

      expect(closed.status.isClosed()).toBe(true);
      expect(closed.status.value).toBe("CLOSED");
      expect(closed.closedBy).toBe("user_2");
      expect(closed.closingEntryId).toBe("je_cc");
      expect(closed.openingEntryId).toBe("je_ca");
      expect(closed.closedAt).toBeInstanceOf(Date);
      expect(closed.updatedAt.getTime()).toBeGreaterThanOrEqual(
        beforeUpdated.getTime(),
      );
      // Identity preserved
      expect(closed.id).toBe(fy.id);
      expect(closed.organizationId).toBe(fy.organizationId);
      expect(closed.year.value).toBe(2026);
    });

    it("throws FiscalYearAlreadyClosedError when invoked on a CLOSED FiscalYear (W-3)", () => {
      const fy = FiscalYear.fromPersistence({
        id: "fy_42",
        organizationId: "org_1",
        year: Year.of(2026),
        status: FiscalYearStatus.closed(),
        closedAt: new Date("2026-12-31T20:00:00Z"),
        closedBy: "user_2",
        closingEntryId: "je_cc",
        openingEntryId: "je_ca",
        createdAt: new Date("2026-01-01T12:00:00Z"),
        updatedAt: new Date("2026-12-31T20:00:00Z"),
      });
      expect(() =>
        fy.markClosed({
          closedBy: "user_3",
          closingEntryId: "je_cc2",
          openingEntryId: "je_ca2",
        }),
      ).toThrow(FiscalYearAlreadyClosedError);
    });
  });

  describe("FiscalYear.toSnapshot", () => {
    it("returns a plain-object snapshot suitable for the persistence layer", () => {
      const fy = FiscalYear.create({
        organizationId: "org_1",
        year: Year.of(2026),
        createdById: "user_1",
      });
      const snap = fy.toSnapshot();
      expect(snap).toMatchObject({
        id: fy.id,
        organizationId: "org_1",
        year: 2026, // unwrapped to int
        status: "OPEN", // unwrapped to literal
        closedAt: null,
        closedBy: null,
        closingEntryId: null,
        openingEntryId: null,
      });
      expect(snap.createdAt).toBeInstanceOf(Date);
      expect(snap.updatedAt).toBeInstanceOf(Date);
    });

    it("snapshot of a CLOSED FY includes the close-bookkeeping fields", () => {
      const fy = FiscalYear.create({
        organizationId: "org_1",
        year: Year.of(2026),
        createdById: "user_1",
      }).markClosed({
        closedBy: "user_2",
        closingEntryId: "je_cc",
        openingEntryId: "je_ca",
      });
      const snap = fy.toSnapshot();
      expect(snap.status).toBe("CLOSED");
      expect(snap.closedBy).toBe("user_2");
      expect(snap.closingEntryId).toBe("je_cc");
      expect(snap.openingEntryId).toBe("je_ca");
      expect(snap.closedAt).toBeInstanceOf(Date);
    });
  });

  describe("predicates", () => {
    it("isOpen / isClosed delegate to status VO", () => {
      const open = FiscalYear.create({
        organizationId: "org_1",
        year: Year.of(2026),
        createdById: "user_1",
      });
      expect(open.isOpen()).toBe(true);
      expect(open.isClosed()).toBe(false);

      const closed = open.markClosed({
        closedBy: "user_2",
        closingEntryId: "je_cc",
        openingEntryId: "je_ca",
      });
      expect(closed.isOpen()).toBe(false);
      expect(closed.isClosed()).toBe(true);
    });
  });
});
