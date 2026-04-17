"use client";

import { useState } from "react";
import { todayLocal } from "@/lib/date-utils";
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
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CreateLotDialogProps {
  orgSlug: string;
  farmId: string;
  onCreated?: () => void;
}

export default function CreateLotDialog({
  orgSlug,
  farmId,
  onCreated,
}: CreateLotDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState("");
  const [barnNumber, setBarnNumber] = useState("");
  const [initialCount, setInitialCount] = useState("");
  const [startDate, setStartDate] = useState(
    todayLocal(),
  );

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("El nombre del lote es requerido");
      return;
    }
    if (!barnNumber || Number(barnNumber) < 1) {
      toast.error("El numero de galpon debe ser al menos 1");
      return;
    }
    if (!initialCount || Number(initialCount) < 1) {
      toast.error("La cantidad inicial debe ser al menos 1");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/lots`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            barnNumber: Number(barnNumber),
            initialCount: Number(initialCount),
            startDate,
            farmId,
          }),
        },
      );

      if (response.ok) {
        toast.success("Lote creado exitosamente");
        setName("");
        setBarnNumber("");
        setInitialCount("");
        setStartDate(todayLocal());
        setIsOpen(false);
        onCreated?.();
      } else {
        const error = await response.json();
        toast.error(error.error || "Error al crear el lote");
      }
    } catch (error) {
      console.error("Error creating lot:", error);
      toast.error("Error al crear el lote");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setName("");
      setBarnNumber("");
      setInitialCount("");
      setStartDate(todayLocal());
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Lote
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Lote</DialogTitle>
          <DialogDescription>
            Ingresa los datos del lote de pollos
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Nombre del Lote *
            </label>
            <Input
              placeholder="Ej: Lote Enero 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Numero de Galpon *
            </label>
            <Input
              type="number"
              min={1}
              max={10}
              placeholder="1-10"
              value={barnNumber}
              onChange={(e) => setBarnNumber(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Cantidad Inicial de Pollos *
            </label>
            <Input
              type="number"
              min={1}
              placeholder="Ej: 5000"
              value={initialCount}
              onChange={(e) => setInitialCount(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Fecha de Inicio *
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
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
            disabled={isLoading || !name.trim() || !barnNumber || !initialCount}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creando...
              </>
            ) : (
              "Crear Lote"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
