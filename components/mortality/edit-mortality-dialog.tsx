"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EditMortalityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  logId: string;
  initialCount: number;
  initialCause: string | null;
  initialDate: string; // ISO YYYY-MM-DD
  onUpdated?: () => void;
}

/**
 * Edits an existing MortalityLog (count/cause/date). Spec REQ-105.
 * Service revalidates aliveCount using:
 *   aliveCountForUpdate = lot.initialCount - (totalAllLogs - oldLogCount)
 * Throws MortalityCountExceedsAlive if new count exceeds — UI shows
 * the toast with the server error message.
 * lotId/orgId/createdById immutable (INV-02).
 * cause === "" → null (clear); undefined → keep prior.
 */
export function EditMortalityDialog({
  open,
  onOpenChange,
  orgSlug,
  logId,
  initialCount,
  initialCause,
  initialDate,
  onUpdated,
}: EditMortalityDialogProps) {
  const [count, setCount] = useState(String(initialCount));
  const [cause, setCause] = useState(initialCause ?? "");
  const [date, setDate] = useState(initialDate);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCount(String(initialCount));
      setCause(initialCause ?? "");
      setDate(initialDate);
    }
  }, [open, initialCount, initialCause, initialDate]);

  const normalizedCause = cause.trim();
  const dirty =
    Number(count) !== initialCount ||
    normalizedCause !== (initialCause ?? "") ||
    date !== initialDate;

  const handleSubmit = async () => {
    const c = Number(count);
    if (!Number.isInteger(c) || c < 1) {
      toast.error("La cantidad debe ser un entero ≥ 1");
      return;
    }
    if (!date) {
      toast.error("La fecha es requerida");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      if (c !== initialCount) payload.count = c;
      if (date !== initialDate) payload.date = date;
      if (normalizedCause !== (initialCause ?? "")) {
        payload.cause = normalizedCause === "" ? null : normalizedCause;
      }

      const res = await fetch(
        `/api/organizations/${orgSlug}/mortality/${logId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(
          err.error || "Error al actualizar el registro de mortalidad",
        );
        return;
      }
      toast.success("Registro actualizado");
      onOpenChange(false);
      onUpdated?.();
    } catch (e) {
      console.error("edit-mortality:", e);
      toast.error("Error al actualizar el registro");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={saving ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar registro de mortalidad</DialogTitle>
          <DialogDescription>
            Corrige la cantidad, causa o fecha del registro.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Cantidad *
            </label>
            <Input
              type="number"
              min={1}
              step={1}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              disabled={saving}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Fecha *</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={saving}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Causa (opcional)
            </label>
            <Textarea
              value={cause}
              onChange={(e) => setCause(e.target.value)}
              disabled={saving}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !dirty}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              "Guardar cambios"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
