import { describe, expect, it, vi, beforeEach } from "vitest";
import Decimal from "decimal.js";

import { PeriodAlreadyClosedError } from "../../domain/errors/annual-close-errors";

/**
 * RED — Phase 4.9 PrismaAnnualClosingJournalWriterTxAdapter unit test.
 *
 * Adapter contract (`AnnualClosingJournalWriterTxPort` — design rev 2 §4 + §5):
 *   - `createAndPost(input)` returns `{entryId}`.
 *   - **REQ-2.7 / C-5 invariant**: re-reads target FiscalPeriod inside TX,
 *      asserts `status === 'OPEN'` BEFORE any insert. Otherwise throws
 *      `PeriodAlreadyClosedError({periodId, status})`.
 *   - **W-1 reuse**: delegates voucher number resolution + INSERT to
 *      `JournalRepository.createWithRetryTx`. Inline `MAX(number)+1` FORBIDDEN.
 *   - DEC-1 boundary: `decimal.js Decimal` lines → `new Prisma.Decimal(d.toString())`
 *      ONLY inside the adapter call to `createWithRetryTx`.
 *
 * Test strategy — mocked tx + mocked JournalRepository (factory injected via
 * ctor so the test can pass a stub). VoucherTypeCfg.findUniqueOrThrow + period
 * lookup + journalEntry.update are also mocked.
 */

const mockPeriodFindUnique = vi.fn();
const mockVoucherTypeFindUniqueOrThrow = vi.fn();
const mockJournalEntryUpdate = vi.fn();
const mockCreateWithRetryTx = vi.fn();

const mockTx = {
  fiscalPeriod: { findUnique: mockPeriodFindUnique },
  voucherTypeCfg: { findUniqueOrThrow: mockVoucherTypeFindUniqueOrThrow },
  journalEntry: { update: mockJournalEntryUpdate },
};

const mockRepoFactory = vi.fn(() => ({ createWithRetryTx: mockCreateWithRetryTx }));

import { PrismaAnnualClosingJournalWriterTxAdapter } from "../../infrastructure/prisma-annual-closing-journal-writer-tx.adapter";

