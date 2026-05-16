"use client";

/**
 * WorksheetPageClient — orchestrates filters + fetch + table + export buttons
 * for the Hoja de Trabajo 12 Columnas page.
 *
 * Covers REQ-10 (filters wired), spec 1.S2 (no-CJ note), REQ-11 (RBAC via API).
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
import { WorksheetTable } from "./worksheet-table";

// ── Types (serialized — Decimals as strings) ──────────────────────────────────

interface SerializedTotals {
  sumasDebe: string;
  sumasHaber: string;
  saldoDeudor: string;
  saldoAcreedor: string;
  ajustesDebe: string;
  ajustesHaber: string;
  saldoAjDeudor: string;
  saldoAjAcreedor: string;
  resultadosPerdidas: string;
  resultadosGanancias: string;
  bgActivo: string;
  bgPasPat: string;
}

interface SerializedRow extends SerializedTotals {
  accountId: string;
  code: string;
  name: string;
  isContraAccount: boolean;
  accountType: string;
  isCarryOver: boolean;
}

interface SerializedReport {
  orgId: string;
  dateFrom: string;
  dateTo: string;
  groups: Array<{
    accountType: string;
    rows: SerializedRow[];
    subtotals: SerializedTotals;
  }>;
  carryOverRow?: SerializedRow;
  grandTotals: SerializedTotals;
  imbalanced: boolean;
  imbalanceDelta: string;
  oppositeSignAccounts: Array<{
    code: string;
    name: string;
    accountType: string;
    amount: string;
  }>;
  allAjustesZero?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface WorksheetPageClientProps {
  orgSlug: string;
  orgName?: string;
}

export function WorksheetPageClient({ orgSlug }: WorksheetPageClientProps) {
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
        if (!res.ok) {
          if (!cancelled) setPeriodsLoaded(true);
          return;
        }
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

  // Pick the fiscal period that contains today (mirrors journal-entry-form
  // and sale-form pattern via findPeriodCoveringDate, but inlined here because
  // our FiscalPeriodOption uses string dates rather than Date instances).
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
      if (filters.fiscalPeriodId) {
        params.set("fiscalPeriodId", filters.fiscalPeriodId);
      }

      try {
        const res = await fetch(
          `/api/organizations/${orgSlug}/worksheet?${params.toString()}`,
        );

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? `Error al generar la Hoja de Trabajo (${res.status})`);
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
    if (lastFilters.fiscalPeriodId) {
      params.set("fiscalPeriodId", lastFilters.fiscalPeriodId);
    }
    return `/api/organizations/${orgSlug}/worksheet?${params.toString()}`;
  }

  function handleOpenPdf() {
    const url = buildExportUrl("pdf");
    if (!url) return;
    // Navegación nativa — browser hace el GET, renderiza con visor nativo,
    // respeta cookies de Clerk por ser mismo origen.
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleDownloadXlsx() {
    const url = buildExportUrl("xlsx");
    if (!url) return;
    setLoadingXlsx(true);

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`Error al exportar Hoja de Trabajo (xlsx):`, res.status);
        return;
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const periodLabel = `${lastFilters!.dateFrom.toISOString().slice(0, 10)}_${lastFilters!.dateTo.toISOString().slice(0, 10)}`;
      a.download = `hoja-de-trabajo-${periodLabel}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Error al descargar Hoja de Trabajo:", err);
    } finally {
      setLoadingXlsx(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters — render only after periods fetch resolves so initial* props
          (computed from currentPeriod) apply at mount, not after a remount. */}
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
          <span className="ml-3 text-muted-foreground">Generando Hoja de Trabajo...</span>
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
          {/* No-CJ note (spec 1.S2) */}
          {report.allAjustesZero && (
            <div className="rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-foreground text-sm">
              Sin asientos de ajuste (CJ) en este período. Las columnas de ajuste
              aparecen en cero.
            </div>
          )}

          {/* Export buttons — paridad con balance-sheet/trial-balance */}
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
              {/* Sub-header del Card — paridad con los otros reportes */}
              <div className="px-6 pb-4 text-center">
                <h2 className="text-xl font-bold tracking-wide">
                  HOJA DE TRABAJO
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Del {formatDateBO(new Date(report.dateFrom))} al{" "}
                  {formatDateBO(new Date(report.dateTo))}
                </p>
                <p className="text-xs italic text-muted-foreground">
                  (Expresado en Bolivianos)
                </p>
              </div>
              <WorksheetTable report={report} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
