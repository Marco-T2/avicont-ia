"use client";

/**
 * AnnualCloseDialog — confirm + POST /annual-close.
 *
 * Triggered by 'Cerrar la gestión {year}' in `annual-period-list.tsx`.
 *
 * Voseo Rioplatense (REQ-7.4): 'Confirmar Cierre de Gestión',
 * 'Estás a punto de cerrar la gestión {year}', 'Confirmar Cierre',
 * 'Gestión cerrada exitosamente'.
 *
 * POST contract: body `{ year }`. Justification was removed from the UI
 * (friction without audit value); the route handler auto-generates a
 * deterministic string ≥50 chars so the service-layer
 * MIN_JUSTIFICATION_LENGTH invariant and audit_logs trail stay intact.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Lock } from "lucide-react";
import type { AnnualCloseSummary } from "@/modules/annual-close/presentation/index";

export interface AnnualCloseDialogProps {
  orgSlug: string;
  year: number;
  summary: AnnualCloseSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AnnualCloseDialog({
  orgSlug,
  year,
  summary,
  open,
  onOpenChange,
}: AnnualCloseDialogProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/organizations/${orgSlug}/annual-close`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ year }),
        },
      );
      if (!res.ok) {
        const data = await res
          .json()
          .catch(() => ({ error: "Error desconocido al cerrar la gestión." }));
        toast.error(data?.error ?? "Error al cerrar la gestión.");
        return;
      }
      toast.success("Gestión cerrada exitosamente");
      router.refresh();
      onOpenChange(false);
    } catch {
      toast.error("Error de conexión al intentar cerrar la gestión.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar Cierre de Gestión</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2">
              <p>
                Estás a punto de cerrar la gestión <strong>{year}</strong>.
              </p>
              {summary && (
                <>
                  <p>
                    Balance del año — Debe:{" "}
                    <strong>{summary.balance.debit}</strong> · Haber:{" "}
                    <strong>{summary.balance.credit}</strong>
                  </p>
                  <p>
                    Meses cerrados: <strong>{summary.periods.closed}</strong> /{" "}
                    {summary.periods.total} — Diciembre:{" "}
                    <strong>{summary.decemberStatus}</strong>
                  </p>
                </>
              )}
              <p className="text-warning">
                Esta acción es irreversible. Se generará un Comprobante de
                Cierre (CC) en diciembre y un Comprobante de Apertura (CA) en
                enero del año siguiente.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        {summary && summary.balance.balanced === false && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Los asientos del año no cuadran — no se puede cerrar la gestión.
            </span>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            variant="default"
            disabled={submitting}
            onClick={handleConfirm}
          >
            <Lock className="mr-2 h-4 w-4" />
            {submitting ? "Cerrando..." : "Confirmar Cierre"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
