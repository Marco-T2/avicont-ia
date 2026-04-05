"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, AlertTriangle } from "lucide-react";
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
    <Dialog open={!!account} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Desactivar Cuenta
          </DialogTitle>
          <DialogDescription>
            Esta accion desactivara la cuenta{" "}
            <strong>{account?.code} - {account?.name}</strong>.
            No se podra usar en nuevos asientos contables.
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm text-gray-500">
          Solo se puede desactivar una cuenta que no tenga movimientos registrados
          ni subcuentas activas.
        </p>

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
            onClick={handleDeactivate}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Desactivando...
              </>
            ) : (
              "Desactivar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
