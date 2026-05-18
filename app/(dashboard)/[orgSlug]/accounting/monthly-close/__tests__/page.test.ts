/**
 * /accounting/monthly-close page — rbac gate tests + REQ-2b redirect-on-no-period tests.
 *
 * Page requires period:read. On RBAC failure → redirect to /${orgSlug}.
 * PR2 migration: replaces requireAuth+requireOrgAccess+requireRole triple chain.
 *
 * REQ-2b transition (annual-close atomicity per page.tsx:15-25):
 *   The page used to render a combobox letting the user pick any period; that
 *   risked manually closing December and breaking annual-close atomicity
 *   (annual-close.service.ts:491-559 — Dec must lock inside the same tx as
 *   CC + auto-periods + CA). Page now redirects to /${orgSlug}/settings/periods
 *   when no valid OPEN periodId is provided.
 *
 * (a) RBAC ok + valid OPEN periodId → panel called with selectedPeriod snapshot
 * (b) RBAC ok + unknown/missing periodId → redirect to /${orgSlug}/settings/periods
 *     (panel NOT called)
 *
 * Note on `mockRedirect`: real Next.js `redirect()` throws an internal
 * NEXT_REDIRECT error to abort the render. `beforeEach` installs that throw
 * globally so every test mirrors production semantics — the SUT redirect at
 * page.tsx:45 (no valid OPEN period) is OUTSIDE a try/catch and relies on
 * the throw to short-circuit before touching `period.id`. Tests exercising
 * either redirect branch wrap the call in `await expect(...).rejects`.
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

vi.mock("@/features/permissions/server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/modules/fiscal-periods/presentation/server", () => ({
  makeFiscalPeriodsService: vi.fn(() => ({ list: mockList })),
}));

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

const OPEN_PERIOD_SNAPSHOT = {
  id: "p-01",
  organizationId: "org-1",
  name: "Enero 2026",
  year: 2026,
  month: 1,
  startDate: new Date("2026-01-01"),
  endDate: new Date("2026-01-31"),
  status: "OPEN" as const,
  closedAt: null,
  closedBy: null,
  createdById: "user-1",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};
const OPEN_PERIOD = { toSnapshot: () => OPEN_PERIOD_SNAPSHOT };

beforeEach(() => {
  vi.clearAllMocks();
  mockList.mockResolvedValue([]);
  mockMonthlyClosePanel.mockReturnValue(null);
  // Mirror real Next.js redirect() semantics: throws NEXT_REDIRECT to abort
  // render. SUT relies on this to short-circuit before touching `period.id`.
  mockRedirect.mockImplementation(() => {
    throw new Error("NEXT_REDIRECT");
  });
});

describe("/accounting/monthly-close — rbac gate", () => {
  it("renders when requirePermission resolves AND a valid OPEN period is provided", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });
    mockList.mockResolvedValue([OPEN_PERIOD]);

    await MonthlyClosePage({
      params: makeParams(),
      searchParams: makeSearchParams({ periodId: "p-01" }),
    });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      "period",
      "read",
      ORG_SLUG,
    );
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to org root when requirePermission throws", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));

    await expect(
      MonthlyClosePage({ params: makeParams(), searchParams: makeSearchParams() }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}`);
  });
});

describe("/accounting/monthly-close — REQ-2 ?periodId pre-selection", () => {
  it("REQ-2a — valid OPEN periodId → panel receives selectedPeriod snapshot", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });
    mockList.mockResolvedValue([OPEN_PERIOD]);

    const jsx = await MonthlyClosePage({
      params: makeParams(),
      searchParams: makeSearchParams({ periodId: "p-01" }),
    });

    const children = (jsx as React.ReactElement<{ children: React.ReactNode[] }>).props.children;
    const childrenArray = (Array.isArray(children) ? children : [children]) as React.ReactNode[];
    const panelElement = childrenArray.find(
      (child) => React.isValidElement(child) && (child as React.ReactElement).type === mockMonthlyClosePanel,
    ) as React.ReactElement<{ selectedPeriod?: { id: string; status: string } }> | undefined;

    expect(panelElement).toBeDefined();
    expect(panelElement?.props?.selectedPeriod).toMatchObject({
      id: "p-01",
      status: "OPEN",
    });
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("REQ-2b — unknown periodId → redirects to /${orgSlug}/settings/periods (panel NOT rendered)", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });
    mockList.mockResolvedValue([OPEN_PERIOD]);

    await expect(
      MonthlyClosePage({
        params: makeParams(),
        searchParams: makeSearchParams({ periodId: "unknown" }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}/settings/periods`);
    expect(mockMonthlyClosePanel).not.toHaveBeenCalled();
  });

  it("REQ-2c — no periodId → redirects to /${orgSlug}/settings/periods", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });
    mockList.mockResolvedValue([OPEN_PERIOD]);

    await expect(
      MonthlyClosePage({
        params: makeParams(),
        searchParams: makeSearchParams({}),
      }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}/settings/periods`);
  });
});
