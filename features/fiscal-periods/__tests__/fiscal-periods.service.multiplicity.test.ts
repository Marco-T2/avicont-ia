/**
 * Phase 1 — FiscalPeriodsService multiplicity unit tests.
 *
 * Mocks `FiscalPeriodsRepository` directly via vi.fn. These tests codify the
 * invariant repair mandated by REQ-1 (month-scoped uniqueness), REQ-2 (remove
 * the contradictory OPEN guard), and REQ-3 (new error code + P2002 trip-wire).
 *
 * REQ-8 items 1-2: each scenario is a SEPARATE `it()` block — NO parametrization.
 *
 * Tests T02, T03, T04 remain RED until T06/T07 rewire `create()` through
 * `findByYearAndMonth`. T05's P2002 trip-wire goes GREEN in its own atomic
 * commit alongside the try/catch mapping.
 */

import { describe, it, expect, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import {
  ConflictError,
  FISCAL_PERIOD_MONTH_EXISTS,
} from "@/features/shared/errors";
import { FiscalPeriodsService } from "../fiscal-periods.service";
import type { FiscalPeriodsRepository } from "../fiscal-periods.repository";
import type {
  CreateFiscalPeriodInput,
  FiscalPeriod,
} from "../fiscal-periods.types";

// ── Shared fixtures ────────────────────────────────────────────────────────

const ORG_ID = "org-1";

function buildFiscalPeriod(overrides: Partial<FiscalPeriod> = {}): FiscalPeriod {
  return {
    id: "fp-1",
    organizationId: ORG_ID,
    name: "Febrero 2026",
    year: 2026,
    month: 2,
    startDate: new Date(Date.UTC(2026, 1, 1)),
    endDate: new Date(Date.UTC(2026, 1, 28)),
    status: "OPEN",
    closedAt: null,
    closedBy: null,
    createdById: "user-1",
    createdAt: new Date(Date.UTC(2026, 1, 1)),
    updatedAt: new Date(Date.UTC(2026, 1, 1)),
    ...overrides,
  };
}

function baseInput(overrides: Partial<CreateFiscalPeriodInput> = {}): CreateFiscalPeriodInput {
  return {
    name: "Febrero 2026",
    year: 2026,
    startDate: new Date(Date.UTC(2026, 1, 1)),
    endDate: new Date(Date.UTC(2026, 1, 28)),
    createdById: "user-1",
    ...overrides,
  };
}

// The mock repository intentionally OMITS `findOpenPeriod`. Its absence is
// the structural guarantee for REQ-2 — if the service still references it,
// tests T02-T04 fail with "findOpenPeriod is not a function".
type RepoMock = Pick<
  FiscalPeriodsRepository,
  "findAll" | "findById" | "findByYear" | "create" | "updateStatus" | "countDraftEntries"
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
    updateStatus: vi.fn(),
    countDraftEntries: vi.fn(),
  };
}

// ── T02 — REQ-1 Scenario 1.1 / REQ-8 item 1 ────────────────────────────────

describe("FiscalPeriodsService.create — multiplicity (F-01)", () => {
  it("creates second period in same year", async () => {
    const repo = buildRepoMock();
    // A period for January already exists — findByYear would return it, but
    // the month-aware path should ignore year-level collisions.
    vi.mocked(repo.findByYear).mockResolvedValueOnce(
      buildFiscalPeriod({ id: "fp-jan", month: 1, name: "Enero 2026" }),
    );
    // February slot is free.
    repo.findByYearAndMonth.mockResolvedValueOnce(null);
    const created = buildFiscalPeriod({ id: "fp-feb", month: 2, name: "Febrero 2026" });
    vi.mocked(repo.create).mockResolvedValueOnce(created);

    const service = new FiscalPeriodsService(
      repo as unknown as FiscalPeriodsRepository,
    );

    const result = await service.create(ORG_ID, baseInput());

    expect(result).toEqual(created);
    expect(repo.findByYearAndMonth).toHaveBeenCalledWith(ORG_ID, 2026, 2);
  });

  // ── T03 — REQ-2 Scenario 2.1 / REQ-8 item 2 ─────────────────────────────

  it("creates period with another OPEN existing", async () => {
    const repo = buildRepoMock();
    // findByYear returns null — no year-level collision to mask the test.
    vi.mocked(repo.findByYear).mockResolvedValueOnce(null);
    // March slot is free (month-aware check passes).
    repo.findByYearAndMonth.mockResolvedValueOnce(null);
    const created = buildFiscalPeriod({ id: "fp-mar", month: 3, name: "Marzo 2026" });
    vi.mocked(repo.create).mockResolvedValueOnce(created);

    const service = new FiscalPeriodsService(
      repo as unknown as FiscalPeriodsRepository,
    );

    // The repo mock deliberately does NOT expose `findOpenPeriod`. If the
    // service still calls it, this test fails with "findOpenPeriod is not a
    // function" — the structural guarantee for REQ-2 retirement.
    const result = await service.create(
      ORG_ID,
      baseInput({
        name: "Marzo 2026",
        startDate: new Date(Date.UTC(2026, 2, 1)),
        endDate: new Date(Date.UTC(2026, 2, 31)),
      }),
    );

    expect(result).toEqual(created);
    expect(repo.findByYearAndMonth).toHaveBeenCalledWith(ORG_ID, 2026, 3);
  });
});
