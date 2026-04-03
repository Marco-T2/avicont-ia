"use client";

import { useState } from "react";
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
import type { Account } from "@/generated/prisma/client";

const ACCOUNT_TYPES = [
  { value: "ACTIVO", label: "Activo" },
  { value: "PASIVO", label: "Pasivo" },
  { value: "PATRIMONIO", label: "Patrimonio" },
  { value: "INGRESO", label: "Ingreso" },
  { value: "GASTO", label: "Gasto" },
];

interface CreateAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  allAccounts: Account[];
  onCreated: () => void;
}

export default function CreateAccountDialog({
  open,
  onOpenChange,
  orgSlug,
  allAccounts,
  onCreated,
}: CreateAccountDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [parentId, setParentId] = useState("");
  const [level, setLevel] = useState(1);

  function resetForm() {
    setCode("");
    setName("");
    setType("");
    setParentId("");
    setLevel(1);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const body: Record<string, unknown> = {
        code,
        name,
        type,
        level,
      };
      if (parentId) {
        body.parentId = parentId;
      }

      const res = await fetch(`/api/organizations/${orgSlug}/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al crear la cuenta");
      }

      toast.success("Cuenta creada exitosamente");
      resetForm();
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear la cuenta");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva Cuenta Contable</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Codigo</Label>
            <Input
              id="code"
              placeholder="Ej: 1.1.01"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              placeholder="Ej: Caja General"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Tipo de Cuenta</Label>
            <Select value={type} onValueChange={setType} required>
              <SelectTrigger>
                <SelectValue placeholder="Seleccione un tipo" />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="parent">Cuenta Padre (opcional)</Label>
            <Select
              value={parentId}
              onValueChange={(val) => setParentId(val === "none" ? "" : val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin cuenta padre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin cuenta padre</SelectItem>
                {allAccounts
                  .filter((a) => a.isActive)
                  .map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="level">Nivel</Label>
            <Input
              id="level"
              type="number"
              min={1}
              max={5}
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              required
            />
            <p className="text-xs text-gray-400">
              Nivel 1 = grupo principal, niveles superiores = subcuentas
            </p>
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
            <Button type="submit" disabled={isSubmitting || !code || !name || !type}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                "Crear Cuenta"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
