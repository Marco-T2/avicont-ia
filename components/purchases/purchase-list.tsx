"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ShoppingCart,
  Truck,
  Package,
  Wrench,
  FileText,
  Plus,
  MoreHorizontal,
  Eye,
  Pencil,
  CheckCircle,
  XCircle,
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import type { PurchaseWithDetails } from "@/features/purchase";

// ── Helpers ──

function formatCurrency(amount: number): string {
  return `Bs. ${amount.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Borrador", className: "bg-amber-100 text-amber-800" },
  POSTED: { label: "Contabilizado", className: "bg-green-100 text-green-800" },
  LOCKED: { label: "Bloqueado", className: "bg-blue-100 text-blue-800 border-blue-300" },
  VOIDED: { label: "Anulado", className: "bg-red-100 text-red-700" },
};

const PURCHASE_TYPE_LABEL: Record<string, string> = {
  FLETE: "Flete",
  POLLO_FAENADO: "Pollo Faenado",
  COMPRA_GENERAL: "Compra General",
  SERVICIO: "Servicio",
};

// ── Props ──

interface PurchaseListProps {
  orgSlug: string;
  purchases: PurchaseWithDetails[];
}

export default function PurchaseList({ orgSlug, purchases }: PurchaseListProps) {
  const router = useRouter();
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = purchases.filter((p) => {
    if (typeFilter !== "all" && p.purchaseType !== typeFilter) return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    return true;
  });

  async function handlePost(purchaseId: string) {
    if (!window.confirm("¿Contabilizar esta compra? Esta acción generará el asiento contable y la cuenta por pagar.")) return;
    setActioningId(purchaseId);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/purchases/${purchaseId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "POSTED" }),
        },
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al contabilizar");
      }
      toast.success("Compra contabilizada");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al contabilizar");
    } finally {
      setActioningId(null);
    }
  }

  async function handleVoid(purchaseId: string) {
    if (!window.confirm("¿Anular esta compra? Se revertirá el asiento contable y la cuenta por pagar.")) return;
    setActioningId(purchaseId);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/purchases/${purchaseId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "VOIDED" }),
        },
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al anular");
      }
      toast.success("Compra anulada");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al anular");
    } finally {
      setActioningId(null);
    }
  }

  async function handleDelete(purchaseId: string) {
    if (!window.confirm("¿Eliminar este borrador? Esta acción no se puede deshacer.")) return;
    setActioningId(purchaseId);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/purchases/${purchaseId}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al eliminar");
      }
      toast.success("Borrador eliminado");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setActioningId(null);
    }
  }

  return (
    <>
      {/* Type cards / quick create */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cursor-pointer transition-shadow hover:shadow-md">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-orange-100 p-2">
                <Truck className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <CardTitle className="text-sm">Flete</CardTitle>
                <CardDescription className="text-xs">Transporte de pollos</CardDescription>
              </div>
            </div>
            <CardAction>
              <Link href={`/${orgSlug}/purchases/new?type=FLETE`}>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Nuevo
                </Button>
              </Link>
            </CardAction>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer transition-shadow hover:shadow-md">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-100 p-2">
                <Package className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <CardTitle className="text-sm">Pollo Faenado</CardTitle>
                <CardDescription className="text-xs">Compra de pollo faenado</CardDescription>
              </div>
            </div>
            <CardAction>
              <Link href={`/${orgSlug}/purchases/new?type=POLLO_FAENADO`}>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Nuevo
                </Button>
              </Link>
            </CardAction>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer transition-shadow hover:shadow-md">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2">
                <ShoppingCart className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-sm">Compra General</CardTitle>
                <CardDescription className="text-xs">Compras diversas</CardDescription>
              </div>
            </div>
            <CardAction>
              <Link href={`/${orgSlug}/purchases/new?type=COMPRA_GENERAL`}>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Nuevo
                </Button>
              </Link>
            </CardAction>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer transition-shadow hover:shadow-md">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-2">
                <Wrench className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-sm">Servicio</CardTitle>
                <CardDescription className="text-xs">Servicios contratados</CardDescription>
              </div>
            </div>
            <CardAction>
              <Link href={`/${orgSlug}/purchases/new?type=SERVICIO`}>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Nuevo
                </Button>
              </Link>
            </CardAction>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label className="text-sm">Tipo</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="FLETE">Flete</SelectItem>
                  <SelectItem value="POLLO_FAENADO">Pollo Faenado</SelectItem>
                  <SelectItem value="COMPRA_GENERAL">Compra General</SelectItem>
                  <SelectItem value="SERVICIO">Servicio</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-sm">Estado</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="DRAFT">Borrador</SelectItem>
                  <SelectItem value="POSTED">Contabilizado</SelectItem>
                  <SelectItem value="LOCKED">Bloqueado</SelectItem>
                  <SelectItem value="VOIDED">Anulado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Nro</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Tipo</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Proveedor</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Fecha</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Total</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-600">Estado</th>
                  <th className="w-12 py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-600">No hay compras registradas</p>
                      <p className="text-sm text-gray-400 mt-1">
                        {typeFilter !== "all" || statusFilter !== "all"
                          ? "Ninguna compra coincide con los filtros aplicados"
                          : "Cree la primera compra para comenzar"}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((purchase) => {
                    const statusBadge = STATUS_BADGE[purchase.status] ?? {
                      label: purchase.status,
                      className: "bg-gray-100 text-gray-800",
                    };
                    const typeName = PURCHASE_TYPE_LABEL[purchase.purchaseType] ?? purchase.purchaseType;
                    const isLoading = actioningId === purchase.id;

                    return (
                      <tr
                        key={purchase.id}
                        className="border-b hover:bg-gray-50 cursor-pointer"
                        onClick={() => router.push(`/${orgSlug}/purchases/${purchase.id}`)}
                      >
                        <td className="py-3 px-4 font-mono text-blue-600 font-medium">
                          {purchase.displayCode}
                        </td>
                        <td className="py-3 px-4">{typeName}</td>
                        <td className="py-3 px-4 text-gray-500">
                          {purchase.contact?.name ?? "—"}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {formatDate(purchase.date)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {formatCurrency(purchase.totalAmount)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge className={statusBadge.className}>
                            {statusBadge.label}
                          </Badge>
                        </td>
                        <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                          {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin text-gray-400 mx-auto" />
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon-sm" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {purchase.status === "DRAFT" && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() => router.push(`/${orgSlug}/purchases/${purchase.id}`)}
                                    >
                                      <Pencil className="h-4 w-4 mr-2" />
                                      Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handlePost(purchase.id)}
                                    >
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      Contabilizar
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleDelete(purchase.id)}
                                      className="text-red-600 focus:text-red-600"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Eliminar
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {purchase.status === "POSTED" && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() => router.push(`/${orgSlug}/purchases/${purchase.id}`)}
                                    >
                                      <Eye className="h-4 w-4 mr-2" />
                                      Ver / Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleVoid(purchase.id)}
                                      className="text-red-600 focus:text-red-600"
                                    >
                                      <XCircle className="h-4 w-4 mr-2" />
                                      Anular
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {(purchase.status === "LOCKED" || purchase.status === "VOIDED") && (
                                  <DropdownMenuItem
                                    onClick={() => router.push(`/${orgSlug}/purchases/${purchase.id}`)}
                                  >
                                    <Eye className="h-4 w-4 mr-2" />
                                    Ver
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
