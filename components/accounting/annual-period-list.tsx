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
 * 'la gestión'), 'Cerrar la gestión {year}', 'Diciembre se cierra junto con
 * la gestión anual' (REQ-7.3, REQ-7.4).
 *
 * Citation: design rev 2 section 8 + spec REQ-7.1/7.2/7.3/7.4/7.5.
 *
 * Phase 7.1 GREEN: minimal accordion + header counts + status badge.
 * Phase 7.2-7.6 add: year-close button gate, Dec disabled tooltip, dialog.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CalendarDays, Plus } from "lucide-react";
import type { FiscalPeriod } from "@/modules/fiscal-periods/presentation/index";
import type { AnnualCloseSummary } from "@/modules/annual-close/presentation/index";
import { formatDateBO } from "@/lib/date-utils";
import AnnualCloseDialog from "./annual-close-dialog";
import PeriodCreateDialog from "./period-create-dialog";

export interface YearGroup {
  year: number;
  periods: FiscalPeriod[];
  fiscalYear: {
    id: string;
    status: "OPEN" | "CLOSED";
    closedAt: Date | string | null;
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
  const router = useRouter();
  // Sort newest-first defensively (server should already sort, but UI is the
  // last line — voseo phase 7 invariant).
  const sortedYears = [...periodsByYear].sort((a, b) => b.year - a.year);
  const newestYear = sortedYears[0]?.year;
  const [openYear, setOpenYear] = useState<number | null>(null);
  const [activeYearForDialog, setActiveYearForDialog] = useState<number | null>(
    null,
  );
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const defaultOpen =
    newestYear != null ? [String(newestYear)] : ([] as string[]);

  const isEmpty = sortedYears.length === 0;

  return (
    <TooltipProvider>
      {isEmpty && (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarDays className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
            <p className="text-base font-medium">
              Esta organización no tiene gestiones registradas
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Creá la primera gestión para empezar a registrar movimientos contables.
            </p>
            <Button
              className="mt-4"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Crear primera gestión
            </Button>
          </CardContent>
        </Card>
      )}
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

      <PeriodCreateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        orgSlug={orgSlug}
        onCreated={() => {
          setShowCreateDialog(false);
          router.refresh();
        }}
      />
    </TooltipProvider>
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
            No hay períodos creados para esta gestión.
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
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span tabIndex={0} className="inline-block">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled
                                  >
                                    Cerrar
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                Diciembre se cierra junto con la gestión anual
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <MonthlyCloseButton
                              orgSlug={orgSlug}
                              period={{ id: p.id, name: p.name }}
                            />
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

/**
 * Year-close button state matrix (REQ-7.2 + voseo).
 *
 * Resolved in priority order:
 *  1. FY status CLOSED       → 'Año cerrado el {dd/mm/yyyy}'   disabled outline
 *  2. summary.balance ≠ 0    → 'Asientos no cuadran'           disabled outline
 *  3. summary.gateReason has 'borradores'
 *                            → 'Resolvé borradores de diciembre' disabled outline
 *  4. summary.gateAllowed true → 'Cerrar la gestión {year}'    enabled  default
 *  5. closedCount<11 (no summary or summary denied)
 *                            → 'Falta cerrar meses (N)'        disabled outline
 *  6. fallback              → 'Resolvé los pendientes'         disabled outline
 *
 * Tooltip mechanic: shadcn `<Tooltip>` (Radix-based) wraps disabled buttons
 * via a focusable `<span>` so the tooltip fires on hover AND keyboard focus
 * (native `title=` doesn't work on mobile or keyboard nav). Content carries
 * `summary.gateReason` (server-computed voseo string).
 */
function YearCloseAction({
  group,
  onCloseYear,
  closedCount,
}: YearCloseActionProps) {
  const status = group.fiscalYear?.status ?? "OPEN";

  // (1) FY CLOSED.
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
  const reasonTooltip = summary?.gateReason;

  // (2) Unbalanced balance (REQ-2.1 BalanceNotZeroError surface).
  // NOTE: `title` carries the voseo reason for the native tooltip.
  // We do NOT set `aria-label` (would override the visible accessible name).
  if (summary && summary.balance.balanced === false) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="inline-block">
            <Button variant="outline" size="sm" disabled>
              Asientos no cuadran
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {reasonTooltip ??
            "Los asientos del año no cuadran (DEBE no es igual a HABER)."}
        </TooltipContent>
      </Tooltip>
    );
  }

  // (3) Drafts in December (REQ-2.1 DraftEntriesInDecemberError surface).
  if (
    !gateAllowed &&
    reasonTooltip &&
    /borradores/i.test(reasonTooltip)
  ) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="inline-block">
            <Button variant="outline" size="sm" disabled>
              Resolvé borradores de diciembre
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{reasonTooltip}</TooltipContent>
      </Tooltip>
    );
  }

  // (4) Gate allowed — primary action.
  if (gateAllowed) {
    return (
      <Button variant="default" size="sm" onClick={onCloseYear}>
        Cerrar la gestión {group.year}
      </Button>
    );
  }

  // (5) Missing months fallback (no summary OR generic gate-denied).
  const missing = MONTHS_PER_YEAR - 1 - closedCount;
  const fallbackReason =
    reasonTooltip ??
    (missing > 0
      ? `Falta cerrar ${missing} mes(es) antes de cerrar la gestión ${group.year}.`
      : `Aún no podés cerrar la gestión ${group.year}.`);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-block">
          <Button variant="outline" size="sm" disabled>
            {missing > 0
              ? `Falta cerrar meses (${missing})`
              : "Resolvé los pendientes"}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{fallbackReason}</TooltipContent>
    </Tooltip>
  );
}

