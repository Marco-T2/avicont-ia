import { requireAuth, handleError } from "@/features/shared/middleware";
import { DocumentsService } from "@/features/documents/documents.service";

const service = new DocumentsService();

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  try {
    const { documentId } = await params;
    const { userId } = await requireAuth();

    await service.delete(documentId, userId);

    return Response.json({
      success: true,
      message: "Documento eliminado exitosamente",
    });
  } catch (error) {
    return handleError(error);
  }
}
