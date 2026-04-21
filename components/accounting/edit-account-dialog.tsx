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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SUBTYPES_BY_TYPE, formatSubtypeLabel } from "@/features/accounting/account-subtype.utils";
import type { Account, AccountSubtype } from "@/generated/prisma/client";

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
  const [subtype, setSubtype] = useState<AccountSubtype | "">("");
  const [isContraAccount, setIsContraAccount] = useState(false);

  useEffect(() => {
    if (account) {
      setName(account.name);
      setDescription(account.description ?? "");
      // Inicializar subtipo con el valor actual de la cuenta
      setSubtype((account.subtype as AccountSubtype | null) ?? "");
      setIsContraAccount(account.isContraAccount);
    }
  }, [account]);

  // Opciones de subtipo filtradas por el tipo de la cuenta
  const subtypeOptions = account
    ? (SUBTYPES_BY_TYPE[account.type as keyof typeof SUBTYPES_BY_TYPE] ?? [])
    : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!account) return;
    setIsSubmitting(true);

    try {
      // Construir el body incluyendo subtype cuando la cuenta tiene nivel >= 2
      const patchBody: Record<string, unknown> = {
        name,
        description: description || undefined,
      };
      if (account.level >= 2 && subtype) {
        patchBody.subtype = subtype;
      }
      // Contra-cuenta — solo aplica a ACTIVO; enviar si cambió respecto al valor actual
      if (account.type === "ACTIVO" && isContraAccount !== account.isContraAccount) {
        patchBody.isContraAccount = isContraAccount;
      }

      const res = await fetch(
        `/api/organizations/${orgSlug}/accounts/${account.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchBody),
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

          {/* Contra-cuenta — solo aplica a ACTIVO */}
          {account && account.type === "ACTIVO" && (
            <div className="space-y-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isContraAccount}
                  onChange={(e) => setIsContraAccount(e.target.checked)}
                  className="h-4 w-4 cursor-pointer"
                />
                <span className="text-sm">Es contra-cuenta</span>
              </label>
              <p className="text-xs text-gray-500">
                Contra-activo (naturaleza acreedora). Ej: Depreciación Acumulada, Amortización Acumulada.
              </p>
            </div>
          )}

          {/* Subtipo — solo visible para cuentas de nivel >= 2 */}
          {account && account.level >= 2 && (
            <div className="space-y-2">
              <Label htmlFor="edit-subtype">Subtipo</Label>
              <Select
                value={subtype || "none"}
                onValueChange={(val) =>
                  setSubtype(val === "none" ? "" : (val as AccountSubtype))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar subtipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin subtipo</SelectItem>
                  {subtypeOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {formatSubtypeLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
