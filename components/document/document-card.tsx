"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import {
  FileText,
  Brain,
  Trash2,
  Download,
  Loader2,
  Calendar,
  User,
  File,
  RefreshCcw,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Document } from "@/types";
import type { DocumentScope } from "@/features/permissions";

const SCOPE_LABELS: Record<DocumentScope, string> = {
  ORGANIZATION: "Organización",
  ACCOUNTING: "Contabilidad",
  FARM: "Granja",
};

const SCOPE_COLORS: Record<DocumentScope, string> = {
  ORGANIZATION: "bg-blue-100 text-blue-700 border-blue-200",
  ACCOUNTING: "bg-amber-100 text-amber-700 border-amber-200",
  FARM: "bg-green-100 text-green-700 border-green-200",
};

interface DocumentCardProps {
  document: Document;
  isAnalyzing: boolean;
  onAnalyze: (documentId: string) => void;
  onDelete: (documentId: string) => void;
  onToggleSummary: (documentId: string) => void;
  expandedSummaries: Set<string>;
  formatFileSize: (bytes?: number) => string;
}

export default function DocumentCard({
  document: doc,
  isAnalyzing,
  onAnalyze,
  onDelete,
  onToggleSummary,
  expandedSummaries,
  formatFileSize,
}: DocumentCardProps) {
  const isExpanded = expandedSummaries.has(doc.id);

  // F6 / REQ-49 — local reindex UI state. Server is authoritative for RBAC
  // (per orchestrator brief: omit client-side gating, let server return 403);
  // a 5xx/403 surfaces here as a generic error toast. The button itself is
  // gated by `doc.aiSummary` as a proxy for "this document has indexable
  // content" — mirrors the existing Re-analizar copy heuristic.
  const [reindexOpen, setReindexOpen] = useState(false);
  const [reindexing, setReindexing] = useState(false);

  async function handleReindexConfirm() {
    setReindexing(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}/reindex`, {
        method: "POST",
      });
      if (res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          chunkCount?: number;
        };
        toast.success(
          body.chunkCount
            ? `Documento re-indexado (${body.chunkCount} chunks)`
            : "Documento re-indexado",
        );
        setReindexOpen(false);
      } else if (res.status === 409) {
        // REQ-48 — concurrency contention; tell the user to wait.
        toast.error(
          "Re-indexación en progreso, esperá unos segundos y volvé a intentar",
        );
      } else {
        toast.error("Error en re-indexación");
      }
    } catch {
      toast.error("Error en re-indexación");
    } finally {
      setReindexing(false);
    }
  }

  return (
    <div className="border rounded-lg p-6 hover:shadow-lg transition-all">
      <div className="flex items-start justify-between">
        {/* Left Column: Document Info */}
        <div className="flex items-start gap-4 flex-1">
          <div className="p-3 rounded-lg bg-blue-100">
            <FileText className="h-6 w-6 text-blue-600" />
          </div>
          <div className="flex-1">
            {/* Document Header */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-lg mb-1">{doc.name}</h3>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {doc.user.name || doc.user.email}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </span>
                  {doc.fileSize && (
                    <span className="flex items-center gap-1">
                      <File className="h-3 w-3" />
                      {formatFileSize(doc.fileSize)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {doc.scope && (
                  <Badge
                    variant="outline"
                    className={SCOPE_COLORS[doc.scope as DocumentScope] || ""}
                  >
                    {SCOPE_LABELS[doc.scope as DocumentScope] || doc.scope}
                  </Badge>
                )}
              </div>
            </div>

            {/* AI Summary Section */}
            {doc.aiSummary && (
              <div className="mt-4 p-4 bg-linear-to-r from-gray-50 to-blue-50 rounded-lg border">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Resumen IA</span>
                    <Badge variant="outline" className="ml-2">
                      Gemini AI
                    </Badge>
                  </div>
                  {doc.aiSummary.length > 200 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleSummary(doc.id)}
                    >
                      {isExpanded ? "Ver menos" : "Leer más"}
                    </Button>
                  )}
                </div>
                <div className="text-gray-700">
                  {isExpanded ? (
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown>{doc.aiSummary}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown>
                        {doc.aiSummary.length > 200
                          ? `${doc.aiSummary.substring(0, 200)}...`
                          : doc.aiSummary}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Actions */}
        <div className="flex flex-col gap-2 ml-4">
          {doc.fileUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(doc.fileUrl, "_blank")}
              title="Descargar"
              className="justify-start"
            >
              <Download className="h-4 w-4 mr-2" />
              Descargar
            </Button>
          )}

          <Button
            variant={doc.aiSummary ? "outline" : "default"}
            size="sm"
            onClick={() => onAnalyze(doc.id)}
            disabled={isAnalyzing}
            className="justify-start w-full"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {doc.aiSummary ? "Re-analizando..." : "Analizando..."}
              </>
            ) : (
              <>
                <Brain className="h-4 w-4 mr-2" />
                {doc.aiSummary ? "Re-analizar" : "Analizar"}
              </>
            )}
          </Button>

          {/* F6 / REQ-49 — Re-indexar gated by aiSummary presence (proxy
              for "doc has indexable content"). Server enforces RBAC and the
              409 contention contract; UI just surfaces the result via toast. */}
          {doc.aiSummary && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReindexOpen(true)}
              className="justify-start"
              title="Re-procesar y reembedding del documento"
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Re-indexar
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50 justify-start"
            onClick={() => onDelete(doc.id)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Eliminar
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={reindexOpen}
        onOpenChange={setReindexOpen}
        title="Re-indexar documento"
        description="Esto reprocesará el documento (puede tomar ~10 segundos y volverá a generar embeddings para todos los chunks). ¿Continuar?"
        confirmLabel="Sí, re-indexar"
        cancelLabel="Cancelar"
        loading={reindexing}
        onConfirm={handleReindexConfirm}
      />
    </div>
  );
}
