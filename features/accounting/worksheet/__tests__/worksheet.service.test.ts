/**
 * T17 — RED: WorksheetService unit tests with mocked repository.
 *
 * Covers: REQ-10 (filter resolution), REQ-11 (RBAC gate).
 * Repository is mocked — no DB access.
 */

import { describe, it, expect, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { WorksheetService } from "../worksheet.service";
import { WorksheetRepository } from "../worksheet.repository";
import { ForbiddenError, NotFoundError, ValidationError } from "@/features/shared/errors";
import type { WorksheetAccountMetadata, WorksheetMovementAggregation } from "../worksheet.repository";

// ── Helpers ───────────────────────────────────────────────────────────────────

const D = (v: string | number) => new Prisma.Decimal(String(v));

const minimalAccounts: WorksheetAccountMetadata[] = [
  {
    id: "acc-1",
    code: "1.1.1",
    name: "Caja",
    level: 3,
    type: "ACTIVO",
    nature: "DEUDORA",
    isActive: true,
    isDetail: true,
    isContraAccount: false,
  },
];

const minimalSumas: WorksheetMovementAggregation[] = [
  { accountId: "acc-1", totalDebit: D("1000"), totalCredit: D("0"), nature: "DEUDORA" },
];

// ── Mock repo factory ─────────────────────────────────────────────────────────

type MockRepoOverrides = Partial<{
  findFiscalPeriod: WorksheetRepository["findFiscalPeriod"];
  findAccountsWithDetail: WorksheetRepository["findAccountsWithDetail"];
  aggregateByAdjustmentFlag: WorksheetRepository["aggregateByAdjustmentFlag"];
}>;

function createMockRepo(overrides: MockRepoOverrides = {}): WorksheetRepository {
  const base = {
    findFiscalPeriod: vi.fn().mockResolvedValue({
      id: "period-1",
      status: "OPEN",
      startDate: new Date("2025-01-01"),
      endDate: new Date("2025-12-31"),
    }),
    findAccountsWithDetail: vi.fn().mockResolvedValue(minimalAccounts),
    aggregateByAdjustmentFlag: vi.fn().mockImplementation(
      async (_orgId: string, _range: unknown, isAdj: boolean) => {
        return isAdj ? [] : minimalSumas;
      },
    ),
    requireOrg: vi.fn().mockReturnValue({ organizationId: "org-1" }),
    transaction: vi.fn(),
    db: {} as unknown,
    ...overrides,
  };
  return base as unknown as WorksheetRepository;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("WorksheetService — RBAC (REQ-11)", () => {
  it("REQ-11.S2: viewer role → ForbiddenError before any DB query", async () => {
    const mockRepo = createMockRepo();
    const service = new WorksheetService(mockRepo);

    await expect(
      service.generateWorksheet("org-1", "member" as never, {
        dateFrom: new Date("2025-01-01"),
        dateTo: new Date("2025-12-31"),
      }),
    ).rejects.toThrow(ForbiddenError);

    // No DB calls made
    expect(mockRepo.findAccountsWithDetail).not.toHaveBeenCalled();
    expect(mockRepo.aggregateByAdjustmentFlag).not.toHaveBeenCalled();
  });

  it("REQ-11.S2: viewer role → ForbiddenError", async () => {
    const mockRepo = createMockRepo();
    const service = new WorksheetService(mockRepo);

    await expect(
      service.generateWorksheet("org-1", "viewer" as never, {
        dateFrom: new Date("2025-01-01"),
        dateTo: new Date("2025-12-31"),
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("REQ-11.S3: no membership (empty role) → ForbiddenError", async () => {
    const mockRepo = createMockRepo();
    const service = new WorksheetService(mockRepo);

    await expect(
      service.generateWorksheet("org-1", "" as never, {
        dateFrom: new Date("2025-01-01"),
        dateTo: new Date("2025-12-31"),
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("REQ-11.S1: contador role → proceeds without throwing", async () => {
    const mockRepo = createMockRepo();
    const service = new WorksheetService(mockRepo);

    await expect(
      service.generateWorksheet("org-1", "contador", {
        dateFrom: new Date("2025-01-01"),
        dateTo: new Date("2025-12-31"),
      }),
    ).resolves.not.toThrow();
  });

  it("owner role → proceeds without throwing", async () => {
    const mockRepo = createMockRepo();
    const service = new WorksheetService(mockRepo);

    await expect(
      service.generateWorksheet("org-1", "owner", {
        dateFrom: new Date("2025-01-01"),
        dateTo: new Date("2025-12-31"),
      }),
    ).resolves.not.toThrow();
  });

  it("admin role → proceeds without throwing", async () => {
    const mockRepo = createMockRepo();
    const service = new WorksheetService(mockRepo);

    await expect(
      service.generateWorksheet("org-1", "admin", {
        dateFrom: new Date("2025-01-01"),
        dateTo: new Date("2025-12-31"),
      }),
    ).resolves.not.toThrow();
  });
});

describe("WorksheetService — filter resolution (REQ-10)", () => {
  it("REQ-10.S1: fiscalPeriodId only → uses period range as effective range", async () => {
    const mockRepo = createMockRepo({
      findFiscalPeriod: vi.fn().mockResolvedValue({
        id: "period-1",
        status: "OPEN",
        startDate: new Date("2025-01-01"),
        endDate: new Date("2025-12-31"),
      }),
    });
    const service = new WorksheetService(mockRepo);

    await service.generateWorksheet("org-1", "contador", {
      dateFrom: new Date("2025-01-01"),
      dateTo: new Date("2025-12-31"),
      fiscalPeriodId: "period-1",
    });

    expect(mockRepo.findFiscalPeriod).toHaveBeenCalledWith("org-1", "period-1");
    // aggregateByAdjustmentFlag should have been called with the period's range
    expect(mockRepo.aggregateByAdjustmentFlag).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({
        dateFrom: new Date("2025-01-01"),
        dateTo: new Date("2025-12-31"),
      }),
      expect.any(Boolean),
    );
  });

  it("REQ-10.S2: dateRange only (no fiscalPeriodId) → uses date range directly", async () => {
    const mockRepo = createMockRepo();
    const service = new WorksheetService(mockRepo);

    await service.generateWorksheet("org-1", "contador", {
      dateFrom: new Date("2025-03-01"),
      dateTo: new Date("2025-06-30"),
    });

    expect(mockRepo.aggregateByAdjustmentFlag).toHaveBeenCalledWith(
      "org-1",
      { dateFrom: new Date("2025-03-01"), dateTo: new Date("2025-06-30") },
      expect.any(Boolean),
    );
  });

  it("REQ-10.S3: both provided → intersection (narrower range applies)", async () => {
    const mockRepo = createMockRepo({
      findFiscalPeriod: vi.fn().mockResolvedValue({
        id: "period-1",
        status: "OPEN",
        startDate: new Date("2025-01-01"),
        endDate: new Date("2025-12-31"),
      }),
    });
    const service = new WorksheetService(mockRepo);

    // dateRange (July-Sept) is inside the period (Jan-Dec) → intersection = July-Sept
    await service.generateWorksheet("org-1", "contador", {
      dateFrom: new Date("2025-07-01"),
      dateTo: new Date("2025-09-30"),
      fiscalPeriodId: "period-1",
    });

    expect(mockRepo.aggregateByAdjustmentFlag).toHaveBeenCalledWith(
      "org-1",
      { dateFrom: new Date("2025-07-01"), dateTo: new Date("2025-09-30") },
      expect.any(Boolean),
    );
  });

  it("REQ-10.S4: dateRange outside fiscal period → empty result, no error", async () => {
    const mockRepo = createMockRepo({
      findFiscalPeriod: vi.fn().mockResolvedValue({
        id: "period-1",
        status: "OPEN",
        startDate: new Date("2025-01-01"),
        endDate: new Date("2025-12-31"),
      }),
      aggregateByAdjustmentFlag: vi.fn().mockResolvedValue([]),
      findAccountsWithDetail: vi.fn().mockResolvedValue([]),
    });
    const service = new WorksheetService(mockRepo);

    // dateRange in 2026 — outside the 2025 period
    const result = await service.generateWorksheet("org-1", "contador", {
      dateFrom: new Date("2026-01-01"),
      dateTo: new Date("2026-03-31"),
      fiscalPeriodId: "period-1",
    });

    // Should return empty report, no throw
    expect(result).toBeDefined();
    expect(result.groups).toHaveLength(0);
  });

  it("REQ-10.E1: unknown fiscalPeriodId → NotFoundError", async () => {
    const mockRepo = createMockRepo({
      findFiscalPeriod: vi.fn().mockResolvedValue(null),
    });
    const service = new WorksheetService(mockRepo);

    await expect(
      service.generateWorksheet("org-1", "contador", {
        dateFrom: new Date("2025-01-01"),
        dateTo: new Date("2025-12-31"),
        fiscalPeriodId: "non-existent-period",
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("REQ-10.E2: dateFrom > dateTo → ValidationError", async () => {
    const mockRepo = createMockRepo();
    const service = new WorksheetService(mockRepo);

    await expect(
      service.generateWorksheet("org-1", "contador", {
        dateFrom: new Date("2025-09-01"),
        dateTo: new Date("2025-03-01"), // inverted
      }),
    ).rejects.toThrow(ValidationError);
  });
});

describe("WorksheetService — report shape", () => {
  it("returns a WorksheetReport with orgId populated", async () => {
    const mockRepo = createMockRepo();
    const service = new WorksheetService(mockRepo);

    const result = await service.generateWorksheet("org-1", "contador", {
      dateFrom: new Date("2025-01-01"),
      dateTo: new Date("2025-12-31"),
    });

    expect(result.orgId).toBe("org-1");
    expect(result.dateFrom).toEqual(new Date("2025-01-01"));
    expect(result.dateTo).toEqual(new Date("2025-12-31"));
    expect(result.grandTotals).toBeDefined();
    // imbalanced state depends on fixture — just assert it's a boolean
    expect(typeof result.imbalanced).toBe("boolean");
  });

  it("calls aggregateByAdjustmentFlag twice (once for Sumas, once for Ajustes) in parallel", async () => {
    const mockRepo = createMockRepo();
    const service = new WorksheetService(mockRepo);

    await service.generateWorksheet("org-1", "contador", {
      dateFrom: new Date("2025-01-01"),
      dateTo: new Date("2025-12-31"),
    });

    // Should have been called twice: once with false, once with true
    expect(mockRepo.aggregateByAdjustmentFlag).toHaveBeenCalledTimes(2);
    const calls = (mockRepo.aggregateByAdjustmentFlag as ReturnType<typeof vi.fn>).mock.calls;
    const flags = calls.map((c: unknown[]) => c[2]);
    expect(flags).toContain(false);
    expect(flags).toContain(true);
  });
});
