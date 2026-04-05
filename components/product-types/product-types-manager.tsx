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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, X, Check, Loader2, PowerOff } from "lucide-react";
import { toast } from "sonner";

// ── Local type (no Prisma client in client components) ──

interface ProductTypeItem {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  sortOrder: number;
}

interface ProductTypesManagerProps {
  orgSlug: string;
  initialProductTypes: ProductTypeItem[];
}

type EditingState = {
  id: string;
  name: string;
  code: string;
  sortOrder: string;
} | null;

type CreatingState = {
  name: string;
  code: string;
  sortOrder: string;
} | null;

const BASE_URL = (orgSlug: string) =>
  `/api/organizations/${orgSlug}/product-types`;

export default function ProductTypesManager({
  orgSlug,
  initialProductTypes,
}: ProductTypesManagerProps) {
  const router = useRouter();
  const [productTypes, setProductTypes] =
    useState<ProductTypeItem[]>(initialProductTypes);
  const [editing, setEditing] = useState<EditingState>(null);
  const [creating, setCreating] = useState<CreatingState>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // ── Create ──

  function openCreate() {
    setEditing(null);
    setCreating({ name: "", code: "", sortOrder: "" });
  }

  function cancelCreate() {
    setCreating(null);
  }

  async function handleCreate() {
    if (!creating) return;
    if (!creating.name.trim() || !creating.code.trim()) {
      toast.error("Nombre y código son requeridos");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(BASE_URL(orgSlug), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: creating.name.trim(),
          code: creating.code.trim().toUpperCase(),
          sortOrder: creating.sortOrder ? parseInt(creating.sortOrder, 10) : 0,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al crear el tipo de producto");
      }

      const newItem = await response.json();
      setProductTypes((prev) =>
        [...prev, newItem].sort((a, b) => a.sortOrder - b.sortOrder),
      );
      setCreating(null);
      toast.success("Tipo de producto creado");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al crear el tipo de producto",
      );
    } finally {
      setIsSaving(false);
    }
  }

  // ── Edit ──

  function openEdit(item: ProductTypeItem) {
    setCreating(null);
    setEditing({
      id: item.id,
      name: item.name,
      code: item.code,
      sortOrder: String(item.sortOrder),
    });
  }

  function cancelEdit() {
    setEditing(null);
  }

  async function handleSaveEdit() {
    if (!editing) return;
    if (!editing.name.trim() || !editing.code.trim()) {
      toast.error("Nombre y código son requeridos");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(
        `${BASE_URL(orgSlug)}/${editing.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editing.name.trim(),
            code: editing.code.trim().toUpperCase(),
            sortOrder: editing.sortOrder ? parseInt(editing.sortOrder, 10) : 0,
          }),
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al actualizar");
      }

      const updated = await response.json();
      setProductTypes((prev) =>
        prev
          .map((pt) => (pt.id === updated.id ? updated : pt))
          .sort((a, b) => a.sortOrder - b.sortOrder),
      );
      setEditing(null);
      toast.success("Tipo de producto actualizado");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al actualizar el tipo de producto",
      );
    } finally {
      setIsSaving(false);
    }
  }

  // ── Deactivate / Reactivate ──

  async function handleToggleActive(item: ProductTypeItem) {
    setLoadingId(item.id);
    try {
      if (item.isActive) {
        // Deactivate via DELETE
        const response = await fetch(
          `${BASE_URL(orgSlug)}/${item.id}`,
          { method: "DELETE" },
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? "Error al desactivar");
        }

        const updated = await response.json();
        setProductTypes((prev) =>
          prev.map((pt) => (pt.id === updated.id ? updated : pt)),
        );
        toast.success("Tipo de producto desactivado");
      } else {
        // Reactivate via PATCH
        const response = await fetch(
          `${BASE_URL(orgSlug)}/${item.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive: true }),
          },
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? "Error al reactivar");
        }

        const updated = await response.json();
        setProductTypes((prev) =>
          prev.map((pt) => (pt.id === updated.id ? updated : pt)),
        );
        toast.success("Tipo de producto reactivado");
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
          <CardTitle>Tipos de Producto</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openCreate}
            disabled={!!creating}
          >
            <Plus className="h-4 w-4 mr-1" />
            Nuevo Producto
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left py-3 px-4 font-medium text-gray-600">
                  Nombre
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-600 w-32">
                  Código
                </th>
                <th className="text-center py-3 px-4 font-medium text-gray-600 w-24">
                  Estado
                </th>
                <th className="text-right py-3 px-4 font-medium text-gray-600 w-28">
                  Orden
                </th>
                <th className="w-28 py-3 px-4" />
              </tr>
            </thead>
            <tbody>
              {/* New product row */}
              {creating !== null && (
                <tr className="border-b bg-blue-50/40">
                  <td className="py-2 px-4">
                    <Input
                      autoFocus
                      value={creating.name}
                      onChange={(e) =>
                        setCreating((prev) =>
                          prev ? { ...prev, name: e.target.value } : null,
                        )
                      }
                      placeholder="Ej: Pollo Entero"
                      className="h-8"
                    />
                  </td>
                  <td className="py-2 px-4">
                    <Input
                      value={creating.code}
                      onChange={(e) =>
                        setCreating((prev) =>
                          prev
                            ? {
                                ...prev,
                                code: e.target.value.toUpperCase(),
                              }
                            : null,
                        )
                      }
                      placeholder="Ej: PO"
                      maxLength={20}
                      className="h-8 uppercase"
                    />
                  </td>
                  <td className="py-2 px-4 text-center">
                    <Badge className="bg-green-100 text-green-800">Activo</Badge>
                  </td>
                  <td className="py-2 px-4">
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={creating.sortOrder}
                      onChange={(e) =>
                        setCreating((prev) =>
                          prev ? { ...prev, sortOrder: e.target.value } : null,
                        )
                      }
                      placeholder="0"
                      className="h-8 text-right"
                    />
                  </td>
                  <td className="py-2 px-4">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className="text-green-600 hover:text-green-800 hover:bg-green-50"
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
                        className="text-gray-500 hover:text-gray-700"
                        onClick={cancelCreate}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              )}

              {/* Existing product rows */}
              {productTypes.length === 0 && creating === null && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-gray-500">
                    No hay tipos de producto registrados.
                  </td>
                </tr>
              )}
              {productTypes.map((item) => {
                const isEditing = editing?.id === item.id;
                const isLoading = loadingId === item.id;

                if (isEditing) {
                  return (
                    <tr key={item.id} className="border-b bg-amber-50/40">
                      <td className="py-2 px-4">
                        <Input
                          autoFocus
                          value={editing.name}
                          onChange={(e) =>
                            setEditing((prev) =>
                              prev ? { ...prev, name: e.target.value } : null,
                            )
                          }
                          className="h-8"
                        />
                      </td>
                      <td className="py-2 px-4">
                        <Input
                          value={editing.code}
                          onChange={(e) =>
                            setEditing((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    code: e.target.value.toUpperCase(),
                                  }
                                : null,
                            )
                          }
                          maxLength={20}
                          className="h-8 uppercase"
                        />
                      </td>
                      <td className="py-2 px-4 text-center">
                        <Badge
                          className={
                            item.isActive
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-600"
                          }
                        >
                          {item.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </td>
                      <td className="py-2 px-4">
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={editing.sortOrder}
                          onChange={(e) =>
                            setEditing((prev) =>
                              prev
                                ? { ...prev, sortOrder: e.target.value }
                                : null,
                            )
                          }
                          className="h-8 text-right"
                        />
                      </td>
                      <td className="py-2 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            className="text-green-600 hover:text-green-800 hover:bg-green-50"
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
                            className="text-gray-500 hover:text-gray-700"
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
                    className={`border-b hover:bg-gray-50 ${!item.isActive ? "opacity-60" : ""}`}
                  >
                    <td className="py-3 px-4">{item.name}</td>
                    <td className="py-3 px-4 font-mono text-sm">{item.code}</td>
                    <td className="py-3 px-4 text-center">
                      <Badge
                        className={
                          item.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-600"
                        }
                      >
                        {item.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right text-gray-500">
                      {item.sortOrder}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
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
                              ? "text-red-500 hover:text-red-700 hover:bg-red-50"
                              : "text-green-500 hover:text-green-700 hover:bg-green-50"
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
