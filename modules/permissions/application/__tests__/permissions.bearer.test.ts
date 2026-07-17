/**
 * Fase B (app móvil): el gate `requirePermission` debe autorizar las requests
 * Bearer SIN org activa (caso F2: el móvil manda el orgSlug por URL y su JWT no
 * trae org_id) derivando la org del slug + membership (requireOrgAccess), sin
 * pasar por el lazy-sync `ensure` (que necesita el clerkOrgId de la sesión).
 *
 * El flujo web queda intacto: con org activa corre `ensure`; sin org activa y
 * sin Bearer (cookie web sin org) sigue dando 403.
 *
 * Mockeamos toda la cadena pesada con stubs estáticos (espejo de
 * permissions.smoke.test.ts) para no cargar Prisma ni el SDK de Clerk.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRequireAuth, mockEnsure, mockRequireOrgAccess, mockRequireRole } =
  vi.hoisted(() => ({
    mockRequireAuth: vi.fn(),
    mockEnsure: vi.fn(async () => ({ orgId: "ignored" })),
    mockRequireOrgAccess: vi.fn(async () => "org-db-1"),
    mockRequireRole: vi.fn(async () => ({ role: "owner" })),
  }));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

vi.mock("@/modules/shared/presentation/middleware", () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock("@/modules/organizations/presentation/server", () => ({
  requireOrgAccess: mockRequireOrgAccess,
  requireRole: mockRequireRole,
}));

vi.mock("@/modules/organizations/presentation/composition-root", () => ({
  makeEnsureFromClerkService: () => ({ ensure: mockEnsure }),
}));

vi.mock("@/modules/permissions/infrastructure/permissions.cache", () => ({
  ensureOrgSeeded: vi.fn(async () => ({ roles: new Map() })),
  getMatrix: vi.fn(async () => ({ roles: new Map() })),
}));

import { requirePermission } from "../permissions.server";
import { ForbiddenError } from "@/modules/shared/domain/errors";

beforeEach(() => {
  vi.clearAllMocks();
  mockEnsure.mockResolvedValue({ orgId: "ignored" });
  mockRequireOrgAccess.mockResolvedValue("org-db-1");
  mockRequireRole.mockResolvedValue({ role: "owner" });
});

describe("requirePermission — request Bearer sin org activa (app móvil)", () => {
  beforeEach(() => {
    mockRequireAuth.mockResolvedValue({
      userId: "u-mobile",
      orgId: null,
      viaBearer: true,
    });
  });

  it("NO corre el lazy-sync ensure (no hay clerkOrgId en el token)", async () => {
    await requirePermission("dispatches", "write", "mi-org");
    expect(mockEnsure).not.toHaveBeenCalled();
  });

  it("autoriza por orgSlug de la URL + membership (requireOrgAccess)", async () => {
    const result = await requirePermission("dispatches", "write", "mi-org");
    expect(mockRequireOrgAccess).toHaveBeenCalledWith("u-mobile", "mi-org");
    expect(result.orgId).toBe("org-db-1");
  });
});

describe("requirePermission — flujo web intacto", () => {
  it("con org activa corre el lazy-sync ensure (cookie web)", async () => {
    mockRequireAuth.mockResolvedValue({
      userId: "u-web",
      orgId: "clerk-org-1",
      viaBearer: false,
    });

    await requirePermission("dispatches", "write", "mi-org");

    expect(mockEnsure).toHaveBeenCalledWith("clerk-org-1", "u-web");
    expect(mockRequireOrgAccess).toHaveBeenCalledWith("u-web", "mi-org");
  });

  it("cookie web SIN org activa sigue dando 403 (comportamiento original)", async () => {
    mockRequireAuth.mockResolvedValue({
      userId: "u-web",
      orgId: null,
      viaBearer: false,
    });

    await expect(
      requirePermission("dispatches", "write", "mi-org"),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(mockEnsure).not.toHaveBeenCalled();
    expect(mockRequireOrgAccess).not.toHaveBeenCalled();
  });
});
