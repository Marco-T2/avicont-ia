"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface RoleDeleteDialogProps {
  orgSlug: string;
  roleSlug: string;
  roleName: string;
  onDeleted: () => void;
}

/**
 * RoleDeleteDialog — two-step confirmation before DELETE.
 *
 * PR7.5 / REQ CR.7-S1, U.5-S4
 * - DELETE NOT called until confirmation button clicked
 * - 409 ROLE_HAS_MEMBERS shown as inline error message
 */
export default function RoleDeleteDialog({
  orgSlug,
  roleSlug,
  roleName,
  onDeleted,
}: RoleDeleteDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) setErrorMessage(null);
  }

  async function handleConfirm() {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(
        `/api/organizations/${orgSlug}/roles/${roleSlug}`,
        { method: "DELETE" },
      );

      if (res.ok) {
        toast.success("Rol eliminado");
        setOpen(false);
        onDeleted();
        router.refresh();
      } else {
        const data = await res.json();
        if (data.code === "ROLE_HAS_MEMBERS" || res.status === 409) {
          setErrorMessage(
            "No se puede eliminar: hay miembros asignados a este rol.",
          );
        } else {
          toast.error(data.error ?? "Error al eliminar el rol");
        }
      }
    } catch {
      toast.error("Error al eliminar el rol");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          Eliminar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Eliminar rol</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          ¿Estás seguro que querés eliminar el rol{" "}
          <span className="font-medium text-foreground">{roleName}</span>?
          Esta acción no se puede deshacer.
        </p>

        {errorMessage && (
          <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">
            {errorMessage}
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Eliminando...
              </>
            ) : (
              "Confirmar eliminación"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
