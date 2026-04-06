"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ClipboardList, FileText, Package, Plus, Search, MoreHorizontal, Eye, Pencil, CheckCircle, XCircle, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import type { FiscalPeriod } from "@/generated/prisma/client";

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

const DISPATCH_TYPE_LABEL: Record<string, string> = {
  NOTA_DESPACHO: "Nota de Despacho",
  BOLETA_CERRADA: "Boleta Cerrada",
};

// ── Local interfaces (no Prisma client in client components) ──

interface DispatchContact {
  id: string;
  name: string;
  type: string;
}

interface DispatchItem {
  id: string;
  organizationId: string;
  dispatchType: "NOTA_DESPACHO" | "BOLETA_CERRADA";
  status: "DRAFT" | "POSTED" | "LOCKED" | "VOIDED";
  sequenceNumber: number;
  referenceNumber: number | null;
  date: Date | string;
  contactId: string;
  periodId: string;
  description: string;
  totalAmount: number;
  displayCode: string;
  contact: DispatchContact;
}

interface DispatchListProps {
  orgSlug: string;
  dispatches: DispatchItem[];
  periods: FiscalPeriod[];
  filters: {
    dispatchType?: string;
    status?: string;
    periodId?: string;
    referenceNumber?: string;
  };
}

export default function DispatchList({
  orgSlug,
  dispatches,
  periods,
  filters,
}: DispatchListProps) {
  const router = useRouter();
  const [actioningId, setActioningId] = useState<string | null>(null);

  const periodMap = new Map(periods.map((p) => [p.id, p.name]));

  function applyFilter(key: string, value: string) {
    const params = new URLSearchParams();
    if (filters.periodId) params.set("periodId", filters.periodId);
    if (filters.dispatchType) params.set("dispatchType", filters.dispatchType);
    if (filters.status) params.set("status", filters.status);
    if (filters.referenceNumber) params.set("referenceNumber", filters.referenceNumber);

    if (value && value !== "all" && value !== "") {
      params.set(key, value);
    } else {
      params.delete(key);
    }

    const query = params.toString();
    router.push(`/${orgSlug}/dispatches${query ? `?${query}` : ""}`);
  }

  function clearFilters() {
    router.push(`/${orgSlug}/dispatches`);
  }

  async function handlePostFromList(dispatchId: string) {
    if (!window.confirm("¿Contabilizar este despacho?")) return;
    setActioningId(dispatchId);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/dispatches/${dispatchId}/status`,
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
      toast.success("Despacho contabilizado");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al contabilizar");
    } finally {
      setActioningId(null);
    }
  }

  async function handleVoidFromList(dispatchId: string) {
    if (!window.confirm("¿Anular este despacho? Se revertirá el asiento contable y la cuenta por cobrar.")) return;
    setActioningId(dispatchId);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/dispatches/${dispatchId}/status`,
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
      toast.success("Despacho anulado");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al anular");
    } finally {
      setActioningId(null);
    }
  }

  async function handleDeleteFromList(dispatchId: string) {
    if (!window.confirm("¿Eliminar este borrador? Esta acción no se puede deshacer.")) return;
    setActioningId(dispatchId);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/dispatches/${dispatchId}`,
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

  const hasFilters = !!(
    filters.periodId ||
    filters.dispatchType ||
    filters.status ||
    filters.referenceNumber
  );

  return (
    <>
      {/* Type cards */}
      <div className="grid grid-cols-2 gap-4">
        {/* Nota de Despacho */}
        <Card className="cursor-pointer transition-shadow hover:shadow-md">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2">
                <ClipboardList className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle>Nota de Despacho</CardTitle>
                <CardDescription>Pesado en destino</CardDescription>
              </div>
            </div>
            <CardAction>
              <Link href={`/${orgSlug}/dispatches/new?type=NOTA_DESPACHO`}>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Nuevo
                </Button>
              </Link>
            </CardAction>
          </CardHeader>
        </Card>

        {/* Boleta Cerrada */}
        <Card className="cursor-pointer transition-shadow hover:shadow-md">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-100 p-2">
                <Package className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <CardTitle>Boleta Cerrada</CardTitle>
                <CardDescription>Pesado en matadero</CardDescription>
              </div>
            </div>
            <CardAction>
              <Link href={`/${orgSlug}/dispatches/new?type=BOLETA_CERRADA`}>
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
              <Label className="text-sm">Período</Label>
              <Select
                value={filters.periodId ?? "all"}
                onValueChange={(v) => applyFilter("periodId", v)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Todos los períodos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los períodos</SelectItem>
                  {periods.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-sm">Tipo</Label>
              <Select
                value={filters.dispatchType ?? "all"}
                onValueChange={(v) => applyFilter("dispatchType", v)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="NOTA_DESPACHO">Nota de Despacho</SelectItem>
                  <SelectItem value="BOLETA_CERRADA">Boleta Cerrada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-sm">Estado</Label>
              <Select
                value={filters.status ?? "all"}
                onValueChange={(v) => applyFilter("status", v)}
              >
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

            <div className="space-y-1">
              <Label className="text-sm">Búsqueda por Ref.</Label>
              <Input
                className="w-40"
                placeholder="Nro. de referencia"
                defaultValue={filters.referenceNumber ?? ""}
                onBlur={(e) => applyFilter("referenceNumber", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    applyFilter("referenceNumber", (e.target as HTMLInputElement).value);
                  }
                }}
              />
            </div>

            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <Search className="h-4 w-4 mr-2" />
                Limpiar filtros
              </Button>
            )}
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
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Código</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Ref.</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Fecha</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Tipo</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Período</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Cliente</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-600">Estado</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Total</th>
                  <th className="w-12 py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {dispatches.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center">
                      <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-600">No hay despachos registrados</p>
                      <p className="text-sm text-gray-400 mt-1">
                        {hasFilters
                          ? "Ningún despacho coincide con los filtros aplicados"
                          : "Cree el primer despacho para comenzar"}
                      </p>
                    </td>
                  </tr>
                ) : (
                  dispatches.map((dispatch) => {
                    const statusBadge = STATUS_BADGE[dispatch.status] ?? {
                      label: dispatch.status,
                      className: "bg-gray-100 text-gray-800",
                    };
                    const periodName = periodMap.get(dispatch.periodId) ?? "—";
                    const typeName = DISPATCH_TYPE_LABEL[dispatch.dispatchType] ?? dispatch.dispatchType;
                    const isLoading = actioningId === dispatch.id;

                    return (
                      <tr
                        key={dispatch.id}
                        className="border-b hover:bg-gray-50 cursor-pointer"
                        onClick={() =>
                          router.push(`/${orgSlug}/dispatches/${dispatch.id}`)
                        }
                      >
                        <td className="py-3 px-4 font-mono text-blue-600 font-medium">
                          {dispatch.displayCode}
                        </td>
                        <td className="py-3 px-4 font-mono text-gray-500">
                          {dispatch.referenceNumber ?? "—"}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {formatDate(dispatch.date)}
                        </td>
                        <td className="py-3 px-4">{typeName}</td>
                        <td className="py-3 px-4 text-gray-500">{periodName}</td>
                        <td className="py-3 px-4 text-gray-500">
                          {dispatch.contact?.name ?? "—"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge className={statusBadge.className}>
                            {statusBadge.label}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {formatCurrency(dispatch.totalAmount)}
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
                                {dispatch.status === "DRAFT" && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() => router.push(`/${orgSlug}/dispatches/${dispatch.id}`)}
                                    >
                                      <Pencil className="h-4 w-4 mr-2" />
                                      Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handlePostFromList(dispatch.id)}
                                    >
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      Contabilizar
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleDeleteFromList(dispatch.id)}
                                      className="text-red-600 focus:text-red-600"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Eliminar
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {dispatch.status === "POSTED" && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() => router.push(`/${orgSlug}/dispatches/${dispatch.id}`)}
                                    >
                                      <Eye className="h-4 w-4 mr-2" />
                                      Ver
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleVoidFromList(dispatch.id)}
                                      className="text-red-600 focus:text-red-600"
                                    >
                                      <XCircle className="h-4 w-4 mr-2" />
                                      Anular
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {dispatch.status === "LOCKED" && (
                                  <DropdownMenuItem
                                    onClick={() => router.push(`/${orgSlug}/dispatches/${dispatch.id}`)}
                                  >
                                    <Eye className="h-4 w-4 mr-2" />
                                    Ver
                                  </DropdownMenuItem>
                                )}
                                {dispatch.status === "VOIDED" && (
                                  <DropdownMenuItem
                                    onClick={() => router.push(`/${orgSlug}/dispatches/${dispatch.id}`)}
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
