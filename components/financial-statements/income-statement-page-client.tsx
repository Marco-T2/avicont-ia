"use client";

// Cliente de la página de Estado de Resultados
// Orquesta filtros → fetch → visualización + banner preliminar + export
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { StatementFilters } from "./statement-filters";
import type { StatementFilterParams } from "./statement-filters";
import { IncomeStatementView } from "./income-statement-view";
import type { SerializedIncomeStatement } from "./income-statement-view";
import { PreliminaryBanner } from "./preliminary-banner";
import { ExportButtons } from "./export-buttons";
import { Loader2 } from "lucide-react";

interface IncomeStatementPageClientProps {
  orgSlug: string;
}

export function IncomeStatementPageClient({
  orgSlug,
}: IncomeStatementPageClientProps) {
  const [statement, setStatement] = useState<SerializedIncomeStatement | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastParams, setLastParams] = useState<Record<string, string>>({});

  async function handleSubmit(params: StatementFilterParams) {
    if (params.type !== "income-statement") return;

    setLoading(true);
    setError(null);
    setStatement(null);

    const queryParams: Record<string, string> = {};
    if ("periodId" in params && params.periodId) {
      queryParams["periodId"] = params.periodId;
    } else if ("dateFrom" in params && params.dateFrom && params.dateTo) {
      queryParams["dateFrom"] = params.dateFrom;
      queryParams["dateTo"] = params.dateTo;
    }

    setLastParams(queryParams);

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

      const data: SerializedIncomeStatement = await res.json();
      setStatement(data);
    } catch {
      setError("Error de conexión. Por favor intente nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
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

      {/* Estado de carga */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <span className="ml-3 text-gray-500">Generando Estado de Resultados...</span>
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

      {/* Resultado */}
      {statement && !loading && (
        <div className="space-y-4">
          {/* Banner PRELIMINAR (no hay ImbalanceBanner en ER) */}
          <PreliminaryBanner show={statement.current.preliminary} />

          {/* Botones de exportación */}
          <div className="flex justify-end">
            <ExportButtons
              orgSlug={orgSlug}
              endpoint="income-statement"
              queryParams={lastParams}
            />
          </div>

          {/* Tabla jerárquica */}
          <Card>
            <CardContent className="pt-4 pb-6 px-0">
              <IncomeStatementView statement={statement} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
