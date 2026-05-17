"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface EditLotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  lotId: string;
  initialName: string;
  initialBarnNumber: number;
  onUpdated?: () => void;
}

/**
 * Edits `name` and/or `barnNumber` of an existing Lot. Spec REQ-100.
 * Other fields (initialCount, status, farmId, organizationId) are
 * immutable (INV-04). PATCH discriminator on the route: this payload
 * has no `endDate` → service.update path.
 */
export function EditLotDialog({
  open,
  onOpenChange,
  orgSlug,
  lotId,
  initialName,
  initialBarnNumber,
  onUpdated,
}: EditLotDialogProps) {
  const [name, setName] = useState(initialName);
  const [barnNumber, setBarnNumber] = useState(String(initialBarnNumber));
  const [saving, setSaving] = useState(false);

  // Reset form state every time the dialog opens (fresh values).
  useEffect(() => {
    if (open) {
      setName(initialName);
      setBarnNumber(String(initialBarnNumber));
    }
  }, [open, initialName, initialBarnNumber]);

  const dirty =
    name.trim() !== initialName ||
    Number(barnNumber) !== initialBarnNumber;

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    const barn = Number(barnNumber);
    if (!Number.isInteger(barn) || barn < 1 || barn > 10) {
      toast.error("El número de galpón debe ser entero entre 1 y 10");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      if (name.trim() !== initialName) payload.name = name.trim();
      if (barn !== initialBarnNumber) payload.barnNumber = barn;

      const res = await fetch(
        `/api/organizations/${orgSlug}/lots/${lotId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Error al actualizar el lote");
        return;
      }
      toast.success("Lote actualizado");
      onOpenChange(false);
      onUpdated?.();
    } catch (e) {
      console.error("edit-lot:", e);
      toast.error("Error al actualizar el lote");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={saving ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar lote</DialogTitle>
          <DialogDescription>
            Modifica el nombre y/o número de galpón. La cantidad inicial
            y el estado del lote no se pueden cambiar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Nombre del Lote *
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Número de Galpón *
            </label>
            <Input
              type="number"
              min={1}
              max={10}
              value={barnNumber}
              onChange={(e) => setBarnNumber(e.target.value)}
              disabled={saving}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !dirty || !name.trim()}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              "Guardar cambios"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
