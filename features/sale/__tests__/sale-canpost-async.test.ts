/**
 * PR3.1 RED — canPost async matrix lookup for SaleService (REQ-P.6 / D.7)
 *
 * Tests:
 * (a) Custom role `facturador` with `canPost` including 'sales' → posting allowed
 * (b) `cobrador` with no 'sales' in canPost → ForbiddenError (403)
 * (c) `getMatrix` called exactly once per post operation (no extra DB calls)
 * (d) Loader injection via _setLoader test hook (no real DB)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { OrgMatrix } from "@/features/shared/permissions.cache";
import { _setLoader, _resetCache } from "@/features/shared/permissions.cache";
import { POST_NOT_ALLOWED_FOR_ROLE } from "@/features/shared/errors";
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
      canClose: Set<Resource>;
      canReopen: Set<Resource>;
      isSystem: boolean;
    }
  >();

  for (const slug of rolesWithCanPost) {
    roles.set(slug, {
      permissionsRead: new Set(),
      permissionsWrite: new Set(),
      canPost: new Set(["sales"] as PostableResource[]),
      canClose: new Set(),
      canReopen: new Set(),
      isSystem: false,
    });
  }

  // cobrador is always present but WITHOUT canPost for sales
  if (!rolesWithCanPost.includes("cobrador")) {
    roles.set("cobrador", {
      permissionsRead: new Set(),
      permissionsWrite: new Set(),
      canPost: new Set(),
      canClose: new Set(),
      canReopen: new Set(),
      isSystem: true,
    });
  }

  return { orgId, roles, loadedAt: Date.now() };
}

const ORG = "org_alpha";

beforeEach(() => {
  _resetCache();
});

afterEach(() => {
  _resetCache();
});

// ──────────────────────────────────────────────────────────────────────────────
// Import service AFTER setting up loader so cache module is ready
// ──────────────────────────────────────────────────────────────────────────────

describe("SaleService.createAndPost — async canPost (PR3.1 / P.6-S1 / P.6-S2)", () => {
  describe("(d) loader injection via _setLoader", () => {
    it("uses the injected loader — no real DB required", async () => {
      const loader = vi.fn().mockResolvedValue(makeMatrix(ORG, ["facturador"]));
      _setLoader(loader);

      // Importing here to pick up the reset cache state
      const { SaleService } = await import("@/features/sale/sale.service");
      const service = new SaleService();

      // facturador has canPost for sales → should NOT throw ForbiddenError.
      // It WILL throw something else (missing contact etc.) — we just need it to
      // pass the canPost guard, i.e. NOT throw ForbiddenError with POST_NOT_ALLOWED_FOR_ROLE.
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

      const { SaleService } = await import("@/features/sale/sale.service");
      const service = new SaleService();

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

  describe("(b) P.6-S2 — cobrador with no sales in canPost → 403 ForbiddenError", () => {
    it("throws ForbiddenError(POST_NOT_ALLOWED_FOR_ROLE) for cobrador", async () => {
      // cobrador present in matrix but NOT in canPost for sales
      _setLoader(
        vi.fn().mockResolvedValue(makeMatrix(ORG, ["facturador"])),
      );

      const { SaleService } = await import("@/features/sale/sale.service");
      const service = new SaleService();

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
      // Matrix only has facturador — unknown role not present
      _setLoader(
        vi.fn().mockResolvedValue(makeMatrix(ORG, ["facturador"])),
      );

      const { SaleService } = await import("@/features/sale/sale.service");
      const service = new SaleService();

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

      const { SaleService } = await import("@/features/sale/sale.service");
      const service = new SaleService();

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

      const { SaleService } = await import("@/features/sale/sale.service");
      const service = new SaleService();

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
