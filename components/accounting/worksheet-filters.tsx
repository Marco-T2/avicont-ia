"use client";

/**
 * WorksheetFilters — date range filter form for the Hoja de Trabajo.
 *
 * Controlled date range inputs (dateFrom / dateTo).
 * On submit calls onFilter with WorksheetFilters shape.
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

interface WorksheetFiltersProps {
  onFilter: (filters: WorksheetFilterValues) => void;
  loading: boolean;
  initialDateFrom?: string;
  initialDateTo?: string;
}

export function WorksheetFilters({
  onFilter,
  loading,
  initialDateFrom = "",
  initialDateTo = "",
}: WorksheetFiltersProps) {
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!dateFrom || !dateTo) return;

    onFilter({
      dateFrom: new Date(dateFrom),
      dateTo: new Date(dateTo),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
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
