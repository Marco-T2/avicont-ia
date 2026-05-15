"use client";

/**
 * WorksheetPageClient — orchestrates filters + fetch + table + export buttons
 * for the Hoja de Trabajo 12 Columnas page.
 *
 * Covers REQ-10 (filters wired), spec 1.S2 (no-CJ note), REQ-11 (RBAC via API).
 */

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
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

  // Build export URL for download links
  function buildExportUrl(format: "pdf" | "xlsx"): string {
    if (!lastFilters) return "#";
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

  return (
    <div className="space-y-4">
      {/* Filters — render only after periods fetch resolves so initial* props
          (computed from currentPeriod) apply at mount, not after a remount. */}
      <Card>
        <CardContent className="pt-6">
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

          {/* Export buttons */}
          <div className="flex gap-2">
            <a
              href={buildExportUrl("pdf")}
              download
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent"
            >
              Descargar PDF
            </a>
            <a
              href={buildExportUrl("xlsx")}
              download
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent"
            >
              Descargar Excel
            </a>
          </div>

          {/* Table */}
          <Card>
            <CardContent className="pt-4 pb-6 px-0 overflow-auto">
              <WorksheetTable report={report} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
