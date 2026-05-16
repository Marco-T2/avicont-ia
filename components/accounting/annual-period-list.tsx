"use client";

/**
 * AnnualPeriodList — year-grouped accordion of fiscal periods.
 *
 * Replaces flat `period-list.tsx`. Renders one `<AccordionItem>` per fiscal
 * year, ordered newest first, current year expanded by default. Each year
 * header shows: year number, status badge ('Abierta' | 'Cerrada'), N/12
 * cerrados counter, and a year-close button (Phase 7.2+ — disabled-state
 * matrix).
 *
 * Body (collapsed AccordionContent) renders the 12 monthly periods with
 * status, closedAt date, and per-month action buttons.
 *
 * **Props contract** (server-narrowed Snapshot DTOs — R5 NO Prisma value-form
 * per DEC-1): `periodsByYear` is an array of `{year, periods, fiscalYear,
 * summary}` where `summary` is the optional `AnnualCloseSummary` for years
 * that the server pre-fetched (typically current + open prior).
 *
 * **Voseo Rioplatense**: 'Abierta' / 'Cerrada' (feminine — concords with
 * 'la gestion'), 'Cerrar la gestion {year}', 'Diciembre se cierra junto con
 * la gestion anual' (REQ-7.3, REQ-7.4).
 *
 * Citation: design rev 2 section 8 + spec REQ-7.1/7.2/7.3/7.4/7.5.
 *
 * Phase 7.1 GREEN: minimal accordion + header counts + status badge.
 * Phase 7.2-7.6 add: year-close button gate, Dec disabled tooltip, dialog.
 */

import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";
import Link from "next/link";
import type { FiscalPeriod } from "@/modules/fiscal-periods/presentation/index";
import type { AnnualCloseSummary } from "@/modules/annual-close/presentation/index";
import { formatDateBO } from "@/lib/date-utils";
import AnnualCloseDialog from "./annual-close-dialog";

export interface YearGroup {
  year: number;
  periods: FiscalPeriod[];
  fiscalYear: {
    id: string;
    status: "OPEN" | "CLOSED";
    closedAt: Date | string | null;
    closingEntryId: string | null;
    openingEntryId: string | null;
  } | null;
  summary: AnnualCloseSummary | null;
}

export type PeriodsByYear = YearGroup[];

interface AnnualPeriodListProps {
  orgSlug: string;
  periodsByYear: PeriodsByYear;
}

const MONTHS_PER_YEAR = 12;
const DEC_MONTH = 12;

function countClosed(periods: FiscalPeriod[]): number {
  return periods.filter((p) => p.status === "CLOSED").length;
}

