/**
 * Phase 7.5 RED — periods page server-side data shape: year-grouped.
 *
 * Asserts the periods page now:
 *  - calls `requirePermission('period', 'read', orgSlug)` (preserved)
 *  - fetches FiscalPeriod[] from fiscalPeriodsService.list(orgId)
 *  - fetches FiscalYear[] via the annual-close service (or per-year getSummary)
 *  - groups periods by year + attaches the matching fiscalYear + summary
 *  - passes periodsByYear to AnnualPeriodList (NOT the flat PeriodList)
 *
 * RED expected failure mode: the current `page.tsx` (HEAD 0776133a) imports
 * `PeriodList` (flat) and does NOT call annual-close service. Mocks below
 * intercept the new presentation/server module — `vi.mock` for the annual-
 * close server module must exist BEFORE the page imports it. Test FAILS
 * because the page does NOT yet import or call the annual-close service.
 *
 * Source of truth: orchestrator prompt 'Update server page' + design rev 2
 * section 8 (server-side YearGroup shape).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.setConfig({ testTimeout: 15000 });

const {
  mockRedirect,
  mockRequirePermission,
  mockList,
  mockGetSummary,
  mockGetFiscalYearByYear,
  mockAnnualPeriodList,
  mockMakeAnnualCloseService,
} = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockList: vi.fn(),
  mockGetSummary: vi.fn(),
  mockGetFiscalYearByYear: vi.fn(),
  mockAnnualPeriodList: vi.fn().mockReturnValue(null),
  mockMakeAnnualCloseService: vi.fn(() => ({
    getSummary: mockGetSummary,
    getFiscalYearByYear: mockGetFiscalYearByYear,
  })),
}));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("@/features/permissions/server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/modules/fiscal-periods/presentation/server", () => ({
  makeFiscalPeriodsService: vi.fn(() => ({ list: mockList })),
}));

vi.mock("@/modules/annual-close/presentation/server", () => ({
  makeAnnualCloseService: mockMakeAnnualCloseService,
}));

vi.mock("@/components/accounting/annual-period-list", () => ({
  __esModule: true,
  default: (props: unknown) => {
    mockAnnualPeriodList(props);
    return null;
  },
}));

// Keep stale PeriodList mock too — page must NOT import it anymore.
vi.mock("@/components/accounting/period-list", () => ({
  __esModule: true,
  default: vi.fn().mockReturnValue(null),
}));

import PeriodsPage from "../page";

const ORG_SLUG = "acme";
const ORG_ID = "org-1";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG });
}

function buildPeriod(year: number, month: number, status: "OPEN" | "CLOSED") {
  return {
    id: `p-${year}-${String(month).padStart(2, "0")}`,
    organizationId: ORG_ID,
    name: `M${month} ${year}`,
    year,
    month,
    startDate: new Date(`${year}-${String(month).padStart(2, "0")}-01`),
    endDate: new Date(`${year}-${String(month).padStart(2, "0")}-28`),
    status,
    closedAt: status === "CLOSED" ? new Date() : null,
    closedBy: status === "CLOSED" ? "user-1" : null,
    createdById: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequirePermission.mockResolvedValue({ orgId: ORG_ID });

  // Fixture: 2 years of periods — 2026 (4 closed, 8 open) + 2025 (12 closed).
  const periods2026 = Array.from({ length: 12 }, (_, i) =>
    buildPeriod(2026, i + 1, i < 4 ? "CLOSED" : "OPEN"),
  );
  const periods2025 = Array.from({ length: 12 }, (_, i) =>
    buildPeriod(2025, i + 1, "CLOSED"),
  );
  mockList.mockResolvedValue(
    [...periods2026, ...periods2025].map((p) => ({
      toSnapshot: () => p,
    })),
  );

  mockGetSummary.mockResolvedValue({
    year: 2026,
    fiscalYearStatus: "OPEN",
    periods: { closed: 4, open: 8, total: 12 },
    decemberStatus: "OPEN",
    ccExists: false,
    gateAllowed: false,
    gateReason: "Quedan 8 mes(es) sin cerrar antes de poder cerrar la gestión.",
    balance: { debit: "100000.00", credit: "100000.00", balanced: true },
  });

  mockGetFiscalYearByYear.mockImplementation(
    (_orgId: string, year: number) => {
      if (year === 2025) {
        return Promise.resolve({
          id: "fy-2025",
          organizationId: ORG_ID,
          year: 2025,
          status: "CLOSED",
          closedAt: new Date("2026-01-15"),
          closedBy: "user-1",
          closingEntryId: "je-cc-2025",
          openingEntryId: "je-ca-2026",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      return Promise.resolve({
        id: `fy-${year}`,
        organizationId: ORG_ID,
        year,
        status: "OPEN",
        closedAt: null,
        closedBy: null,
        closingEntryId: null,
        openingEntryId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    },
  );
});

describe("/settings/periods — Phase 7.5 server-side year grouping", () => {
  it("preserves RBAC: requirePermission('period','read', orgSlug)", async () => {
    await PeriodsPage({ params: makeParams() });
    expect(mockRequirePermission).toHaveBeenCalledWith(
      "period",
      "read",
      ORG_SLUG,
    );
  });

  it("fetches periods AND annual-close summary per year, then passes periodsByYear to AnnualPeriodList", async () => {
    await PeriodsPage({ params: makeParams() });

    // Period reader called once for the org.
    expect(mockList).toHaveBeenCalledWith(ORG_ID);

    // Annual-close service factory was called.
    expect(mockMakeAnnualCloseService).toHaveBeenCalled();

    // AnnualPeriodList received the orgSlug + periodsByYear.
    expect(mockAnnualPeriodList).toHaveBeenCalled();
    const props = mockAnnualPeriodList.mock.calls[0][0] as {
      orgSlug: string;
      periodsByYear: Array<{ year: number; periods: unknown[] }>;
    };
    expect(props.orgSlug).toBe(ORG_SLUG);
    expect(props.periodsByYear).toBeDefined();

    const years = props.periodsByYear.map((g) => g.year).sort((a, b) => b - a);
    expect(years).toEqual([2026, 2025]);

    const y2026 = props.periodsByYear.find((g) => g.year === 2026)!;
    expect(y2026.periods.length).toBe(12);

    const y2025 = props.periodsByYear.find((g) => g.year === 2025)!;
    expect(y2025.periods.length).toBe(12);
  });

  it("calls getSummary for OPEN years and attaches result to YearGroup.summary", async () => {
    await PeriodsPage({ params: makeParams() });

    // 2026 OPEN → getSummary(orgId, 2026) called.
    expect(mockGetSummary).toHaveBeenCalledWith(ORG_ID, 2026);

    const props = mockAnnualPeriodList.mock.calls[0][0] as {
      periodsByYear: Array<{
        year: number;
        summary: { gateReason?: string } | null;
      }>;
    };
    const y2026 = props.periodsByYear.find((g) => g.year === 2026)!;
    expect(y2026.summary).not.toBeNull();
    expect(y2026.summary!.gateReason).toMatch(/Quedan 8 mes/);
  });

  it("attaches FiscalYear snapshot to YearGroup.fiscalYear (status, closedAt, etc.)", async () => {
    await PeriodsPage({ params: makeParams() });

    const props = mockAnnualPeriodList.mock.calls[0][0] as {
      periodsByYear: Array<{
        year: number;
        fiscalYear: { id: string; status: string } | null;
      }>;
    };
    const y2025 = props.periodsByYear.find((g) => g.year === 2025)!;
    expect(y2025.fiscalYear).not.toBeNull();
    expect(y2025.fiscalYear!.status).toBe("CLOSED");
  });

  it("redirects to org root when requirePermission throws", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));
    await PeriodsPage({ params: makeParams() });
    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}`);
  });
});
