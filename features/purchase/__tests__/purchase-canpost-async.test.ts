/**
 * PR3.2 RED — canPost async matrix lookup for PurchaseService (REQ-P.6 / D.7)
 *
 * Tests:
 * (a) Custom role `facturador` with `canPost` including 'purchases' → posting allowed
 * (b) `cobrador` with no 'purchases' in canPost → ForbiddenError (403)
 * (c) `getMatrix` called exactly once per post operation (no extra DB calls)
 * (d) Loader injection via _setLoader test hook (no real DB)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { OrgMatrix } from "@/features/shared/permissions.cache";
import { _setLoader, _resetCache } from "@/features/shared/permissions.cache";
import {
  ForbiddenError,
  POST_NOT_ALLOWED_FOR_ROLE,
} from "@/features/shared/errors";
import type { Resource, PostableResource } from "@/features/shared/permissions";

// ──────────────────────────────────────────────────────────────────────────────
// Loader helpers
// ──────────────────────────────────────────────────────────────────────────────

function makeMatrix(
  orgId: string,
  rolesWithCanPost: string[],
): OrgMatrix {
  const roles = new Map<
    string,
    {
      permissionsRead: Set<Resource>;
      permissionsWrite: Set<Resource>;
      canPost: Set<PostableResource>;
      isSystem: boolean;
    }
  >();

  for (const slug of rolesWithCanPost) {
    roles.set(slug, {
      permissionsRead: new Set(),
      permissionsWrite: new Set(),
      canPost: new Set(["purchases"] as PostableResource[]),
      isSystem: false,
    });
  }

  // cobrador is always present but WITHOUT canPost for purchases
  if (!rolesWithCanPost.includes("cobrador")) {
    roles.set("cobrador", {
      permissionsRead: new Set(),
      permissionsWrite: new Set(),
      canPost: new Set(),
      isSystem: true,
    });
  }

  return { orgId, roles, loadedAt: Date.now() };
}

const ORG = "org_beta";

beforeEach(() => {
  _resetCache();
});

afterEach(() => {
  _resetCache();
});

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

describe("PurchaseService.createAndPost — async canPost (PR3.2 / P.6-S1 / P.6-S2)", () => {
  describe("(d) loader injection via _setLoader", () => {
    it("uses the injected loader — no real DB required", async () => {
      const loader = vi.fn().mockResolvedValue(makeMatrix(ORG, ["facturador"]));
      _setLoader(loader);

      const { PurchaseService } = await import("@/features/purchase/purchase.service");
      const service = new PurchaseService();

      // facturador has canPost for purchases → should NOT throw POST_NOT_ALLOWED_FOR_ROLE.
      const result = service.createAndPost(ORG, {} as never, {
        userId: "u1",
        role: "facturador",
      });

      await expect(result).rejects.not.toMatchObject({
        code: POST_NOT_ALLOWED_FOR_ROLE,
        statusCode: 403,
      });
    });
  });

  describe("(a) P.6-S1 — facturador with canPost=true in matrix → posting allowed", () => {
    it("does not throw ForbiddenError(POST_NOT_ALLOWED_FOR_ROLE) for facturador", async () => {
      _setLoader(
        vi.fn().mockResolvedValue(makeMatrix(ORG, ["facturador"])),
      );

      const { PurchaseService } = await import("@/features/purchase/purchase.service");
      const service = new PurchaseService();

      const result = service.createAndPost(ORG, {} as never, {
        userId: "u1",
        role: "facturador",
      });

      // Should NOT be blocked at the canPost guard
      await expect(result).rejects.not.toMatchObject({
        code: POST_NOT_ALLOWED_FOR_ROLE,
        statusCode: 403,
      });
    });
  });

  describe("(b) P.6-S2 — cobrador with no purchases in canPost → 403 ForbiddenError", () => {
    it("throws ForbiddenError(POST_NOT_ALLOWED_FOR_ROLE) for cobrador", async () => {
      // cobrador present in matrix but NOT in canPost for purchases
      _setLoader(
        vi.fn().mockResolvedValue(makeMatrix(ORG, ["facturador"])),
      );

      const { PurchaseService } = await import("@/features/purchase/purchase.service");
      const service = new PurchaseService();

      await expect(
        service.createAndPost(ORG, {} as never, {
          userId: "u1",
          role: "cobrador",
        }),
      ).rejects.toMatchObject({
        code: POST_NOT_ALLOWED_FOR_ROLE,
        statusCode: 403,
      });
    });

    it("throws ForbiddenError for unknown custom role with no canPost entry", async () => {
      _setLoader(
        vi.fn().mockResolvedValue(makeMatrix(ORG, ["facturador"])),
      );

      const { PurchaseService } = await import("@/features/purchase/purchase.service");
      const service = new PurchaseService();

      await expect(
        service.createAndPost(ORG, {} as never, {
          userId: "u1",
          role: "custom_no_post",
        }),
      ).rejects.toMatchObject({
        code: POST_NOT_ALLOWED_FOR_ROLE,
        statusCode: 403,
      });
    });
  });

  describe("(c) getMatrix called exactly once per post operation", () => {
    it("calls loader exactly once for a single createAndPost call", async () => {
      const loader = vi.fn().mockResolvedValue(makeMatrix(ORG, ["facturador"]));
      _setLoader(loader);

      const { PurchaseService } = await import("@/features/purchase/purchase.service");
      const service = new PurchaseService();

      // facturador passes canPost, then service proceeds and will fail on DB ops
      await service
        .createAndPost(ORG, {} as never, {
          userId: "u1",
          role: "facturador",
        })
        .catch(() => {
          // Expected — fails at DB level, not at canPost guard
        });

      // The loader (backing getMatrix) was called exactly once
      expect(loader).toHaveBeenCalledTimes(1);
      expect(loader).toHaveBeenCalledWith(ORG);
    });

    it("calls loader once for cobrador (throws at guard, no second DB call)", async () => {
      const loader = vi.fn().mockResolvedValue(makeMatrix(ORG, []));
      _setLoader(loader);

      const { PurchaseService } = await import("@/features/purchase/purchase.service");
      const service = new PurchaseService();

      await service
        .createAndPost(ORG, {} as never, {
          userId: "u1",
          role: "cobrador",
        })
        .catch(() => {
          // Expected ForbiddenError
        });

      expect(loader).toHaveBeenCalledTimes(1);
    });
  });
});
