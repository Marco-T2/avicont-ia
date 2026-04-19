import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
import { ContactsService } from "@/features/contacts/server";
import { PayablesService } from "@/features/payables/server";
import {
  createPayableSchema,
  payableFiltersSchema,
} from "@/features/payables";

const contactsService = new ContactsService();
const payablesService = new PayablesService(contactsService);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { orgId } = await requirePermission("purchases", "read", orgSlug);

    const { searchParams } = new URL(request.url);
    const filters = payableFiltersSchema.parse({
      contactId: searchParams.get("contactId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      dueDateFrom: searchParams.get("dueDateFrom") ?? undefined,
      dueDateTo: searchParams.get("dueDateTo") ?? undefined,
    });

    const payables = await payablesService.list(orgId, filters);

    return Response.json(payables);
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
    const { orgId } = await requirePermission("purchases", "write", orgSlug);

    const body = await request.json();
    const input = createPayableSchema.parse(body);

    const payable = await payablesService.create(orgId, input);

    return Response.json(payable, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
