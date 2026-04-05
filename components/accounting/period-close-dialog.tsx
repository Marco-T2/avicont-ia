"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { FiscalPeriod } from "@/features/fiscal-periods";

interface PeriodCloseDialogProps {
  period: FiscalPeriod | null;
  orgSlug: string;
  onOpenChange: (open: boolean) => void;
  onClosed: () => void;
}

export default function PeriodCloseDialog({
  period,
  orgSlug,
  onOpenChange,
  onClosed,
}: PeriodCloseDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleClose() {
    if (!period) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(
        `/api/organizations/${orgSlug}/periods/${period.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "CLOSED" }),
        },
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al cerrar el período");
      }

      toast.success(`Período "${period.name}" cerrado exitosamente`);
      onClosed();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al cerrar el período",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={!!period} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cerrar Período Fiscal</DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-2">
          <p className="text-gray-700">
            ¿Estás seguro de cerrar el período{" "}
            <span className="font-semibold">{period?.name}</span>?
          </p>
          <p className="text-sm text-red-600 font-medium">
            Esta acción no se puede revertir.
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Cerrando...
              </>
            ) : (
              "Cerrar Período"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