// ── MonthlyCloseButton ──────────────────────────────────────────────────────
//
// Fast-close UX: click consulta el summary del período. Si está vacío (0
// posted + 0 drafts), abre confirm dialog inline y POSTea directo al endpoint
// `/monthly-close` reusando el auto-justification del route. Si tiene
// registros, redirige al flujo completo `/accounting/monthly-close?periodId=X`
// donde el panel muestra summary detallado + balance check.

interface MonthlyCloseButtonProps {
  orgSlug: string;
  period: { id: string; name: string };
}

interface PeriodSummaryShape {
  posted: {
    dispatches: number;
    payments: number;
    journalEntries: number;
  };
  drafts: {
    dispatches: number;
    payments: number;
    journalEntries: number;
    sales: number;
    purchases: number;
  };
}

function sumCounts(s: PeriodSummaryShape): number {
  const { posted, drafts } = s;
  return (
    posted.dispatches +
    posted.payments +
    posted.journalEntries +
    drafts.dispatches +
    drafts.payments +
    drafts.journalEntries +
    drafts.sales +
    drafts.purchases
  );
}

function MonthlyCloseButton({ orgSlug, period }: MonthlyCloseButtonProps) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [closing, setClosing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleClick() {
    setChecking(true);
    try {
      const res = await fetch(
        `/api/organizations/${orgSlug}/monthly-close/summary?periodId=${period.id}`,
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Error al consultar el período.");
        return;
      }
      const summary = (await res.json()) as PeriodSummaryShape;
      if (sumCounts(summary) === 0) {
        // Empty period → fast-close flow (mini confirm dialog).
        setConfirmOpen(true);
      } else {
        // Has activity → full flow with summary panel + balance check.
        router.push(
          `/${orgSlug}/accounting/monthly-close?periodId=${period.id}`,
        );
      }
    } catch {
      toast.error("Error de conexión al consultar el período.");
    } finally {
      setChecking(false);
    }
  }

  async function executeFastClose() {
    setClosing(true);
    try {
      const res = await fetch(`/api/organizations/${orgSlug}/monthly-close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodId: period.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Error al cerrar el período.");
        return;
      }
      toast.success(`${period.name} cerrado`);
      setConfirmOpen(false);
      router.refresh();
    } catch {
      toast.error("Error de conexión al cerrar el período.");
    } finally {
      setClosing(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={checking}
      >
        {checking ? "Comprobando..." : "Cerrar"}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => !closing && setConfirmOpen(open)}
        title="Cerrar mes vacío"
        description={
          <span>
            <strong>{period.name}</strong> no tiene registros. ¿Cerrar el
            período directamente?
          </span>
        }
        confirmLabel="Sí, cerrar"
        variant="default"
        loading={closing}
        onConfirm={executeFastClose}
      />
    </>
  );
}
