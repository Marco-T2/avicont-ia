/**
 * PR3.3 RED — canPost async matrix lookup for JournalService (REQ-P.6 / D.7)
 *
 * This file closes the design D.7 misread gap: journal.service.ts uses
 * canPost exactly like sale.service.ts and purchase.service.ts, so it must
 * be migrated to the async matrix-backed check too.
 *
 * Tests:
 * (a) Custom role `custom_asentador` with `canPost` including 'journal' → allowed
 *     This case REQUIRES the async path — the slug is NOT in POST_ALLOWED_ROLES.
 * (b) `cobrador` (no 'journal' in canPost) → ForbiddenError(POST_NOT_ALLOWED_FOR_ROLE)
 * (c) `getMatrix` called exactly once per createAndPost invocation
 * (d) Loader injection via _setLoader (no real DB dependency)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { OrgMatrix } from "@/features/permissions/server";
import { _setLoader, _resetCache } from "@/features/permissions/server";
import { POST_NOT_ALLOWED_FOR_ROLE } from "@/features/shared/errors";
import type { Resource, PostableResource } from "@/features/permissions";

// ──────────────────────────────────────────────────────────────────────────────
// Loader helpers
// ──────────────────────────────────────────────────────────────────────────────

function makeMatrix(orgId: string, rolesWithJournalCanPost: string[]): OrgMatrix {
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

  for (const slug of rolesWithJournalCanPost) {
    roles.set(slug, {
      permissionsRead: new Set(),
      permissionsWrite: new Set(),
      canPost: new Set(["journal"] as PostableResource[]),
      canClose: new Set(),
      canReopen: new Set(),
      isSystem: false,
    });
  }

  // cobrador is always present but WITHOUT canPost for journal
  if (!rolesWithJournalCanPost.includes("cobrador")) {
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

const ORG = "org_journal_async";

beforeEach(() => {
  _resetCache();
});

afterEach(() => {
  _resetCache();
});

describe("JournalService.createAndPost — async canPost (PR3.3 / P.6-S1 / P.6-S2)", () => {
  describe("(d) loader injection via _setLoader", () => {
    it("uses the injected loader — no real DB required", async () => {
      const loader = vi
        .fn()
        .mockResolvedValue(makeMatrix(ORG, ["custom_asentador"]));
      _setLoader(loader);

      const { JournalService } = await import(
        "@/features/accounting/journal.service"
      );
      const service = new JournalService();

      // custom_asentador is NOT in POST_ALLOWED_ROLES.journal (sync map),
      // so this test REQUIRES the async matrix path to pass the guard.
      const result = service.createAndPost(ORG, {} as never, {
        userId: "u1",
        role: "custom_asentador",
      });

      // Should NOT be blocked at the canPost guard (may fail at DB layer).
      await expect(result).rejects.not.toMatchObject({
        code: POST_NOT_ALLOWED_FOR_ROLE,
        statusCode: 403,
      });
    });
  });

  describe("(a) P.6-S1 — custom role with canPost=true in matrix → posting allowed", () => {
    it("does not throw ForbiddenError(POST_NOT_ALLOWED_FOR_ROLE) for a custom slug that is NOT in POST_ALLOWED_ROLES", async () => {
      // `custom_asentador` is intentionally a slug that the STATIC map does
      // not include. Only an async matrix lookup against an org matrix that
      // grants canPost=['journal'] to this slug can let this test pass.
      _setLoader(
        vi.fn().mockResolvedValue(makeMatrix(ORG, ["custom_asentador"])),
      );

      const { JournalService } = await import(
        "@/features/accounting/journal.service"
      );
      const service = new JournalService();

      const result = service.createAndPost(ORG, {} as never, {
        userId: "u1",
        role: "custom_asentador",
      });

      await expect(result).rejects.not.toMatchObject({
        code: POST_NOT_ALLOWED_FOR_ROLE,
        statusCode: 403,
      });
    });
  });

  describe("(b) P.6-S2 — cobrador with no journal in canPost → 403 ForbiddenError", () => {
    it("throws ForbiddenError(POST_NOT_ALLOWED_FOR_ROLE) for cobrador", async () => {
      // Matrix has custom_asentador allowed, cobrador present but no canPost.
      _setLoader(
        vi.fn().mockResolvedValue(makeMatrix(ORG, ["custom_asentador"])),
      );

      const { JournalService } = await import(
        "@/features/accounting/journal.service"
      );
      const service = new JournalService();

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

    it("throws ForbiddenError for an unknown custom role with no canPost entry", async () => {
      _setLoader(
        vi.fn().mockResolvedValue(makeMatrix(ORG, ["custom_asentador"])),
      );

      const { JournalService } = await import(
        "@/features/accounting/journal.service"
      );
      const service = new JournalService();

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
    it("calls loader exactly once for a single createAndPost call (custom_asentador)", async () => {
      const loader = vi
        .fn()
        .mockResolvedValue(makeMatrix(ORG, ["custom_asentador"]));
      _setLoader(loader);

      const { JournalService } = await import(
        "@/features/accounting/journal.service"
      );
      const service = new JournalService();

      // custom_asentador passes the async guard, then the service proceeds and
      // will fail later on missing collaborators (period / voucher type / etc.)
      await service
        .createAndPost(ORG, {} as never, {
          userId: "u1",
          role: "custom_asentador",
        })
        .catch(() => {
          // Expected — fails at DB/service level, not at canPost guard.
        });

      expect(loader).toHaveBeenCalledTimes(1);
      expect(loader).toHaveBeenCalledWith(ORG);
    });

    it("calls loader once for cobrador (throws at guard, no second DB call)", async () => {
      const loader = vi.fn().mockResolvedValue(makeMatrix(ORG, []));
      _setLoader(loader);

      const { JournalService } = await import(
        "@/features/accounting/journal.service"
      );
      const service = new JournalService();

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
