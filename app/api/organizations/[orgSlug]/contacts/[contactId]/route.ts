import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
import { ContactsService } from "@/features/contacts/server";
import { updateContactSchema } from "@/features/contacts";

const service = new ContactsService();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; contactId: string }> },
) {
  try {
    const { orgSlug, contactId } = await params;
    const { orgId } = await requirePermission("contacts", "read", orgSlug);

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
    const { orgSlug, contactId } = await params;
    const { orgId } = await requirePermission("contacts", "write", orgSlug);

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
    const { orgSlug, contactId } = await params;
    const { orgId } = await requirePermission("contacts", "write", orgSlug);

    const contact = await service.deactivate(orgId, contactId);

    return Response.json(contact);
  } catch (error) {
    return handleError(error);
  }
}
