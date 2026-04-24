"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
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
import { slugify } from "@/features/organizations/roles.validation";
import { SYSTEM_ROLES } from "@/features/permissions";

interface RoleCreateDialogProps {
  orgSlug: string;
  onCreated: () => void;
}

/**
 * RoleCreateDialog — form to create a custom role from a template.
 *
 * PR7.3 / REQ CR.3-S1, CR.4-S1, U.5-S3, D.5
 * - name input + slug preview (slugified on the fly)
 * - template selector (from the 6 system roles)
 * - Save disabled until template is selected AND name is non-empty
 * - POST /api/organizations/[orgSlug]/roles with { name, templateSlug, slug }
 * - on success: close + call onCreated
 */
export default function RoleCreateDialog({
  orgSlug,
  onCreated,
}: RoleCreateDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [templateSlug, setTemplateSlug] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const slug = slugify(name);
  const canSave = name.trim().length > 0 && templateSlug.length > 0;

  function reset() {
    setName("");
    setTemplateSlug("");
  }

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) reset();
  }

  async function handleSave() {
    if (!canSave) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/organizations/${orgSlug}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), templateSlug, slug }),
      });

      if (res.ok) {
        toast.success("Rol creado exitosamente");
        setOpen(false);
        reset();
        onCreated();
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Error al crear el rol");
      }
    } catch {
      toast.error("Error al crear el rol");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Crear rol
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Crear rol personalizado</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="role-name" className="block text-sm font-medium mb-1.5">
              Nombre *
            </label>
            <Input
              id="role-name"
              placeholder="ej. Facturador externo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
            {name.trim().length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Slug: <span className="font-mono">{slug}</span>
              </p>
            )}
          </div>

          {/* Template */}
          <div>
            <label htmlFor="role-template" className="block text-sm font-medium mb-1.5">
              Plantilla *
            </label>
            <Select
              value={templateSlug}
              onValueChange={setTemplateSlug}
              disabled={isLoading}
            >
              <SelectTrigger id="role-template" className="w-full">
                <SelectValue placeholder="Seleccioná una plantilla..." />
              </SelectTrigger>
              <SelectContent>
                {SYSTEM_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Los permisos del rol nuevo copiarán los de la plantilla.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!canSave || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              "Guardar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
