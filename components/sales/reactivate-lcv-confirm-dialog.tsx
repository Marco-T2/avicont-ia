"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

// ── Props ────────────────────────────────────────────────────────────────────

interface ReactivateLcvConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
}

// ── Componente presentacional ─────────────────────────────────────────────────

export function ReactivateLcvConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending = false,
}: ReactivateLcvConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reactivar registro en el Libro de Ventas</DialogTitle>
          <DialogDescription>
            Se reactivará el registro anterior del LCV y el comprobante se
            regenerará con IVA e IT. ¿Confirmás?
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Reactivando...
              </>
            ) : (
              "Reactivar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
