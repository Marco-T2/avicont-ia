/**
 * /api/organizations/[orgSlug]/roles/[roleSlug]
 *   — read / update / delete a single custom role (PR5.2).
 *
 * D.10 — API surface:
 *   GET    200 { role: CustomRole }             · 404 / 403
 *   PATCH  200 { role: CustomRole }             · 400 (Zod) / 403 (system / self-lock) / 404 / 422
 *   DELETE 200 { success: true }                · 403 / 404 / 409 (ROLE_HAS_MEMBERS)
 *
 * Permission gate:
 *   GET    → requirePermission("members","read",orgSlug)
 *   PATCH  → requirePermission("members","write",orgSlug)
 *   DELETE → requirePermission("members","write",orgSlug)
 *
 * Caller context (D.4 self-lock wiring):
 *   We pass { clerkUserId } into RolesService.updateRole / deleteRole. The
 *   service's injected `getCallerRoleSlug` resolves the caller's current role
 *   inside the org so the self-lock guard (CR.6 / D.4) can run end-to-end.
 *
 *   getCallerRoleSlug resolution strategy: we use the `role` field returned by
 *   `requirePermission` — it is the caller's current OrganizationMember.role
 *   resolved via the permission check itself. This avoids a second DB lookup.
 *
 *   Because the service singleton is constructed once per module-load, its
 *   `getCallerRoleSlug` closure cannot see per-request data. So we stash the
 *   caller's role slug against the clerkUserId+orgId pair for the duration of
 *   the request via a tiny WeakMap-free key-value store (Map<string, string>).
 *   It is per-process state used inside the same request; we clear the entry
 *   right after the service call completes.
 */
import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
import { RolesRepository, RolesService } from "@/features/organizations";
import { z } from "zod";

// ─── Caller-role cache for the service's DI hook ────────────────────────────
//
// Key: `${orgId}::${clerkUserId}` · Value: role slug · Lifetime: the duration
// of a single request (set before the service call, deleted after).
const callerRoleSlugByPair = new Map<string, string>();

function pairKey(orgId: string, clerkUserId: string): string {
  return `${orgId}::${clerkUserId}`;
}

const service = new RolesService({
  repo: new RolesRepository(),
  getCallerRoleSlug: async (orgId, caller) => {
    return callerRoleSlugByPair.get(pairKey(orgId, caller.clerkUserId)) ?? null;
  },
});

// ─── Zod schema (D.5: slug immutable on UPDATE — reject via .strict()) ─────
const patchRoleSchema = z
  .object({
    name: z.string().min(1).max(64).optional(),
    description: z.string().nullable().optional(),
    permissionsRead: z.array(z.string()).optional(),
    permissionsWrite: z.array(z.string()).optional(),
    canPost: z.array(z.string()).optional(),
  })
  .strict();

// ─── GET ────────────────────────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; roleSlug: string }> },
) {
  try {
    const { orgSlug, roleSlug } = await params;
    const { orgId } = await requirePermission("members", "read", orgSlug);

    const role = await service.getRole(orgId, roleSlug);
    return Response.json({ role });
  } catch (error) {
    return handleError(error);
  }
}

// ─── PATCH ──────────────────────────────────────────────────────────────────

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; roleSlug: string }> },
) {
  try {
    const { orgSlug, roleSlug } = await params;
    const { session, orgId, role: callerRole } = await requirePermission(
      "members",
      "write",
      orgSlug,
    );

    const body = await request.json();
    const input = patchRoleSchema.parse(body);

    const key = pairKey(orgId, session.userId);
    callerRoleSlugByPair.set(key, callerRole);
    try {
      const role = await service.updateRole(orgId, roleSlug, input, {
        clerkUserId: session.userId,
      });
      return Response.json({ role });
    } finally {
      callerRoleSlugByPair.delete(key);
    }
  } catch (error) {
    return handleError(error);
  }
}

// ─── DELETE ─────────────────────────────────────────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; roleSlug: string }> },
) {
  try {
    const { orgSlug, roleSlug } = await params;
    const { session, orgId, role: callerRole } = await requirePermission(
      "members",
      "write",
      orgSlug,
    );

    const key = pairKey(orgId, session.userId);
    callerRoleSlugByPair.set(key, callerRole);
    try {
      await service.deleteRole(orgId, roleSlug, {
        clerkUserId: session.userId,
      });
      return Response.json({ success: true });
    } finally {
      callerRoleSlugByPair.delete(key);
    }
  } catch (error) {
    return handleError(error);
  }
}
