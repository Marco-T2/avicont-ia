"use client";

// Formulario de filtros QuickBooks-style para estados financieros.
// Soporta: períodos fiscales, 17 macros de período, rango custom, breakdownBy,
// compareWith (con rango custom comparativo opcional).
// Emite onSubmit(params: QuickBooksFilterParams) cuando el usuario confirma.
// La precedencia de filtrado es: fiscalPeriodId > preset > custom (diseño §3.2).

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
import type { DatePresetId, BreakdownBy, CompareWith } from "@/modules/accounting/financial-statements/presentation";

type StatementMode = "balance-sheet" | "income-statement";

// Sentinel para la opción "Sin selección" en Select (Radix no admite value="")
const NO_PERIOD = "__none__";
const NO_PRESET = "__none__";

// ── Labels en español para los 17 macros de período ──

const PRESET_OPTIONS: { value: DatePresetId; label: string }[] = [
  { value: "all_dates", label: "Todas las fechas" },
  { value: "today", label: "Hoy" },
  { value: "yesterday", label: "Ayer" },
  { value: "this_week", label: "Esta semana" },
  { value: "last_week", label: "Semana pasada" },
  { value: "this_month", label: "Este mes" },
  { value: "this_month_to_date", label: "Este mes hasta hoy" },
  { value: "last_month", label: "Mes pasado" },
  { value: "this_quarter", label: "Este trimestre" },
  { value: "last_quarter", label: "Trimestre pasado" },
  { value: "this_year", label: "Este año" },
  { value: "this_year_to_date", label: "Este año hasta hoy" },
  { value: "last_year", label: "Año pasado" },
  { value: "last_30_days", label: "Últimos 30 días" },
  { value: "last_90_days", label: "Últimos 90 días" },
  { value: "last_12_months", label: "Últimos 12 meses" },
  { value: "custom_date", label: "Rango personalizado" },
];

const BREAKDOWN_OPTIONS: { value: BreakdownBy; label: string }[] = [
  { value: "total", label: "Total" },
  { value: "months", label: "Meses" },
  { value: "quarters", label: "Trimestres" },
  { value: "years", label: "Años" },
];

const COMPARE_OPTIONS: { value: CompareWith; label: string }[] = [
  { value: "none", label: "Ninguno" },
  { value: "previous_period", label: "Período anterior" },
  { value: "previous_year", label: "Año anterior" },
  { value: "custom", label: "Personalizado" },
];

// ── Tipo de params emitido ──

export type QuickBooksFilterParams = {
  type: "balance-sheet" | "income-statement";
  // Precedencia: fiscalPeriodId > preset > custom
  fiscalPeriodId?: string;
  preset?: DatePresetId;
  asOfDate?: string;        // BS: fecha de corte (requerida si no hay preset ni period)
  dateFrom?: string;        // IS: inicio del rango custom
  dateTo?: string;          // IS: fin del rango custom
  breakdownBy?: BreakdownBy;
  compareWith?: CompareWith;
  compareAsOfDate?: string;  // BS comparative custom
  compareDateFrom?: string;  // IS comparative custom
  compareDateTo?: string;    // IS comparative custom
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
  onSubmit: (params: QuickBooksFilterParams) => void;
  loading?: boolean;
}

