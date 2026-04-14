"use client";

// Botones de exportación PDF y Excel para estados financieros
// Construye la URL con los mismos params que generaron el statement y agrega ?format=pdf|xlsx
// Dispara descarga mediante blob URL generado en cliente
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type ExportFormat = "pdf" | "xlsx";

interface ExportButtonsProps {
  orgSlug: string;
  // Endpoint relativo sin /api, ej: "balance-sheet" | "income-statement"
  endpoint: "balance-sheet" | "income-statement";
  // Query params que se usaron para generar el statement (sin format)
  queryParams: Record<string, string>;
  // Si no hay statement generado, los botones quedan deshabilitados
  disabled?: boolean;
}

export function ExportButtons({
  orgSlug,
  endpoint,
  queryParams,
  disabled = false,
}: ExportButtonsProps) {
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingXlsx, setLoadingXlsx] = useState(false);

  async function handleExport(format: ExportFormat) {
    const setLoading = format === "pdf" ? setLoadingPdf : setLoadingXlsx;
    setLoading(true);

    try {
      const params = new URLSearchParams({ ...queryParams, format });
      const url = `/api/organizations/${orgSlug}/financial-statements/${endpoint}?${params.toString()}`;

      const res = await fetch(url);
      if (!res.ok) {
        console.error("Error al exportar:", res.status);
        return;
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download =
        format === "pdf"
          ? `${endpoint}-${queryParams["date"] ?? queryParams["dateFrom"] ?? "reporte"}.pdf`
          : `${endpoint}-${queryParams["date"] ?? queryParams["dateFrom"] ?? "reporte"}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Error al descargar:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleExport("pdf")}
        disabled={disabled || loadingPdf || loadingXlsx}
        aria-label="Exportar estado financiero en formato PDF"
      >
        {loadingPdf && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Exportar PDF
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleExport("xlsx")}
        disabled={disabled || loadingPdf || loadingXlsx}
        aria-label="Exportar estado financiero en formato Excel"
      >
        {loadingXlsx && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Exportar Excel
      </Button>
    </div>
  );
}
