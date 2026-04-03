import { analyzeDocument as analyzeWithGemini } from "@/features/ai-agent";
import { requireAuth, handleError } from "@/features/shared/middleware";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const { documentId, organizationId, analysisType } = await request.json();
    if (!documentId || !organizationId) {
      return Response.json(
        { error: "Falta el ID del documento o de la organización" },
        { status: 400 },
      );
    }

    // Find document verifying org membership
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        organization: {
          clerkOrgId: organizationId,
          members: {
            some: {
              user: { clerkUserId: userId },
            },
          },
        },
      },
    });

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

    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: {
        aiSummary: summary,
        aiKeywords: ["analyzed"],
        sentiment: "analyzed",
      },
    });

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
