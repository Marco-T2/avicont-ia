import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
import { ContactsService } from "@/features/contacts/server";
import { ReceivablesService } from "@/features/receivables/server";
import { updateReceivableSchema } from "@/features/receivables";

const contactsService = new ContactsService();
const receivablesService = new ReceivablesService(contactsService);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; receivableId: string }> },
) {
  try {
    const { orgSlug, receivableId } = await params;
    const { orgId } = await requirePermission("sales", "read", orgSlug);

    const receivable = await receivablesService.getById(orgId, receivableId);

    return Response.json(receivable);
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; receivableId: string }> },
) {
  try {
    const { orgSlug, receivableId } = await params;
    const { orgId } = await requirePermission("sales", "write", orgSlug);

    const body = await request.json();
    const input = updateReceivableSchema.parse(body);

    const receivable = await receivablesService.update(orgId, receivableId, input);

    return Response.json(receivable);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; receivableId: string }> },
) {
  try {
    const { orgSlug, receivableId } = await params;
    const { orgId } = await requirePermission("sales", "write", orgSlug);

    const receivable = await receivablesService.void(orgId, receivableId);

    return Response.json(receivable);
  } catch (error) {
    return handleError(error);
  }
}
