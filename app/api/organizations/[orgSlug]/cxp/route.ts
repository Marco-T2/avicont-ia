import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import {
  makePayablesService,
  attachContact,
  attachContacts,
} from "@/modules/payables/presentation/server";
import {
  createPayableSchema,
  payableFiltersSchema,
} from "@/modules/payables/presentation/validation";

const payablesService = makePayablesService();

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

    const items = await payablesService.list(orgId, filters);
    const payables = await attachContacts(orgId, items);

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

    const item = await payablesService.create(orgId, input);
    const payable = await attachContact(orgId, item);

    return Response.json(payable, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
