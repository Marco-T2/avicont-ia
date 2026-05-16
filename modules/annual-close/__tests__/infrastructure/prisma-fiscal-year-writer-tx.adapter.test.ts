import { describe, expect, it, vi, beforeEach } from "vitest";

import { FiscalYearAlreadyClosedError } from "../../domain/errors/annual-close-errors";

/**
 * RED — Phase 4.3 PrismaFiscalYearWriterTxAdapter unit test (mocked TX).
 *
 * Adapter contract (`FiscalYearWriterTxPort` — design rev 2 §5):
 *   - `upsertOpen({organizationId, year, createdById})` → {id}
 *      via `tx.fiscalYear.upsert({where:{organizationId_year:{...}},
 *      create:{...status:OPEN, createdById}, update:{}})`. Idempotent.
 *   - `markClosed({fiscalYearId, closedBy, closingEntryId, openingEntryId})`
 *      → {closedAt} via GUARDED `tx.fiscalYear.updateMany({where:{id, status:
 *      "OPEN"}, data:{status:"CLOSED", ...}})`. If count !== 1 → throw
 *      FiscalYearAlreadyClosedError (W-3 lost-update protection).
 *
 * Mock-del-colaborador — mocked `Prisma.TransactionClient` surface restricted
 * to `tx.fiscalYear.upsert` + `tx.fiscalYear.updateMany`.
 */

const mockUpsert = vi.fn();
const mockUpdateMany = vi.fn();

const mockTx = {
  fiscalYear: { upsert: mockUpsert, updateMany: mockUpdateMany },
};

import { PrismaFiscalYearWriterTxAdapter } from "../../infrastructure/prisma-fiscal-year-writer-tx.adapter";

describe("PrismaFiscalYearWriterTxAdapter", () => {
  beforeEach(() => {
    mockUpsert.mockReset();
    mockUpdateMany.mockReset();
  });

  describe("upsertOpen", () => {
    it("creates a new FiscalYear OPEN when none exists; returns id", async () => {
      mockUpsert.mockResolvedValue({ id: "fy-new-1" });

      const adapter = new PrismaFiscalYearWriterTxAdapter(mockTx as never);
      const result = await adapter.upsertOpen({
        organizationId: "org-1",
        year: 2026,
        createdById: "user-1",
      });

      expect(result).toEqual({ id: "fy-new-1" });
      const call = mockUpsert.mock.calls[0]?.[0];
      expect(call?.where).toEqual({
        organizationId_year: { organizationId: "org-1", year: 2026 },
      });
      expect(call?.create?.organizationId).toBe("org-1");
      expect(call?.create?.year).toBe(2026);
      expect(call?.create?.status).toBe("OPEN");
      expect(call?.create?.createdById).toBe("user-1");
      expect(call?.update).toEqual({});
      expect(call?.select).toEqual({ id: true });
    });

    it("returns existing FiscalYear id when row pre-exists (idempotent)", async () => {
      mockUpsert.mockResolvedValue({ id: "fy-existing-2" });

      const adapter = new PrismaFiscalYearWriterTxAdapter(mockTx as never);
      const result = await adapter.upsertOpen({
        organizationId: "org-2",
        year: 2025,
        createdById: "user-2",
      });

      expect(result).toEqual({ id: "fy-existing-2" });
    });
  });

  describe("markClosed — W-3 guarded UPDATE", () => {
    it("updates exactly 1 row → returns {closedAt} populated by adapter", async () => {
      mockUpdateMany.mockResolvedValue({ count: 1 });

      const adapter = new PrismaFiscalYearWriterTxAdapter(mockTx as never);
      const before = Date.now();
      const result = await adapter.markClosed({
        fiscalYearId: "fy-1",
        closedBy: "user-1",
        closingEntryId: "je-cc-1",
        openingEntryId: "je-ca-1",
      });
      const after = Date.now();

      expect(result.closedAt).toBeInstanceOf(Date);
      expect(result.closedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.closedAt.getTime()).toBeLessThanOrEqual(after);

      const call = mockUpdateMany.mock.calls[0]?.[0];
      // GUARDED predicate (W-3): WHERE id=? AND status='OPEN'
      expect(call?.where).toEqual({ id: "fy-1", status: "OPEN" });
      expect(call?.data?.status).toBe("CLOSED");
      expect(call?.data?.closedBy).toBe("user-1");
      expect(call?.data?.closingEntryId).toBe("je-cc-1");
      expect(call?.data?.openingEntryId).toBe("je-ca-1");
      expect(call?.data?.closedAt).toBeInstanceOf(Date);
    });

    it("count=0 (lost-update race / already CLOSED) → throws FiscalYearAlreadyClosedError", async () => {
      mockUpdateMany.mockResolvedValue({ count: 0 });

      const adapter = new PrismaFiscalYearWriterTxAdapter(mockTx as never);

      await expect(
        adapter.markClosed({
          fiscalYearId: "fy-already-closed",
          closedBy: "user-1",
          closingEntryId: "je-cc-1",
          openingEntryId: "je-ca-1",
        }),
      ).rejects.toBeInstanceOf(FiscalYearAlreadyClosedError);
    });

    it("count=0 → error carries fiscalYearId in details for upstream handling", async () => {
      mockUpdateMany.mockResolvedValue({ count: 0 });

      const adapter = new PrismaFiscalYearWriterTxAdapter(mockTx as never);

      try {
        await adapter.markClosed({
          fiscalYearId: "fy-race-1",
          closedBy: "user-1",
          closingEntryId: "je-cc-1",
          openingEntryId: "je-ca-1",
        });
        expect.fail("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(FiscalYearAlreadyClosedError);
        const err = e as FiscalYearAlreadyClosedError;
        expect((err.details as { fiscalYearId: string }).fiscalYearId).toBe(
          "fy-race-1",
        );
      }
    });
  });
});
