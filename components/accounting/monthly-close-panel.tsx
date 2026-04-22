"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Lock } from "lucide-react";

interface Period {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface PeriodSummary {
  posted: { dispatches: number; payments: number; journalEntries: number };
  drafts: {
    dispatches: number;
    payments: number;
    journalEntries: number;
    sales: number;
    purchases: number;
  };
  journalsByVoucherType: Array<{
    code: string;
    name: string;
    count: number;
    totalDebit: number;
  }>;
  periodStatus: string;
  balance: {
    balanced: boolean;
    totalDebit: string;
    totalCredit: string;
    difference: string;
  };
}

interface MonthlyClosePanelProps {
  orgSlug: string;
  periods: Period[];
  preselectedPeriodId?: string;
}

function formatBs(amount: number): string {
  return `Bs ${amount.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function totalDrafts(drafts: PeriodSummary["drafts"]): number {
  return (
    drafts.dispatches +
    drafts.payments +
    drafts.journalEntries +
    drafts.sales +
    drafts.purchases
  );
}

function totalPosted(posted: PeriodSummary["posted"]): number {
  return posted.dispatches + posted.payments + posted.journalEntries;
}

export function MonthlyClosePanel({ orgSlug, periods, preselectedPeriodId }: MonthlyClosePanelProps) {
  const router = useRouter();
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(preselectedPeriodId ?? "");
  const [summary, setSummary] = useState<PeriodSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justification, setJustification] = useState("");

  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId);

  const fetchSummary = useCallback(
    async (periodId: string) => {
      setLoading(true);
      setError(null);
      setSummary(null);
      try {
        const res = await fetch(
          `/api/organizations/${orgSlug}/monthly-close/summary?periodId=${periodId}`
        );
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Error al cargar el resumen del período.");
          return;
        }
        const data: PeriodSummary = await res.json();
        setSummary(data);
      } catch {
        setError("Error de conexión al cargar el resumen.");
      } finally {
        setLoading(false);
      }
    },
    [orgSlug]
  );

  // REQ-2: auto-fetch summary when a period is pre-selected via ?periodId
  useEffect(() => {
    if (preselectedPeriodId) {
      fetchSummary(preselectedPeriodId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePeriodChange = (periodId: string) => {
    setSelectedPeriodId(periodId);
    fetchSummary(periodId);
  };

  const handleClose = async () => {
    if (!selectedPeriodId) return;
    setClosing(true);
    setError(null);
    try {
      const trimmed = justification.trim();
      const res = await fetch(`/api/organizations/${orgSlug}/monthly-close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodId: selectedPeriodId,
          ...(trimmed ? { justification: trimmed } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Error al cerrar el período.");
        return;
      }
      const result = await res.json();
      const correlationId = result?.correlationId as string | undefined;
      setConfirmOpen(false);
      setJustification("");
      // REQ-3: surface correlationId entry point via toast action (sonner v2 action: { label, onClick })
      if (correlationId) {
        toast.success("Período cerrado", {
          description: "El período fue cerrado exitosamente.",
          action: {
            label: "Ver registro",
            onClick: () =>
              router.push(
                `/${orgSlug}/accounting/monthly-close/close-event?correlationId=${correlationId}`,
              ),
          },
        });
      }
      router.refresh();
      // Reload summary to reflect CLOSED state
      await fetchSummary(selectedPeriodId);
    } catch {
      setError("Error de conexión al intentar cerrar el período.");
    } finally {
      setClosing(false);
    }
  };

  const isClosed = summary?.periodStatus === "CLOSED";
  const hasDrafts = summary ? totalDrafts(summary.drafts) > 0 : false;
  const canClose =
    !isClosed && !hasDrafts && summary !== null && summary.balance.balanced === true;

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <Card>
        <CardHeader>
          <CardTitle>Seleccionar Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Select value={selectedPeriodId} onValueChange={handlePeriodChange}>
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Seleccione un período fiscal..." />
              </SelectTrigger>
              <SelectContent>
                {periods.map((period) => (
                  <SelectItem key={period.id} value={period.id}>
                    {period.name}
                    {period.status === "CLOSED" ? " (Cerrado)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {summary && (
              <Badge
                className={
                  isClosed
                    ? "bg-blue-100 text-blue-700 border-blue-300"
                    : "bg-green-100 text-green-700 border-green-300"
                }
                variant="outline"
              >
                {isClosed ? "CERRADO" : "ABIERTO"}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Loading state */}
      {loading && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Cargando resumen del período...
          </CardContent>
        </Card>
      )}

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Summary */}
      {summary && !loading && (
        <>
          {/* Draft warning */}
          {hasDrafts && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>
                Hay documentos en borrador. Debe contabilizarlos o eliminarlos
                antes de cerrar.
              </span>
            </div>
          )}

          {/* Posted counts */}
          <Card>
            <CardHeader>
              <CardTitle>Documentos Contabilizados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-lg border bg-muted/30 p-4 text-center">
                  <p className="text-2xl font-bold">{summary.posted.dispatches}</p>
                  <p className="text-sm text-muted-foreground">Despachos</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4 text-center">
                  <p className="text-2xl font-bold">{summary.posted.payments}</p>
                  <p className="text-sm text-muted-foreground">Cobros y Pagos</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4 text-center">
                  <p className="text-2xl font-bold">{summary.posted.journalEntries}</p>
                  <p className="text-sm text-muted-foreground">Asientos Contables</p>
                </div>
              </div>

              {hasDrafts && (
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 text-center">
                    <p className="text-2xl font-bold text-amber-700">
                      {summary.drafts.dispatches}
                    </p>
                    <p className="text-sm text-amber-600">Despachos en borrador</p>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 text-center">
                    <p className="text-2xl font-bold text-amber-700">
                      {summary.drafts.payments}
                    </p>
                    <p className="text-sm text-amber-600">Pagos en borrador</p>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 text-center">
                    <p className="text-2xl font-bold text-amber-700">
                      {summary.drafts.journalEntries}
                    </p>
                    <p className="text-sm text-amber-600">Asientos en borrador</p>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 text-center">
                    <p className="text-2xl font-bold text-amber-700">
                      {summary.drafts.sales}
                    </p>
                    <p className="text-sm text-amber-600">Ventas en borrador</p>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 text-center">
                    <p className="text-2xl font-bold text-amber-700">
                      {summary.drafts.purchases}
                    </p>
                    <p className="text-sm text-amber-600">Compras en borrador</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Journal entries by voucher type */}
          {summary.journalsByVoucherType.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Asientos por Tipo de Comprobante</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">Código</th>
                        <th className="pb-2 pr-4 font-medium">Tipo</th>
                        <th className="pb-2 pr-4 text-right font-medium">Asientos</th>
                        <th className="pb-2 text-right font-medium">Total Debe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.journalsByVoucherType.map((row) => (
                        <tr key={row.code} className="border-b last:border-0">
                          <td className="py-2 pr-4 font-mono text-xs">{row.code}</td>
                          <td className="py-2 pr-4">{row.name}</td>
                          <td className="py-2 pr-4 text-right">{row.count}</td>
                          <td className="py-2 text-right font-medium">
                            {formatBs(row.totalDebit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Balance warning */}
          {summary && !summary.balance.balanced && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <div>
                <p className="font-semibold">DEBE ≠ HABER — No se puede cerrar este período</p>
                <p>
                  Debe total: Bs {summary.balance.totalDebit} · Haber total: Bs{" "}
                  {summary.balance.totalCredit} · Diferencia: Bs{" "}
                  {summary.balance.difference}
                </p>
              </div>
            </div>
          )}

          {/* Close button */}
          {!isClosed && (
            <div className="flex justify-end">
              <Button
                variant="destructive"
                disabled={!canClose}
                onClick={() => setConfirmOpen(true)}
              >
                <Lock className="mr-2 h-4 w-4" />
                Cerrar Período
              </Button>
            </div>
          )}
        </>
      )}

      {/* Confirmation dialog */}
      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open) {
            setJustification("");
          }
          setConfirmOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Cierre de Período</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Está a punto de cerrar el período{" "}
                  <strong>{selectedPeriod?.name}</strong>.
                </p>
                {summary && (
                  <p>
                    Se bloquearán{" "}
                    <strong>{totalPosted(summary.posted)}</strong> registro(s)
                    contabilizados.
                  </p>
                )}
                <p className="text-amber-700">
                  Esta acción bloqueará todos los documentos contabilizados del
                  período. Solo administradores podrán editar documentos
                  bloqueados con justificación.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 px-0">
            <label
              htmlFor="close-justification"
              className="text-sm font-medium text-foreground"
            >
              Justificación (opcional)
            </label>
            <Textarea
              id="close-justification"
              placeholder="Justificación (opcional)"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              disabled={closing}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setJustification("");
                setConfirmOpen(false);
              }}
              disabled={closing}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleClose}
              disabled={closing}
            >
              <Lock className="mr-2 h-4 w-4" />
              {closing ? "Cerrando..." : "Confirmar Cierre"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
