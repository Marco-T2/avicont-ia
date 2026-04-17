"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/date-utils";

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

interface CreateExpenseFormProps {
  orgSlug: string;
  lotId: string;
  onCreated?: () => void;
}

export default function CreateExpenseForm({
  orgSlug,
  lotId,
  onCreated,
}: CreateExpenseFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayLocal());

  const handleSubmit = async () => {
    if (!amount || Number(amount) <= 0) {
      toast.error("El monto debe ser mayor a 0");
      return;
    }
    if (!category) {
      toast.error("Selecciona una categoria");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/expenses`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: Number(amount),
            category,
            description: description.trim() || undefined,
            date,
            lotId,
          }),
        },
      );

      if (response.ok) {
        toast.success("Gasto registrado exitosamente");
        setAmount("");
        setCategory("");
        setDescription("");
        setDate(todayLocal());
        setIsOpen(false);
        onCreated?.();
      } else {
        const error = await response.json();
        toast.error(error.error || "Error al registrar el gasto");
      }
    } catch (error) {
      console.error("Error creating expense:", error);
      toast.error("Error al registrar el gasto");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setAmount("");
      setCategory("");
      setDescription("");
      setDate(todayLocal());
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Registrar Gasto
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Registrar Gasto</DialogTitle>
          <DialogDescription>
            Agrega un nuevo gasto a este lote
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Monto (Bs.) *
            </label>
            <Input
              type="number"
              min={0.01}
              step={0.01}
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Categoria *
            </label>
            <Select
              value={category}
              onValueChange={setCategory}
              disabled={isLoading}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar categoria" />
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
            <label className="block text-sm font-medium mb-2">
              Descripcion
            </label>
            <Input
              placeholder="Detalle opcional"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Fecha *
            </label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={isLoading}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !amount || !category}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              "Guardar Gasto"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
