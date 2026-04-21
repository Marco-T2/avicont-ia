"use client";

/**
 * EquityStatementPageClient — orchestrates filters + fetch + view + export buttons
 * for the Estado de Evolución del Patrimonio Neto page.
 */

import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
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

  function buildExportUrl(format: "pdf" | "xlsx"): string {
    if (!lastFilters) return "#";
    const params = new URLSearchParams({
      dateFrom: lastFilters.dateFrom.toISOString().slice(0, 10),
      dateTo: lastFilters.dateTo.toISOString().slice(0, 10),
      format,
    });
    return `/api/organizations/${orgSlug}/equity-statement?${params.toString()}`;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <WorksheetFilters onFilter={handleFilter} loading={loading} />
        </CardContent>
      </Card>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <span className="ml-3 text-gray-500">
            Generando Estado de Evolución del Patrimonio Neto...
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700"
        >
          {error}
        </div>
      )}

      {/* Results */}
      {statement && !loading && (
        <div className="space-y-4">
          {/* Export buttons */}
          <div className="flex gap-2">
            <a
              href={buildExportUrl("pdf")}
              download
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-gray-50"
            >
              Descargar PDF
            </a>
            <a
              href={buildExportUrl("xlsx")}
              download
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-gray-50"
            >
              Descargar Excel
            </a>
          </div>

          {/* View */}
          <Card>
            <CardContent className="pt-4 pb-6 px-0 overflow-auto">
              <EquityStatementView statement={statement} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
