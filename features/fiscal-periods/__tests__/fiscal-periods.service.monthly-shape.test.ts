/**
 * Monthly-shape guard tests for FiscalPeriodsService.create().
 *
 * Codifies REQ-5: the service MUST reject any (startDate, endDate) pair that
 * does not cover exactly one UTC calendar month.
 *
 * Guard runs after INVALID_DATE_RANGE check, before findByYearAndMonth DB call.
 *
 * ME-T01..ME-T08 — each scenario is a separate it() block per REQ-8 item 1.
 *
 * ME-T07 strategy: new Date('2025-02-29') silently rolls to 2025-03-01 in
 * Node.js (and Zod z.coerce.date() does NOT reject it). Tests pass Date objects
 * directly to bypass string coercion. Comment documents the JS month index
 * mapping: month index 2 = March (0-indexed), so new Date(Date.UTC(2025,2,1))
 * = 2025-03-01T00:00:00.000Z.
 */

import { describe, it, expect, vi } from "vitest";
import {
  ValidationError,
  FISCAL_PERIOD_NOT_MONTHLY,
} from "@/features/shared/errors";
import { FiscalPeriodsService } from "../fiscal-periods.service";
import type { FiscalPeriodsRepository } from "../fiscal-periods.repository";
import type {
  CreateFiscalPeriodInput,
  FiscalPeriod,
} from "../fiscal-periods.types";

// ── Shared fixtures ────────────────────────────────────────────────────────────

const ORG_ID = "org-monthly-shape";

function buildFiscalPeriod(overrides: Partial<FiscalPeriod> = {}): FiscalPeriod {
  return {
    id: "fp-1",
    organizationId: ORG_ID,
    name: "Enero 2026",
    year: 2026,
    month: 1,
    startDate: new Date(Date.UTC(2026, 0, 1)),
    endDate: new Date(Date.UTC(2026, 0, 31)),
    status: "OPEN",
    closedAt: null,
    closedBy: null,
    createdById: "user-1",
    createdAt: new Date(Date.UTC(2026, 0, 1)),
    updatedAt: new Date(Date.UTC(2026, 0, 1)),
    ...overrides,
  };
}

function baseInput(overrides: Partial<CreateFiscalPeriodInput> = {}): CreateFiscalPeriodInput {
  return {
    name: "Enero 2026",
    year: 2026,
    startDate: new Date(Date.UTC(2026, 0, 1)),
    endDate: new Date(Date.UTC(2026, 0, 31)),
    createdById: "user-1",
    ...overrides,
  };
}

type RepoMock = Pick<
  FiscalPeriodsRepository,
  "findAll" | "findById" | "findByYear" | "create" | "countDraftEntries"
> & {
  findByYearAndMonth: ReturnType<typeof vi.fn>;
};

function buildRepoMock(): RepoMock {
  return {
    findAll: vi.fn(),
    findById: vi.fn(),
    findByYear: vi.fn().mockResolvedValue(null),
    findByYearAndMonth: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    countDraftEntries: vi.fn(),
  };
}

// ── ME-T01: annual period → 422 FISCAL_PERIOD_NOT_MONTHLY ─────────────────────

