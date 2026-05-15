"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import type { Account } from "@/generated/prisma/client";

interface DeactivateAccountDialogProps {
  account: Account | null;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  onDeactivated: () => void;
}

export default function DeactivateAccountDialog({
  account,
  onOpenChange,
  orgSlug,
  onDeactivated,
}: DeactivateAccountDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleDeactivate() {
    if (!account) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(
        `/api/organizations/${orgSlug}/accounts/${account.id}`,
        { method: "DELETE" },
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al desactivar la cuenta");
      }

      toast.success(`Cuenta ${account.code} desactivada`);
      onDeactivated();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al desactivar la cuenta",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ConfirmDialog
      open={!!account}
      onOpenChange={onOpenChange}
      title="Desactivar cuenta"
      description={
        account
          ? `Esta acción desactivará la cuenta ${account.code} - ${account.name}. No se podrá usar en nuevos asientos contables. Solo se puede desactivar una cuenta sin movimientos registrados ni subcuentas activas.`
          : null
      }
      confirmLabel="Desactivar"
      variant="destructive"
      loading={isSubmitting}
      onConfirm={handleDeactivate}
    />
  );
}
