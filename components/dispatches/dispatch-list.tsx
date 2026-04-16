"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  ClipboardList,
  DollarSign,
  FileText,
  Package,
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
import type { HubItem } from "@/features/dispatch/hub.types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: string): string {
  const num = parseFloat(amount);
  return `Bs. ${num.toLocaleString("es-BO", {
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

const TYPE_LABEL: Record<string, string> = {
  VENTA_GENERAL: "Venta General",
  NOTA_DESPACHO: "Nota de Despacho",
  BOLETA_CERRADA: "Boleta Cerrada",
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface DispatchListProps {
  orgSlug: string;
  items: HubItem[];
  filters: {
    type?: string;
    status?: string;
    periodId?: string;
    contactId?: string;
    dateFrom?: string;
    dateTo?: string;
  };
}

// ── Action routing — exhaustive switch on source (D7) ─────────────────────────

function getViewPath(orgSlug: string, item: HubItem): string {
  switch (item.source) {
    case "sale":
      return `/${orgSlug}/sales/${item.id}`;
    case "dispatch":
      return `/${orgSlug}/dispatches/${item.id}`;
    default: {
      const _exhaustive: never = item;
      return `/${orgSlug}/dispatches`;
    }
  }
}

function getEditPath(orgSlug: string, item: HubItem): string {
  switch (item.source) {
    case "sale":
      return `/${orgSlug}/sales/${item.id}`;
    case "dispatch":
      return `/${orgSlug}/dispatches/${item.id}`;
    default: {
      const _exhaustive: never = item;
      return `/${orgSlug}/dispatches`;
    }
  }
}

function getStatusApiPath(orgSlug: string, item: HubItem): string {
  switch (item.source) {
    case "sale":
      return `/api/organizations/${orgSlug}/sales/${item.id}/status`;
    case "dispatch":
      return `/api/organizations/${orgSlug}/dispatches/${item.id}/status`;
    default: {
      const _exhaustive: never = item;
      void _exhaustive;
      return `/api/organizations/${orgSlug}/dispatches/unknown/status`;
    }
  }
}

function getDeleteApiPath(orgSlug: string, item: HubItem): string {
  switch (item.source) {
    case "sale":
      return `/api/organizations/${orgSlug}/sales/${item.id}`;
    case "dispatch":
      return `/api/organizations/${orgSlug}/dispatches/${item.id}`;
    default: {
      const _exhaustive: never = item;
      void _exhaustive;
      return `/api/organizations/${orgSlug}/dispatches/unknown`;
    }
  }
}

// ── HubItemRow sub-component (task 3.9 refactor) ─────────────────────────────

interface HubItemRowProps {
  orgSlug: string;
  item: HubItem;
  isLoading: boolean;
  onPost: (item: HubItem) => void;
  onVoid: (item: HubItem) => void;
  onDelete: (item: HubItem) => void;
}

function HubItemRow({ orgSlug, item, isLoading, onPost, onVoid, onDelete }: HubItemRowProps) {
  const router = useRouter();
  const statusBadge = STATUS_BADGE[item.status] ?? {
    label: item.status,
    className: "bg-gray-100 text-gray-800",
  };
  const typeName = TYPE_LABEL[item.type] ?? item.type;
  const viewPath = getViewPath(orgSlug, item);
  const editPath = getEditPath(orgSlug, item);

  return (
    <tr
      className="border-b hover:bg-gray-50 cursor-pointer"
      onClick={() => router.push(viewPath)}
    >
      <td className="py-3 px-4 font-mono text-blue-600 font-medium">
        {item.displayCode}
      </td>
      <td className="py-3 px-4 font-mono text-gray-500">
        {item.referenceNumber ?? "—"}
      </td>
      <td className="py-3 px-4 whitespace-nowrap">
        {formatDate(item.date)}
      </td>
      <td className="py-3 px-4">{typeName}</td>
      <td className="py-3 px-4 text-gray-500">{item.contactName}</td>
      <td className="py-3 px-4 text-center">
        <Badge className={statusBadge.className}>{statusBadge.label}</Badge>
      </td>
      <td className="py-3 px-4 text-right font-mono">
        {formatCurrency(item.totalAmount)}
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
              {item.status === "DRAFT" && (
                <>
                  <DropdownMenuItem onClick={() => router.push(editPath)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onPost(item)}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Contabilizar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(item)}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar
                  </DropdownMenuItem>
                </>
              )}
              {item.status === "POSTED" && (
                <>
                  <DropdownMenuItem onClick={() => router.push(viewPath)}>
                    <Eye className="h-4 w-4 mr-2" />
                    Ver
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onVoid(item)}
                    className="text-red-600 focus:text-red-600"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Anular
                  </DropdownMenuItem>
                </>
              )}
              {(item.status === "LOCKED" || item.status === "VOIDED") && (
                <DropdownMenuItem onClick={() => router.push(viewPath)}>
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
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DispatchList({
  orgSlug,
  items,
  filters,
}: DispatchListProps) {
  const router = useRouter();
  const [actioningId, setActioningId] = useState<string | null>(null);

  function buildQuery(overrides: Record<string, string | undefined>): string {
    const params = new URLSearchParams();
    const merged = {
      type: filters.type,
      status: filters.status,
      periodId: filters.periodId,
      contactId: filters.contactId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      ...overrides,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value && value !== "all") {
        params.set(key, value);
      }
    }
    return params.toString();
  }

  function applyFilter(key: string, value: string) {
    const query = buildQuery({ [key]: value });
    router.push(`/${orgSlug}/dispatches${query ? `?${query}` : ""}`);
  }

  function clearFilters() {
    router.push(`/${orgSlug}/dispatches`);
  }

  async function handlePostFromList(item: HubItem) {
    const label = item.source === "sale" ? "venta" : "despacho";
    if (!window.confirm(`¿Contabilizar este ${label}?`)) return;
    setActioningId(item.id);
    try {
      const response = await fetch(getStatusApiPath(orgSlug, item), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "POSTED" }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? `Error al contabilizar`);
      }
      toast.success(`${label.charAt(0).toUpperCase() + label.slice(1)} contabilizado`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al contabilizar");
    } finally {
      setActioningId(null);
    }
  }

  async function handleVoidFromList(item: HubItem) {
    const label = item.source === "sale" ? "venta" : "despacho";
    if (!window.confirm(`¿Anular este ${label}? Se revertirá el asiento contable.`)) return;
    setActioningId(item.id);
    try {
      const response = await fetch(getStatusApiPath(orgSlug, item), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "VOIDED" }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al anular");
      }
      toast.success(`${label.charAt(0).toUpperCase() + label.slice(1)} anulado`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al anular");
    } finally {
      setActioningId(null);
    }
  }

  async function handleDeleteFromList(item: HubItem) {
    if (!window.confirm("¿Eliminar este borrador? Esta acción no se puede deshacer.")) return;
    setActioningId(item.id);
    try {
      const response = await fetch(getDeleteApiPath(orgSlug, item), { method: "DELETE" });
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

  const hasFilters = !!(filters.type || filters.status || filters.periodId || filters.contactId || filters.dateFrom || filters.dateTo);

  return (
    <>
      {/* Type cards */}
      <div className="grid grid-cols-3 gap-4">
        {/* Ventas General */}
        <Card className="cursor-pointer transition-shadow hover:shadow-md">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-2">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <CardTitle>Ventas General</CardTitle>
                <CardDescription>Servicios y productos varios</CardDescription>
              </div>
            </div>
            <CardAction>
              <Link href={`/${orgSlug}/sales/new`}>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Nuevo
                </Button>
              </Link>
            </CardAction>
          </CardHeader>
        </Card>

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
              <label className="text-sm font-medium">Tipo</label>
              <Select
                value={filters.type ?? "all"}
                onValueChange={(v) => applyFilter("type", v)}
              >
                <SelectTrigger className="w-48" data-testid="filter-type">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="VENTA_GENERAL">Venta General</SelectItem>
                  <SelectItem value="NOTA_DESPACHO">Nota de Despacho</SelectItem>
                  <SelectItem value="BOLETA_CERRADA">Boleta Cerrada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Estado</label>
              <Select
                value={filters.status ?? "all"}
                onValueChange={(v) => applyFilter("status", v)}
              >
                <SelectTrigger className="w-40" data-testid="filter-status">
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

            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
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
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Cliente</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-600">Estado</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Total</th>
                  <th className="w-12 py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center" data-testid="dispatch-list-empty">
                      <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-600">No hay registros</p>
                      <p className="text-sm text-gray-400 mt-1">
                        {hasFilters
                          ? "Ningún registro coincide con los filtros aplicados"
                          : "Cree el primer registro para comenzar"}
                      </p>
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <HubItemRow
                      key={item.id}
                      orgSlug={orgSlug}
                      item={item}
                      isLoading={actioningId === item.id}
                      onPost={handlePostFromList}
                      onVoid={handleVoidFromList}
                      onDelete={handleDeleteFromList}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
