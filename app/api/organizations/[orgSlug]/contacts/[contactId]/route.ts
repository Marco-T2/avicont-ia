import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import {
  ContactsService,
  updateContactSchema,
} from "@/features/contacts";

const service = new ContactsService();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; contactId: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug, contactId } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin", "contador"]);

    const contact = await service.getById(orgId, contactId);

    return Response.json(contact);
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; contactId: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug, contactId } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin", "contador"]);

    const body = await request.json();
    const input = updateContactSchema.parse(body);

    const contact = await service.update(orgId, contactId, input);

    return Response.json(contact);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; contactId: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug, contactId } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin", "contador"]);

    const contact = await service.deactivate(orgId, contactId);

    return Response.json(contact);
  } catch (error) {
    return handleError(error);
  }
}
