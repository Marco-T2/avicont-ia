/**
 * T18 [RED → GREEN] — /[orgSlug]/lots page (REQ-204, D-8).
 *
 * Server fetch via `makeLotService().list(orgId)` with the RBAC chain
 * mirrored EXACTLY from `/[orgSlug]/farms/page.tsx`
 * (requireAuth → requireOrgAccess → render). RBAC-EXCEPTION applies
 * — there is no "lots" Resource in the frozen permissions union
 * (Marco I.2/I.3 lock), same as the legacy farms page.
 *
 * Expected failure mode (RED): module under test does NOT exist
 * yet — `import LotsPage from "../page"` resolves to no file, vitest
 * fails with `Failed to load url ../page`. After T18 GREEN landing
 * the new page + client, all 3 cases pass.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

const {
  mockRedirect,
  mockRequireAuth,
  mockRequireOrgAccess,
  mockListLots,
  mockLotsPageClient,
} = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRequireAuth: vi.fn(),
  mockRequireOrgAccess: vi.fn(),
  mockListLots: vi.fn(),
  mockLotsPageClient: vi.fn(() => null),
}));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("@/features/shared", () => ({ requireAuth: mockRequireAuth }));

vi.mock("@/modules/organizations/presentation/server", () => ({
  requireOrgAccess: mockRequireOrgAccess,
}));

vi.mock("@/modules/lot/presentation/server", () => ({
  makeLotService: () => ({ list: mockListLots }),
}));

vi.mock("../lots-client", () => ({ default: mockLotsPageClient }));

import LotsPage from "../page";

const ORG_SLUG = "acme";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG });
}

interface PossibleElement {
  type?: unknown;
  props?: { children?: unknown; [k: string]: unknown };
}

function findElement(
  root: unknown,
  componentType: unknown,
): PossibleElement | null {
  if (!root || typeof root !== "object") return null;
  const el = root as PossibleElement;
  if (el.type === componentType) return el;
  const children = el.props?.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const found = findElement(child, componentType);
      if (found) return found;
    }
    return null;
  }
  return findElement(children, componentType);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/[orgSlug]/lots — RBAC chain + server fetch (REQ-204, D-8)", () => {
  it("redirects to /sign-in when requireAuth throws", async () => {
    mockRequireAuth.mockRejectedValue(new Error("unauth"));

    await LotsPage({ params: makeParams() });

    expect(mockRedirect).toHaveBeenCalledWith("/sign-in");
    expect(mockListLots).not.toHaveBeenCalled();
  });

  it("redirects to /select-org when requireOrgAccess throws", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user-1" });
    mockRequireOrgAccess.mockRejectedValue(new Error("no org"));

    await LotsPage({ params: makeParams() });

    expect(mockRedirect).toHaveBeenCalledWith("/select-org");
    expect(mockListLots).not.toHaveBeenCalled();
  });

  it("fetches lots via service.list(orgId) and renders client with snapshots", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user-1" });
    mockRequireOrgAccess.mockResolvedValue("org-1");
    const snapshot = {
      id: "l-1",
      name: "Lote Mayo",
      barnNumber: 1,
      initialCount: 5000,
      startDate: new Date("2026-05-01"),
      endDate: null,
      status: "ACTIVE" as const,
      farmName: "Capinota",
      memberId: "m-1",
      organizationId: "org-1",
      createdAt: new Date("2026-05-01"),
      updatedAt: new Date("2026-05-01"),
    };
    // LotService.list returns Lot[] (entities) — the page maps toSnapshot.
    mockListLots.mockResolvedValue([{ toSnapshot: () => snapshot }]);

    const tree = (await LotsPage({ params: makeParams() })) as ReactElement;

    expect(mockListLots).toHaveBeenCalledWith("org-1");
    const clientEl = findElement(tree, mockLotsPageClient);
    expect(clientEl).not.toBeNull();
    expect(clientEl?.props).toMatchObject({
      orgSlug: ORG_SLUG,
      lots: [snapshot],
    });
  });
});
