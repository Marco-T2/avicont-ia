"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Account } from "@/generated/prisma/client";

interface EditAccountDialogProps {
  account: Account | null;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  onUpdated: () => void;
}

export default function EditAccountDialog({
  account,
  onOpenChange,
  orgSlug,
  onUpdated,
}: EditAccountDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (account) {
      setName(account.name);
      setDescription(account.description ?? "");
    }
  }, [account]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!account) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(
        `/api/organizations/${orgSlug}/accounts/${account.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description: description || undefined }),
        },
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al actualizar la cuenta");
      }

      toast.success("Cuenta actualizada");
      onUpdated();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al actualizar la cuenta",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={!!account} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Editar Cuenta {account?.code}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Nombre</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Descripcion (opcional)</Label>
            <Input
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripcion de la cuenta"
            />
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
            <Button type="submit" disabled={isSubmitting || !name}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
