"use client";

/**
 * AnnualCloseDialog — confirm + justification + POST /annual-close.
 *
 * Triggered by 'Cerrar la gestión {year}' in `annual-period-list.tsx`.
 * Mirror `monthly-close-panel.tsx` confirm flow EXACT (Dialog + textarea +
 * sonner toast + router.refresh).
 *
 * Voseo Rioplatense (REQ-7.4):
 *  - Title: 'Confirmar Cierre de Gestión'
 *  - Body: 'Estás a punto de cerrar la gestión {year}'
 *  - Justification label: 'Justificación (mínimo 50 caracteres)'
 *  - Confirm button: 'Confirmar Cierre'
 *  - Success toast: 'Gestión cerrada exitosamente'
 *
 * POST contract (matches modules/annual-close/presentation/validation.ts):
 *  body { year, justification }
 *  200 → { fiscalYearId, correlationId, status, ... }
 *  4xx/5xx → { error: string }
 *
 * Citation: orchestrator prompt 'Expected deliverables #2' + design rev 2
 * section 8 + spec REQ-2.6 (API route) + REQ-7.4 voseo.
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
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Lock } from "lucide-react";
import type { AnnualCloseSummary } from "@/modules/annual-close/presentation/index";

export interface AnnualCloseDialogProps {
  orgSlug: string;
  year: number;
  summary: AnnualCloseSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MIN_JUSTIFICATION = 50;

export default function AnnualCloseDialog({
  orgSlug,
  year,
  summary,
  open,
  onOpenChange,
}: AnnualCloseDialogProps) {
  const router = useRouter();
  const [justification, setJustification] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canConfirm = justification.trim().length >= MIN_JUSTIFICATION && !submitting;

  async function handleConfirm() {
    if (!canConfirm) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/organizations/${orgSlug}/annual-close`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ year, justification: justification.trim() }),
        },
      );
      if (!res.ok) {
        const data = await res
          .json()
          .catch(() => ({ error: "Error desconocido al cerrar la gestión." }));
        toast.error(data?.error ?? "Error al cerrar la gestión.");
        return;
      }
      // Success path.
      toast.success("Gestión cerrada exitosamente");
      setJustification("");
      router.refresh();
      onOpenChange(false);
    } catch {
      toast.error("Error de conexión al intentar cerrar la gestión.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setJustification("");
        onOpenChange(next);
      }}
    >
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

        <div className="space-y-1">
          <label
            htmlFor="annual-close-justification"
            className="text-sm font-medium text-foreground"
          >
            Justificación (mínimo {MIN_JUSTIFICATION} caracteres)
          </label>
          <Textarea
            id="annual-close-justification"
            placeholder="Explicá por qué cerrás la gestión..."
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            disabled={submitting}
            rows={4}
          />
          <p className="text-xs text-muted-foreground">
            {justification.trim().length}/{MIN_JUSTIFICATION} caracteres
          </p>
        </div>

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
            disabled={!canConfirm}
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
