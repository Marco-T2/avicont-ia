"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MONTH_NAMES_ES } from "@/modules/fiscal-periods/presentation/index";

interface PeriodCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  onCreated: () => void;
}

/** Pad an integer to two digits: 4 → "04", 12 → "12" */
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Return the last calendar day of a given month (1..12) in a given year */
function lastDayOfMonth(year: number, month: number): number {
  // Day 0 of next month = last day of this month
  return new Date(year, month, 0).getDate();
}

/** Format a date as "YYYY-MM-DD" from year + 1-indexed month + day */
function toDateString(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export default function PeriodCreateDialog({
  open,
  onOpenChange,
  orgSlug,
  onCreated,
}: PeriodCreateDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Month Select state — null means "no month selected yet"
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  // Dirty flags: true when the user has manually edited the field AFTER the
  // last autocomplete. A fresh month selection clears these flags.
  const [manualStartDate, setManualStartDate] = useState(false);
  const [manualEndDate, setManualEndDate] = useState(false);
  const [manualName, setManualName] = useState(false);

  // ── Autocomplete effect ──────────────────────────────────────────────────
  // Runs whenever selectedMonth or year changes. Skips fields that the user
  // has manually overridden since the last month selection.
  useEffect(() => {
    if (selectedMonth === null) return;

    const start = toDateString(year, selectedMonth, 1);
    const end = toDateString(year, selectedMonth, lastDayOfMonth(year, selectedMonth));
    const autoName = `${MONTH_NAMES_ES[selectedMonth - 1]} ${year}`;

    if (!manualStartDate) setStartDate(start);
    if (!manualEndDate) setEndDate(end);
    if (!manualName) setName(autoName);
  }, [selectedMonth, year]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleMonthSelect(value: string) {
    const month = parseInt(value, 10);
    // NOTE: dirty flags are intentionally NOT cleared here.
    // Per REQ-2 / UX-T04: a manual edit must survive all subsequent month
    // and year changes. Flags are only reset on full form reset.
    setSelectedMonth(month);
  }

  function resetForm() {
    setName("");
    setYear(new Date().getFullYear());
    setStartDate("");
    setEndDate("");
    setSelectedMonth(null);
    setManualStartDate(false);
    setManualEndDate(false);
    setManualName(false);
  }

  // ── Derived state ────────────────────────────────────────────────────────

  const isYearValid = year >= 2000 && year <= 2100;

  /** True when the selected range does not map to exactly one calendar month */
  const crossMonthWarning = (() => {
    if (!startDate || !endDate) return false;
    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;

    const startMonth = start.getMonth(); // 0-indexed
    const endMonth = end.getMonth();
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();

    if (startYear !== endYear || startMonth !== endMonth) return true;
    if (start.getDate() !== 1) return true;
    const last = lastDayOfMonth(start.getFullYear(), start.getMonth() + 1);
    if (end.getDate() !== last) return true;

    return false;
  })();

  // ── Submit (single period) ───────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/organizations/${orgSlug}/periods`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          year,
          startDate,
          endDate,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al crear el período");
      }

      toast.success("Período fiscal creado exitosamente");
      resetForm();
      onCreated();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al crear el período",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Batch: "Crear los 12 meses de {year}" ───────────────────────────────

  const [isBatching, setIsBatching] = useState(false);

  async function handleBatch() {
    setIsBatching(true);

    const result = { created: 0, skipped: 0, failed: 0 };

    for (let month = 1; month <= 12; month++) {
      const batchStart = toDateString(year, month, 1);
      const batchEnd = toDateString(year, month, lastDayOfMonth(year, month));
      const batchName = `${MONTH_NAMES_ES[month - 1]} ${year}`;

      try {
        const res = await fetch(`/api/organizations/${orgSlug}/periods`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: batchName,
            year,
            startDate: batchStart,
            endDate: batchEnd,
          }),
        });

        if (res.status === 409) {
          const data = await res.json() as { code?: string };
          if (data.code === "FISCAL_PERIOD_MONTH_EXISTS") {
            result.skipped++;
          } else {
            result.failed++;
          }
          continue;
        }

        if (!res.ok) {
          result.failed++;
          continue;
        }

        result.created++;
      } catch {
        result.failed++;
      }
    }

    setIsBatching(false);

    const parts: string[] = [];
    if (result.created > 0) parts.push(`${result.created} períodos creados`);
    if (result.skipped > 0) parts.push(`${result.skipped} ya existían`);
    if (result.failed > 0) parts.push(`${result.failed} fallidos`);

    toast.success(parts.join(", "));
    onOpenChange(false);
  }

  const isBusy = isSubmitting || isBatching;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo Período Fiscal</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Un período fiscal representa un mes contable. Cerrás uno por mes.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Month Select — positioned before date fields (REQ-2) */}
          <div className="space-y-2">
            <Label>Mes</Label>
            <Select
              value={selectedMonth !== null ? String(selectedMonth) : ""}
              onValueChange={handleMonthSelect}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccioná un mes" />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES_ES.map((monthName, idx) => (
                  <SelectItem key={monthName} value={String(idx + 1)}>
                    {monthName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              placeholder="Ej: Abril 2026"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setManualName(true);
              }}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="year">Año</Label>
            <Input
              id="year"
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="startDate">Fecha de inicio</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setManualStartDate(true);
              }}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate">Fecha de cierre</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setManualEndDate(true);
              }}
              required
            />
          </div>

          {/* Cross-month soft warning (REQ-4) — non-blocking */}
          {crossMonthWarning && (
            <div
              role="alert"
              className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-foreground"
            >
              Este período abarca más de un mes. Al cerrarlo, se bloquearán
              todos los comprobantes del período a la vez. ¿Es lo que querés?
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            {/* Batch button (REQ-3) */}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={isBusy || !isYearValid}
              onClick={handleBatch}
            >
              {isBatching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creando períodos...
                </>
              ) : (
                `Crear los 12 meses de ${year}`
              )}
            </Button>

            <div className="flex gap-2 w-full">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isBusy}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={isBusy || !name || !startDate || !endDate}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creando...
                  </>
                ) : (
                  "Crear Período"
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
