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
import { Plus, Pencil, X, Check, Loader2, PowerOff } from "lucide-react";
import { toast } from "sonner";
import { Gated } from "@/components/common/gated";

interface VoucherTypeItem {
  id: string;
  code: string;
  name: string;
  prefix: string;
  description: string | null;
  isActive: boolean;
  _count?: { journalEntries: number };
}

interface VoucherTypesManagerProps {
  orgSlug: string;
  initialVoucherTypes: VoucherTypeItem[];
}

type EditingState = {
  id: string;
  name: string;
  prefix: string;
} | null;

type CreatingState = {
  code: string;
  name: string;
  prefix: string;
} | null;

const BASE_URL = (orgSlug: string) =>
  `/api/organizations/${orgSlug}/voucher-types`;

export default function VoucherTypesManager({
  orgSlug,
  initialVoucherTypes,
}: VoucherTypesManagerProps) {
  const router = useRouter();
  const [voucherTypes, setVoucherTypes] =
    useState<VoucherTypeItem[]>(initialVoucherTypes);
  const [editing, setEditing] = useState<EditingState>(null);
  const [creating, setCreating] = useState<CreatingState>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function openCreate() {
    setEditing(null);
    setCreating({ code: "", name: "", prefix: "" });
  }

  function cancelCreate() {
    setCreating(null);
  }

  async function handleCreate() {
    if (!creating) return;
    if (!creating.code.trim() || !creating.name.trim() || !creating.prefix.trim()) {
      toast.error("Código, nombre y prefijo son requeridos");
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
          prefix: creating.prefix.trim().toUpperCase(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al crear el tipo de comprobante");
      }

      const newItem = (await response.json()) as VoucherTypeItem;
      setVoucherTypes((prev) =>
        [...prev, { ...newItem, _count: { journalEntries: 0 } }].sort((a, b) =>
          a.code.localeCompare(b.code),
        ),
      );
      setCreating(null);
      toast.success("Tipo de comprobante creado");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al crear el tipo de comprobante",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function openEdit(item: VoucherTypeItem) {
    setCreating(null);
    setEditing({ id: item.id, name: item.name, prefix: item.prefix });
  }

  function cancelEdit() {
    setEditing(null);
  }

  async function handleSaveEdit() {
    if (!editing) return;
    if (!editing.name.trim() || !editing.prefix.trim()) {
      toast.error("Nombre y prefijo son requeridos");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`${BASE_URL(orgSlug)}/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editing.name.trim(),
          prefix: editing.prefix.trim().toUpperCase(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al actualizar");
      }

      const updated = (await response.json()) as VoucherTypeItem;
      setVoucherTypes((prev) =>
        prev
          .map((vt) => (vt.id === updated.id ? { ...vt, ...updated } : vt))
          .sort((a, b) => a.code.localeCompare(b.code)),
      );
      setEditing(null);
      toast.success("Tipo de comprobante actualizado");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al actualizar el tipo de comprobante",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleActive(item: VoucherTypeItem) {
    setLoadingId(item.id);
    try {
      const response = await fetch(`${BASE_URL(orgSlug)}/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al cambiar el estado");
      }

      const updated = (await response.json()) as VoucherTypeItem;
      setVoucherTypes((prev) =>
        prev.map((vt) => (vt.id === updated.id ? { ...vt, ...updated } : vt)),
      );
      toast.success(
        item.isActive ? "Tipo de comprobante desactivado" : "Tipo de comprobante reactivado",
      );
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
          <CardTitle>Tipos de Comprobante</CardTitle>
          <Gated resource="accounting-config" action="write">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openCreate}
              disabled={!!creating}
            >
              <Plus className="h-4 w-4 mr-1" />
              Nuevo tipo de comprobante
            </Button>
          </Gated>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground w-20">
                  Código
                </th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                  Nombre
                </th>
                <th className="text-center py-3 px-4 font-medium text-muted-foreground w-20">
                  Prefijo
                </th>
                <th className="text-center py-3 px-4 font-medium text-muted-foreground w-24">
                  Asientos
                </th>
                <th className="text-center py-3 px-4 font-medium text-muted-foreground w-24">
                  Estado
                </th>
                <th className="w-24 py-3 px-4" />
              </tr>
            </thead>
            <tbody>
              {creating !== null && (
                <tr className="border-b bg-info/10">
                  <td className="py-2 px-4">
                    <Input
                      autoFocus
                      value={creating.code}
                      onChange={(e) =>
                        setCreating((prev) =>
                          prev ? { ...prev, code: e.target.value.toUpperCase() } : null,
                        )
                      }
                      placeholder="Ej: CX"
                      maxLength={6}
                      className="h-8 uppercase font-mono"
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
                      placeholder="Ej: Comprobante Bancario"
                      maxLength={100}
                      className="h-8"
                    />
                  </td>
                  <td className="py-2 px-4 text-center">
                    <Input
                      value={creating.prefix}
                      onChange={(e) =>
                        setCreating((prev) =>
                          prev
                            ? { ...prev, prefix: e.target.value.toUpperCase() }
                            : null,
                        )
                      }
                      placeholder="X"
                      maxLength={1}
                      className="h-8 uppercase font-mono text-center"
                    />
                  </td>
                  <td className="py-2 px-4 text-center text-muted-foreground">—</td>
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

              {voucherTypes.length === 0 && creating === null && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-muted-foreground">
                    No hay tipos de comprobante registrados.
                  </td>
                </tr>
              )}

              {voucherTypes.map((item) => {
                const isEditing = editing?.id === item.id;
                const isLoading = loadingId === item.id;
                const count = item._count?.journalEntries ?? 0;

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
                      <td className="py-2 px-4 text-center">
                        <Input
                          value={editing.prefix}
                          onChange={(e) =>
                            setEditing((prev) =>
                              prev
                                ? { ...prev, prefix: e.target.value.toUpperCase() }
                                : null,
                            )
                          }
                          maxLength={1}
                          className="h-8 uppercase font-mono text-center"
                        />
                      </td>
                      <td className="py-2 px-4 text-center text-muted-foreground">{count}</td>
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
                    <td className="py-3 px-4 text-center font-mono">{item.prefix}</td>
                    <td className="py-3 px-4 text-center text-muted-foreground">{count}</td>
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
                      <Gated resource="accounting-config" action="write">
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
                      </Gated>
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
