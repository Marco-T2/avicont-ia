import { requireAuth, handleError } from "@/features/shared/middleware";
import { DocumentsService } from "@/features/documents/documents.service";
import {
  createDocumentSchema,
  listDocumentsSchema,
} from "@/features/documents/documents.validation";

const service = new DocumentsService();

export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const formData = await request.formData();
    const name = formData.get("name") as string;
    const content = formData.get("content") as string;
    const clerkOrgId = formData.get("organizationId") as string;
    const file = formData.get("file") as File;
    const scope = (formData.get("scope") as string) || undefined;

    // Validar campos requeridos
    createDocumentSchema.parse({ name, organizationId: clerkOrgId });

    const result = await service.upload(
      clerkOrgId,
      userId,
      name,
      content || null,
      file && file.size > 0 ? file : null,
      scope as "ORGANIZATION" | "ACCOUNTING" | "FARM" | undefined,
    );

    return Response.json({
      success: true,
      message: "Documento subido exitosamente",
      document: result,
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();

    const { searchParams } = new URL(request.url);
    const clerkOrgId = searchParams.get("organizationId");

    // Validar parámetros de consulta
    const { organizationId } = listDocumentsSchema.parse({
      organizationId: clerkOrgId,
    });

    const result = await service.list(organizationId, userId);

    return Response.json(result);
  } catch (error) {
    return handleError(error);
  }
}
