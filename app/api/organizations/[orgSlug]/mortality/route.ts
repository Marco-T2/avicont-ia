import { requireAuth, handleError } from "@/features/shared/middleware";
import { requireOrgAccess } from "@/modules/organizations/presentation/server";
import { UsersService } from "@/features/users/server";
import {
  makeMortalityService,
  logMortalitySchema,
} from "@/modules/mortality/presentation/server";

const usersService = new UsersService();
const service = makeMortalityService();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { userId: clerkUserId } = await requireAuth();
    const { orgSlug } = await params;
    const orgId = await requireOrgAccess(clerkUserId, orgSlug);

    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get("lotId");

    if (!lotId) {
      return Response.json(
        { error: "El parámetro lotId es requerido" },
        { status: 400 },
      );
    }

    const logs = await service.listByLot(orgId, lotId);

    return Response.json(logs.map((e) => e.toJSON()));
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { userId: clerkUserId } = await requireAuth();
    const { orgSlug } = await params;
    const orgId = await requireOrgAccess(clerkUserId, orgSlug);

    const body = await request.json();
    const input = logMortalitySchema.parse(body);

    const user = await usersService.resolveByClerkId(clerkUserId);

    const log = await service.log(orgId, {
      ...input,
      createdById: user.id,
    });

    return Response.json(log.toJSON(), { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
