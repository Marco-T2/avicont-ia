"use client";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface UnlinkLcvConfirmDialogPurchaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
}

export function UnlinkLcvConfirmDialogPurchase({
  open,
  onOpenChange,
  onConfirm,
  isPending = false,
}: UnlinkLcvConfirmDialogPurchaseProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Desvincular del Libro de Compras"
      description="No se elimina la compra — solo se elimina el vínculo con el LCV. La compra se conserva intacta. El asiento contable se regenera sin IVA ni IT. ¿Confirmás?"
      confirmLabel="Desvincular"
      variant="destructive"
      loading={isPending}
      onConfirm={onConfirm}
    />
  );
}