describe("FiscalPeriodsService.create — monthly-shape guard", () => {
  it("ME-T01: annual period (Jan 1 → Dec 31) throws FISCAL_PERIOD_NOT_MONTHLY", async () => {
    const repo = buildRepoMock();
    const service = new FiscalPeriodsService(
      repo as unknown as FiscalPeriodsRepository,
    );

    await expect(
      service.create(
        ORG_ID,
        baseInput({
          name: "Año 2026",
          year: 2026,
          startDate: new Date(Date.UTC(2026, 0, 1)),
          endDate: new Date(Date.UTC(2026, 11, 31)),
        }),
      ),
    ).rejects.toSatisfy(
      (err) =>
        err instanceof ValidationError &&
        (err as ValidationError).code === FISCAL_PERIOD_NOT_MONTHLY &&
        (err as ValidationError).statusCode === 422 &&
        (err as ValidationError).message ===
          "El período debe corresponder a exactamente un mes calendario.",
    );

    // Guard fires before DB — repo must never be called
    expect(repo.findByYearAndMonth).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });

  // ── ME-T01b: AC-5.6 — details populated so UI can display the violation ───────

  it("ME-T01b: annual period rejection populates AppError.details with startDate and endDate (AC-5.6)", async () => {
    const repo = buildRepoMock();
    const service = new FiscalPeriodsService(
      repo as unknown as FiscalPeriodsRepository,
    );

    const startDate = new Date(Date.UTC(2026, 0, 1));
    const endDate = new Date(Date.UTC(2026, 11, 31));

    await expect(
      service.create(
        ORG_ID,
        baseInput({
          name: "Año 2026",
          year: 2026,
          startDate,
          endDate,
        }),
      ),
    ).rejects.toSatisfy(
      (err) =>
        err instanceof ValidationError &&
        typeof (err as ValidationError).details === "object" &&
        (err as ValidationError).details !== null &&
        (err as ValidationError).details!["startDate"] === startDate.toISOString() &&
        (err as ValidationError).details!["endDate"] === endDate.toISOString(),
    );
  });

  // ── ME-T02: start not 1st → 422 ─────────────────────────────────────────────

  it("ME-T02: startDate not the 1st of the month throws FISCAL_PERIOD_NOT_MONTHLY", async () => {
    const repo = buildRepoMock();
    const service = new FiscalPeriodsService(
      repo as unknown as FiscalPeriodsRepository,
    );

    await expect(
      service.create(
        ORG_ID,
        baseInput({
          name: "Enero 2026 parcial",
          year: 2026,
          startDate: new Date(Date.UTC(2026, 0, 15)), // Jan 15 — not the 1st
          endDate: new Date(Date.UTC(2026, 0, 31)),
        }),
      ),
    ).rejects.toSatisfy(
      (err) =>
        err instanceof ValidationError &&
        (err as ValidationError).code === FISCAL_PERIOD_NOT_MONTHLY &&
        (err as ValidationError).statusCode === 422,
    );

    expect(repo.findByYearAndMonth).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });

  // ── ME-T03: end not last day → 422 ──────────────────────────────────────────

  it("ME-T03: endDate not the last day of the month throws FISCAL_PERIOD_NOT_MONTHLY", async () => {
    const repo = buildRepoMock();
    const service = new FiscalPeriodsService(
      repo as unknown as FiscalPeriodsRepository,
    );

    await expect(
      service.create(
        ORG_ID,
        baseInput({
          name: "Enero 2026 incompleto",
          year: 2026,
          startDate: new Date(Date.UTC(2026, 0, 1)),
          endDate: new Date(Date.UTC(2026, 0, 30)), // Jan 30 — not Jan 31
        }),
      ),
    ).rejects.toSatisfy(
      (err) =>
        err instanceof ValidationError &&
        (err as ValidationError).code === FISCAL_PERIOD_NOT_MONTHLY &&
        (err as ValidationError).statusCode === 422,
    );

    expect(repo.findByYearAndMonth).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });

  // ── ME-T04: leap Feb 29 → 201 OK ────────────────────────────────────────────

  it("ME-T04: February 2024 (leap year) ending Feb 29 succeeds", async () => {
    const repo = buildRepoMock();
    const created = buildFiscalPeriod({
      id: "fp-feb-2024",
      name: "Febrero 2024",
      year: 2024,
      month: 2,
      startDate: new Date(Date.UTC(2024, 1, 1)),
      endDate: new Date(Date.UTC(2024, 1, 29)),
    });
    vi.mocked(repo.create).mockResolvedValueOnce(created);

    const service = new FiscalPeriodsService(
      repo as unknown as FiscalPeriodsRepository,
    );

    const result = await service.create(
      ORG_ID,
      baseInput({
        name: "Febrero 2024",
        year: 2024,
        startDate: new Date(Date.UTC(2024, 1, 1)),
        endDate: new Date(Date.UTC(2024, 1, 29)),
      }),
    );

    expect(result).toEqual(created);
    expect(repo.findByYearAndMonth).toHaveBeenCalledWith(ORG_ID, 2024, 2);
    expect(repo.create).toHaveBeenCalled();
  });

  // ── ME-T05: non-leap 2026 Feb 28 → 201 OK ───────────────────────────────────

  it("ME-T05: February 2026 (non-leap) ending Feb 28 succeeds", async () => {
    const repo = buildRepoMock();
    const created = buildFiscalPeriod({
      id: "fp-feb-2026",
      name: "Febrero 2026",
      year: 2026,
      month: 2,
      startDate: new Date(Date.UTC(2026, 1, 1)),
      endDate: new Date(Date.UTC(2026, 1, 28)),
    });
    vi.mocked(repo.create).mockResolvedValueOnce(created);

    const service = new FiscalPeriodsService(
      repo as unknown as FiscalPeriodsRepository,
    );

    const result = await service.create(
      ORG_ID,
      baseInput({
        name: "Febrero 2026",
        year: 2026,
        startDate: new Date(Date.UTC(2026, 1, 1)),
        endDate: new Date(Date.UTC(2026, 1, 28)),
      }),
    );

    expect(result).toEqual(created);
    expect(repo.findByYearAndMonth).toHaveBeenCalledWith(ORG_ID, 2026, 2);
    expect(repo.create).toHaveBeenCalled();
  });

  // ── ME-T06: non-leap 2025 Feb 28 → 201 OK ───────────────────────────────────

  it("ME-T06: February 2025 (non-leap) ending Feb 28 succeeds", async () => {
    const repo = buildRepoMock();
    const created = buildFiscalPeriod({
      id: "fp-feb-2025",
      name: "Febrero 2025",
      year: 2025,
      month: 2,
      startDate: new Date(Date.UTC(2025, 1, 1)),
      endDate: new Date(Date.UTC(2025, 1, 28)),
    });
    vi.mocked(repo.create).mockResolvedValueOnce(created);

    const service = new FiscalPeriodsService(
      repo as unknown as FiscalPeriodsRepository,
    );

    const result = await service.create(
      ORG_ID,
      baseInput({
        name: "Febrero 2025",
        year: 2025,
        startDate: new Date(Date.UTC(2025, 1, 1)),
        endDate: new Date(Date.UTC(2025, 1, 28)),
      }),
    );

    expect(result).toEqual(created);
    expect(repo.findByYearAndMonth).toHaveBeenCalledWith(ORG_ID, 2025, 2);
    expect(repo.create).toHaveBeenCalled();
  });

  // ── ME-T07: 2025-02-29 rolls to Mar 1 → 422 ─────────────────────────────────
  //
  // JS behavior: new Date('2025-02-29') → 2025-03-01T00:00:00.000Z (silent rollover).
  // Zod z.coerce.date() does NOT reject it — the coercion happens via new Date(value).
  // Service receives endDate = Mar 1, which is NOT lastDayOfUTCMonth(Feb 2025) = Feb 28.
  // Guard rejects with FISCAL_PERIOD_NOT_MONTHLY.
  //
  // Date.UTC month index: 2 = March (0-indexed), so Date.UTC(2025, 2, 1) = 2025-03-01.

  it("ME-T07: Feb 29 (non-leap 2025) silently rolls to Mar 1 — guard catches mismatch", async () => {
    const repo = buildRepoMock();
    const service = new FiscalPeriodsService(
      repo as unknown as FiscalPeriodsRepository,
    );

    await expect(
      service.create(
        ORG_ID,
        baseInput({
          name: "Febrero 2025 inválido",
          year: 2025,
          startDate: new Date(Date.UTC(2025, 1, 1)), // Feb 1 2025
          endDate: new Date(Date.UTC(2025, 2, 1)),   // Mar 1 2025 (rolled from Feb 29)
        }),
      ),
    ).rejects.toSatisfy(
      (err) =>
        err instanceof ValidationError &&
        (err as ValidationError).code === FISCAL_PERIOD_NOT_MONTHLY &&
        (err as ValidationError).statusCode === 422,
    );

    expect(repo.findByYearAndMonth).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });

  // ── ME-T08: valid Apr 2026 → 201 OK regression ──────────────────────────────

  it("ME-T08: April 2026 (30-day month) succeeds — regression check", async () => {
    const repo = buildRepoMock();
    const created = buildFiscalPeriod({
      id: "fp-apr-2026",
      name: "Abril 2026",
      year: 2026,
      month: 4,
      startDate: new Date(Date.UTC(2026, 3, 1)),
      endDate: new Date(Date.UTC(2026, 3, 30)),
    });
    vi.mocked(repo.create).mockResolvedValueOnce(created);

    const service = new FiscalPeriodsService(
      repo as unknown as FiscalPeriodsRepository,
    );

    const result = await service.create(
      ORG_ID,
      baseInput({
        name: "Abril 2026",
        year: 2026,
        startDate: new Date(Date.UTC(2026, 3, 1)),
        endDate: new Date(Date.UTC(2026, 3, 30)),
      }),
    );

    expect(result).toEqual(created);
    expect(repo.findByYearAndMonth).toHaveBeenCalledWith(ORG_ID, 2026, 4);
    expect(repo.create).toHaveBeenCalled();
  });
});
