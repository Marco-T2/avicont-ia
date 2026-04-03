import {
  requireAuth,
  requireOrgAccess,
  handleError,
} from "@/features/shared/middleware";
import { MortalityService, logMortalitySchema } from "@/features/mortality";
import { prisma } from "@/lib/prisma";

const service = new MortalityService();

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

    return Response.json(logs);
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

    const user = await prisma.user.findUniqueOrThrow({
      where: { clerkUserId },
      select: { id: true },
    });

    const log = await service.log(orgId, {
      ...input,
      createdById: user.id,
    });

    return Response.json(log, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
