/**
 * /api/organizations/[orgSlug]/tags — list + create org-canonical tags.
 *
 * F5 / REQ-46 — API surface (paired sister: roles/route.ts).
 *   GET    200 { tags: Tag[] }     · 401/403
 *   POST   201 { tag: Tag }        · 400 (Zod) / 403 / 409 (slug collision)
 *
 * Permission gate (REQ-46):
 *   GET  → requirePermission("documents", "read",  orgSlug)
 *          documents:read is allowed for every system role, so the gate
 *          collapses to "any org member" as required.
 *   POST → requirePermission("documents", "write", orgSlug)
 *          documents:write is allowed for {owner, admin, contador}, which is
 *          exactly the set of roles that can upload documents to ANY scope
 *          per UPLOAD_SCOPES. Mirrors document upload RBAC per
 *          `[[paired_sister_default_no_surface]]`.
 *
 * Conflict mapping: PrismaTagsRepository.create lets the @@unique(orgId, slug)
 * P2002 surface; the route catches by code and rethrows as ConflictError so
 * the shared error serializer maps to HTTP 409 with the friendly Spanish copy
 * "Tag con ese nombre ya existe" (ConflictError appends "ya existe" to the
 * resource string passed to its constructor).
 */
import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import { makeTagsService } from "@/modules/tags/presentation/server";
import { ConflictError } from "@/features/shared/errors";
import { z } from "zod";

const service = makeTagsService();

const createTagSchema = z.object({
  name: z.string().min(1).max(80),
  color: z.string().max(32).optional(),
});

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { orgId } = await requirePermission("documents", "write", orgSlug);

    const body = await request.json();
    const input = createTagSchema.parse(body);

    try {
      const tag = await service.create(orgId, input.name, input.color);
      return Response.json({ tag }, { status: 201 });
    } catch (err) {
      // Prisma P2002 on @@unique(orgId, slug) — surface as 409 with friendly copy.
      if (
        err != null &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code?: string }).code === "P2002"
      ) {
        throw new ConflictError("Tag con ese nombre");
      }
      throw err;
    }
  } catch (error) {
    return handleError(error);
  }
}
