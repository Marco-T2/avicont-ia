"use client";

// Formulario de filtros para estados financieros
// Soporta selección por período fiscal o rango de fechas custom
// Emite onSubmit(params) cuando el usuario hace clic en "Generar"
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export type StatementMode = "balance-sheet" | "income-statement";

// Sentinel para la opción "Sin período" en el Select (Radix no admite value="")
const NO_PERIOD = "__none__";

// Parámetros que emite el formulario al padre
export type StatementFilterParams =
  | { type: "balance-sheet"; asOfDate: string; periodId?: string }
  | {
      type: "income-statement";
      periodId: string;
      dateFrom?: undefined;
      dateTo?: undefined;
    }
  | {
      type: "income-statement";
      periodId?: undefined;
      dateFrom: string;
      dateTo: string;
    };

interface FiscalPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface StatementFiltersProps {
  orgSlug: string;
  mode: StatementMode;
  onSubmit: (params: StatementFilterParams) => void;
  loading?: boolean;
}

export function StatementFilters({
  orgSlug,
  mode,
  onSubmit,
  loading = false,
}: StatementFiltersProps) {
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [loadingPeriods, setLoadingPeriods] = useState(true);

  // Campos del formulario
  const [periodId, setPeriodId] = useState<string>(NO_PERIOD);
  const hasPeriod = periodId !== NO_PERIOD && periodId !== "";
  const [asOfDate, setAsOfDate] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Cargar períodos fiscales disponibles
  useEffect(() => {
    setLoadingPeriods(true);
    fetch(`/api/organizations/${orgSlug}/periods`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: FiscalPeriod[]) => setPeriods(data))
      .catch(() => setPeriods([]))
      .finally(() => setLoadingPeriods(false));
  }, [orgSlug]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (mode === "balance-sheet") {
      if (!asOfDate) return;
      onSubmit({
        type: "balance-sheet",
        asOfDate,
        periodId: hasPeriod ? periodId : undefined,
      });
      return;
    }

    // mode === "income-statement"
    if (hasPeriod) {
      onSubmit({ type: "income-statement", periodId });
      return;
    }
    if (dateFrom && dateTo) {
      onSubmit({ type: "income-statement", dateFrom, dateTo });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Selector de período fiscal (compartido por ambos modos) */}
      <div className="space-y-2">
        <Label htmlFor="period-select">
          Período Fiscal{" "}
          <span className="text-gray-400 font-normal">(opcional)</span>
        </Label>
        <Select
          value={periodId}
          onValueChange={setPeriodId}
          disabled={loadingPeriods}
        >
          <SelectTrigger id="period-select" className="w-full">
            <SelectValue
              placeholder={
                loadingPeriods ? "Cargando períodos..." : "Seleccionar período"
              }
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_PERIOD}>Sin período (rango libre)</SelectItem>
            {periods.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}{" "}
                <span className="text-xs text-gray-500">
                  ({p.status === "CLOSED" ? "Cerrado" : "Abierto"})
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Campos específicos por modo */}
      {mode === "balance-sheet" ? (
        <div className="space-y-2">
          <Label htmlFor="as-of-date">Fecha de Corte *</Label>
          <Input
            id="as-of-date"
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            required
          />
        </div>
      ) : (
        // income-statement: rango de fechas (solo si no hay período seleccionado)
        !hasPeriod && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date-from">Fecha Desde *</Label>
              <Input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                required={!hasPeriod}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-to">Fecha Hasta *</Label>
              <Input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                required={!hasPeriod}
                min={dateFrom}
              />
            </div>
          </div>
        )
      )}

      <Button type="submit" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Generar
      </Button>
    </form>
  );
}
