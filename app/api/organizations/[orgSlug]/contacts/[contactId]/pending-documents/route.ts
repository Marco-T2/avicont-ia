import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
import { ContactsService } from "@/features/contacts";

const service = new ContactsService();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; contactId: string }> },
) {
  try {
    const { orgSlug, contactId } = await params;
    const { orgId } = await requirePermission("contacts", "read", orgSlug);

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as "receivable" | "payable";

    if (!type || !["receivable", "payable"].includes(type)) {
      return Response.json(
        { error: "Tipo inválido. Use ?type=receivable o ?type=payable" },
        { status: 400 },
      );
    }

    const documents = await service.getPendingDocuments(orgId, contactId, type);

    return Response.json({ documents });
  } catch (error) {
    return handleError(error);
  }
}
