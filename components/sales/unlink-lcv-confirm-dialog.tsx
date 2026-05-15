"use client";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface UnlinkLcvConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
}

export function UnlinkLcvConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending = false,
}: UnlinkLcvConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Desvincular del Libro de Ventas"
      description="No se elimina la venta — solo se elimina el vínculo con el LCV. La venta se conserva intacta. El asiento contable se regenera sin IVA ni IT. ¿Confirmás?"
      confirmLabel="Desvincular"
      variant="destructive"
      loading={isPending}
      onConfirm={onConfirm}
    />
  );
}
