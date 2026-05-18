"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface DeactivateLotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  lotId: string;
  lotName: string;
  onDeactivated?: () => void;
}

/**
 * Cierra (desactiva) un lote ACTIVE — transición lifecycle binaria
 * REQ-203 / D-4. PATCH /api/organizations/{orgSlug}/lots/{lotId} con
 * { endDate } discrimina al service.deactivate path. endDate default a
 * hoy (granjero típicamente cierra el día que el último pollo sale),
 * editable para registro retroactivo. El dominio sólo valida que el
 * lote esté ACTIVE (CannotDeactivateInactiveLot); no hay min(startDate)
 * — cualquier validación cross-field vive en domain, no en este form.
 */
export function DeactivateLotDialog({
  open,
  onOpenChange,
  orgSlug,
  lotId,
  lotName,
  onDeactivated,
}: DeactivateLotDialogProps) {
  const [endDate, setEndDate] = useState(todayLocal());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setEndDate(todayLocal());
  }, [open]);

  const handleSubmit = async () => {
    if (!endDate) {
      toast.error("La fecha de cierre es requerida");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(
        `/api/organizations/${orgSlug}/lots/${lotId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endDate }),
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Error al cerrar el lote");
        return;
      }
      toast.success("Lote cerrado");
      onOpenChange(false);
      onDeactivated?.();
    } catch (e) {
      console.error("deactivate-lot:", e);
      toast.error("Error al cerrar el lote");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={saving ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Cerrar lote</DialogTitle>
          <DialogDescription>
            Vas a cerrar el lote <strong>&quot;{lotName}&quot;</strong>.
            Una vez cerrado pasa a estado &quot;Inactivo&quot; y no
            podrás editarlo ni cargar nuevos gastos o mortalidad sobre él.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Fecha de cierre *
            </label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={saving}
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
          <Button onClick={handleSubmit} disabled={saving || !endDate}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Cerrando...
              </>
            ) : (
              "Cerrar lote"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
