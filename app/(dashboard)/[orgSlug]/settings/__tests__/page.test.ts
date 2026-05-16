/**
 * /settings page — C3 sidebar-reorg-settings-hub entry-gate broadening + per-card RBAC.
 *
 * Pre-C3 behavior (REQ-OP.8): hard gate via `requirePermission("accounting-config", "read")`.
 * Members of custom roles with `members:read` but no `accounting-config:read`
 * were locked out — even though their Miembros card would be the only one
 * visible.
 *
 * C3 behavior (this file's contract):
 * - No hard entry gate; resolve session + role + orgId via the same chain
 *   farms/page.tsx uses (requireAuth → requireOrgAccess → getMemberByClerkUserId).
 * - For each SettingsCard, evaluate `canAccess(role, card.resource, "read", orgId)`
 *   (cards without `resource` always pass).
 * - If `cards.length === 0` after filter → redirect to `/${orgSlug}`.
 * - Otherwise render only the allowed cards.
 *
 * The page is a Server Component — we do not render it, we inspect the
 * returned ReactElement tree to assert which cards reach the rendering loop.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockRedirect,
  mockRequireAuth,
  mockRequireOrgAccess,
  mockGetMemberByClerkUserId,
  mockMakeOrganizationsService,
  mockCanAccess,
} = vi.hoisted(() => {
  const mockGetMember = vi.fn();
  return {
    mockRedirect: vi.fn(),
    mockRequireAuth: vi.fn(),
    mockRequireOrgAccess: vi.fn(),
    mockGetMemberByClerkUserId: mockGetMember,
    mockMakeOrganizationsService: vi.fn(() => ({
      getMemberByClerkUserId: mockGetMember,
    })),
    mockCanAccess: vi.fn(),
  };
});

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("@/features/permissions/server", () => ({
  canAccess: mockCanAccess,
}));

vi.mock("@/features/shared", () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock("@/modules/organizations/presentation/server", () => ({
  requireOrgAccess: mockRequireOrgAccess,
  makeOrganizationsService: mockMakeOrganizationsService,
}));

import SettingsHubPage from "../page";

const ORG_SLUG = "acme";
const ORG_ID = "org-1";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ userId: "u1" });
  mockRequireOrgAccess.mockResolvedValue(ORG_ID);
  mockGetMemberByClerkUserId.mockResolvedValue({ role: "owner" });
});

/**
 * Walk the returned React tree and collect every `aria-label` prop value.
 * Each rendered card emits a Link with `aria-label={card.title}`.
 */
function collectLinkAriaLabels(node: unknown, acc: string[] = []): string[] {
  if (!node || typeof node !== "object") return acc;
  const el = node as {
    type?: unknown;
    props?: { children?: unknown; "aria-label"?: string };
  };
  if (el.props && typeof el.props["aria-label"] === "string") {
    acc.push(el.props["aria-label"]);
  }
  const children = el.props?.children;
  if (Array.isArray(children)) {
    for (const c of children) collectLinkAriaLabels(c, acc);
  } else if (children) {
    collectLinkAriaLabels(children, acc);
  }
  return acc;
}

describe("/settings — C3 per-card RBAC + entry-gate broadening", () => {
  it("admin with all permissions reaches hub; 10 cards rendered", async () => {
    mockGetMemberByClerkUserId.mockResolvedValue({ role: "admin" });
    mockCanAccess.mockResolvedValue(true);

    const tree = await SettingsHubPage({ params: makeParams() });
    expect(mockRedirect).not.toHaveBeenCalled();

    const labels = collectLinkAriaLabels(tree);
    expect(labels).toHaveLength(10);
    expect(labels).not.toContain("Cierre Mensual");
  });

  it("custom-role with ONLY members:read reaches hub (entry gate broadened)", async () => {
    mockGetMemberByClerkUserId.mockResolvedValue({ role: "custom" });
    mockCanAccess.mockImplementation(
      async (_role: string, resource: string) => resource === "members",
    );

    const tree = await SettingsHubPage({ params: makeParams() });
    expect(mockRedirect).not.toHaveBeenCalled();

    const labels = collectLinkAriaLabels(tree);
    // Both 'Miembros' (resource=members) and 'Roles y Permisos' (gated by
    // members per Avicont convention) are visible. No other card.
    expect(labels).toContain("Miembros");
    expect(labels).toContain("Roles y Permisos");
    expect(labels).not.toContain("Plan de Cuentas");
    expect(labels).not.toContain("Cierre Mensual");
    expect(labels).not.toContain("Auditoría");
  });

  it("zero-resource role redirects to /${orgSlug}", async () => {
    mockGetMemberByClerkUserId.mockResolvedValue({ role: "viewer" });
    mockCanAccess.mockResolvedValue(false);

    await SettingsHubPage({ params: makeParams() });
    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}`);
  });
});
