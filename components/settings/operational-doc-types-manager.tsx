"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, X, Check, Loader2, PowerOff } from "lucide-react";
import { toast } from "sonner";

// ── Local types (no Prisma client in client components) ──

type DocDirection = "COBRO" | "PAGO" | "BOTH";

interface DocTypeItem {
  id: string;
  code: string;
  name: string;
  direction: DocDirection;
  isActive: boolean;
}

interface OperationalDocTypesManagerProps {
  orgSlug: string;
  initialDocTypes: DocTypeItem[];
}

type EditingState = {
  id: string;
  name: string;
  direction: DocDirection;
} | null;

type CreatingState = {
  code: string;
  name: string;
  direction: DocDirection;
} | null;

const BASE_URL = (orgSlug: string) =>
  `/api/organizations/${orgSlug}/operational-doc-types`;

function directionBadge(direction: DocDirection) {
  switch (direction) {
    case "COBRO":
      return (
        <Badge className="bg-info/10 text-info">Cobro</Badge>
      );
    case "PAGO":
      return (
        <Badge className="bg-success/10 text-success">Pago</Badge>
      );
    case "BOTH":
      return (
        <Badge className="bg-primary/10 text-primary">Ambos</Badge>
      );
  }
}

export default function OperationalDocTypesManager({
  orgSlug,
  initialDocTypes,
}: OperationalDocTypesManagerProps) {
  const router = useRouter();
  const [docTypes, setDocTypes] = useState<DocTypeItem[]>(initialDocTypes);
  const [editing, setEditing] = useState<EditingState>(null);
  const [creating, setCreating] = useState<CreatingState>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // ── Create ──

  function openCreate() {
    setEditing(null);
    setCreating({ code: "", name: "", direction: "COBRO" });
  }

  function cancelCreate() {
    setCreating(null);
  }

  async function handleCreate() {
    if (!creating) return;
    if (!creating.code.trim() || !creating.name.trim()) {
      toast.error("Código y nombre son requeridos");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(BASE_URL(orgSlug), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: creating.code.trim().toUpperCase(),
          name: creating.name.trim(),
          direction: creating.direction,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al crear el tipo de documento");
      }

      const newItem = await response.json();
      setDocTypes((prev) =>
        [...prev, newItem].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setCreating(null);
      toast.success("Tipo de documento creado");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al crear el tipo de documento",
      );
    } finally {
      setIsSaving(false);
    }
  }

  // ── Edit ──

  function openEdit(item: DocTypeItem) {
    setCreating(null);
    setEditing({
      id: item.id,
      name: item.name,
      direction: item.direction,
    });
  }

  function cancelEdit() {
    setEditing(null);
  }

  async function handleSaveEdit() {
    if (!editing) return;
    if (!editing.name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`${BASE_URL(orgSlug)}/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editing.name.trim(),
          direction: editing.direction,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al actualizar");
      }

      const updated = await response.json();
      setDocTypes((prev) =>
        prev
          .map((dt) => (dt.id === updated.id ? updated : dt))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      setEditing(null);
      toast.success("Tipo de documento actualizado");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al actualizar el tipo de documento",
      );
    } finally {
      setIsSaving(false);
    }
  }

  // ── Deactivate / Reactivate ──

  async function handleToggleActive(item: DocTypeItem) {
    setLoadingId(item.id);
    try {
      if (item.isActive) {
        // Deactivate via DELETE
        const response = await fetch(`${BASE_URL(orgSlug)}/${item.id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? "Error al desactivar");
        }

        const updated = await response.json();
        setDocTypes((prev) =>
          prev.map((dt) => (dt.id === updated.id ? updated : dt)),
        );
        toast.success("Tipo de documento desactivado");
      } else {
        // Reactivate via PATCH
        const response = await fetch(`${BASE_URL(orgSlug)}/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: true }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? "Error al reactivar");
        }

        const updated = await response.json();
        setDocTypes((prev) =>
          prev.map((dt) => (dt.id === updated.id ? updated : dt)),
        );
        toast.success("Tipo de documento reactivado");
      }
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al cambiar el estado",
      );
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Tipos de Documento Operativo</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openCreate}
            disabled={!!creating}
          >
            <Plus className="h-4 w-4 mr-1" />
            Nuevo tipo de documento
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground w-28">
                  Código
                </th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                  Nombre
                </th>
                <th className="text-center py-3 px-4 font-medium text-muted-foreground w-28">
                  Dirección
                </th>
                <th className="text-center py-3 px-4 font-medium text-muted-foreground w-24">
                  Estado
                </th>
                <th className="w-24 py-3 px-4" />
              </tr>
            </thead>
            <tbody>
              {/* New doc type row */}
              {creating !== null && (
                <tr className="border-b bg-info/10">
                  <td className="py-2 px-4">
                    <Input
                      autoFocus
                      value={creating.code}
                      onChange={(e) =>
                        setCreating((prev) =>
                          prev
                            ? { ...prev, code: e.target.value.toUpperCase() }
                            : null,
                        )
                      }
                      placeholder="Ej: RC"
                      maxLength={20}
                      className="h-8 uppercase"
                    />
                  </td>
                  <td className="py-2 px-4">
                    <Input
                      value={creating.name}
                      onChange={(e) =>
                        setCreating((prev) =>
                          prev ? { ...prev, name: e.target.value } : null,
                        )
                      }
                      placeholder="Ej: Recibo de Cobranza"
                      maxLength={100}
                      className="h-8"
                    />
                  </td>
                  <td className="py-2 px-4">
                    <Select
                      value={creating.direction}
                      onValueChange={(value) =>
                        setCreating((prev) =>
                          prev ? { ...prev, direction: value as DocDirection } : null,
                        )
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="COBRO">Cobro</SelectItem>
                        <SelectItem value="PAGO">Pago</SelectItem>
                        <SelectItem value="BOTH">Ambos</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-2 px-4 text-center">
                    <Badge className="bg-success/10 text-success">Activo</Badge>
                  </td>
                  <td className="py-2 px-4">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className="text-success hover:text-success hover:bg-success/10"
                        onClick={handleCreate}
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={cancelCreate}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              )}

              {/* Empty state */}
              {docTypes.length === 0 && creating === null && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-muted-foreground">
                    No hay tipos de documento registrados.
                  </td>
                </tr>
              )}

              {/* Existing doc type rows */}
              {docTypes.map((item) => {
                const isEditing = editing?.id === item.id;
                const isLoading = loadingId === item.id;

                if (isEditing) {
                  return (
                    <tr key={item.id} className="border-b bg-warning/10">
                      <td className="py-2 px-4 font-mono text-sm text-muted-foreground">
                        {item.code}
                      </td>
                      <td className="py-2 px-4">
                        <Input
                          autoFocus
                          value={editing.name}
                          onChange={(e) =>
                            setEditing((prev) =>
                              prev ? { ...prev, name: e.target.value } : null,
                            )
                          }
                          maxLength={100}
                          className="h-8"
                        />
                      </td>
                      <td className="py-2 px-4">
                        <Select
                          value={editing.direction}
                          onValueChange={(value) =>
                            setEditing((prev) =>
                              prev
                                ? { ...prev, direction: value as DocDirection }
                                : null,
                            )
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="COBRO">Cobro</SelectItem>
                            <SelectItem value="PAGO">Pago</SelectItem>
                            <SelectItem value="BOTH">Ambos</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 px-4 text-center">
                        <Badge
                          className={
                            item.isActive
                              ? "bg-success/10 text-success"
                              : "bg-muted text-muted-foreground"
                          }
                        >
                          {item.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </td>
                      <td className="py-2 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            className="text-success hover:text-success hover:bg-success/10"
                            onClick={handleSaveEdit}
                            disabled={isSaving}
                          >
                            {isSaving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={cancelEdit}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={item.id}
                    className={`border-b hover:bg-accent/50 ${!item.isActive ? "opacity-60" : ""}`}
                  >
                    <td className="py-3 px-4 font-mono text-sm">{item.code}</td>
                    <td className="py-3 px-4">{item.name}</td>
                    <td className="py-3 px-4 text-center">
                      {directionBadge(item.direction)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge
                        className={
                          item.isActive
                            ? "bg-success/10 text-success"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {item.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          className="text-info hover:text-info hover:bg-info/10"
                          onClick={() => openEdit(item)}
                          disabled={isLoading}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          className={
                            item.isActive
                              ? "text-destructive hover:text-destructive hover:bg-destructive/10"
                              : "text-success hover:text-success hover:bg-success/10"
                          }
                          onClick={() => handleToggleActive(item)}
                          disabled={isLoading}
                          title={item.isActive ? "Desactivar" : "Reactivar"}
                        >
                          {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <PowerOff className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

