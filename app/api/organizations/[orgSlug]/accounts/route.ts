import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
import { AccountsService } from "@/features/accounting/server";
import { createAccountSchema } from "@/features/accounting/accounting.validation";
import { AccountSubtype } from "@/generated/prisma/client";

const service = new AccountsService();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { orgId } = await requirePermission("accounting-config", "read", orgSlug);

    const { searchParams } = new URL(request.url);
    const tree = searchParams.get("tree") === "true";
    const type = searchParams.get("type") as import("@/generated/prisma/client").AccountType | null;
    const subtypeParam = searchParams.get("subtype");
    const isDetail = searchParams.get("isDetail");
    const isActive = searchParams.get("isActive");

    // Validar el subtype query param contra los valores del enum — ignorar si inválido (per spec account-listing)
    const subtypeValues = Object.values(AccountSubtype) as string[];
    const subtype = subtypeParam && subtypeValues.includes(subtypeParam)
      ? (subtypeParam as AccountSubtype)
      : undefined;

    const accounts = tree
      ? await service.getTree(orgId)
      : await service.list(orgId, {
          ...(type ? { type } : {}),
          ...(subtype ? { subtype } : {}),
          ...(isDetail !== null ? { isDetail: isDetail === "true" } : {}),
          ...(isActive !== null ? { isActive: isActive === "true" } : {}),
        });

    return Response.json(accounts);
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
    const { orgId } = await requirePermission("accounting-config", "write", orgSlug);

    const body = await request.json();
    const input = createAccountSchema.parse(body);

    const account = await service.create(orgId, input);

    return Response.json(account, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
