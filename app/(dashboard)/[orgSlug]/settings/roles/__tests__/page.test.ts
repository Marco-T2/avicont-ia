/**
 * /settings/roles page — auth gate tests.
 *
 * Page is read-only; requires accounting-config:read. On failure, redirect
 * to the org root (authenticated user without permission, NOT sign-in).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRedirect, mockRequirePermission } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRequirePermission: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("@/features/shared/permissions.server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/components/settings/roles-permissions-matrix", () => ({
  RolesPermissionsMatrix: vi.fn().mockReturnValue(null),
}));

import RolesPage from "../page";

const ORG_SLUG = "acme";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/settings/roles — auth gate", () => {
  it("allows render when requirePermission resolves", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-1", userId: "u-1" });

    await RolesPage({ params: makeParams() });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      "accounting-config",
      "read",
      ORG_SLUG,
    );
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to org root when requirePermission throws", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));

    await RolesPage({ params: makeParams() });

    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}`);
  });
});
