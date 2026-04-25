"use client";

// Barra de acciones del informe: compacto, actualizar, exportar PDF/Excel.
// Sin botón de email ni edición de título (spec: propuesta §4).
// Los exportadores PDF y Excel son stubs en PR3; se conectan en PR4.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlignJustify,
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
  // Controla si la tabla usa modo compacto
  compact: boolean;
  onToggleCompact: () => void;
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
  compact,
  onToggleCompact,
  onRefresh,
  refreshing = false,
  hasStatement = false,
  onAnalyze,
  analyzing = false,
}: StatementToolbarProps) {
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingXlsx, setLoadingXlsx] = useState(false);

  async function handleExport(format: ExportFormat) {
    // Stub PR3 — la implementación completa se conecta en PR4
    const setLoading = format === "pdf" ? setLoadingPdf : setLoadingXlsx;
    setLoading(true);

    try {
      const params = new URLSearchParams({ ...queryParams, format });
      const url = `/api/organizations/${orgSlug}/financial-statements/${endpoint}?${params.toString()}`;

      const res = await fetch(url);
      if (!res.ok) {
        console.error(`[toolbar] Error al exportar ${format}:`, res.status);
        return;
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${endpoint}-${queryParams["date"] ?? queryParams["dateFrom"] ?? "reporte"}.${format === "pdf" ? "pdf" : "xlsx"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("[toolbar] Error al descargar:", err);
    } finally {
      setLoading(false);
    }
  }

  const exportBusy = loadingPdf || loadingXlsx;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Compacto: alterna densidad de filas */}
      <Button
        type="button"
        variant={compact ? "default" : "outline"}
        size="sm"
        onClick={onToggleCompact}
        aria-pressed={compact}
        aria-label={compact ? "Desactivar vista compacta" : "Activar vista compacta"}
      >
        <AlignJustify className="h-4 w-4 mr-1.5" />
        Compacto
      </Button>

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

      {/* Imprimir PDF — stub PR3, completo en PR4 */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => handleExport("pdf")}
        disabled={!hasStatement || exportBusy}
        aria-label="Exportar como PDF"
      >
        {loadingPdf ? (
          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
        ) : (
          <Printer className="h-4 w-4 mr-1.5" />
        )}
        PDF
      </Button>

      {/* Exportar Excel — stub PR3, completo en PR4 */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => handleExport("xlsx")}
        disabled={!hasStatement || exportBusy}
        aria-label="Exportar como Excel"
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
          aria-label="Generar análisis IA del Balance General"
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
