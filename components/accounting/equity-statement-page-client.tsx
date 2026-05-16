"use client";

/**
 * EquityStatementPageClient — orchestrates filters + fetch + view + export buttons
 * for the Estado de Evolución del Patrimonio Neto page.
 */

import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, FileSpreadsheet } from "lucide-react";
import { formatDateBO } from "@/lib/date-utils";
import { WorksheetFilters, type WorksheetFilterValues } from "./worksheet-filters";
import { EquityStatementView } from "./equity-statement-view";

// ── Serialized types (Decimals as strings) ─────────────────────────────────────

interface SerializedCell {
  column: string;
  amount: string;
}

interface SerializedRow {
  key: string;
  label: string;
  cells: SerializedCell[];
  total: string;
}

interface SerializedColumn {
  key: string;
  label: string;
  visible: boolean;
}

interface SerializedStatement {
  orgId: string;
  dateFrom: string;
  dateTo: string;
  columns: SerializedColumn[];
  rows: SerializedRow[];
  columnTotals: Record<string, string>;
  grandTotal: string;
  periodResult: string;
  imbalanced: boolean;
  imbalanceDelta: string;
  preliminary: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface EquityStatementPageClientProps {
  orgSlug: string;
}

export function EquityStatementPageClient({ orgSlug }: EquityStatementPageClientProps) {
  const [statement, setStatement] = useState<SerializedStatement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFilters, setLastFilters] = useState<WorksheetFilterValues | null>(null);

  const fetchStatement = useCallback(
    async (filters: WorksheetFilterValues) => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        dateFrom: filters.dateFrom.toISOString().slice(0, 10),
        dateTo: filters.dateTo.toISOString().slice(0, 10),
        format: "json",
      });

      try {
        const res = await fetch(
          `/api/organizations/${orgSlug}/equity-statement?${params.toString()}`,
        );

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(
            (body as { error?: string }).error ??
              `Error al generar el Estado de Patrimonio (${res.status})`,
          );
          return;
        }

        const data = (await res.json()) as SerializedStatement;
        setStatement(data);
      } catch {
        setError("Error de conexión. Por favor intente nuevamente.");
      } finally {
        setLoading(false);
      }
    },
    [orgSlug],
  );

  function handleFilter(filters: WorksheetFilterValues) {
    setLastFilters(filters);
    void fetchStatement(filters);
  }

  const [loadingXlsx, setLoadingXlsx] = useState(false);

  function buildExportUrl(format: "pdf" | "xlsx"): string | null {
    if (!lastFilters) return null;
    const params = new URLSearchParams({
      dateFrom: lastFilters.dateFrom.toISOString().slice(0, 10),
      dateTo: lastFilters.dateTo.toISOString().slice(0, 10),
      format,
    });
    return `/api/organizations/${orgSlug}/equity-statement?${params.toString()}`;
  }

  function handleOpenPdf() {
    const url = buildExportUrl("pdf");
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleDownloadXlsx() {
    const url = buildExportUrl("xlsx");
    if (!url) return;
    setLoadingXlsx(true);

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`Error al exportar EEPN (xlsx):`, res.status);
        return;
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const periodLabel = `${lastFilters!.dateFrom.toISOString().slice(0, 10)}_${lastFilters!.dateTo.toISOString().slice(0, 10)}`;
      a.download = `eepn-${periodLabel}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Error al descargar EEPN:", err);
    } finally {
      setLoadingXlsx(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent>
          <WorksheetFilters onFilter={handleFilter} loading={loading} />
        </CardContent>
      </Card>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">
            Generando Estado de Evolución del Patrimonio Neto...
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive"
        >
          {error}
        </div>
      )}

      {/* Results */}
      {statement && !loading && (
        <div className="space-y-4">
          {/* Export buttons — paridad con balance-sheet/trial-balance/worksheet */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenPdf}
              aria-label="Abrir PDF en pestaña nueva"
            >
              <Printer className="h-4 w-4 mr-1.5" />
              PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadXlsx}
              disabled={loadingXlsx}
              aria-label="Descargar como Excel"
            >
              {loadingXlsx ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4 mr-1.5" />
              )}
              Excel
            </Button>
          </div>

          {/* View */}
          <Card>
            <CardContent className="pt-0 pb-6 px-0 overflow-auto">
              {/* Sub-header del Card — paridad con los otros reportes */}
              <div className="px-6 pb-4 text-center">
                <h2 className="text-xl font-bold tracking-wide">
                  ESTADO DE EVOLUCIÓN DEL PATRIMONIO NETO
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Del {formatDateBO(new Date(statement.dateFrom))} al{" "}
                  {formatDateBO(new Date(statement.dateTo))}
                </p>
                <p className="text-xs italic text-muted-foreground">
                  (Expresado en Bolivianos)
                </p>
              </div>
              <EquityStatementView statement={statement} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