export default function AnnualPeriodList({
  orgSlug,
  periodsByYear,
}: AnnualPeriodListProps) {
  // Sort newest-first defensively (server should already sort, but UI is the
  // last line — voseo phase 7 invariant).
  const sortedYears = [...periodsByYear].sort((a, b) => b.year - a.year);
  const newestYear = sortedYears[0]?.year;
  const [openYear, setOpenYear] = useState<number | null>(null);
  const [activeYearForDialog, setActiveYearForDialog] = useState<number | null>(
    null,
  );

  const defaultOpen =
    newestYear != null ? [String(newestYear)] : ([] as string[]);

  return (
    <>
      <Accordion type="multiple" defaultValue={defaultOpen}>
        {sortedYears.map((group) => {
          const closed = countClosed(group.periods);
          const status = group.fiscalYear?.status ?? "OPEN";
          const badgeLabel = status === "CLOSED" ? "Cerrada" : "Abierta";

          return (
            <AccordionItem key={group.year} value={String(group.year)}>
              <AccordionTrigger>
                <div className="flex flex-1 items-center gap-4">
                  <span className="text-base font-semibold">{group.year}</span>
                  <Badge
                    variant={status === "CLOSED" ? "secondary" : "default"}
                    className={
                      status === "CLOSED"
                        ? "bg-muted text-muted-foreground"
                        : "bg-success/10 text-success dark:bg-success/20"
                    }
                  >
                    {badgeLabel}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {closed}/{MONTHS_PER_YEAR} cerrados
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <YearPeriodsTable
                  orgSlug={orgSlug}
                  group={group}
                  onCloseYear={() => {
                    setActiveYearForDialog(group.year);
                    setOpenYear(group.year);
                  }}
                />
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {activeYearForDialog != null && (
        <AnnualCloseDialog
          orgSlug={orgSlug}
          year={activeYearForDialog}
          summary={
            sortedYears.find((g) => g.year === activeYearForDialog)?.summary ??
            null
          }
          open={openYear === activeYearForDialog}
          onOpenChange={(o) => {
            setOpenYear(o ? activeYearForDialog : null);
            if (!o) setActiveYearForDialog(null);
          }}
        />
      )}
    </>
  );
}

interface YearPeriodsTableProps {
  orgSlug: string;
  group: YearGroup;
  onCloseYear: () => void;
}

function YearPeriodsTable({ orgSlug, group, onCloseYear }: YearPeriodsTableProps) {
  const { periods, fiscalYear } = group;
  const closedCount = countClosed(periods);
  const monthsOneToElevenClosed =
    periods
      .filter((p) => p.month >= 1 && p.month <= MONTHS_PER_YEAR - 1)
      .every((p) => p.status === "CLOSED") &&
    periods.filter((p) => p.month >= 1 && p.month <= MONTHS_PER_YEAR - 1)
      .length === MONTHS_PER_YEAR - 1;
  const disableDecMonthlyClose =
    monthsOneToElevenClosed && fiscalYear?.status !== "CLOSED";

  if (periods.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <CalendarDays className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">
            No hay períodos creados para esta gestion.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="text-sm text-muted-foreground">
            {closedCount}/{MONTHS_PER_YEAR} períodos cerrados
          </div>
          <YearCloseAction
            group={group}
            onCloseYear={onCloseYear}
            closedCount={closedCount}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                  Mes
                </th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                  Inicio
                </th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                  Cierre
                </th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                  Estado
                </th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {[...periods]
                .sort((a, b) => a.month - b.month)
                .map((p) => {
                  const isDec = p.month === DEC_MONTH;
                  const disableMonthlyClose =
                    isDec && disableDecMonthlyClose;
                  return (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="px-4 py-2 font-medium">{p.name}</td>
                      <td className="px-4 py-2">
                        {formatDateBO(p.startDate)}
                      </td>
                      <td className="px-4 py-2">
                        {p.closedAt ? formatDateBO(p.closedAt) : "—"}
                      </td>
                      <td className="px-4 py-2">
                        {p.status === "OPEN" ? (
                          <Badge className="bg-success/10 text-success dark:bg-success/20">
                            Abierto
                          </Badge>
                        ) : (
                          <Badge className="bg-muted text-muted-foreground">
                            Cerrado
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {p.status === "OPEN" &&
                          (disableMonthlyClose ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled
                              title="Diciembre se cierra junto con la gestion anual"
                            >
                              Cerrar
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" asChild>
                              <Link
                                href={`/${orgSlug}/accounting/monthly-close?periodId=${p.id}`}
                              >
                                Cerrar
                              </Link>
                            </Button>
                          ))}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

interface YearCloseActionProps {
  group: YearGroup;
  onCloseYear: () => void;
  closedCount: number;
}

function YearCloseAction({
  group,
  onCloseYear,
  closedCount,
}: YearCloseActionProps) {
  const status = group.fiscalYear?.status ?? "OPEN";

  if (status === "CLOSED") {
    const closedAt = group.fiscalYear?.closedAt;
    return (
      <Button variant="outline" size="sm" disabled>
        {closedAt
          ? `Año cerrado el ${formatDateBO(closedAt)}`
          : "Año cerrado"}
      </Button>
    );
  }

  const summary = group.summary;
  const gateAllowed = summary?.gateAllowed === true;

  if (!gateAllowed) {
    const missing = MONTHS_PER_YEAR - 1 - closedCount;
    const reason =
      summary?.gateReason ??
      (missing > 0
        ? `Falta cerrar ${missing} mes(es) antes de cerrar la gestion ${group.year}.`
        : `Aun no podes cerrar la gestion ${group.year}.`);

    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        title={reason}
        aria-label={reason}
      >
        {missing > 0
          ? `Falta cerrar meses (${missing})`
          : "Resolve los pendientes"}
      </Button>
    );
  }

  return (
    <Button variant="default" size="sm" onClick={onCloseYear}>
      Cerrar la gestion {group.year}
    </Button>
  );
}
