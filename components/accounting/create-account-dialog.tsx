"use client";

import { useEffect, useMemo, useState } from "react";
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
import { getNextCode } from "@/features/accounting/account-code.utils";
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
  /** Pre-select a parent account (e.g., from "Agregar subcuenta" button) */
  preselectedParentId?: string;
}

export default function CreateAccountDialog({
  open,
  onOpenChange,
  orgSlug,
  allAccounts,
  onCreated,
  preselectedParentId,
}: CreateAccountDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState(preselectedParentId ?? "");
  const [type, setType] = useState("");
  const [useCustomCode, setUseCustomCode] = useState(false);
  const [customCode, setCustomCode] = useState("");

  // Sync parentId when preselectedParentId changes (e.g., clicking "Agregar cuenta hija" on different rows)
  useEffect(() => {
    if (open) {
      setParentId(preselectedParentId ?? "");
      setUseCustomCode(false);
      setCustomCode("");
      setName("");
      setType("");
    }
  }, [open, preselectedParentId]);

  // Resolve the selected parent account
  const parent = useMemo(
    () => (parentId ? allAccounts.find((a) => a.id === parentId) ?? null : null),
    [parentId, allAccounts],
  );

  // Compute the suggested code based on parent and siblings
  const suggestedCode = useMemo(() => {
    const siblingCodes = allAccounts
      .filter((a) => (parent ? a.parentId === parent.id : a.parentId === null))
      .map((a) => a.code);
    return getNextCode(parent?.code ?? null, siblingCodes);
  }, [parent, allAccounts]);

  // The effective code: custom if toggled, otherwise auto-generated
  const effectiveCode = useCustomCode ? customCode : suggestedCode;

  // Inherited type from parent (read-only when parent is selected)
  const effectiveType = parent ? parent.type : type;

  // Computed level for display
  const computedLevel = parent ? parent.level + 1 : 1;

  function resetForm() {
    setName("");
    setParentId(preselectedParentId ?? "");
    setType("");
    setUseCustomCode(false);
    setCustomCode("");
  }

  function handleParentChange(val: string) {
    const newParentId = val === "none" ? "" : val;
    setParentId(newParentId);
    // Reset custom code when parent changes
    setUseCustomCode(false);
    setCustomCode("");
    // Reset type when switching to root
    if (!newParentId) setType("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const body: Record<string, unknown> = { name };

      if (parentId) {
        body.parentId = parentId;
      } else {
        // Root account — type is required
        body.type = effectiveType;
      }

      // Only send code if custom
      if (useCustomCode && customCode) {
        body.code = customCode;
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
      toast.error(
        err instanceof Error ? err.message : "Error al crear la cuenta",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const canSubmit = name && effectiveType && !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva Cuenta Contable</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Parent account selector */}
          <div className="space-y-2">
            <Label htmlFor="parent">Cuenta Padre</Label>
            <Select value={parentId || "none"} onValueChange={handleParentChange}>
              <SelectTrigger>
                <SelectValue placeholder="Sin cuenta padre (raíz)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin cuenta padre (raíz)</SelectItem>
                {allAccounts
                  .filter((a) => a.isActive && a.level < 4)
                  .map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Code — auto-generated with manual override */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="code">Codigo</Label>
              <button
                type="button"
                className="text-xs text-blue-600 hover:underline"
                onClick={() => {
                  setUseCustomCode(!useCustomCode);
                  if (!useCustomCode) setCustomCode(suggestedCode);
                }}
              >
                {useCustomCode ? "Usar automatico" : "Personalizar codigo"}
              </button>
            </div>
            {useCustomCode ? (
              <Input
                id="code"
                placeholder={`Ej: ${suggestedCode}`}
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value)}
              />
            ) : (
              <Input
                id="code"
                value={suggestedCode}
                disabled
                className="bg-gray-50 text-gray-600"
              />
            )}
          </div>

          {/* Name */}
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

          {/* Type — inherited from parent (read-only) or selectable for root */}
          <div className="space-y-2">
            <Label htmlFor="type">Tipo de Cuenta</Label>
            {parent ? (
              <Input
                id="type"
                value={ACCOUNT_TYPES.find((t) => t.value === parent.type)?.label ?? parent.type}
                disabled
                className="bg-gray-50 text-gray-600"
              />
            ) : (
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
            )}
          </div>

          {/* Level — informational only */}
          <p className="text-xs text-gray-500">
            Nivel: {computedLevel} {computedLevel === 1 ? "(grupo principal)" : `(subcuenta de ${parent?.name})`}
          </p>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit}>
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
