import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
import {
  ContactsService,
  createContactSchema,
  contactFiltersSchema,
} from "@/features/contacts";

const service = new ContactsService();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { orgId } = await requirePermission("contacts", "read", orgSlug);

    const { searchParams } = new URL(request.url);
    const rawFilters = {
      type: searchParams.get("type") ?? undefined,
      isActive:
        searchParams.has("isActive")
          ? searchParams.get("isActive") === "true"
          : undefined,
      search: searchParams.get("search") ?? undefined,
    };
    const filters = contactFiltersSchema.parse(rawFilters);

    const contacts = await service.list(orgId, filters);

    return Response.json({ contacts });
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
    const { orgId } = await requirePermission("contacts", "write", orgSlug);

    const body = await request.json();
    const input = createContactSchema.parse(body);

    const contact = await service.create(orgId, input);

    return Response.json(contact, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
