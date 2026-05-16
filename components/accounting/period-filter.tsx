"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MONTH_NAMES_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export interface PeriodFilterPeriod {
  id: string;
  name: string;
  year: number;
  month: number;
}

export interface PeriodFilterProps {
  /** All periods across all fiscal years; the component filters by selectedYear internally. */
  periods: PeriodFilterPeriod[];
  /** Distinct fiscal years (4-digit) available to choose from. Order is preserved as given. */
  availableYears: number[];
  /** Currently-selected fiscal year. Drives which periods appear in the period dropdown. */
  selectedYear: number;
  /** Currently-selected period id; null/undefined means "all periods within the selected year". */
  selectedPeriodId?: string | null;
  /** Fires when the user picks a different fiscal year. Consumer is responsible for
   *  clearing the period selection if it no longer belongs to the new year. */
  onYearChange: (year: number) => void;
  /** Fires when the user picks a specific period, or null when "Todos los períodos" is chosen. */
  onPeriodChange: (periodId: string | null) => void;
  /** Optional label overrides for i18n / module-specific copy. */
  labels?: {
    year?: string;
    period?: string;
    allPeriods?: string;
  };
  /** Tailwind width classes for the trigger buttons. Default `w-32` (year) / `w-48` (period). */
  triggerWidths?: { year?: string; period?: string };
}

function formatPeriodLabel(period: PeriodFilterPeriod): string {
  const monthName = MONTH_NAMES_ES[period.month - 1] ?? `Mes ${period.month}`;
  return `${monthName} ${period.year}`;
}

/**
 * Two paired selects: Gestión (fiscal year) → Período (month within year).
 *
 * Agnostic of any module — consumers (Journal, Sales, Purchases, etc.) pass
 * pre-derived `availableYears` + the full `periods` array and wire the
 * callbacks to their URL/state of choice. The component handles the
 * year-filtering and month-sorting of the period dropdown internally.
 */
export default function PeriodFilter({
  periods,
  availableYears,
  selectedYear,
  selectedPeriodId,
  onYearChange,
  onPeriodChange,
  labels,
  triggerWidths,
}: PeriodFilterProps) {
  const periodsForYear = periods
    .filter((p) => p.year === selectedYear)
    .sort((a, b) => a.month - b.month);

  return (
    <>
      <div className="space-y-1">
        <Label className="text-sm">{labels?.year ?? "Gestión"}</Label>
        <Select
          value={String(selectedYear)}
          onValueChange={(v) => onYearChange(Number(v))}
        >
          <SelectTrigger className={triggerWidths?.year ?? "w-32"}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableYears.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-sm">{labels?.period ?? "Período"}</Label>
        <Select
          value={selectedPeriodId ?? "all"}
          onValueChange={(v) => onPeriodChange(v === "all" ? null : v)}
        >
          <SelectTrigger className={triggerWidths?.period ?? "w-48"}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {labels?.allPeriods ?? "Todos los períodos"}
            </SelectItem>
            {periodsForYear.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {formatPeriodLabel(p)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
