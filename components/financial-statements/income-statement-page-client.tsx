"use client";

// Cliente de la página de Estado de Resultados — estilo QuickBooks.
// Orquesta: filtros → fetch → toolbar + tabla TanStack + banner preliminar.
import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { StatementFilters } from "./statement-filters";
import type { QuickBooksFilterParams } from "./statement-filters";
import { StatementTable } from "./statement-table";
import { StatementToolbar } from "./statement-toolbar";
import { PreliminaryBanner } from "./preliminary-banner";
import {
  buildIncomeStatementTableRows,
} from "@/features/accounting/financial-statements/statement-table-rows.utils";
import type {
  SerializedIncomeStatementResponse,
  SerializedColumn,
} from "@/features/accounting/financial-statements/statement-table-rows.utils";

interface IncomeStatementPageClientProps {
  orgSlug: string;
  orgName?: string;
}

export function IncomeStatementPageClient({ orgSlug, orgName }: IncomeStatementPageClientProps) {
  const displayOrgName = orgName ?? orgSlug.charAt(0).toUpperCase() + orgSlug.slice(1);
  const [statement, setStatement] = useState<SerializedIncomeStatementResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compact, setCompact] = useState(false);
  const [lastParams, setLastParams] = useState<QuickBooksFilterParams | null>(null);
  const [exportQueryParams, setExportQueryParams] = useState<Record<string, string>>({});

  const fetchStatement = useCallback(async (params: QuickBooksFilterParams) => {
    setLoading(true);
    setError(null);

    // Construir query params para la API
    const queryParams: Record<string, string> = {};

    if (params.fiscalPeriodId) {
      queryParams["periodId"] = params.fiscalPeriodId;
    }
    if (params.preset) {
      queryParams["preset"] = params.preset;
    }
    if (params.dateFrom) {
      queryParams["dateFrom"] = params.dateFrom;
    }
    if (params.dateTo) {
      queryParams["dateTo"] = params.dateTo;
    }
    if (params.breakdownBy && params.breakdownBy !== "total") {
      queryParams["breakdownBy"] = params.breakdownBy;
    }
    if (params.compareWith && params.compareWith !== "none") {
      queryParams["compareWith"] = params.compareWith;
    }
    if (params.compareDateFrom) {
      queryParams["compareDateFrom"] = params.compareDateFrom;
    }
    if (params.compareDateTo) {
      queryParams["compareDateTo"] = params.compareDateTo;
    }

    setExportQueryParams(queryParams);

    try {
      const searchParams = new URLSearchParams(queryParams);
      const res = await fetch(
        `/api/organizations/${orgSlug}/financial-statements/income-statement?${searchParams.toString()}`,
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(
          body.error ?? `Error al generar el estado de resultados (${res.status})`,
        );
        return;
      }

      const data = await res.json();
      // Garantizar que columns esté presente (backward compat)
      if (!data.columns || data.columns.length === 0) {
        data.columns = [{ id: "col-current", label: "Total", role: "current" }];
      }
      setStatement(data as SerializedIncomeStatementResponse);
    } catch {
      setError("Error de conexión. Por favor intente nuevamente.");
    } finally {
      setLoading(false);
    }
  }, [orgSlug]);

  async function handleSubmit(params: QuickBooksFilterParams) {
    if (params.type !== "income-statement") return;
    setLastParams(params);
    await fetchStatement(params);
  }

  async function handleRefresh() {
    if (lastParams) {
      await fetchStatement(lastParams);
    }
  }

  const tableRows = statement ? buildIncomeStatementTableRows(statement) : [];
  const tableColumns: SerializedColumn[] = statement?.columns ?? [];

  return (
    <div className="space-y-4">
      {/* Formulario de filtros */}
      <Card>
        <CardContent className="pt-6">
          <StatementFilters
            orgSlug={orgSlug}
            mode="income-statement"
            onSubmit={handleSubmit}
            loading={loading}
          />
        </CardContent>
      </Card>

      {/* Toolbar */}
      {(statement || lastParams) && (
        <StatementToolbar
          orgSlug={orgSlug}
          endpoint="income-statement"
          queryParams={exportQueryParams}
          compact={compact}
          onToggleCompact={() => setCompact((c) => !c)}
          onRefresh={handleRefresh}
          refreshing={loading}
          hasStatement={!!statement}
        />
      )}

      {/* Estado de carga */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">Generando Estado de Resultados...</span>
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
          <PreliminaryBanner show={statement.current.preliminary} />

          <Card>
            <CardContent className="pt-4 pb-6 px-0 overflow-hidden">
              <StatementTable
                columns={tableColumns}
                rows={tableRows}
                compact={compact}
                onRefresh={handleRefresh}
                title="Estado de Resultados"
                orgName={displayOrgName}
                subtitle={formatDateRange(statement.current.dateFrom, statement.current.dateTo)}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function formatDateRange(isoFrom: string, isoTo: string): string {
  const fmt = (iso: string) => {
    if (!iso) return "";
    const datePart = iso.slice(0, 10);
    const [y, m, d] = datePart.split("-").map(Number);
    if (!y || !m || !d) return iso;
    const date = new Date(Date.UTC(y, m - 1, d));
    if (isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat("es-BO", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
  };
  return `Del ${fmt(isoFrom)} al ${fmt(isoTo)}`;
}
