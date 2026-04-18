import { requireAuth, handleError } from "@/features/shared/middleware";
import { OrganizationsService } from "@/features/organizations/organizations.service";

const service = new OrganizationsService();

export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const { clerkOrgId, name, slug } = body;

    if (!clerkOrgId || !name) {
      return Response.json(
        { error: "Faltan campos requeridos" },
        { status: 400 },
      );
    }

    const { organization, created } = await service.syncOrganization(
      { clerkOrgId, name, slug },
      userId,
    );

    return Response.json({
      success: true,
      organization,
      created,
      message: created
        ? "Organización creada exitosamente"
        : "La organización ya existe",
    });
  } catch (error) {
    return handleError(error);
  }
}
