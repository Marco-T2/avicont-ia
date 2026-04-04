// components/document-card.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Brain,
  Trash2,
  Download,
  Loader2,
  Calendar,
  User,
  Tag,
  File,
  Sparkles,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Document, AnalysisType } from "@/types";
import { analysisTypes } from "@/app/data/data";
import type { DocumentScope } from "@/features/shared/permissions";

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
  selectedAnalysisType: AnalysisType;
  onAnalysisTypeChange: (type: AnalysisType) => void;
  onAnalyze: (documentId: string) => void;
  onDelete: (documentId: string) => void;
  onToggleSummary: (documentId: string) => void;
  expandedSummaries: Set<string>;
  formatFileSize: (bytes?: number) => string;
}

export default function DocumentCard({
  document: doc,
  isAnalyzing,
  selectedAnalysisType,
  onAnalysisTypeChange,
  onAnalyze,
  onDelete,
  onToggleSummary,
  expandedSummaries,
  formatFileSize,
}: DocumentCardProps) {
  const isExpanded = expandedSummaries.has(doc.id);

  // Get analysis type icon
  const getAnalysisIcon = (type: AnalysisType) => {
    const analysisType = analysisTypes.find((t) => t.value === type);
    const Icon = analysisType?.icon || Sparkles;
    return <Icon className="h-4 w-4" />;
  };

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
                {doc.sentiment && (
                  <Badge>
                    <div className="flex items-center gap-1">
                      <span className="capitalize">{doc.sentiment}</span>
                    </div>
                  </Badge>
                )}
              </div>
            </div>

            {/* AI Analysis Section */}
            {doc.aiSummary && (
              <div className="mt-4 p-4 bg-linear-to-r from-gray-50 to-blue-50 rounded-lg border">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Análisis de IA</span>
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
                {/* Summary Content */}
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
                {/* Keywords */}
                {doc.aiKeywords.length > 0 && (
                  <div className="mt-4 pt-3 border-t">
                    <div className="flex items-center gap-2 mb-2">
                      <Tag className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium">Temas Clave</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {doc.aiKeywords.slice(0, 8).map((keyword, idx) => (
                        <Badge
                          key={idx}
                          variant="secondary"
                          className="px-3 py-1"
                        >
                          {keyword}
                        </Badge>
                      ))}
                      {doc.aiKeywords.length > 8 && (
                        <Badge variant="outline" className="px-3 py-1">
                          +{doc.aiKeywords.length - 8} más
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Actions */}
        <div className="flex flex-col gap-2 ml-4">
          {/* Download Button */}
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

          {/* Analysis Section */}
          <div className="space-y-2">
            <div className="text-xs text-gray-500">
              {doc.aiSummary ? "Re-analizar con:" : "Analizar con:"}
            </div>

            <Select
              value={selectedAnalysisType}
              onValueChange={(value: AnalysisType) =>
                onAnalysisTypeChange(value)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  <div className="flex items-center gap-2">
                    {getAnalysisIcon(selectedAnalysisType)}
                    {
                      analysisTypes.find(
                        (type) => type.value === selectedAnalysisType,
                      )?.label
                    }
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {analysisTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <type.icon className="h-4 w-4" />
                      {type.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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
          </div>

          {/* Delete Button */}
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
    </div>
  );
}