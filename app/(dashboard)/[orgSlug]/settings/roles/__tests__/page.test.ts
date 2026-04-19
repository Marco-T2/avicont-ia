/**
 * /settings/roles page — auth gate tests.
 *
 * Page requires accounting-config:read. On failure, redirect to org root.
 * PR7.5: page now lists roles via RolesService + renders RolesListClient.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRedirect, mockRequirePermission, mockListRoles } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockListRoles: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("@/features/shared/permissions.server", () => ({
  requirePermission: mockRequirePermission,
}));

// Mock RolesService — inject mockListRoles so we control what the page receives
vi.mock("@/features/organizations/server", () => {
  class RolesRepository {}
  class RolesService {
    listRoles = mockListRoles;
  }
  return { RolesRepository, RolesService };
});

// Mock the client component — server-rendering it in node env fails
vi.mock("@/components/settings/roles-list-client", () => ({
  default: vi.fn().mockReturnValue(null),
}));

import RolesPage from "../page";

const ORG_SLUG = "acme";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockListRoles.mockResolvedValue([]);
});

describe("/settings/roles — auth gate (PR7.5)", () => {
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

  it("calls listRoles with the resolved orgId", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-42", userId: "u-1" });

    await RolesPage({ params: makeParams() });

    expect(mockListRoles).toHaveBeenCalledWith("org-42");
  });
});
