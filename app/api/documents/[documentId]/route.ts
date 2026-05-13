import { requireAuth, handleError } from "@/features/shared/middleware";
import { makeDocumentsService } from "@/modules/documents/presentation/server";

const service = makeDocumentsService();

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
