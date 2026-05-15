"use client";

import { useState, useEffect, useCallback } from "react";
import { useOrganization } from "@clerk/nextjs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import DocumentUploadDialog from "@/components/document/document-upload-dialog";
import { AnalysisType, Document } from "@/types";
import { analysisTypes, formatFileSize } from "@/app/data/data";
import DocumentCard from "@/components/document/document-card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export default function DocumentsPage() {
  const { organization } = useOrganization();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [expandedSummaries, setExpandedSummaries] = useState<Set<string>>(
    new Set(),
  );
  const [selectedAnalysisType, setSelectedAnalysisType] =
    useState<AnalysisType>("summary");
  const [userRole, setUserRole] = useState<string | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    if (!organization) return;
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/documents?organizationId=${organization.id}`,
      );
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents);
        if (data.metadata?.userRole) {
          setUserRole(data.metadata.userRole);
        }
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error);
      toast.error("Error al cargar documentos");
    } finally {
      setIsLoading(false);
    }
  }, [organization]);

  // Initial fetch
  useEffect(() => {
    if (organization?.id) {
      fetchDocuments();
    }
  }, [organization?.id, fetchDocuments]);

  // Toggle summary expansion
  const toggleSummary = (documentId: string) => {
    const newExpanded = new Set(expandedSummaries);
    if (newExpanded.has(documentId)) {
      newExpanded.delete(documentId);
    } else {
      newExpanded.add(documentId);
    }
    setExpandedSummaries(newExpanded);
  };

  // Handle analysis
  const handleAnalyze = async (documentId: string) => {
    if (!organization) return;

    setIsAnalyzing(documentId);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          organizationId: organization.id,
          analysisType: selectedAnalysisType,
        }),
      });

      if (response.ok) {
        await response.json();
        const analysisTypeLabel = analysisTypes.find(
          (type) => type.value === selectedAnalysisType,
        )?.label;

        toast.success(
          `¡Análisis de ${analysisTypeLabel || "Documento"} completado exitosamente!`,
        );
        fetchDocuments(); // Refresh to show analysis

        // Expand the summary for the newly analyzed document
        setExpandedSummaries((prev) => new Set(prev).add(documentId));
      } else {
        const error = await response.json();
        toast.error(error.error || "Error en el análisis");
      }
    } catch (error) {
      console.error("Analysis error:", error);
      toast.error("Error en el análisis");
    } finally {
      setIsAnalyzing(null);
    }
  };

  // Handle delete
  const handleDelete = (documentId: string) => {
    setDeleteId(documentId);
  };

  const executeDelete = async () => {
    if (!deleteId) return;
    const documentId = deleteId;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Documento eliminado exitosamente");
        setDeleteId(null);
        fetchDocuments(); // Refresh list
      } else {
        toast.error("Error al eliminar el documento");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete document");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Documentos</h1>
          <p className="text-muted-foreground">
            Subí y analizá documentos en {organization?.name}
          </p>
        </div>

        {/* Upload Dialog */}
        <DocumentUploadDialog onUploadSuccess={fetchDocuments} userRole={userRole} />
      </div>

      {/* Stats Bar */}
      {documents.length > 0 && !isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold">{documents.length}</div>
                <p className="text-sm text-muted-foreground">Total de Documentos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-success">
                  {documents.filter((d) => d.aiSummary).length}
                </div>
                <p className="text-sm text-muted-foreground">Analizados</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold">
                  {formatFileSize(
                    documents.reduce(
                      (acc, doc) => acc + (doc.fileSize || 0),
                      0,
                    ),
                  )}
                </div>
                <p className="text-sm text-muted-foreground">Tamaño Total</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle>
            Documentos ({documents.length})
            {isLoading && (
              <Loader2 className="h-4 w-4 inline ml-2 animate-spin" />
            )}
          </CardTitle>
          <CardDescription>
            {documents.filter((d) => d.aiSummary).length} analizados •{" "}
            {documents.filter((d) => !d.aiSummary).length} pendientes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Cargando documentos...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">No hay documentos cargados aún</p>
              <p className="text-sm text-muted-foreground mt-2">
                Subí tu primer documento para comenzar
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {documents.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  isAnalyzing={isAnalyzing === doc.id}
                  selectedAnalysisType={selectedAnalysisType}
                  onAnalysisTypeChange={setSelectedAnalysisType}
                  onAnalyze={handleAnalyze}
                  onDelete={handleDelete}
                  onToggleSummary={toggleSummary}
                  expandedSummaries={expandedSummaries}
                  formatFileSize={formatFileSize}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Eliminar documento"
        description="¿Eliminar este documento? Esta operación no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        loading={isDeleting}
        onConfirm={executeDelete}
      />
    </div>
  );
}