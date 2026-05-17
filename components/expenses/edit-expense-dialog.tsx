"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const EXPENSE_CATEGORIES = [
  { value: "ALIMENTO", label: "Alimento" },
  { value: "CHALA", label: "Chala" },
  { value: "AGUA", label: "Agua" },
  { value: "GARRAFAS", label: "Garrafas" },
  { value: "MANTENIMIENTO", label: "Mantenimiento" },
  { value: "GALPONERO", label: "Galponero" },
  { value: "MEDICAMENTOS", label: "Medicamentos" },
  { value: "VETERINARIO", label: "Veterinario" },
  { value: "OTROS", label: "Otros" },
] as const;

interface EditExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  expenseId: string;
  initialAmount: number;
  initialCategory: string;
  initialDescription: string | null;
  initialDate: string; // ISO YYYY-MM-DD
  onUpdated?: () => void;
}

/**
 * Edits an existing Expense (amount/category/date/description).
 * Spec REQ-103/REQ-104. lotId/orgId/createdById immutable (INV-03).
 * Sparse payload (only changed fields) cooperates con .refine() del
 * updateExpenseSchema. description === null limpia el campo.
 */
export function EditExpenseDialog({
  open,
  onOpenChange,
  orgSlug,
  expenseId,
  initialAmount,
  initialCategory,
  initialDescription,
  initialDate,
  onUpdated,
}: EditExpenseDialogProps) {
  const [amount, setAmount] = useState(String(initialAmount));
  const [category, setCategory] = useState(initialCategory);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [date, setDate] = useState(initialDate);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount(String(initialAmount));
      setCategory(initialCategory);
      setDescription(initialDescription ?? "");
      setDate(initialDate);
    }
  }, [
    open,
    initialAmount,
    initialCategory,
    initialDescription,
    initialDate,
  ]);

  const normalizedDescription = description.trim();
  const dirty =
    Number(amount) !== initialAmount ||
    category !== initialCategory ||
    normalizedDescription !== (initialDescription ?? "") ||
    date !== initialDate;

  const handleSubmit = async () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("El monto debe ser mayor a 0");
      return;
    }
    if (!category) {
      toast.error("Selecciona una categoría");
      return;
    }
    if (!date) {
      toast.error("La fecha es requerida");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      if (amt !== initialAmount) payload.amount = amt;
      if (category !== initialCategory) payload.category = category;
      if (date !== initialDate) payload.date = date;
      if (normalizedDescription !== (initialDescription ?? "")) {
        payload.description =
          normalizedDescription === "" ? null : normalizedDescription;
      }

      const res = await fetch(
        `/api/organizations/${orgSlug}/expenses/${expenseId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Error al actualizar el gasto");
        return;
      }
      toast.success("Gasto actualizado");
      onOpenChange(false);
      onUpdated?.();
    } catch (e) {
      console.error("edit-expense:", e);
      toast.error("Error al actualizar el gasto");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={saving ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar gasto</DialogTitle>
          <DialogDescription>
            Corrige los datos del gasto registrado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Monto (Bs.) *
            </label>
            <Input
              type="number"
              step="0.01"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={saving}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Categoría *
            </label>
            <Select
              value={category}
              onValueChange={setCategory}
              disabled={saving}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una categoría" />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Fecha *</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={saving}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Descripción (opcional)
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
              rows={2}
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
          <Button onClick={handleSubmit} disabled={saving || !dirty}>
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
