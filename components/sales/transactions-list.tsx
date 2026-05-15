"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card";
import VoucherStatusBadge from "@/components/common/voucher-status-badge";
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
import { formatDateBO } from "@/lib/date-utils";

// Presentation-local discriminated union — replaces retired
// @/modules/dispatch/presentation HubItem (hub.types.ts DELETED in C1 GREEN
// poc-dispatch-retirement-into-sales). Inlined here pre-C2 component move
// per design § 5 presentation-local types decision.
type CommonStatus = "DRAFT" | "POSTED" | "LOCKED" | "VOIDED";
type HubItemSale = {
  source: "sale";
  type: "VENTA_GENERAL";
  id: string;
  displayCode: string;
  referenceNumber: number | null;
  date: Date;
  contactId: string;
  contactName: string;
  periodId: string;
  description: string;
  totalAmount: string;
  status: CommonStatus;
};
type HubItemDispatch = {
  source: "dispatch";
  type: "NOTA_DESPACHO" | "BOLETA_CERRADA";
  id: string;
  displayCode: string;
  referenceNumber: number | null;
  date: Date;
  contactId: string;
  contactName: string;
  periodId: string;
  description: string;
  totalAmount: string;
  status: CommonStatus;
};
type HubItem = HubItemSale | HubItemDispatch;

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: string): string {
  const num = parseFloat(amount);
  return `Bs. ${num.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const TYPE_LABEL: Record<string, string> = {
  VENTA_GENERAL: "Venta General",
  NOTA_DESPACHO: "Nota de Despacho",
  BOLETA_CERRADA: "Boleta Cerrada",
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface TransactionsListProps {
  orgSlug: string;
  items: HubItem[];
  periods: { id: string; name: string }[];
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
  periodName: string;
  isLoading: boolean;
  onPost: (item: HubItem) => void;
  onVoid: (item: HubItem) => void;
  onDelete: (item: HubItem) => void;
}

function HubItemRow({ orgSlug, item, periodName, isLoading, onPost, onVoid, onDelete }: HubItemRowProps) {
  const router = useRouter();
  const typeName = TYPE_LABEL[item.type] ?? item.type;
  const viewPath = getViewPath(orgSlug, item);
  const editPath = getEditPath(orgSlug, item);

  return (
    <tr
      className="border-b hover:bg-accent/50 cursor-pointer"
      onClick={() => router.push(viewPath)}
    >
      <td className="py-3 px-4 text-muted-foreground">{periodName}</td>
      <td className="py-3 px-4 whitespace-nowrap">
        {formatDateBO(item.date)}
      </td>
      <td className="py-3 px-4">{typeName}</td>
      <td className="py-3 px-4 font-mono text-info font-medium">
        {item.displayCode}
      </td>
      <td className="py-3 px-4 font-mono text-muted-foreground">
        {item.referenceNumber ?? "—"}
      </td>
      <td className="py-3 px-4 text-muted-foreground">{item.contactName}</td>
      <td className="py-3 px-4 text-right font-mono">
        {formatCurrency(item.totalAmount)}
      </td>
      <td className="py-3 px-4 text-center">
        <VoucherStatusBadge status={item.status} />
      </td>
      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />
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
                    className="text-destructive focus:text-destructive"
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
                    className="text-destructive focus:text-destructive"
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

/**
 * Renders 3-type unified transactions view (Sale + Boleta Cerrada + Nota de
 * Despacho). Sale section preserves listPaginated pagination; BC/ND rows
 * non-paginated alongside per B5 lock (poc-dispatch-retirement-into-sales).
 */
export default function TransactionsList({
  orgSlug,
  items,
  periods,
  filters,
}: TransactionsListProps) {
  const router = useRouter();
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [postItem, setPostItem] = useState<HubItem | null>(null);
  const [voidItem, setVoidItem] = useState<HubItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<HubItem | null>(null);
  const periodMap = new Map(periods.map((p) => [p.id, p.name]));

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
    router.push(`/${orgSlug}/sales${query ? `?${query}` : ""}`);
  }

  function clearFilters() {
    router.push(`/${orgSlug}/sales`);
  }

  function handlePostFromList(item: HubItem) {
    setPostItem(item);
  }

  function handleVoidFromList(item: HubItem) {
    setVoidItem(item);
  }

  function handleDeleteFromList(item: HubItem) {
    setDeleteItem(item);
  }

  async function executePost() {
    if (!postItem) return;
    const item = postItem;
    const label = item.source === "sale" ? "venta" : "despacho";
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
      setPostItem(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al contabilizar");
    } finally {
      setActioningId(null);
    }
  }

  async function executeVoid() {
    if (!voidItem) return;
    const item = voidItem;
    const label = item.source === "sale" ? "venta" : "despacho";
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
      setVoidItem(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al anular");
    } finally {
      setActioningId(null);
    }
  }

  async function executeDelete() {
    if (!deleteItem) return;
    const item = deleteItem;
    setActioningId(item.id);
    try {
      const response = await fetch(getDeleteApiPath(orgSlug, item), { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al eliminar");
      }
      toast.success("Borrador eliminado");
      setDeleteItem(null);
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
              <div className="rounded-lg bg-success/10 dark:bg-success/20 p-2">
                <DollarSign className="h-5 w-5 text-success" />
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
              <div className="rounded-lg bg-info/10 dark:bg-info/20 p-2">
                <ClipboardList className="h-5 w-5 text-info" />
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
              <div className="rounded-lg bg-primary/10 dark:bg-primary/20 p-2">
                <Package className="h-5 w-5 text-primary" />
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
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Período</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Fecha</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Tipo</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Código</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Ref.</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Cliente</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Total</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Estado</th>
                  <th className="w-12 py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center" data-testid="dispatch-list-empty">
                      <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No hay registros</p>
                      <p className="text-sm text-muted-foreground mt-1">
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
                      periodName={periodMap.get(item.periodId) ?? "—"}
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

      <ConfirmDialog
        open={postItem !== null}
        onOpenChange={(open) => !open && setPostItem(null)}
        title="Contabilizar"
        description={
          postItem
            ? `¿Contabilizar este ${postItem.source === "sale" ? "venta" : "despacho"}? Esta acción generará el asiento contable.`
            : null
        }
        confirmLabel="Contabilizar"
        variant="default"
        loading={actioningId !== null}
        onConfirm={executePost}
      />

      <ConfirmDialog
        open={voidItem !== null}
        onOpenChange={(open) => !open && setVoidItem(null)}
        title="Anular"
        description={
          voidItem
            ? `¿Anular este ${voidItem.source === "sale" ? "venta" : "despacho"}? Se revertirá el asiento contable. Esta operación no se puede deshacer.`
            : null
        }
        confirmLabel="Anular"
        variant="destructive"
        loading={actioningId !== null}
        onConfirm={executeVoid}
      />

      <ConfirmDialog
        open={deleteItem !== null}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        title="Eliminar borrador"
        description="Esta acción eliminará el borrador permanentemente. No se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        loading={actioningId !== null}
        onConfirm={executeDelete}
      />
    </>
  );
}
