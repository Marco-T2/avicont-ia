import { analyzeDocument as analyzeWithGemini } from "@/modules/ai-agent/presentation";
import { requireAuth, handleError } from "@/features/shared/middleware";
import {
  makeDocumentsService,
  analyzeDocumentSchema,
} from "@/modules/documents/presentation/server";

const docsService = makeDocumentsService();

export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const { documentId } = analyzeDocumentSchema.parse(body);

    const document = await docsService.findForAnalysis(documentId, userId);

    if (!document) {
      return Response.json(
        { error: "Documento no encontrado o sin acceso" },
        { status: 404 },
      );
    }

    type DocAnalysisRow = { content: string | null; name: string; organizationId: string; id: string };
    const docRow = document as DocAnalysisRow;
    const content = docRow.content || docRow.name;
    if (!content || content.trim().length < 5) {
      return Response.json(
        { error: "El documento no tiene contenido para analizar" },
        { status: 400 },
      );
    }

    const summary = await analyzeWithGemini(content);

    const updatedDocument = (await docsService.updateAnalysis(
      docRow.organizationId,
      documentId,
      { aiSummary: summary },
    )) as { id: string; name: string; aiSummary: string | null };

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
