/**
 * PR4 4.1 RED — requirePermission(resource, action, orgSlug) (REQ-P.3 / REQ-P.4 / D.2)
 *
 * Scope: single server-side gate used by ALL org route handlers.
 *   - Resolves session via Clerk
 *   - Resolves orgId via org-membership check
 *   - Fails fast with ForbiddenError (403) when role is not in matrix for (resource, action)
 *   - Returns { session, orgId, role } so downstream services can pass role to canPost / canAccess
 *
 * The guard never embeds POST_ALLOWED_ROLES. W-draft (auxiliar posting sales) is
 * enforced at service layer by canPost — NOT here. This matches design D.3.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../middleware", () => ({
  requireAuth: vi.fn(),
  requireOrgAccess: vi.fn(),
  requireRole: vi.fn(),
}));

import { requirePermission } from "../permissions.server";
import {
  requireAuth,
  requireOrgAccess,
  requireRole,
} from "../middleware";
import { ForbiddenError } from "../errors";

const mockedRequireAuth = vi.mocked(requireAuth);
const mockedRequireOrgAccess = vi.mocked(requireOrgAccess);
const mockedRequireRole = vi.mocked(requireRole);

const ORG_SLUG = "acme";
const ORG_ID = "org_acme";
const CLERK_USER = "user_1";

function mockSessionAndOrg(userId = CLERK_USER, orgId = ORG_ID) {
  mockedRequireAuth.mockResolvedValue({ userId } as never);
  mockedRequireOrgAccess.mockResolvedValue(orgId);
}

describe("requirePermission (REQ-P.3 / REQ-P.4 / D.2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("S-P3-S1 — cobrador → journal/write → 403", () => {
    it("throws ForbiddenError when role not in PERMISSIONS_WRITE[journal]", async () => {
      mockSessionAndOrg();
      mockedRequireRole.mockRejectedValue(new ForbiddenError());

      await expect(
        requirePermission("journal", "write", ORG_SLUG),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("passes allowedRoles for journal/write to requireRole", async () => {
      mockSessionAndOrg();
      mockedRequireRole.mockRejectedValue(new ForbiddenError());

      try {
        await requirePermission("journal", "write", ORG_SLUG);
      } catch {
        // expected
      }

      const call = mockedRequireRole.mock.calls.at(-1);
      expect(call).toBeDefined();
      const [, , roles] = call!;
      // journal write allowed: owner | admin | contador  (NOT cobrador)
      expect(roles).toEqual(
        expect.arrayContaining(["owner", "admin", "contador"]),
      );
      expect(roles).not.toContain("cobrador");
      expect(roles).not.toContain("auxiliar");
      expect(roles).not.toContain("member");
    });
  });

  describe("S-P3-S2 — contador → sales/read → pass", () => {
    it("returns { session, orgId, role } when role is in PERMISSIONS_READ[sales]", async () => {
      mockSessionAndOrg();
      mockedRequireRole.mockResolvedValue({
        id: "m1",
        role: "contador",
      } as never);

      const result = await requirePermission("sales", "read", ORG_SLUG);

      expect(result.orgId).toBe(ORG_ID);
      expect(result.session.userId).toBe(CLERK_USER);
      expect(result.role).toBe("contador");
    });

    it("passes read allowedRoles (includes cobrador for sales.read)", async () => {
      mockSessionAndOrg();
      mockedRequireRole.mockResolvedValue({
        id: "m1",
        role: "contador",
      } as never);

      await requirePermission("sales", "read", ORG_SLUG);

      const [, , roles] = mockedRequireRole.mock.calls.at(-1)!;
      // sales read: owner | admin | contador | cobrador
      expect(roles).toEqual(
        expect.arrayContaining(["owner", "admin", "contador", "cobrador"]),
      );
      expect(roles).not.toContain("auxiliar");
    });
  });

  describe("S-P3-S3 — auxiliar → sales/write → pass (W-draft at route level)", () => {
    it("returns role=auxiliar when matrix allows sales.write", async () => {
      mockSessionAndOrg();
      mockedRequireRole.mockResolvedValue({
        id: "m1",
        role: "auxiliar",
      } as never);

      const result = await requirePermission("sales", "write", ORG_SLUG);

      expect(result.role).toBe("auxiliar");
    });

    it("passes write allowedRoles (includes auxiliar for sales.write — W-draft)", async () => {
      mockSessionAndOrg();
      mockedRequireRole.mockResolvedValue({
        id: "m1",
        role: "auxiliar",
      } as never);

      await requirePermission("sales", "write", ORG_SLUG);

      const [, , roles] = mockedRequireRole.mock.calls.at(-1)!;
      // sales write (W-draft): owner | admin | contador | auxiliar
      expect(roles).toEqual(
        expect.arrayContaining([
          "owner",
          "admin",
          "contador",
          "auxiliar",
        ]),
      );
      expect(roles).not.toContain("cobrador");
    });
  });

  describe("read vs write — matrix dimension separation (REQ-P.2)", () => {
    it("reports uses read allowedRoles (cobrador can read reports)", async () => {
      mockSessionAndOrg();
      mockedRequireRole.mockResolvedValue({
        id: "m1",
        role: "cobrador",
      } as never);

      await requirePermission("reports", "read", ORG_SLUG);

      const [, , roles] = mockedRequireRole.mock.calls.at(-1)!;
      expect(roles).toContain("cobrador");
    });

    it("reports write rejects cobrador (reports.write = owner | admin only)", async () => {
      mockSessionAndOrg();
      mockedRequireRole.mockRejectedValue(new ForbiddenError());

      await expect(
        requirePermission("reports", "write", ORG_SLUG),
      ).rejects.toBeInstanceOf(ForbiddenError);

      const [, , roles] = mockedRequireRole.mock.calls.at(-1)!;
      expect(roles).not.toContain("cobrador");
      expect(roles).not.toContain("contador");
    });
  });

  // ── Gap-closure: REQ-P.3-S2 write pass complement ──────────────────────────
  describe("S-P3-S2-write — contador → sales/write → pass (REQ-P.3-S2)", () => {
    it("returns { session, orgId, role } when role is in PERMISSIONS_WRITE[sales]", async () => {
      mockSessionAndOrg();
      mockedRequireRole.mockResolvedValue({
        id: "m1",
        role: "contador",
      } as never);

      const result = await requirePermission("sales", "write", ORG_SLUG);

      expect(result.orgId).toBe(ORG_ID);
      expect(result.session.userId).toBe(CLERK_USER);
      expect(result.role).toBe("contador");
    });

    it("passes write allowedRoles that include contador for sales.write", async () => {
      mockSessionAndOrg();
      mockedRequireRole.mockResolvedValue({
        id: "m1",
        role: "contador",
      } as never);

      await requirePermission("sales", "write", ORG_SLUG);

      const [, , roles] = mockedRequireRole.mock.calls.at(-1)!;
      expect(roles).toEqual(
        expect.arrayContaining(["owner", "admin", "contador"]),
      );
      // cobrador cannot write sales
      expect(roles).not.toContain("cobrador");
    });
  });
});