export function StatementFilters({
  orgSlug,
  mode,
  onSubmit,
  loading = false,
}: StatementFiltersProps) {
  // ── Carga de períodos fiscales (lógica original preservada) ──
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [loadingPeriods, setLoadingPeriods] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoadingPeriods(true);
      try {
        const res = await fetch(`/api/organizations/${orgSlug}/periods`);
        const data: FiscalPeriod[] = res.ok ? await res.json() : [];
        setPeriods(data);
      } catch {
        setPeriods([]);
      } finally {
        setLoadingPeriods(false);
      }
    };
    load();
  }, [orgSlug]);

  // ── Estado del formulario ──

  // Período fiscal seleccionado
  const [periodId, setPeriodId] = useState<string>(NO_PERIOD);
  const hasPeriod = periodId !== NO_PERIOD && periodId !== "";

  // Macro de período (preset)
  const [preset, setPreset] = useState<string>(NO_PRESET);
  const hasPreset = preset !== NO_PRESET && preset !== "";
  const isCustomDate = preset === "custom_date";

  // Campos custom para Balance General
  const [asOfDate, setAsOfDate] = useState<string>("");

  // Campos custom para Estado de Resultados
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Breakdown y comparativo
  const [breakdownBy, setBreakdownBy] = useState<BreakdownBy>("total");
  const [compareWith, setCompareWith] = useState<CompareWith>("none");
  const isCustomCompare = compareWith === "custom";

  // Fechas custom del comparativo
  const [compareAsOfDate, setCompareAsOfDate] = useState<string>("");
  const [compareDateFrom, setCompareDateFrom] = useState<string>("");
  const [compareDateTo, setCompareDateTo] = useState<string>("");

  // Cuando se selecciona un período fiscal, limpiar preset y viceversa
  function handlePeriodChange(value: string) {
    setPeriodId(value);
    if (value !== NO_PERIOD) {
      setPreset(NO_PRESET);
    }
  }

  function handlePresetChange(value: string) {
    setPreset(value);
    if (value !== NO_PRESET) {
      setPeriodId(NO_PERIOD);
    }
  }

  // ── Validación antes de enviar ──
  function isSubmittable(): boolean {
    if (hasPeriod || hasPreset) return true;

    if (mode === "balance-sheet") {
      return !!asOfDate;
    }
    // income-statement: necesita rango custom
    return !!(dateFrom && dateTo);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSubmittable()) return;

    const params: QuickBooksFilterParams = {
      type: mode,
      breakdownBy: breakdownBy !== "total" ? breakdownBy : undefined,
      compareWith: compareWith !== "none" ? compareWith : undefined,
    };

    // Precedencia: período fiscal > preset > custom
    if (hasPeriod) {
      params.fiscalPeriodId = periodId;
    } else if (hasPreset && !isCustomDate) {
      params.preset = preset as DatePresetId;
    } else {
      // Rango custom
      if (mode === "balance-sheet") {
        params.asOfDate = asOfDate;
      } else {
        params.dateFrom = dateFrom;
        params.dateTo = dateTo;
      }
    }

    // Comparative custom
    if (isCustomCompare) {
      if (mode === "balance-sheet" && compareAsOfDate) {
        params.compareAsOfDate = compareAsOfDate;
      } else if (mode === "income-statement" && compareDateFrom && compareDateTo) {
        params.compareDateFrom = compareDateFrom;
        params.compareDateTo = compareDateTo;
      }
    }

    onSubmit(params);
  }

  // ── Derivar si los campos custom deben mostrarse ──
  // Para BS: mostrar asOfDate cuando no hay período ni preset (o preset=custom_date)
  const showBSCustomDate = mode === "balance-sheet" && !hasPeriod && (!hasPreset || isCustomDate);
  // Para IS: mostrar rango custom cuando no hay período ni preset (o preset=custom_date)
  const showISCustomRange = mode === "income-statement" && !hasPeriod && (!hasPreset || isCustomDate);

  const fieldClass = "flex flex-col gap-1 min-w-[160px]";
  const labelClass = "text-xs font-medium text-muted-foreground";

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      {/* ── Período Fiscal ── */}
      <div className={fieldClass}>
        <Label htmlFor="period-select" className={labelClass}>
          Período Fiscal
        </Label>
        <Select
          value={periodId}
          onValueChange={handlePeriodChange}
          disabled={loadingPeriods}
        >
          <SelectTrigger id="period-select" size="sm" className="w-[180px]">
            <SelectValue
              placeholder={
                loadingPeriods ? "Cargando..." : "Sin período"
              }
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_PERIOD}>Sin período (rango libre)</SelectItem>
            {periods.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}{" "}
                <span className="text-xs text-muted-foreground">
                  ({p.status === "CLOSED" ? "Cerrado" : "Abierto"})
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Período del informe (17 macros) — solo si no hay período fiscal ── */}
      {!hasPeriod && (
        <div className={fieldClass}>
          <Label htmlFor="preset-select" className={labelClass}>
            Período del informe
          </Label>
          <Select value={preset} onValueChange={handlePresetChange}>
            <SelectTrigger id="preset-select" size="sm" className="w-[180px]">
              <SelectValue placeholder="Seleccionar..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_PRESET}>— Seleccionar —</SelectItem>
              {PRESET_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* ── Fecha de corte (Balance General, custom) ── */}
      {showBSCustomDate && (
        <div className={fieldClass}>
          <Label htmlFor="as-of-date" className={labelClass}>
            Fecha de Corte *
          </Label>
          <Input
            id="as-of-date"
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            required={showBSCustomDate}
            className="h-9 w-[160px]"
          />
        </div>
      )}

      {/* ── Rango custom (Estado de Resultados) ── */}
      {showISCustomRange && (
        <>
          <div className={fieldClass}>
            <Label htmlFor="date-from" className={labelClass}>
              Desde *
            </Label>
            <Input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              required={showISCustomRange}
              className="h-9 w-[150px]"
            />
          </div>
          <div className={fieldClass}>
            <Label htmlFor="date-to" className={labelClass}>
              Hasta *
            </Label>
            <Input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              required={showISCustomRange}
              min={dateFrom}
              className="h-9 w-[150px]"
            />
          </div>
        </>
      )}

      {/* ── Mostrar columnas por (breakdownBy) ── */}
      <div className={fieldClass}>
        <Label htmlFor="breakdown-select" className={labelClass}>
          Columnas por
        </Label>
        <Select
          value={breakdownBy}
          onValueChange={(v) => setBreakdownBy(v as BreakdownBy)}
        >
          <SelectTrigger id="breakdown-select" size="sm" className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BREAKDOWN_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Comparar con ── */}
      <div className={fieldClass}>
        <Label htmlFor="compare-select" className={labelClass}>
          Comparar con
        </Label>
        <Select
          value={compareWith}
          onValueChange={(v) => setCompareWith(v as CompareWith)}
        >
          <SelectTrigger id="compare-select" size="sm" className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COMPARE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Fechas custom del comparativo ── */}
      {isCustomCompare && mode === "balance-sheet" && (
        <div className={fieldClass}>
          <Label htmlFor="compare-as-of-date" className={labelClass}>
            Corte comparativo *
          </Label>
          <Input
            id="compare-as-of-date"
            type="date"
            value={compareAsOfDate}
            onChange={(e) => setCompareAsOfDate(e.target.value)}
            className="h-9 w-[160px]"
          />
        </div>
      )}

      {isCustomCompare && mode === "income-statement" && (
        <>
          <div className={fieldClass}>
            <Label htmlFor="compare-date-from" className={labelClass}>
              Comp. desde *
            </Label>
            <Input
              id="compare-date-from"
              type="date"
              value={compareDateFrom}
              onChange={(e) => setCompareDateFrom(e.target.value)}
              className="h-9 w-[150px]"
            />
          </div>
          <div className={fieldClass}>
            <Label htmlFor="compare-date-to" className={labelClass}>
              Comp. hasta *
            </Label>
            <Input
              id="compare-date-to"
              type="date"
              value={compareDateTo}
              onChange={(e) => setCompareDateTo(e.target.value)}
              min={compareDateFrom}
              className="h-9 w-[150px]"
            />
          </div>
        </>
      )}

      {/* ── Botón Generar ── */}
      <Button type="submit" size="sm" disabled={loading || !isSubmittable()}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Generar
      </Button>
    </form>
  );
}
