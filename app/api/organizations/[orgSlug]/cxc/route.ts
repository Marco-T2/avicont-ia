import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import {
  makeReceivablesService,
  attachContact,
  attachContacts,
} from "@/modules/receivables/presentation/server";
import {
  createReceivableSchema,
  receivableFiltersSchema,
} from "@/features/receivables";

const receivablesService = makeReceivablesService();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { orgId } = await requirePermission("sales", "read", orgSlug);

    const { searchParams } = new URL(request.url);
    const filters = receivableFiltersSchema.parse({
      contactId: searchParams.get("contactId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      dueDateFrom: searchParams.get("dueDateFrom") ?? undefined,
      dueDateTo: searchParams.get("dueDateTo") ?? undefined,
    });

    const items = await receivablesService.list(orgId, filters);
    const receivables = await attachContacts(orgId, items);

    return Response.json(receivables);
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
    const { orgId } = await requirePermission("sales", "write", orgSlug);

    const body = await request.json();
    const input = createReceivableSchema.parse(body);

    const item = await receivablesService.create(orgId, input);
    const receivable = await attachContact(orgId, item);

    return Response.json(receivable, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