describe("PrismaAnnualClosingJournalWriterTxAdapter", () => {
  beforeEach(() => {
    mockPeriodFindUnique.mockReset();
    mockVoucherTypeFindUniqueOrThrow.mockReset();
    mockJournalEntryUpdate.mockReset();
    mockCreateWithRetryTx.mockReset();
    mockRepoFactory.mockClear();
  });

  describe("REQ-2.7 / C-5 — period-status invariant", () => {
    it("throws PeriodAlreadyClosedError when period status is CLOSED (before any insert)", async () => {
      mockPeriodFindUnique.mockResolvedValue({ status: "CLOSED" });

      const adapter = new PrismaAnnualClosingJournalWriterTxAdapter(
        mockTx as never,
        mockRepoFactory as never,
      );

      await expect(
        adapter.createAndPost({
          organizationId: "org-1",
          periodId: "p-dec-closed",
          date: new Date("2026-12-31T12:00:00Z"),
          voucherTypeCode: "CC",
          description: "Cierre de Gestión 2026",
          createdById: "user-1",
          sourceType: "annual-close",
          sourceId: "fy-1",
          lines: [
            { accountId: "acc-1", debit: new Decimal("100"), credit: new Decimal(0) },
            { accountId: "acc-2", debit: new Decimal(0), credit: new Decimal("100") },
          ],
        }),
      ).rejects.toBeInstanceOf(PeriodAlreadyClosedError);

      // Insert path NEVER reached.
      expect(mockVoucherTypeFindUniqueOrThrow).not.toHaveBeenCalled();
      expect(mockCreateWithRetryTx).not.toHaveBeenCalled();
    });

    it("error carries periodId + status in details for upstream handling", async () => {
      mockPeriodFindUnique.mockResolvedValue({ status: "CLOSED" });

      const adapter = new PrismaAnnualClosingJournalWriterTxAdapter(
        mockTx as never,
        mockRepoFactory as never,
      );

      try {
        await adapter.createAndPost({
          organizationId: "org-1",
          periodId: "p-target",
          date: new Date("2026-12-31T12:00:00Z"),
          voucherTypeCode: "CC",
          description: "x",
          createdById: "u",
          sourceType: "annual-close",
          sourceId: "fy-1",
          lines: [],
        });
        expect.fail("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(PeriodAlreadyClosedError);
        const err = e as PeriodAlreadyClosedError;
        expect(err.details).toEqual({
          periodId: "p-target",
          status: "CLOSED",
        });
      }
    });

    it("throws when period not found (defensive — should not happen post pre-TX validation)", async () => {
      mockPeriodFindUnique.mockResolvedValue(null);

      const adapter = new PrismaAnnualClosingJournalWriterTxAdapter(
        mockTx as never,
        mockRepoFactory as never,
      );

      await expect(
        adapter.createAndPost({
          organizationId: "org-1",
          periodId: "p-ghost",
          date: new Date("2026-12-31T12:00:00Z"),
          voucherTypeCode: "CC",
          description: "x",
          createdById: "u",
          sourceType: "annual-close",
          sourceId: "fy-1",
          lines: [],
        }),
      ).rejects.toThrow();
      expect(mockCreateWithRetryTx).not.toHaveBeenCalled();
    });
  });

  describe("W-1 — voucher correlative via createWithRetryTx + DEC-1 boundary", () => {
    it("OPEN period → delegates INSERT to JournalRepository.createWithRetryTx (no inline MAX query)", async () => {
      mockPeriodFindUnique.mockResolvedValue({ status: "OPEN" });
      mockVoucherTypeFindUniqueOrThrow.mockResolvedValue({ id: "vt-cc-1" });
      mockCreateWithRetryTx.mockResolvedValue({ id: "je-cc-new" });
      mockJournalEntryUpdate.mockResolvedValue({ id: "je-cc-new" });

      const adapter = new PrismaAnnualClosingJournalWriterTxAdapter(
        mockTx as never,
        mockRepoFactory as never,
      );

      const result = await adapter.createAndPost({
        organizationId: "org-1",
        periodId: "p-dec-open",
        date: new Date("2026-12-31T12:00:00Z"),
        voucherTypeCode: "CC",
        description: "Cierre de Gestión 2026",
        createdById: "user-1",
        sourceType: "annual-close",
        sourceId: "fy-1",
        lines: [
          { accountId: "acc-1", debit: new Decimal("125000.50"), credit: new Decimal(0) },
          { accountId: "acc-2", debit: new Decimal(0), credit: new Decimal("125000.50") },
        ],
      });

      expect(result).toEqual({ entryId: "je-cc-new" });

      // VoucherType resolved by code.
      expect(mockVoucherTypeFindUniqueOrThrow).toHaveBeenCalledWith({
        where: {
          organizationId_code: { organizationId: "org-1", code: "CC" },
        },
      });

      // createWithRetryTx called with tx + orgId + entry data + lines + "POSTED".
      expect(mockCreateWithRetryTx).toHaveBeenCalledTimes(1);
      const call = mockCreateWithRetryTx.mock.calls[0];
      expect(call?.[0]).toBe(mockTx);
      expect(call?.[1]).toBe("org-1");
      const entryData = call?.[2];
      expect(entryData?.voucherTypeId).toBe("vt-cc-1");
      expect(entryData?.periodId).toBe("p-dec-open");
      expect(entryData?.date.toISOString()).toBe("2026-12-31T12:00:00.000Z");
      expect(entryData?.description).toBe("Cierre de Gestión 2026");
      expect(entryData?.createdById).toBe("user-1");
      expect(entryData?.sourceType).toBe("annual-close");
      expect(entryData?.sourceId).toBe("fy-1");

      // DEC-1 boundary: lines converted to Prisma.Decimal via toString.
      const lines = call?.[3];
      expect(lines).toHaveLength(2);
      expect(lines[0].accountId).toBe("acc-1");
      expect(lines[0].debit.toString()).toBe("125000.5");
      expect(lines[0].credit.toString()).toBe("0");
      expect(lines[1].credit.toString()).toBe("125000.5");

      // Status: POSTED (annual-close inserts directly POSTED).
      expect(call?.[4]).toBe("POSTED");
    });

    it("OPEN period CA voucher → resolves voucherType code='CA' + delegates same path", async () => {
      mockPeriodFindUnique.mockResolvedValue({ status: "OPEN" });
      mockVoucherTypeFindUniqueOrThrow.mockResolvedValue({ id: "vt-ca-1" });
      mockCreateWithRetryTx.mockResolvedValue({ id: "je-ca-new" });
      mockJournalEntryUpdate.mockResolvedValue({ id: "je-ca-new" });

      const adapter = new PrismaAnnualClosingJournalWriterTxAdapter(
        mockTx as never,
        mockRepoFactory as never,
      );

      const result = await adapter.createAndPost({
        organizationId: "org-1",
        periodId: "p-jan-open",
        date: new Date("2027-01-01T12:00:00Z"),
        voucherTypeCode: "CA",
        description: "Apertura de Gestión 2027",
        createdById: "user-1",
        sourceType: "annual-close",
        sourceId: "fy-1",
        lines: [
          { accountId: "acc-act", debit: new Decimal("50000"), credit: new Decimal(0) },
          { accountId: "acc-cap", debit: new Decimal(0), credit: new Decimal("50000") },
        ],
      });

      expect(result).toEqual({ entryId: "je-ca-new" });
      expect(mockVoucherTypeFindUniqueOrThrow).toHaveBeenCalledWith({
        where: {
          organizationId_code: { organizationId: "org-1", code: "CA" },
        },
      });
    });

    it("repoFactory invoked with the same tx instance — repo stays Tx-bound to caller's TX", async () => {
      mockPeriodFindUnique.mockResolvedValue({ status: "OPEN" });
      mockVoucherTypeFindUniqueOrThrow.mockResolvedValue({ id: "vt-cc-1" });
      mockCreateWithRetryTx.mockResolvedValue({ id: "je-new" });
      mockJournalEntryUpdate.mockResolvedValue({ id: "je-new" });

      const adapter = new PrismaAnnualClosingJournalWriterTxAdapter(
        mockTx as never,
        mockRepoFactory as never,
      );

      await adapter.createAndPost({
        organizationId: "org-1",
        periodId: "p-1",
        date: new Date("2026-12-31T12:00:00Z"),
        voucherTypeCode: "CC",
        description: "x",
        createdById: "u",
        sourceType: "annual-close",
        sourceId: "fy-1",
        lines: [
          { accountId: "a1", debit: new Decimal(1), credit: new Decimal(0) },
          { accountId: "a2", debit: new Decimal(0), credit: new Decimal(1) },
        ],
      });

      // repoFactory was given the SAME tx, ensuring the repo's
      // baseRepository.db = tx (Tx-bound).
      expect(mockRepoFactory).toHaveBeenCalledWith(mockTx);
    });
  });
});
