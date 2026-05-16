"use client";

// Cliente de la página de Balance General — estilo QuickBooks.
// Orquesta: filtros → fetch → toolbar + tabla TanStack + banners.
// Los exportadores PDF/Excel siguen disponibles vía StatementToolbar (stub en PR3, completo en PR4).
import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { StatementFilters } from "./statement-filters";
import type { FiscalPeriod, QuickBooksFilterParams } from "./statement-filters";
import { StatementTable } from "./statement-table";
import { StatementToolbar } from "./statement-toolbar";
import { ImbalanceBanner } from "./imbalance-banner";
import { OppositeSignWarning } from "./opposite-sign-warning";
import {
  BalanceSheetAnalysisCard,
  type AnalyzeBalanceSheetResult,
} from "./balance-sheet-analysis-card";
import {
  buildBalanceSheetTableRows,
} from "@/modules/accounting/financial-statements/presentation";
import type {
  SerializedBalanceSheetResponse,
  SerializedColumn,
} from "@/modules/accounting/financial-statements/presentation";

interface BalanceSheetPageClientProps {
  orgSlug: string;
  orgName?: string;
  periods: FiscalPeriod[];
}

export function BalanceSheetPageClient({ orgSlug, orgName, periods }: BalanceSheetPageClientProps) {
  const displayOrgName = orgName ?? orgSlug.charAt(0).toUpperCase() + orgSlug.slice(1);
  const [statement, setStatement] = useState<SerializedBalanceSheetResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compact, setCompact] = useState(false);
  // Guardamos los params para reutilizarlos en refresh y exportación
  const [lastParams, setLastParams] = useState<QuickBooksFilterParams | null>(null);
  // Params como Record<string, string> para la toolbar de exportación
  const [exportQueryParams, setExportQueryParams] = useState<Record<string, string>>({});
  // Análisis IA — efímero, se reinicia al re-fetch del balance.
  const [analysis, setAnalysis] = useState<AnalyzeBalanceSheetResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const fetchStatement = useCallback(async (params: QuickBooksFilterParams) => {
    setLoading(true);
    setError(null);
    setAnalysis(null);

    // Construir query params para la API
    const queryParams: Record<string, string> = {};

    if (params.fiscalPeriodId) {
      queryParams["periodId"] = params.fiscalPeriodId;
    }
    if (params.preset) {
      queryParams["preset"] = params.preset;
    }
    // Balance General requiere asOfDate: si viene en params la usamos;
    // si hay preset, el service la resuelve — pero la ruta exige el campo date siempre.
    // Usamos la fecha de hoy como fallback cuando hay preset o period.
    const asOfDate = params.asOfDate ?? new Date().toISOString().slice(0, 10);
    queryParams["date"] = asOfDate;

    if (params.breakdownBy && params.breakdownBy !== "total") {
      queryParams["breakdownBy"] = params.breakdownBy;
    }
    if (params.compareWith && params.compareWith !== "none") {
      queryParams["compareWith"] = params.compareWith;
    }
    if (params.compareAsOfDate) {
      queryParams["compareAsOfDate"] = params.compareAsOfDate;
    }

    setExportQueryParams(queryParams);

    try {
      const searchParams = new URLSearchParams(queryParams);
      const res = await fetch(
        `/api/organizations/${orgSlug}/financial-statements/balance-sheet?${searchParams.toString()}`,
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Error al generar el balance (${res.status})`);
        return;
      }

      const data = await res.json();
      // La API devuelve el objeto serializado; aseguramos que columns esté presente
      if (!data.columns || data.columns.length === 0) {
        data.columns = [{ id: "col-current", label: "Total", role: "current" }];
      }
      setStatement(data as SerializedBalanceSheetResponse);
    } catch {
      setError("Error de conexión. Por favor intente nuevamente.");
    } finally {
      setLoading(false);
    }
  }, [orgSlug]);

  async function handleSubmit(params: QuickBooksFilterParams) {
    if (params.type !== "balance-sheet") return;
    setLastParams(params);
    await fetchStatement(params);
  }

  async function handleRefresh() {
    if (lastParams) {
      await fetchStatement(lastParams);
    }
  }

  async function handleAnalyze() {
    if (!statement || analyzing) return;

    setAnalyzing(true);
    setAnalysis(null);

    try {
      const res = await fetch(
        `/api/organizations/${orgSlug}/financial-statements/balance-sheet/analyze`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(exportQueryParams),
        },
      );

      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        setAnalysis({
          status: "error",
          reason:
            body.message ??
            "Excediste el límite de consultas por hora. Intentá de nuevo más tarde.",
        });
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setAnalysis({
          status: "error",
          reason:
            body.error ??
            `Error al generar el análisis (${res.status}).`,
        });
        return;
      }

      const data = (await res.json()) as AnalyzeBalanceSheetResult;
      setAnalysis(data);
    } catch {
      setAnalysis({
        status: "error",
        reason: "Error de conexión. Intentá de nuevo.",
      });
    } finally {
      setAnalyzing(false);
    }
  }

  // Construir árbol de filas para TanStack Table
  const tableRows = statement ? buildBalanceSheetTableRows(statement) : [];
  const tableColumns: SerializedColumn[] = statement?.columns ?? [];

  return (
    <div className="space-y-4">
      {/* Formulario de filtros */}
      <Card>
        <CardContent className="pt-6">
          <StatementFilters
            mode="balance-sheet"
            periods={periods}
            onSubmit={handleSubmit}
            loading={loading}
          />
        </CardContent>
      </Card>

      {/* Toolbar — siempre visible cuando hay o hubo un informe */}
      {(statement || lastParams) && (
        <StatementToolbar
          orgSlug={orgSlug}
          endpoint="balance-sheet"
          queryParams={exportQueryParams}
          compact={compact}
          onToggleCompact={() => setCompact((c) => !c)}
          onRefresh={handleRefresh}
          refreshing={loading}
          hasStatement={!!statement}
          onAnalyze={handleAnalyze}
          analyzing={analyzing}
        />
      )}

      {/* Estado de carga */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">Generando Balance General...</span>
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

      {/* Resultado */}
      {statement && !loading && (
        <div className="space-y-4">
          {/* Banners */}
          <ImbalanceBanner
            imbalanced={statement.current.imbalanced}
            imbalanceDelta={statement.current.imbalanceDelta}
          />
          <OppositeSignWarning accounts={statement.current.oppositeSignAccounts ?? []} />

          {/* Tabla TanStack */}
          <Card>
            <CardContent className="pt-4 pb-6 px-0 overflow-hidden">
              <StatementTable
                columns={tableColumns}
                rows={tableRows}
                compact={compact}
                onRefresh={handleRefresh}
                title="Balance General"
                orgName={displayOrgName}
                subtitle={formatAsOfDate(statement.current.asOfDate)}
              />
            </CardContent>
          </Card>

          {/* Análisis IA — render inline debajo de la tabla, efímero */}
          <BalanceSheetAnalysisCard result={analysis} loading={analyzing} />
        </div>
      )}
    </div>
  );
}

function formatAsOfDate(isoDate: string): string {
  if (!isoDate) return "";
  const datePart = isoDate.slice(0, 10);
  const [y, m, d] = datePart.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (isNaN(date.getTime())) return isoDate;
  const formatted = new Intl.DateTimeFormat("es-BO", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  return `A partir del ${formatted}`;
}
