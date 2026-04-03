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
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface LogMortalityFormProps {
  orgSlug: string;
  lotId: string;
  aliveCount: number;
  onCreated?: () => void;
}

export default function LogMortalityForm({
  orgSlug,
  lotId,
  aliveCount,
  onCreated,
}: LogMortalityFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [count, setCount] = useState("");
  const [cause, setCause] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const handleSubmit = async () => {
    const countNum = Number(count);
    if (!count || countNum < 1) {
      toast.error("La cantidad debe ser al menos 1");
      return;
    }
    if (countNum > aliveCount) {
      toast.error(`La cantidad no puede superar los pollos vivos (${aliveCount})`);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/mortality`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            count: countNum,
            cause: cause.trim() || undefined,
            date,
            lotId,
          }),
        },
      );

      if (response.ok) {
        toast.success("Mortalidad registrada");
        setCount("");
        setCause("");
        setDate(new Date().toISOString().split("T")[0]);
        setIsOpen(false);
        onCreated?.();
      } else {
        const error = await response.json();
        toast.error(error.error || "Error al registrar mortalidad");
      }
    } catch (error) {
      console.error("Error logging mortality:", error);
      toast.error("Error al registrar mortalidad");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setCount("");
      setCause("");
      setDate(new Date().toISOString().split("T")[0]);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <Plus className="h-4 w-4 mr-2" />
          Registrar Mortalidad
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Registrar Mortalidad</DialogTitle>
          <DialogDescription>
            Pollos vivos actualmente: {aliveCount}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Cantidad *
            </label>
            <Input
              type="number"
              min={1}
              max={aliveCount}
              placeholder="Cantidad de bajas"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Causa
            </label>
            <Input
              placeholder="Ej: Enfermedad respiratoria"
              value={cause}
              onChange={(e) => setCause(e.target.value)}
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
            variant="destructive"
            onClick={handleSubmit}
            disabled={isLoading || !count}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              "Registrar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
