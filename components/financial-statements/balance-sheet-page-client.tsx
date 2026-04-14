"use client";

// Cliente de la página de Balance General
// Orquesta filtros → fetch → visualización + banners + export
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { StatementFilters } from "./statement-filters";
import type { StatementFilterParams } from "./statement-filters";
import { BalanceSheetView } from "./balance-sheet-view";
import type { SerializedBalanceSheet } from "./balance-sheet-view";
import { PreliminaryBanner } from "./preliminary-banner";
import { ImbalanceBanner } from "./imbalance-banner";
import { ExportButtons } from "./export-buttons";
import { Loader2 } from "lucide-react";

interface BalanceSheetPageClientProps {
  orgSlug: string;
}

export function BalanceSheetPageClient({
  orgSlug,
}: BalanceSheetPageClientProps) {
  const [statement, setStatement] = useState<SerializedBalanceSheet | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guardamos los query params para poder pasarlos a ExportButtons
  const [lastParams, setLastParams] = useState<Record<string, string>>({});

  async function handleSubmit(params: StatementFilterParams) {
    if (params.type !== "balance-sheet") return;

    setLoading(true);
    setError(null);
    setStatement(null);

    const queryParams: Record<string, string> = { date: params.asOfDate };
    if (params.periodId) queryParams["periodId"] = params.periodId;

    setLastParams(queryParams);

    try {
      const searchParams = new URLSearchParams(queryParams);
      const res = await fetch(
        `/api/organizations/${orgSlug}/financial-statements/balance-sheet?${searchParams.toString()}`,
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(
          body.error ?? `Error al generar el balance (${res.status})`,
        );
        return;
      }

      const data: SerializedBalanceSheet = await res.json();
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
            mode="balance-sheet"
            onSubmit={handleSubmit}
            loading={loading}
          />
        </CardContent>
      </Card>

      {/* Estado de carga */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <span className="ml-3 text-gray-500">Generando Balance General...</span>
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
          {/* Banners */}
          <PreliminaryBanner show={statement.current.preliminary} />
          <ImbalanceBanner
            imbalanced={statement.current.imbalanced}
            imbalanceDelta={statement.current.imbalanceDelta}
          />

          {/* Botones de exportación */}
          <div className="flex justify-end">
            <ExportButtons
              orgSlug={orgSlug}
              endpoint="balance-sheet"
              queryParams={lastParams}
            />
          </div>

          {/* Tabla jerárquica */}
          <Card>
            <CardContent className="pt-4 pb-6 px-0">
              <BalanceSheetView statement={statement} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
