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

interface AddMemberDialogProps {
  orgSlug: string;
  onAdded?: () => void;
}

// 5 roles asignables (owner es implícito al crear la org, no asignable por admin)
const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  contador: "Contador",
  cobrador: "Cobrador",
  auxiliar: "Auxiliar",
  member: "Socio",
};

export default function AddMemberDialog({
  orgSlug,
  onAdded,
}: AddMemberDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");

  const handleSubmit = async () => {
    if (!email.trim()) {
      toast.error("El email es requerido");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/members`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), role }),
        },
      );

      if (response.ok) {
        toast.success("Miembro agregado exitosamente");
        setEmail("");
        setRole("member");
        setIsOpen(false);
        onAdded?.();
      } else {
        const error = await response.json();
        toast.error(error.error || "Error al agregar miembro");
      }
    } catch {
      toast.error("Error al agregar miembro");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setEmail("");
      setRole("member");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Agregar Miembro
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Agregar Nuevo Miembro</DialogTitle>
          <DialogDescription>
            El usuario debe estar registrado en el sistema
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Email *
            </label>
            <Input
              type="email"
              placeholder="usuario@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Rol *
            </label>
            <Select value={role} onValueChange={setRole} disabled={isLoading}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            disabled={isLoading || !email.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Agregando...
              </>
            ) : (
              "Agregar Miembro"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
