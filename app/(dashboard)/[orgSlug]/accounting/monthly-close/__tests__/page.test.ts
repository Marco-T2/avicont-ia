/**
 * /accounting/monthly-close page — rbac gate tests + REQ-2 pre-selection tests.
 *
 * Page requires period:read. On failure, redirect to /${orgSlug}.
 * PR2 migration: replaces requireAuth+requireOrgAccess+requireRole triple chain.
 *
 * REQ-2 additions:
 * (a) searchParams.periodId matching an OPEN period → panel called with preselectedPeriodId
 * (b) searchParams.periodId not matching any period → panel called with preselectedPeriodId: undefined
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRedirect, mockRequirePermission, mockList, mockMonthlyClosePanel } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockList: vi.fn(),
  mockMonthlyClosePanel: vi.fn().mockReturnValue(null),
}));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("@/features/shared/permissions.server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/features/fiscal-periods/server", () => {
  class FiscalPeriodsService {
    list = mockList;
  }
  return { FiscalPeriodsService };
});

vi.mock("@/components/accounting/monthly-close-panel", () => ({
  MonthlyClosePanel: mockMonthlyClosePanel,
}));

import MonthlyClosePage from "../page";

const ORG_SLUG = "acme";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG });
}

function makeSearchParams(params: Record<string, string> = {}) {
  return Promise.resolve(params);
}

const OPEN_PERIOD = {
  id: "p-01",
  organizationId: "org-1",
  name: "Enero 2026",
  year: 2026,
  month: 1,
  startDate: new Date("2026-01-01"),
  endDate: new Date("2026-01-31"),
  status: "OPEN",
  closedAt: null,
  closedBy: null,
  createdById: "user-1",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockList.mockResolvedValue([]);
  mockMonthlyClosePanel.mockReturnValue(null);
});

describe("/accounting/monthly-close — rbac gate", () => {
  it("renders when requirePermission resolves", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });

    await MonthlyClosePage({ params: makeParams(), searchParams: makeSearchParams() });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      "period",
      "read",
      ORG_SLUG,
    );
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to org root when requirePermission throws", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));

    await MonthlyClosePage({ params: makeParams(), searchParams: makeSearchParams() });

    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}`);
  });
});

describe("/accounting/monthly-close — REQ-2 ?periodId pre-selection", () => {
  it("REQ-2a — valid OPEN periodId passed → JSX includes preselectedPeriodId: 'p-01'", async () => {
    // RED: page.tsx does not yet read searchParams, so panel JSX won't have preselectedPeriodId
    // Expected RED failure: jsx.props.children's MonthlyClosePanel element has no preselectedPeriodId
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });
    mockList.mockResolvedValue([OPEN_PERIOD]);

    const jsx = await MonthlyClosePage({
      params: makeParams(),
      searchParams: makeSearchParams({ periodId: "p-01" }),
    });

    // Find the MonthlyClosePanel element in the returned JSX tree
    // The page returns <div className="space-y-6">...<MonthlyClosePanel ...></div>
    // We inspect JSX props directly without rendering (Server Component test pattern)
    const children = (jsx as React.ReactElement<{ children: React.ReactNode[] }>).props.children;
    const childrenArray = Array.isArray(children) ? children : [children];
    const panelElement = childrenArray.find(
      (child: React.ReactElement) => child?.type === mockMonthlyClosePanel,
    ) as React.ReactElement<{ preselectedPeriodId?: string }> | undefined;

    expect(panelElement).toBeDefined();
    expect(panelElement?.props?.preselectedPeriodId).toBe("p-01");
  });

  it("REQ-2b — unknown periodId → JSX has preselectedPeriodId: undefined", async () => {
    // RED: page.tsx does not yet validate the id — passes undefined or raw value
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });
    mockList.mockResolvedValue([OPEN_PERIOD]);

    const jsx = await MonthlyClosePage({
      params: makeParams(),
      searchParams: makeSearchParams({ periodId: "unknown" }),
    });

    const children = (jsx as React.ReactElement<{ children: React.ReactNode[] }>).props.children;
    const childrenArray = Array.isArray(children) ? children : [children];
    const panelElement = childrenArray.find(
      (child: React.ReactElement) => child?.type === mockMonthlyClosePanel,
    ) as React.ReactElement<{ preselectedPeriodId?: string }> | undefined;

    expect(panelElement).toBeDefined();
    expect(panelElement?.props?.preselectedPeriodId).toBeUndefined();
  });
});
