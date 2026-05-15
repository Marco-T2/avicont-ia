"use client";

/**
 * WorksheetFilters — date range + fiscal period filter form for the Hoja de Trabajo.
 *
 * Defaults applied on mount: dateTo = today, dateFrom = today - 1 month.
 * Optional fiscal-period <select> when `periods` prop is provided; selecting a
 * period auto-fills the date inputs from its startDate/endDate range. The
 * fiscalPeriodId is then passed through to onFilter so the API can intersect
 * the date range with the period scope.
 *
 * Covers REQ-10 (UI filter surface).
 */

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export interface WorksheetFilterValues {
  dateFrom: Date;
  dateTo: Date;
  fiscalPeriodId?: string;
}

export interface FiscalPeriodOption {
  id: string;
  name: string;
  /** YYYY-MM-DD slice from FiscalPeriodSnapshot.startDate */
  startDate: string;
  /** YYYY-MM-DD slice from FiscalPeriodSnapshot.endDate */
  endDate: string;
}

interface WorksheetFiltersProps {
  onFilter: (filters: WorksheetFilterValues) => void;
  loading: boolean;
  initialDateFrom?: string;
  initialDateTo?: string;
  periods?: FiscalPeriodOption[];
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultRange(): { from: string; to: string } {
  const today = new Date();
  const oneMonthAgo = new Date(today);
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  return { from: toIsoDate(oneMonthAgo), to: toIsoDate(today) };
}

export function WorksheetFilters({
  onFilter,
  loading,
  initialDateFrom,
  initialDateTo,
  periods = [],
}: WorksheetFiltersProps) {
  const defaults = defaultRange();
  const [dateFrom, setDateFrom] = useState(initialDateFrom || defaults.from);
  const [dateTo, setDateTo] = useState(initialDateTo || defaults.to);
  const [fiscalPeriodId, setFiscalPeriodId] = useState<string>("");

  function handlePeriodChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setFiscalPeriodId(id);
    if (!id) return;
    const period = periods.find((p) => p.id === id);
    if (period) {
      setDateFrom(period.startDate);
      setDateTo(period.endDate);
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dateFrom || !dateTo) return;
    onFilter({
      dateFrom: new Date(dateFrom),
      dateTo: new Date(dateTo),
      fiscalPeriodId: fiscalPeriodId || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
      {periods.length > 0 && (
        <div className="flex flex-col gap-1">
          <Label htmlFor="worksheet-period">Período fiscal</Label>
          <select
            id="worksheet-period"
            value={fiscalPeriodId}
            onChange={handlePeriodChange}
            disabled={loading}
            className="w-48 h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label="Período fiscal"
          >
            <option value="">— Sin período (usar fechas) —</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <Label htmlFor="worksheet-date-from">Fecha de inicio</Label>
        <Input
          id="worksheet-date-from"
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          disabled={loading}
          className="w-40"
          aria-label="Fecha de inicio"
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="worksheet-date-to">Fecha de fin</Label>
        <Input
          id="worksheet-date-to"
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          disabled={loading}
          className="w-40"
          aria-label="Fecha de fin"
        />
      </div>

      <Button
        type="submit"
        disabled={loading || !dateFrom || !dateTo}
        className="mt-auto"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Cargando...
          </>
        ) : (
          "Generar"
        )}
      </Button>
    </form>
  );
}
