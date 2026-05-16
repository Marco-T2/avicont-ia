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
import VoucherStatusBadge from "@/components/common/voucher-status-badge";
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  ShoppingCart,
  Truck,
  Package,
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
import type { PurchaseWithDetails } from "@/modules/purchase/presentation/dto/purchase-with-details";
import type { PaginatedResult } from "@/modules/shared/domain/value-objects/pagination";
import { formatDateBO } from "@/lib/date-utils";

// ── Helpers ──

function formatCurrency(amount: number): string {
  return `Bs. ${amount.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function buildHref(
  orgSlug: string,
  page: number,
  typeFilter: string | undefined,
  statusFilter: string | undefined,
): string {
  const sp = new URLSearchParams();
  if (page > 1) sp.set("page", String(page));
  if (typeFilter) sp.set("purchaseType", typeFilter);
  if (statusFilter) sp.set("status", statusFilter);
  const q = sp.toString();
  return `/${orgSlug}/purchases${q ? `?${q}` : ""}`;
}

const PURCHASE_TYPE_LABEL: Record<string, string> = {
  FLETE: "Flete",
  POLLO_FAENADO: "Pollo Faenado",
  COMPRA_GENERAL: "Compra / Servicio",
  SERVICIO: "Compra / Servicio",
};

// ── Props ──

type PurchaseListProps = PaginatedResult<PurchaseWithDetails> & {
  orgSlug: string;
  typeFilter?: string;
  statusFilter?: string;
};

export default function PurchaseList({
  orgSlug,
  items,
  total,
  page,
  pageSize,
  totalPages,
  typeFilter,
  statusFilter,
}: PurchaseListProps) {
  const router = useRouter();
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [postId, setPostId] = useState<string | null>(null);
  const [voidId, setVoidId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const currentType = typeFilter ?? "all";
  const currentStatus = statusFilter ?? "all";

  function handleTypeChange(next: string) {
    const sp = new URLSearchParams();
    if (next !== "all") sp.set("purchaseType", next);
    if (statusFilter) sp.set("status", statusFilter);
    const q = sp.toString();
    router.push(`/${orgSlug}/purchases${q ? `?${q}` : ""}`);
  }

  function handleStatusChange(next: string) {
    const sp = new URLSearchParams();
    if (typeFilter) sp.set("purchaseType", typeFilter);
    if (next !== "all") sp.set("status", next);
    const q = sp.toString();
    router.push(`/${orgSlug}/purchases${q ? `?${q}` : ""}`);
  }

  function handlePost(purchaseId: string) {
    setPostId(purchaseId);
  }

  function handleVoid(purchaseId: string) {
    setVoidId(purchaseId);
  }

  function handleDelete(purchaseId: string) {
    setDeleteId(purchaseId);
  }

  async function executePost() {
    if (!postId) return;
    const purchaseId = postId;
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
      setPostId(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al contabilizar");
    } finally {
      setActioningId(null);
    }
  }

  async function executeVoid() {
    if (!voidId) return;
    const purchaseId = voidId;
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
      setVoidId(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al anular");
    } finally {
      setActioningId(null);
    }
  }

  async function executeDelete() {
    if (!deleteId) return;
    const purchaseId = deleteId;
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
      setDeleteId(null);
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="cursor-pointer transition-shadow hover:shadow-md">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-warning/10 dark:bg-warning/20 p-2">
                <Truck className="h-5 w-5 text-warning" />
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
              <div className="rounded-lg bg-primary/10 dark:bg-primary/20 p-2">
                <Package className="h-5 w-5 text-primary" />
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
              <div className="rounded-lg bg-info/10 dark:bg-info/20 p-2">
                <ShoppingCart className="h-5 w-5 text-info" />
              </div>
              <div>
                <CardTitle className="text-sm">Compra / Servicio</CardTitle>
                <CardDescription className="text-xs">Compras y servicios contratados</CardDescription>
              </div>
            </div>
            <CardAction>
              <Link href={`/${orgSlug}/purchases/new?type=COMPRA_GENERAL`}>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Nueva Compra / Servicio
                </Button>
              </Link>
            </CardAction>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label className="text-sm">Tipo</Label>
              <Select value={currentType} onValueChange={handleTypeChange}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="FLETE">Flete</SelectItem>
                  <SelectItem value="POLLO_FAENADO">Pollo Faenado</SelectItem>
                  <SelectItem value="COMPRA_GENERAL_O_SERVICIO">Compras y Servicios</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-sm">Estado</Label>
              <Select value={currentStatus} onValueChange={handleStatusChange}>
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
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Período</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Fecha</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Tipo</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Nro</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Ref.</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Proveedor</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Total</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Estado</th>
                  <th className="w-12 py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center">
                      <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No hay compras registradas</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {typeFilter || statusFilter
                          ? "Ninguna compra coincide con los filtros aplicados"
                          : "Cree la primera compra para comenzar"}
                      </p>
                    </td>
                  </tr>
                ) : (
                  items.map((purchase) => {
                    const typeName = PURCHASE_TYPE_LABEL[purchase.purchaseType] ?? purchase.purchaseType;
                    const isLoading = actioningId === purchase.id;

                    return (
                      <tr
                        key={purchase.id}
                        className="border-b hover:bg-accent/50 cursor-pointer"
                        onClick={() => router.push(`/${orgSlug}/purchases/${purchase.id}`)}
                      >
                        <td className="py-3 px-4 text-muted-foreground">
                          {purchase.period?.name ?? "—"}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {formatDateBO(purchase.date)}
                        </td>
                        <td className="py-3 px-4">{typeName}</td>
                        <td className="py-3 px-4 font-mono text-info font-medium">
                          {purchase.displayCode}
                        </td>
                        <td className="py-3 px-4 font-mono text-muted-foreground">
                          {purchase.referenceNumber ?? "—"}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {purchase.contact?.name ?? "—"}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {formatCurrency(purchase.totalAmount)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <VoucherStatusBadge status={purchase.status} />
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
                                      className="text-destructive focus:text-destructive"
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
                                      className="text-destructive focus:text-destructive"
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

      {/* Paginación */}
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href={buildHref(orgSlug, Math.max(1, page - 1), typeFilter, statusFilter)}
                aria-disabled={page <= 1}
                className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
                text="Anterior"
              />
            </PaginationItem>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <PaginationItem key={p}>
                <PaginationLink
                  href={buildHref(orgSlug, p, typeFilter, statusFilter)}
                  isActive={p === page}
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                href={buildHref(orgSlug, Math.min(totalPages, page + 1), typeFilter, statusFilter)}
                aria-disabled={page >= totalPages}
                className={page >= totalPages ? "pointer-events-none opacity-50" : undefined}
                text="Siguiente"
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {total > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          Mostrando {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} de {total}
        </p>
      )}

      <ConfirmDialog
        open={postId !== null}
        onOpenChange={(open) => !open && setPostId(null)}
        title="Contabilizar compra"
        description="¿Contabilizar esta compra? Esta acción generará el asiento contable y la cuenta por pagar."
        confirmLabel="Contabilizar"
        variant="default"
        loading={actioningId !== null}
        onConfirm={executePost}
      />

      <ConfirmDialog
        open={voidId !== null}
        onOpenChange={(open) => !open && setVoidId(null)}
        title="Anular compra"
        description="¿Anular esta compra? Se revertirá el asiento contable y la cuenta por pagar. Esta operación no se puede deshacer."
        confirmLabel="Anular"
        variant="destructive"
        loading={actioningId !== null}
        onConfirm={executeVoid}
      />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
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
