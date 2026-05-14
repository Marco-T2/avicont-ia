/**
 * REQ-OP.9 — RSC page test for /settings/company (CompanyProfilePage).
 *
 * Integration-style: mocks requirePermission, OrgProfileService,
 * DocumentSignatureConfigService, and the client component.
 *
 * Scenarios:
 *   1. Happy path — permission granted → page renders, services are called.
 *   2. RBAC path  — requirePermission throws → redirect called with /<orgSlug>.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRedirect, mockRequirePermission, mockGetOrCreate, mockListAll } =
  vi.hoisted(() => ({
    mockRedirect: vi.fn(),
    mockRequirePermission: vi.fn(),
    mockGetOrCreate: vi.fn(),
    mockListAll: vi.fn(),
  }));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("@/features/permissions/server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/modules/org-profile/presentation/server", () => ({
  makeOrgProfileService: () => ({ getOrCreate: mockGetOrCreate }),
}));

vi.mock("@/modules/document-signature-config/presentation/server", () => ({
  makeDocumentSignatureConfigService: vi.fn().mockImplementation(() => ({
    listAll: mockListAll,
  })),
}));

vi.mock(
  "@/components/settings/company/company-profile-form",
  () => ({
    CompanyProfileForm: vi.fn().mockReturnValue(null),
  }),
);

import CompanyProfilePage from "../page";

const ORG_SLUG = "acme";
const ORG_ID = "org-acme-id";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG });
}

function makeProfile() {
  return {
    id: "p-1",
    organizationId: ORG_ID,
    razonSocial: "Empresa Acme",
    nit: "12345",
    direccion: "Calle 1",
    ciudad: "Sucre",
    telefono: "70000000",
    nroPatronal: null,
    logoUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeViews() {
  return [];
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetOrCreate.mockResolvedValue(makeProfile());
  mockListAll.mockResolvedValue(makeViews());
});

describe("/settings/company — CompanyProfilePage (REQ-OP.9)", () => {
  it("renders when requirePermission resolves — calls both services with orgId", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: ORG_ID });

    await CompanyProfilePage({ params: makeParams() });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      "accounting-config",
      "write",
      ORG_SLUG,
    );
    expect(mockGetOrCreate).toHaveBeenCalledWith(ORG_ID);
    expect(mockListAll).toHaveBeenCalledWith(ORG_ID);
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to org root when requirePermission throws (RBAC gate)", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));

    await CompanyProfilePage({ params: makeParams() });

    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}`);
  });
});
