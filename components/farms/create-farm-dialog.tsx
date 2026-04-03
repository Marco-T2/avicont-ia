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

interface CreateFarmDialogProps {
  orgSlug: string;
  memberId: string;
  onCreated?: () => void;
}

export default function CreateFarmDialog({
  orgSlug,
  memberId,
  onCreated,
}: CreateFarmDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("El nombre de la granja es requerido");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/farms`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            location: location.trim() || undefined,
            memberId,
          }),
        },
      );

      if (response.ok) {
        toast.success("Granja creada exitosamente");
        setName("");
        setLocation("");
        setIsOpen(false);
        onCreated?.();
      } else {
        const error = await response.json();
        toast.error(error.error || "Error al crear la granja");
      }
    } catch (error) {
      console.error("Error creating farm:", error);
      toast.error("Error al crear la granja");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setName("");
      setLocation("");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Granja
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Crear Nueva Granja</DialogTitle>
          <DialogDescription>
            Ingresá los datos de la granja
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Nombre *
            </label>
            <Input
              placeholder="Ej: Granja San Antonio"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Ubicación
            </label>
            <Input
              placeholder="Ej: Km 5 Ruta Nacional 4"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
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
            disabled={isLoading || !name.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creando...
              </>
            ) : (
              "Crear Granja"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
