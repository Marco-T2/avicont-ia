import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
import { ContactsService } from "@/features/contacts/server";
import { PayablesService } from "@/features/payables";
import { updatePayableSchema } from "@/features/payables";

const contactsService = new ContactsService();
const payablesService = new PayablesService(contactsService);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; payableId: string }> },
) {
  try {
    const { orgSlug, payableId } = await params;
    const { orgId } = await requirePermission("purchases", "read", orgSlug);

    const payable = await payablesService.getById(orgId, payableId);

    return Response.json(payable);
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; payableId: string }> },
) {
  try {
    const { orgSlug, payableId } = await params;
    const { orgId } = await requirePermission("purchases", "write", orgSlug);

    const body = await request.json();
    const input = updatePayableSchema.parse(body);

    const payable = await payablesService.update(orgId, payableId, input);

    return Response.json(payable);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; payableId: string }> },
) {
  try {
    const { orgSlug, payableId } = await params;
    const { orgId } = await requirePermission("purchases", "write", orgSlug);

    const payable = await payablesService.void(orgId, payableId);

    return Response.json(payable);
  } catch (error) {
    return handleError(error);
  }
}
