import { requireAuth, handleError } from "@/features/shared/middleware";
import {
  makeDocumentsService,
  createDocumentSchema,
  listDocumentsSchema,
} from "@/modules/documents/presentation/server";
import { z } from "zod";

const service = makeDocumentsService();

// F5/REQ-45 — tagIds arrives as a JSON-stringified array inside FormData
// (avoids FormData multi-append ambiguity). Schema parses + validates the
// payload before forwarding to DocumentsService.upload.
const tagIdsSchema = z.array(z.string().min(1)).optional();

export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const formData = await request.formData();
    const name = formData.get("name") as string;
    const content = formData.get("content") as string;
    const clerkOrgId = formData.get("organizationId") as string;
    const file = formData.get("file") as File;
    const scope = (formData.get("scope") as string) || undefined;
    const tagIdsRaw = formData.get("tagIds");

    // Validar campos requeridos
    createDocumentSchema.parse({ name, organizationId: clerkOrgId });

    // F5/REQ-45 — parse tagIds JSON payload (optional). Invalid JSON or
    // non-string entries surface as a 400 via handleError -> ZodError.
    let tagIds: string[] | undefined;
    if (typeof tagIdsRaw === "string" && tagIdsRaw.length > 0) {
      const parsed = JSON.parse(tagIdsRaw);
      tagIds = tagIdsSchema.parse(parsed);
    }

    const result = await service.upload(
      clerkOrgId,
      userId,
      name,
      content || null,
      file && file.size > 0 ? file : null,
      scope as "ORGANIZATION" | "ACCOUNTING" | "FARM" | undefined,
      tagIds,
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
