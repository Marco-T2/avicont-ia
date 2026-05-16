"use client";

// Barra de acciones del informe: actualizar, exportar PDF/Excel.
// Sin botón de email ni edición de título (spec: propuesta §4).
//
// PDF: abre en pestaña nueva vía window.open — el browser lo renderiza con su
// visor nativo (Content-Disposition: inline en el backend). El usuario puede
// imprimir o descargar desde ese visor.
// Excel: descarga directa vía blob — el browser no renderiza .xlsx inline.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  Printer,
  FileSpreadsheet,
  Loader2,
  Sparkles,
} from "lucide-react";

interface StatementToolbarProps {
  orgSlug: string;
  endpoint: "balance-sheet" | "income-statement";
  // Params actuales para construir la URL de exportación (mismos que se usaron para generar)
  queryParams: Record<string, string>;
  // Callback para refrescar datos desde la API
  onRefresh: () => void;
  refreshing?: boolean;
  // Deshabilitar exportación si no hay informe generado
  hasStatement?: boolean;
  // Análisis IA — sólo se muestra cuando se provee onAnalyze (hoy: balance-sheet)
  onAnalyze?: () => void;
  analyzing?: boolean;
}

type ExportFormat = "pdf" | "xlsx";

export function StatementToolbar({
  orgSlug,
  endpoint,
  queryParams,
  onRefresh,
  refreshing = false,
  hasStatement = false,
  onAnalyze,
  analyzing = false,
}: StatementToolbarProps) {
  const [loadingXlsx, setLoadingXlsx] = useState(false);

  function buildExportUrl(format: ExportFormat): string {
    const params = new URLSearchParams({ ...queryParams, format });
    return `/api/organizations/${orgSlug}/financial-statements/${endpoint}?${params.toString()}`;
  }

  function handleOpenPdf() {
    // Navegación nativa — el browser hace el GET, renderiza el PDF en su visor
    // y respeta las cookies de sesión (Clerk) por ser mismo origen.
    window.open(buildExportUrl("pdf"), "_blank", "noopener,noreferrer");
  }

  async function handleDownloadXlsx() {
    setLoadingXlsx(true);
    try {
      const res = await fetch(buildExportUrl("xlsx"));
      if (!res.ok) {
        console.error(`[toolbar] Error al exportar xlsx:`, res.status);
        return;
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${endpoint}-${queryParams["date"] ?? queryParams["dateFrom"] ?? "reporte"}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("[toolbar] Error al descargar xlsx:", err);
    } finally {
      setLoadingXlsx(false);
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Actualizar */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={refreshing}
        aria-label="Actualizar informe"
      >
        {refreshing ? (
          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4 mr-1.5" />
        )}
        Actualizar
      </Button>

      {/* PDF — abre en pestaña nueva (browser viewer) */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleOpenPdf}
        disabled={!hasStatement}
        aria-label="Abrir PDF en pestaña nueva"
      >
        <Printer className="h-4 w-4 mr-1.5" />
        PDF
      </Button>

      {/* Excel — descarga directa */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleDownloadXlsx}
        disabled={!hasStatement || loadingXlsx}
        aria-label="Descargar como Excel"
      >
        {loadingXlsx ? (
          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
        ) : (
          <FileSpreadsheet className="h-4 w-4 mr-1.5" />
        )}
        Excel
      </Button>

      {/* Análisis IA — sólo cuando el consumidor pasa onAnalyze */}
      {onAnalyze && (
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={onAnalyze}
          disabled={!hasStatement || analyzing}
          aria-label={
            endpoint === "balance-sheet"
              ? "Generar análisis IA del Balance General"
              : "Generar análisis IA del Estado de Resultados"
          }
        >
          {analyzing ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-1.5" />
          )}
          Análisis IA
        </Button>
      )}
    </div>
  );
}
