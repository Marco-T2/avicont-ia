"use client";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface ReactivateLcvConfirmDialogPurchaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
}

export function ReactivateLcvConfirmDialogPurchase({
  open,
  onOpenChange,
  onConfirm,
  isPending = false,
}: ReactivateLcvConfirmDialogPurchaseProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Reactivar registro en el Libro de Compras"
      description="Se reactivará el registro anterior del LCV y el comprobante se regenerará con IVA e IT. ¿Confirmás?"
      confirmLabel="Reactivar"
      variant="default"
      loading={isPending}
      onConfirm={onConfirm}
    />
  );
}
