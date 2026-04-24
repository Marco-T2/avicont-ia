import { analyzeDocument as analyzeWithGemini } from "@/features/ai-agent";
import { requireAuth, handleError } from "@/features/shared/middleware";
import { DocumentsService } from "@/features/documents/server";
import { analyzeDocumentSchema } from "@/features/documents/server";

const docsService = new DocumentsService();

export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const { documentId, analysisType } = analyzeDocumentSchema.parse(body);

    const document = await docsService.findForAnalysis(documentId, userId);

    if (!document) {
      return Response.json(
        { error: "Documento no encontrado o sin acceso" },
        { status: 404 },
      );
    }

    const content = document.content || document.name;
    if (!content || content.trim().length < 5) {
      return Response.json(
        { error: "El documento no tiene contenido para analizar" },
        { status: 400 },
      );
    }

    const summary = await analyzeWithGemini(content, analysisType);

    const updatedDocument = await docsService.updateAnalysis(
      document.organizationId,
      documentId,
      {
        aiSummary: summary,
        aiKeywords: ["analyzed"],
        sentiment: "analyzed",
      },
    );

    return Response.json({
      success: true,
      summary,
      document: {
        id: updatedDocument.id,
        name: updatedDocument.name,
        aiSummary: updatedDocument.aiSummary,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
