import { describe, expect, it, vi, beforeEach } from "vitest";

import { YearOpeningPeriodsExistError } from "../../domain/errors/annual-close-errors";

/**
 * RED — Phase 4.11 PrismaPeriodAutoCreatorTxAdapter unit test.
 *
 * Adapter contract (`PeriodAutoCreatorTxPort` — design rev 2 §4 + §5):
 *   - `createTwelvePeriodsForYear({orgId, year, createdById})` →
 *     `{periodIds: string[], janPeriodId: string}`.
 *   - Pre-check: `tx.fiscalPeriod.count` for (orgId, year). count > 0 →
 *     throw `YearOpeningPeriodsExistError({year, existingCount})`.
 *   - Creates 12 periods (months 1..12) per-row via `tx.fiscalPeriod.create`
 *     (W-4 contingency — per-row trigger). Names "Enero <year>", ...,
 *     "Diciembre <year>" (Spanish via `monthNameEs`). status=OPEN.
 *     startDate/endDate per UTC month boundaries.
 *   - Returns periodIds ordered by month ascending; janPeriodId = month=1.
 *
 * Mock-del-colaborador — mocked tx.fiscalPeriod {count, create, findMany}.
 */

const mockCount = vi.fn();
const mockCreate = vi.fn();
const mockFindMany = vi.fn();

const mockTx = {
  fiscalPeriod: { count: mockCount, create: mockCreate, findMany: mockFindMany },
};

import { PrismaPeriodAutoCreatorTxAdapter } from "../../infrastructure/prisma-period-auto-creator-tx.adapter";

describe("PrismaPeriodAutoCreatorTxAdapter", () => {
  beforeEach(() => {
    mockCount.mockReset();
    mockCreate.mockReset();
    mockFindMany.mockReset();
  });

  describe("YearOpeningPeriodsExistError gate (REQ-5.2)", () => {
    it("count > 0 → throws YearOpeningPeriodsExistError, no creates", async () => {
      mockCount.mockResolvedValue(4);

      const adapter = new PrismaPeriodAutoCreatorTxAdapter(mockTx as never);

      await expect(
        adapter.createTwelvePeriodsForYear({
          organizationId: "org-1",
          year: 2027,
          createdById: "user-1",
        }),
      ).rejects.toBeInstanceOf(YearOpeningPeriodsExistError);

      expect(mockCount).toHaveBeenCalledWith({
        where: { organizationId: "org-1", year: 2027 },
      });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("error carries {year, existingCount} for upstream handling", async () => {
      mockCount.mockResolvedValue(3);

      const adapter = new PrismaPeriodAutoCreatorTxAdapter(mockTx as never);

      try {
        await adapter.createTwelvePeriodsForYear({
          organizationId: "org-1",
          year: 2027,
          createdById: "user-1",
        });
        expect.fail("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(YearOpeningPeriodsExistError);
        const err = e as YearOpeningPeriodsExistError;
        expect(err.details).toEqual({ year: 2027, existingCount: 3 });
      }
    });
  });

  describe("happy path — 0 periods → creates 12 OPEN with Spanish names", () => {
    beforeEach(() => {
      mockCount.mockResolvedValue(0);
      // 12 sequential create calls return synthetic ids based on month.
      mockCreate.mockImplementation(async ({ data }) => ({
        id: `p-${data.year}-${String(data.month).padStart(2, "0")}`,
        month: data.month,
      }));
      // findMany returns the 12 created periods ordered by month asc.
      mockFindMany.mockImplementation(async () => {
        const rows = [];
        for (let m = 1; m <= 12; m++) {
          rows.push({
            id: `p-2027-${String(m).padStart(2, "0")}`,
            month: m,
          });
        }
        return rows;
      });
    });

    it("creates 12 periods per-row (W-4 contingency for audit trigger completeness)", async () => {
      const adapter = new PrismaPeriodAutoCreatorTxAdapter(mockTx as never);
      await adapter.createTwelvePeriodsForYear({
        organizationId: "org-1",
        year: 2027,
        createdById: "user-1",
      });

      // W-4: per-row create (NOT createMany) to ensure per-row trigger fires.
      expect(mockCreate).toHaveBeenCalledTimes(12);
    });

    it("each period has correct Spanish name + status=OPEN + UTC month range", async () => {
      const adapter = new PrismaPeriodAutoCreatorTxAdapter(mockTx as never);
      await adapter.createTwelvePeriodsForYear({
        organizationId: "org-1",
        year: 2027,
        createdById: "user-1",
      });

      const calls = mockCreate.mock.calls.map((c) => c[0].data);
      // Verify month 1 (Enero) shape.
      expect(calls[0].name).toBe("Enero 2027");
      expect(calls[0].year).toBe(2027);
      expect(calls[0].month).toBe(1);
      expect(calls[0].status).toBe("OPEN");
      expect(calls[0].organizationId).toBe("org-1");
      expect(calls[0].createdById).toBe("user-1");
      expect((calls[0].startDate as Date).toISOString()).toBe(
        "2027-01-01T00:00:00.000Z",
      );
      expect((calls[0].endDate as Date).toISOString()).toBe(
        "2027-01-31T00:00:00.000Z",
      );

      // Verify month 12 (Diciembre).
      expect(calls[11].name).toBe("Diciembre 2027");
      expect(calls[11].month).toBe(12);
      expect((calls[11].startDate as Date).toISOString()).toBe(
        "2027-12-01T00:00:00.000Z",
      );
      expect((calls[11].endDate as Date).toISOString()).toBe(
        "2027-12-31T00:00:00.000Z",
      );

      // Verify month 2 (Febrero — non-leap, 28 days).
      expect(calls[1].name).toBe("Febrero 2027");
      expect((calls[1].endDate as Date).toISOString()).toBe(
        "2027-02-28T00:00:00.000Z",
      );
    });

    it("returns {periodIds, janPeriodId} — janPeriodId = month=1 id", async () => {
      const adapter = new PrismaPeriodAutoCreatorTxAdapter(mockTx as never);
      const result = await adapter.createTwelvePeriodsForYear({
        organizationId: "org-1",
        year: 2027,
        createdById: "user-1",
      });

      expect(result.periodIds).toHaveLength(12);
      expect(result.periodIds[0]).toBe("p-2027-01");
      expect(result.periodIds[11]).toBe("p-2027-12");
      expect(result.janPeriodId).toBe("p-2027-01");
    });

    it("leap year (2028): Febrero endDate = 2028-02-29", async () => {
      mockCreate.mockImplementation(async ({ data }) => ({
        id: `p-${data.year}-${String(data.month).padStart(2, "0")}`,
        month: data.month,
      }));
      mockFindMany.mockResolvedValue(
        Array.from({ length: 12 }, (_, i) => ({
          id: `p-2028-${String(i + 1).padStart(2, "0")}`,
          month: i + 1,
        })),
      );

      const adapter = new PrismaPeriodAutoCreatorTxAdapter(mockTx as never);
      await adapter.createTwelvePeriodsForYear({
        organizationId: "org-1",
        year: 2028,
        createdById: "user-1",
      });

      const febCall = mockCreate.mock.calls.find((c) => c[0].data.month === 2);
      expect((febCall?.[0].data.endDate as Date).toISOString()).toBe(
        "2028-02-29T00:00:00.000Z",
      );
    });
  });
});
