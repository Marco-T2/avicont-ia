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

interface UnlinkLcvConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
}

// ── Componente presentacional ─────────────────────────────────────────────────

export function UnlinkLcvConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending = false,
}: UnlinkLcvConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Desvincular del Libro de Ventas</DialogTitle>
          <DialogDescription>
            No se elimina la venta — solo se elimina el vínculo con el LCV. La
            venta se conserva intacta. El asiento contable se regenera sin IVA
            ni IT. ¿Confirmás?
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
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Desvinculando...
              </>
            ) : (
              "Desvincular"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
