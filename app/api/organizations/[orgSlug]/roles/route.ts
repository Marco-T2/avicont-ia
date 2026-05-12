/**
 * /api/organizations/[orgSlug]/roles — list + create custom roles.
 *
 * D.10 — API surface (PR5.1)
 *   GET    200 { roles: CustomRole[] }              · 401/403
 *   POST   201 { role: CustomRole }                 · 400 (Zod) / 403 / 409 / 422
 *
 * Permission gate:
 *   GET  → requirePermission("members","read",orgSlug)
 *   POST → requirePermission("members","write",orgSlug)
 *
 * Caller context (D.4 self-lock wiring):
 *   createRole does NOT strip members.write from the caller (self-lock only
 *   matters on UPDATE of the caller's own role), so we still pass a caller
 *   context through for consistency with the service signature.
 */
import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import { makeRolesService } from "@/modules/organizations/presentation/server";
import { z } from "zod";

const service = makeRolesService(async () => null);

const createRoleSchema = z.object({
  name: z.string().min(1).max(64),
  templateSlug: z.string().min(1),
  description: z.string().optional(),
  slug: z.string().min(1).optional(),
  permissionsRead: z.array(z.string()).optional(),
  permissionsWrite: z.array(z.string()).optional(),
  canPost: z.array(z.string()).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { orgId } = await requirePermission("members", "read", orgSlug);

    const roles = await service.listRoles(orgId);
    return Response.json({ roles });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { session, orgId } = await requirePermission(
      "members",
      "write",
      orgSlug,
    );

    const body = await request.json();
    const input = createRoleSchema.parse(body);

    const role = await service.createRole(orgId, input, {
      clerkUserId: session.userId,
    });

    return Response.json({ role }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
