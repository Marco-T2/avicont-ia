"use client";

/**
 * TrialBalancePageClient — orchestrates filters + fetch + table + export buttons
 * for the Balance de Comprobación de Sumas y Saldos page.
 *
 * Covers C9.S2 (filters wired), C9.S3 (export buttons).
 */

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, FileSpreadsheet } from "lucide-react";
import { formatDateBO } from "@/lib/date-utils";
import {
  WorksheetFilters,
  type WorksheetFilterValues,
  type FiscalPeriodOption,
} from "./worksheet-filters";
import { TrialBalanceTable } from "./trial-balance-table";

// ── Types (serialized — Decimals as strings) ──────────────────────────────────

interface SerializedTotals {
  sumasDebe: string;
  sumasHaber: string;
  saldoDeudor: string;
  saldoAcreedor: string;
}

interface SerializedRow extends SerializedTotals {
  accountId: string;
  code: string;
  name: string;
}

interface SerializedOppositeSignAccount {
  code: string;
  name: string;
  nature: "DEUDORA" | "ACREEDORA";
  saldoDeudor: string;
  saldoAcreedor: string;
}

interface SerializedReport {
  orgId: string;
  dateFrom: string;
  dateTo: string;
  rows: SerializedRow[];
  totals: SerializedTotals;
  imbalanced: boolean;
  deltaSumas: string;
  deltaSaldos: string;
  oppositeSignAccounts: SerializedOppositeSignAccount[];
}

// ── Component ─────────────────────────────────────────────────────────────────

interface TrialBalancePageClientProps {
  orgSlug: string;
}

export function TrialBalancePageClient({ orgSlug }: TrialBalancePageClientProps) {
  const [report, setReport] = useState<SerializedReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFilters, setLastFilters] = useState<WorksheetFilterValues | null>(null);
  const [periods, setPeriods] = useState<FiscalPeriodOption[]>([]);
  const [periodsLoaded, setPeriodsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadPeriods() {
      try {
        const res = await fetch(`/api/organizations/${orgSlug}/periods`);
        if (!res.ok) return;
        const data = (await res.json()) as Array<{
          id: string;
          name: string;
          startDate: string;
          endDate: string;
        }>;
        if (cancelled) return;
        setPeriods(
          data.map((p) => ({
            id: p.id,
            name: p.name,
            startDate: p.startDate.slice(0, 10),
            endDate: p.endDate.slice(0, 10),
          })),
        );
      } catch {
        // silent — period selector is optional UX
      } finally {
        if (!cancelled) setPeriodsLoaded(true);
      }
    }
    void loadPeriods();
    return () => {
      cancelled = true;
    };
  }, [orgSlug]);

  // Period that contains today — mirrors journal-entry-form / sale-form UX.
  const today = new Date().toISOString().slice(0, 10);
  const currentPeriod = periods.find(
    (p) => p.startDate <= today && today <= p.endDate,
  );

  const fetchReport = useCallback(
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
          `/api/organizations/${orgSlug}/trial-balance?${params.toString()}`,
        );

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(
            body.error ?? `Error al generar el Balance de Comprobación (${res.status})`,
          );
          return;
        }

        const data = (await res.json()) as SerializedReport;
        setReport(data);
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
    void fetchReport(filters);
  }

  const [loadingXlsx, setLoadingXlsx] = useState(false);

  function buildExportUrl(format: "pdf" | "xlsx"): string | null {
    if (!lastFilters) return null;
    const params = new URLSearchParams({
      dateFrom: lastFilters.dateFrom.toISOString().slice(0, 10),
      dateTo: lastFilters.dateTo.toISOString().slice(0, 10),
      format,
    });
    return `/api/organizations/${orgSlug}/trial-balance?${params.toString()}`;
  }

  function handleOpenPdf() {
    const url = buildExportUrl("pdf");
    if (!url) return;
    // Navegación nativa — el browser hace el GET, renderiza el PDF en su visor
    // y respeta las cookies de sesión (Clerk) por ser mismo origen.
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleDownloadXlsx() {
    const url = buildExportUrl("xlsx");
    if (!url) return;
    setLoadingXlsx(true);

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`Error al exportar Balance de Comprobación (xlsx):`, res.status);
        return;
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const periodLabel = `${lastFilters!.dateFrom.toISOString().slice(0, 10)}_${lastFilters!.dateTo.toISOString().slice(0, 10)}`;
      a.download = `sumas-y-saldos-${periodLabel}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Error al descargar Balance de Comprobación:", err);
    } finally {
      setLoadingXlsx(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters — render only after periods fetch resolves so initial* props
          apply at mount instead of after a remount. */}
      <Card>
        <CardContent>
          {periodsLoaded ? (
            <WorksheetFilters
              onFilter={handleFilter}
              loading={loading}
              periods={periods}
              initialFiscalPeriodId={currentPeriod?.id}
              initialDateFrom={currentPeriod?.startDate}
              initialDateTo={currentPeriod?.endDate}
            />
          ) : (
            <div className="flex items-center gap-2 py-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando períodos…
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">Generando Balance de Comprobación...</span>
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
      {report && !loading && (
        <div className="space-y-4">
          {/* Export buttons — paridad con balance-sheet/income-statement */}
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

          {/* Table */}
          <Card>
            <CardContent className="pt-0 pb-6 px-0 overflow-auto">
              {/* Sub-header del Card — título + período + (Expresado en Bolivianos) */}
              <div className="px-6 pb-4 text-center">
                <h2 className="text-xl font-bold tracking-wide">
                  BALANCE DE COMPROBACIÓN DE SUMAS Y SALDOS
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Del {formatDateBO(new Date(report.dateFrom))} al{" "}
                  {formatDateBO(new Date(report.dateTo))}
                </p>
                <p className="text-xs italic text-muted-foreground">
                  (Expresado en Bolivianos)
                </p>
              </div>
              <TrialBalanceTable report={report} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
