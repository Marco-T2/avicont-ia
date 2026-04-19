import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
import { ContactsService } from "@/features/contacts/server";
import { ReceivablesService } from "@/features/receivables";
import {
  createReceivableSchema,
  receivableFiltersSchema,
} from "@/features/receivables";

const contactsService = new ContactsService();
const receivablesService = new ReceivablesService(contactsService);

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

    const receivables = await receivablesService.list(orgId, filters);

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

    const receivable = await receivablesService.create(orgId, input);

    return Response.json(receivable, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
