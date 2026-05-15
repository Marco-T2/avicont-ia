/**
 * /[orgSlug]/accounting — dual-view hub page.
 *
 * Pro view (DashboardProClient) when canAccess('reports','read') is true;
 * Light view (DashboardLight) otherwise. Redirects to /sign-in on unauth
 * and /select-org on org-access failure.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

const {
  mockRedirect,
  mockRequireAuth,
  mockRequireOrgAccess,
  mockGetMember,
  mockCanAccess,
  mockDashboardLoad,
  mockJournalsList,
  mockDashboardProClient,
  mockDashboardLight,
} = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRequireAuth: vi.fn(),
  mockRequireOrgAccess: vi.fn(),
  mockGetMember: vi.fn(),
  mockCanAccess: vi.fn(),
  mockDashboardLoad: vi.fn(),
  mockJournalsList: vi.fn(),
  mockDashboardProClient: vi.fn(() => null),
  mockDashboardLight: vi.fn(async () => null),
}));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("@/features/shared", () => ({ requireAuth: mockRequireAuth }));

vi.mock("@/modules/organizations/presentation/server", () => ({
  requireOrgAccess: mockRequireOrgAccess,
  makeOrganizationsService: () => ({
    getMemberByClerkUserId: mockGetMember,
  }),
}));

vi.mock("@/features/permissions/server", () => ({
  canAccess: mockCanAccess,
}));

vi.mock("@/modules/accounting/presentation/server", () => ({
  makeAccountingDashboardService: () => ({ load: mockDashboardLoad }),
  makeJournalsService: () => ({ list: mockJournalsList }),
}));

vi.mock("@/components/accounting/dashboard-pro-client", () => ({
  DashboardProClient: mockDashboardProClient,
}));

vi.mock("@/components/accounting/dashboard-light", () => ({
  DashboardLight: mockDashboardLight,
}));

import AccountingPage from "../page";

const ORG_SLUG = "acme";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/[orgSlug]/accounting — dual-view gate", () => {
  it("redirects to /sign-in when requireAuth throws", async () => {
    mockRequireAuth.mockRejectedValue(new Error("unauth"));

    await AccountingPage({ params: makeParams() });

    expect(mockRedirect).toHaveBeenCalledWith("/sign-in");
    expect(mockDashboardLoad).not.toHaveBeenCalled();
    expect(mockJournalsList).not.toHaveBeenCalled();
  });

  it("redirects to /select-org when requireOrgAccess throws", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user-1" });
    mockRequireOrgAccess.mockRejectedValue(new Error("no org"));

    await AccountingPage({ params: makeParams() });

    expect(mockRedirect).toHaveBeenCalledWith("/select-org");
    expect(mockDashboardLoad).not.toHaveBeenCalled();
  });

  it("loads dashboard data and renders pro view when reports:read is granted", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user-1" });
    mockRequireOrgAccess.mockResolvedValue("org-1");
    mockGetMember.mockResolvedValue({ role: "contador" });
    mockCanAccess.mockImplementation(
      async (_role: string, resource: string) => resource === "reports",
    );
    mockDashboardLoad.mockResolvedValue({
      kpi: {
        totalEntries: 1,
        lastEntryDate: null,
        currentPeriod: null,
        activoTotal: "0.00",
        pasivoTotal: "0.00",
        patrimonioTotal: "0.00",
      },
      topAccounts: [],
      monthlyTrend: [],
      closeStatus: null,
    });

    await AccountingPage({ params: makeParams() });

    expect(mockCanAccess).toHaveBeenCalledWith("contador", "reports", "read", "org-1");
    expect(mockDashboardLoad).toHaveBeenCalledWith("org-1");
    expect(mockJournalsList).not.toHaveBeenCalled();
    expect(mockDashboardProClient).toHaveBeenCalled();
    expect(mockDashboardLight).not.toHaveBeenCalled();
  });

  it("renders light view without invoking dashboard service when reports:read is denied", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user-1" });
    mockRequireOrgAccess.mockResolvedValue("org-1");
    mockGetMember.mockResolvedValue({ role: "viewer" });
    mockCanAccess.mockResolvedValue(false);
    mockJournalsList.mockResolvedValue([
      { date: new Date("2026-05-10T00:00:00Z") },
    ]);

    await AccountingPage({ params: makeParams() });

    expect(mockDashboardLoad).not.toHaveBeenCalled();
    expect(mockJournalsList).toHaveBeenCalledWith("org-1");
    expect(mockDashboardLight).toHaveBeenCalled();
    expect(mockDashboardProClient).not.toHaveBeenCalled();

    const [props] = mockDashboardLight.mock.calls[0];
    expect(props).toMatchObject({
      orgSlug: ORG_SLUG,
      orgId: "org-1",
      role: "viewer",
      totalEntries: 1,
      lastEntryDate: "2026-05-10",
    });
  });
});

// Silence "React is unused" if the import lingers in dev-warning scans.
void React;
