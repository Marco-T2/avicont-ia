/**
 * Unit tests for PrismaAuditCloseEventReaderAdapter (audit-pure-read Group B).
 *
 * Mocks @/lib/prisma to avoid DB dependency — mirror
 * `modules/sale/infrastructure/__tests__/prisma-sale-contact-reader.adapter.test.ts`
 * mock pattern. Covers: query shape (tenant-scoped `findMany` where + orderBy),
 * clean-view mapping (Json → Record, no Prisma types), and empty branch.
 *
 * RED acceptance failure mode: FAILS pre-implementación por module resolution
 * failure (`PrismaAuditCloseEventReaderAdapter` no existe). Post-GREEN: PASSES
 * porque el adapter emite el where {organizationId, correlationId} + orderBy
 * [{entityType asc},{createdAt asc}] y retorna views planas.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { PrismaAuditCloseEventReaderAdapter } from "../prisma-audit-close-event-reader.adapter";

beforeEach(() => {
  vi.clearAllMocks();
});

const row = {
  id: "audit-1",
  organizationId: "org-1",
  entityType: "fiscal_periods",
  entityId: "period-1",
  action: "STATUS_CHANGE",
  oldValues: { status: "OPEN" },
  newValues: { status: "CLOSED" },
  changedById: null,
  justification: null,
  correlationId: "corr-1",
  createdAt: new Date("2026-04-21T10:00:00.000Z"),
};

describe("PrismaAuditCloseEventReaderAdapter — listByCorrelation", () => {
  it("scopes the query by organizationId AND correlationId (tenant safety) with entityType/createdAt ordering", async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValueOnce([]);

    const adapter = new PrismaAuditCloseEventReaderAdapter();
    await adapter.listByCorrelation("org-1", "corr-1");

    expect(prisma.auditLog.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1", correlationId: "corr-1" },
      orderBy: [{ entityType: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        organizationId: true,
        entityType: true,
        entityId: true,
        action: true,
        oldValues: true,
        newValues: true,
        changedById: true,
        justification: true,
        correlationId: true,
        createdAt: true,
      },
    });
  });

  it("returns clean views (plain values, Json coerced to Record | null)", async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValueOnce([row] as never);

    const adapter = new PrismaAuditCloseEventReaderAdapter();
    const result = await adapter.listByCorrelation("org-1", "corr-1");

    expect(result).toEqual([
      {
        id: "audit-1",
        organizationId: "org-1",
        entityType: "fiscal_periods",
        entityId: "period-1",
        action: "STATUS_CHANGE",
        oldValues: { status: "OPEN" },
        newValues: { status: "CLOSED" },
        changedById: null,
        justification: null,
        correlationId: "corr-1",
        createdAt: new Date("2026-04-21T10:00:00.000Z"),
      },
    ]);
  });

  it("returns [] when no rows match organizationId + correlationId (cross-tenant or missing)", async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValueOnce([]);

    const adapter = new PrismaAuditCloseEventReaderAdapter();
    const result = await adapter.listByCorrelation("org-other", "corr-1");

    expect(result).toEqual([]);
  });
});
