/**
 * /api/organizations/[orgSlug]/tags — list org-canonical tags.
 *
 * F5 / REQ-46 — API surface (paired sister: roles/route.ts).
 *   GET 200 { tags: Tag[] }  · 401/403
 *
 * Permission gate (REQ-46):
 *   GET → requirePermission("documents", "read", orgSlug)
 *         documents:read is allowed for every system role, so the gate
 *         collapses to "any org member" as required by the spec.
 *
 * POST is added in the next cycle (Commit B).
 */
import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import { makeTagsService } from "@/modules/tags/presentation/server";

const service = makeTagsService();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { orgId } = await requirePermission("documents", "read", orgSlug);

    const tags = await service.list(orgId);
    return Response.json({ tags });
  } catch (error) {
    return handleError(error);
  }
}
