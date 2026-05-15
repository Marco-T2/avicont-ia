"use client";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface ReactivateLcvConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
}

export function ReactivateLcvConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending = false,
}: ReactivateLcvConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Reactivar registro en el Libro de Ventas"
      description="Se reactivará el registro anterior del LCV y el comprobante se regenerará con IVA e IT. ¿Confirmás?"
      confirmLabel="Reactivar"
      variant="default"
      loading={isPending}
      onConfirm={onConfirm}
    />
  );
}
