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
  initialFarmName: string;
  onUpdated?: () => void;
}

/**
 * Post simplify-lot-identifier: only `farmName` is editable. The
 * legacy `name` + `barnNumber` inputs are gone (columns dropped),
 * and `startDate` is now part of the lot's identity tuple
 * `(orgId, farmName, startDate)` enforced by a DB unique index, so
 * it's immutable post-creation. The PATCH discriminator stays the
 * same: this payload has no `endDate` → service.update path.
 */
export function EditLotDialog({
  open,
  onOpenChange,
  orgSlug,
  lotId,
  initialFarmName,
  onUpdated,
}: EditLotDialogProps) {
  const [farmName, setFarmName] = useState(initialFarmName);
  const [saving, setSaving] = useState(false);

  // Reset form state every time the dialog opens (fresh values).
  useEffect(() => {
    if (open) {
      setFarmName(initialFarmName);
    }
  }, [open, initialFarmName]);

  const dirty = farmName.trim() !== initialFarmName;

  const handleSubmit = async () => {
    if (!farmName.trim()) {
      toast.error("El nombre de la granja es requerido");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      if (farmName.trim() !== initialFarmName) {
        payload.farmName = farmName.trim();
      }

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
            Solo el nombre de la granja puede modificarse. La fecha de
            inicio es parte de la identidad del lote y la cantidad
            inicial no se puede cambiar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Granja *
            </label>
            <Input
              value={farmName}
              onChange={(e) => setFarmName(e.target.value)}
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
            disabled={saving || !dirty || !farmName.trim()}
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
