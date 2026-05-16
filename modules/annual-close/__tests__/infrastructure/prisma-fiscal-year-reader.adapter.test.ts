import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * RED — Phase 4.1 PrismaFiscalYearReaderAdapter unit test (mocked Prisma).
 *
 * Adapter contract (`FiscalYearReaderPort` — design rev 2 §5):
 *   - `getByYear(orgId, year)` → FiscalYearSnapshot|null via `prisma.fiscalYear
 *      .findUnique({where:{organizationId_year:{organizationId, year}}})`.
 *   - `countPeriodsByStatus(orgId, year)` → {closed, open, total} via groupBy
 *      on `prisma.fiscalPeriod` filtered to (orgId, year).
 *   - `ccExistsForYear(orgId, year)` → boolean via `prisma.journalEntry
 *      .findFirst({where:{organizationId, status:"POSTED", voucherType:{code:"CC"},
 *      date:{gte: toNoonUtc(`${year}-01-01`), lte: toNoonUtc(`${year}-12-31`)}}})`.
 *   - `decemberPeriodOf(orgId, year)` → {id, status}|null via
 *      `prisma.fiscalPeriod.findUnique({where:{organizationId_year_month:
 *      {organizationId, year, month:12}}})` (S-5).
 *   - `findResultAccount(orgId)` → {id, code, nature}|null via
 *      `prisma.account.findFirst({where:{organizationId, code:"3.2.2"}})`.
 *
 * Mock-del-colaborador pattern mirror `legacy-fiscal-periods.adapter.test.ts`
 * (POC #11.0c precedent). Mock just the Prisma client surface area the adapter
 * touches — fast, deterministic, no DB needed.
 */

const mockFiscalYearFindUnique = vi.fn();
const mockFiscalPeriodGroupBy = vi.fn();
const mockFiscalPeriodFindUnique = vi.fn();
const mockJournalEntryFindFirst = vi.fn();
const mockAccountFindFirst = vi.fn();

const mockPrisma = {
  fiscalYear: { findUnique: mockFiscalYearFindUnique },
  fiscalPeriod: {
    groupBy: mockFiscalPeriodGroupBy,
    findUnique: mockFiscalPeriodFindUnique,
  },
  journalEntry: { findFirst: mockJournalEntryFindFirst },
  account: { findFirst: mockAccountFindFirst },
};

import { PrismaFiscalYearReaderAdapter } from "../../infrastructure/prisma-fiscal-year-reader.adapter";

describe("PrismaFiscalYearReaderAdapter", () => {
  beforeEach(() => {
    mockFiscalYearFindUnique.mockReset();
    mockFiscalPeriodGroupBy.mockReset();
    mockFiscalPeriodFindUnique.mockReset();
    mockJournalEntryFindFirst.mockReset();
    mockAccountFindFirst.mockReset();
  });

  describe("getByYear", () => {
    it("returns FiscalYearSnapshot when row exists", async () => {
      const createdAt = new Date("2026-01-01T12:00:00Z");
      const updatedAt = new Date("2026-02-01T12:00:00Z");
      mockFiscalYearFindUnique.mockResolvedValue({
        id: "fy-1",
        organizationId: "org-1",
        year: 2026,
        status: "OPEN",
        closedAt: null,
        closedBy: null,
        createdAt,
        updatedAt,
      });

      const adapter = new PrismaFiscalYearReaderAdapter(mockPrisma as never);
      const result = await adapter.getByYear("org-1", 2026);

      expect(result).toEqual({
        id: "fy-1",
        organizationId: "org-1",
        year: 2026,
        status: "OPEN",
        closedAt: null,
        closedBy: null,
        createdAt,
        updatedAt,
      });
      expect(mockFiscalYearFindUnique).toHaveBeenCalledWith({
        where: {
          organizationId_year: { organizationId: "org-1", year: 2026 },
        },
      });
    });

    it("returns null when no row exists", async () => {
      mockFiscalYearFindUnique.mockResolvedValue(null);
      const adapter = new PrismaFiscalYearReaderAdapter(mockPrisma as never);
      const result = await adapter.getByYear("org-1", 2099);
      expect(result).toBeNull();
    });
  });

  describe("countPeriodsByStatus", () => {
    it("returns {closed, open, total} from groupBy aggregate", async () => {
      mockFiscalPeriodGroupBy.mockResolvedValue([
        { status: "CLOSED", _count: { _all: 9 } },
        { status: "OPEN", _count: { _all: 3 } },
      ]);

      const adapter = new PrismaFiscalYearReaderAdapter(mockPrisma as never);
      const result = await adapter.countPeriodsByStatus("org-1", 2026);

      expect(result).toEqual({ closed: 9, open: 3, total: 12 });
      expect(mockFiscalPeriodGroupBy).toHaveBeenCalledWith({
        by: ["status"],
        where: { organizationId: "org-1", year: 2026 },
        _count: { _all: true },
      });
    });

    it("returns zero counts when no periods exist", async () => {
      mockFiscalPeriodGroupBy.mockResolvedValue([]);
      const adapter = new PrismaFiscalYearReaderAdapter(mockPrisma as never);
      const result = await adapter.countPeriodsByStatus("org-1", 2099);
      expect(result).toEqual({ closed: 0, open: 0, total: 0 });
    });
  });

  describe("ccExistsForYear retirement (CAN-5.2 / REQ-A.8)", () => {
    // RED — declared failure mode: `expected typeof to be 'undefined' received
    // 'function'`. At HEAD edb6a634 ccExistsForYear is still implemented on
    // the adapter. T-02 GREEN removes it from port + adapter; idempotency gate
    // moves exclusively to FY.status='CLOSED' (stronger — FK-anchored).
    it("ccExistsForYear method has been retired from the adapter (CAN-5.2 idempotency moved to FY.status)", () => {
      const adapter = new PrismaFiscalYearReaderAdapter(mockPrisma as never);
      expect(
        typeof (adapter as unknown as Record<string, unknown>).ccExistsForYear,
      ).toBe("undefined");
    });
  });

  describe("decemberPeriodOf", () => {
    it("returns {id, status} when Dec period exists", async () => {
      mockFiscalPeriodFindUnique.mockResolvedValue({
        id: "p-dec-2026",
        status: "OPEN",
      });

      const adapter = new PrismaFiscalYearReaderAdapter(mockPrisma as never);
      const result = await adapter.decemberPeriodOf("org-1", 2026);

      expect(result).toEqual({ id: "p-dec-2026", status: "OPEN" });
      expect(mockFiscalPeriodFindUnique).toHaveBeenCalledWith({
        where: {
          organizationId_year_month: {
            organizationId: "org-1",
            year: 2026,
            month: 12,
          },
        },
        select: { id: true, status: true },
      });
    });

    it("returns null when Dec period does not exist", async () => {
      mockFiscalPeriodFindUnique.mockResolvedValue(null);
      const adapter = new PrismaFiscalYearReaderAdapter(mockPrisma as never);
      const result = await adapter.decemberPeriodOf("org-1", 2099);
      expect(result).toBeNull();
    });
  });

  describe("findResultAccount", () => {
    it("returns {id, code, nature} when 3.2.2 account exists", async () => {
      mockAccountFindFirst.mockResolvedValue({
        id: "acc-322",
        code: "3.2.2",
        nature: "ACREEDORA",
      });

      const adapter = new PrismaFiscalYearReaderAdapter(mockPrisma as never);
      const result = await adapter.findResultAccount("org-1");

      expect(result).toEqual({
        id: "acc-322",
        code: "3.2.2",
        nature: "ACREEDORA",
      });
      expect(mockAccountFindFirst).toHaveBeenCalledWith({
        where: { organizationId: "org-1", code: "3.2.2" },
        select: { id: true, code: true, nature: true },
      });
    });

    it("returns null when 3.2.2 account is missing", async () => {
      mockAccountFindFirst.mockResolvedValue(null);
      const adapter = new PrismaFiscalYearReaderAdapter(mockPrisma as never);
      const result = await adapter.findResultAccount("org-1");
      expect(result).toBeNull();
    });
  });
});
