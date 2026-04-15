"use client";

/**
 * Barra de herramientas del Libro de Compras/Ventas IVA.
 *
 * Incluye:
 * - Selector de período fiscal
 * - Botón "Nueva entrada" → abre modal
 * - Botón "Exportar Excel" (stub PR4 — funcional en PR5)
 *
 * Mirrors the architecture of statement-toolbar.tsx.
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, FileSpreadsheet, Loader2 } from "lucide-react";

interface FiscalPeriodOption {
  id: string;
  name: string;
  status: string;
}

interface IvaBooksToolbarProps {
  orgSlug: string;
  kind: "purchases" | "sales";
  /** Período actualmente seleccionado */
  selectedPeriodId: string;
  onPeriodChange: (periodId: string) => void;
  onNewEntry: () => void;
  /** Deshabilitar exportar si no hay datos */
  hasData?: boolean;
}

export function IvaBooksToolbar({
  orgSlug,
  kind,
  selectedPeriodId,
  onPeriodChange,
  onNewEntry,
  hasData = false,
}: IvaBooksToolbarProps) {
  const [periods, setPeriods] = useState<FiscalPeriodOption[]>([]);
  const [loadingPeriods, setLoadingPeriods] = useState(true);
  const [exportingXlsx, setExportingXlsx] = useState(false);

  useEffect(() => {
    setLoadingPeriods(true);
    fetch(`/api/organizations/${orgSlug}/periods`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: FiscalPeriodOption[]) => setPeriods(data))
      .catch(() => setPeriods([]))
      .finally(() => setLoadingPeriods(false));
  }, [orgSlug]);

  async function handleExport() {
    // Stub PR4 — wiring completo en PR5
    if (!selectedPeriodId) return;
    setExportingXlsx(true);
    try {
      const url = `/api/organizations/${orgSlug}/iva-books/${kind}/export?periodId=${selectedPeriodId}`;
      const res = await fetch(url);
      if (!res.ok) {
        console.error("[iva-books-toolbar] Export failed:", res.status);
        return;
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `Libro${kind === "purchases" ? "Compras" : "Ventas"}_${selectedPeriodId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("[iva-books-toolbar] Export error:", err);
    } finally {
      setExportingXlsx(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Selector de período fiscal */}
      <div className="flex flex-col gap-1 min-w-[180px]">
        <Label htmlFor="iva-period-select" className="text-xs font-medium text-gray-600">
          Período fiscal
        </Label>
        <select
          id="iva-period-select"
          data-testid="iva-period-select"
          value={selectedPeriodId}
          onChange={(e) => onPeriodChange(e.target.value)}
          disabled={loadingPeriods}
          className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm disabled:opacity-50"
        >
          <option value="">
            {loadingPeriods ? "Cargando..." : "— Todos los períodos —"}
          </option>
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {p.status === "CLOSED" ? "(Cerrado)" : "(Abierto)"}
            </option>
          ))}
        </select>
      </div>

      {/* Botón nueva entrada */}
      <Button
        type="button"
        size="sm"
        onClick={onNewEntry}
        aria-label={`Nueva entrada ${kind === "purchases" ? "Libro de Compras" : "Libro de Ventas"}`}
      >
        <Plus className="h-4 w-4 mr-1.5" />
        Nueva entrada
      </Button>

      {/* Exportar Excel — stub PR4, completo en PR5 */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleExport}
        disabled={!hasData || !selectedPeriodId || exportingXlsx}
        aria-label="Exportar como Excel"
      >
        {exportingXlsx ? (
          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
        ) : (
          <FileSpreadsheet className="h-4 w-4 mr-1.5" />
        )}
        Exportar Excel
      </Button>
    </div>
  );
}
