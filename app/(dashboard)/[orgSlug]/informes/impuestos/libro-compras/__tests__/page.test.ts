/**
 * /informes/impuestos/libro-compras page — rbac gate tests.
 *
 * Page requires reports:read. On failure, redirect to /${orgSlug}.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRedirect, mockRequirePermission, mockList } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockList: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("@/features/shared/permissions.server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/features/fiscal-periods", () => {
  class FiscalPeriodsService {
    list = mockList;
  }
  return { FiscalPeriodsService };
});

vi.mock("@/components/iva-books/iva-books-page-client", () => ({
  IvaBooksPageClient: vi.fn().mockReturnValue(null),
}));

import LibroComprasPage from "../page";

const ORG_SLUG = "acme";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockList.mockResolvedValue([]);
});

describe("/informes/impuestos/libro-compras — rbac gate", () => {
  it("renders when requirePermission resolves", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });

    await LibroComprasPage({ params: makeParams() });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      "reports",
      "read",
      ORG_SLUG,
    );
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to org root when requirePermission throws", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));

    await LibroComprasPage({ params: makeParams() });

    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}`);
  });
});
