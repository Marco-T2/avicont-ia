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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  FileText,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  CheckCircle,
  XCircle,
  Trash2,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { PaymentWithRelations } from "@/modules/payment/presentation/dto/payment-with-relations";
import type { PaymentDirection } from "@/modules/payment/presentation/server";
import type { PaginatedResult } from "@/modules/shared/domain/value-objects/pagination";

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

function buildHref(
  orgSlug: string,
  page: number,
  status: string | undefined,
  contactId: string | undefined,
  method: string | undefined,
): string {
  const sp = new URLSearchParams();
  if (page > 1) sp.set("page", String(page));
  if (status) sp.set("status", status);
  if (contactId) sp.set("contactId", contactId);
  if (method) sp.set("method", method);
  const q = sp.toString();
  return `/${orgSlug}/payments${q ? `?${q}` : ""}`;
}

const METHOD_LABEL: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  CHEQUE: "Cheque",
  DEPOSITO: "Depósito",
};

// ── Infer payment direction ──

function inferDirection(payment: PaymentWithRelations, contacts: ContactOption[]): PaymentDirection {
  if (payment.allocations.length > 0) {
    return payment.allocations[0].receivableId ? "COBRO" : "PAGO";
  }
  const contact = contacts.find((c) => c.id === payment.contactId);
  if (contact?.type === "CLIENTE") return "COBRO";
  if (contact?.type === "PROVEEDOR") return "PAGO";
  return "PAGO";
}

// ── Local interfaces ──

interface ContactOption {
  id: string;
  name: string;
  type: string;
}

type PaymentListProps = PaginatedResult<PaymentWithRelations> & {
  orgSlug: string;
  contacts: ContactOption[];
  statusFilter?: string;
  contactIdFilter?: string;
  methodFilter?: string;
};

// ── Row sub-component with actions dropdown ──

interface PaymentRowProps {
  orgSlug: string;
  payment: PaymentWithRelations;
  direction: PaymentDirection;
  isLoading: boolean;
  onPost: (payment: PaymentWithRelations) => void;
  onVoid: (payment: PaymentWithRelations) => void;
  onDelete: (payment: PaymentWithRelations) => void;
}

function PaymentRow({
  orgSlug,
  payment,
  direction,
  isLoading,
  onPost,
  onVoid,
  onDelete,
}: PaymentRowProps) {
  const router = useRouter();
  const totalAllocated = payment.allocations.reduce(
    (sum, a) => sum + a.amount,
    0,
  );
  const unapplied = payment.amount - totalAllocated;
  const hasUnapplied =
    unapplied > 0.01 &&
    (payment.status === "POSTED" || payment.status === "LOCKED");

  const viewPath = `/${orgSlug}/payments/${payment.id}`;

  return (
    <tr
      className="border-b hover:bg-accent/50 cursor-pointer"
      onClick={() => router.push(viewPath)}
    >
      <td className="py-3 px-4 whitespace-nowrap">{formatDate(payment.date)}</td>
      <td className="py-3 px-4">
        <Badge
          className={
            direction === "COBRO"
              ? "bg-info/10 text-info dark:bg-info/20"
              : "bg-success/10 text-success dark:bg-success/20"
          }
        >
          {direction === "COBRO" ? "Cobro" : "Pago"}
        </Badge>
      </td>
      <td className="py-3 px-4 text-muted-foreground">
        {payment.contact?.name ?? "---"}
      </td>
      <td className="py-3 px-4 text-muted-foreground">
        {METHOD_LABEL[payment.method] ?? payment.method}
      </td>
      <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
        {payment.operationalDocType && payment.referenceNumber
          ? `${payment.operationalDocType.code}-${payment.referenceNumber}`
          : payment.referenceNumber
            ? String(payment.referenceNumber)
            : "—"}
      </td>
      <td className="py-3 px-4 text-muted-foreground max-w-48 truncate">
        {payment.description}
      </td>
      <td className="py-3 px-4 text-center">
        <VoucherStatusBadge status={payment.status} />
      </td>
      <td className="py-3 px-4 text-right font-mono">
        <div className="flex flex-col items-end gap-1">
          <span>{formatCurrency(payment.amount)}</span>
          {hasUnapplied && (
            <Badge className="bg-info/10 text-info dark:bg-info/20 text-xs font-normal">
              Crédito: Bs
              {unapplied.toLocaleString("es-BO", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Badge>
          )}
        </div>
      </td>
      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-8 w-8"
                aria-label="Acciones"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(viewPath)}>
                <Eye className="h-4 w-4 mr-2" />
                Ver
              </DropdownMenuItem>
              {payment.status === "DRAFT" && (
                <>
                  <DropdownMenuItem onClick={() => router.push(viewPath)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onPost(payment)}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Contabilizar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(payment)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar
                  </DropdownMenuItem>
                </>
              )}
              {payment.status === "POSTED" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onVoid(payment)}
                    className="text-destructive focus:text-destructive"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Anular
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </td>
    </tr>
  );
}

export default function PaymentList({
  orgSlug,
  items,
  total,
  page,
  pageSize,
  totalPages,
  contacts,
  statusFilter,
  contactIdFilter,
  methodFilter,
}: PaymentListProps) {
  const router = useRouter();
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [postPayment, setPostPayment] = useState<PaymentWithRelations | null>(null);
  const [voidPayment, setVoidPayment] = useState<PaymentWithRelations | null>(null);
  const [deletePayment, setDeletePayment] = useState<PaymentWithRelations | null>(null);

  // ── Server-side filters via URL searchParams nav (page resets a 1 al cambiar filtro) ──
  const filterStatus = statusFilter ?? "";
  const filterContactId = contactIdFilter ?? "";
  const filterMethod = methodFilter ?? "";
  const hasFilters = !!(filterStatus || filterContactId || filterMethod);

  function navigateFilter(
    nextStatus: string | undefined,
    nextContactId: string | undefined,
    nextMethod: string | undefined,
  ) {
    router.push(buildHref(orgSlug, 1, nextStatus, nextContactId, nextMethod));
  }

  function handleStatusChange(v: string) {
    navigateFilter(
      v === "all" ? undefined : v,
      filterContactId || undefined,
      filterMethod || undefined,
    );
  }

  function handleContactIdChange(v: string) {
    navigateFilter(
      filterStatus || undefined,
      v === "all" ? undefined : v,
      filterMethod || undefined,
    );
  }

  function handleMethodChange(v: string) {
    navigateFilter(
      filterStatus || undefined,
      filterContactId || undefined,
      v === "all" ? undefined : v,
    );
  }

  function clearFilters() {
    router.push(`/${orgSlug}/payments`);
  }

  // ── Summary stats (page-only — items is current page slice; total counts
  // los registros que matchean filtros server-side aplicados) ──
  const cobros = items.filter((p) => inferDirection(p, contacts) === "COBRO");
  const pagos = items.filter((p) => inferDirection(p, contacts) === "PAGO");
  const cobrosTotal = cobros.reduce((s, p) => s + p.amount, 0);
  const pagosTotal = pagos.reduce((s, p) => s + p.amount, 0);

  // ── Action handlers ──

  async function executeStatusTransition(
    payment: PaymentWithRelations,
    targetStatus: "POSTED" | "VOIDED",
  ) {
    setActioningId(payment.id);
    try {
      const res = await fetch(
        `/api/organizations/${orgSlug}/payments/${payment.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: targetStatus }),
        },
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(
          data.error ??
            (targetStatus === "POSTED"
              ? "Error al contabilizar"
              : "Error al anular"),
        );
      }
      toast.success(
        targetStatus === "POSTED"
          ? "Pago contabilizado correctamente"
          : "Pago anulado correctamente",
      );
      setPostPayment(null);
      setVoidPayment(null);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al cambiar el estado",
      );
    } finally {
      setActioningId(null);
    }
  }

  async function executeDelete(payment: PaymentWithRelations) {
    setActioningId(payment.id);
    try {
      const res = await fetch(
        `/api/organizations/${orgSlug}/payments/${payment.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al eliminar");
      }
      toast.success("Pago eliminado correctamente");
      setDeletePayment(null);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al eliminar el pago",
      );
    } finally {
      setActioningId(null);
    }
  }

  return (
    <>
      {/* Type cards */}
      <div className="grid grid-cols-2 gap-4">
        {/* Cobro */}
        <Card className="cursor-pointer transition-shadow hover:shadow-md">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-info/10 dark:bg-info/20 p-2">
                <ArrowDownCircle className="h-5 w-5 text-info" />
              </div>
              <div>
                <CardTitle>Cobros</CardTitle>
                <CardDescription>
                  {cobros.length} registro{cobros.length !== 1 ? "s" : ""} &mdash;{" "}
                  {formatCurrency(cobrosTotal)}
                </CardDescription>
              </div>
            </div>
            <CardAction>
              <Link href={`/${orgSlug}/payments/new?type=COBRO`}>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Nuevo Cobro
                </Button>
              </Link>
            </CardAction>
          </CardHeader>
        </Card>

        {/* Pago */}
        <Card className="cursor-pointer transition-shadow hover:shadow-md">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-success/10 dark:bg-success/20 p-2">
                <ArrowUpCircle className="h-5 w-5 text-success" />
              </div>
              <div>
                <CardTitle>Pagos</CardTitle>
                <CardDescription>
                  {pagos.length} registro{pagos.length !== 1 ? "s" : ""} &mdash;{" "}
                  {formatCurrency(pagosTotal)}
                </CardDescription>
              </div>
            </div>
            <CardAction>
              <Link href={`/${orgSlug}/payments/new?type=PAGO`}>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Nuevo Pago
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
              <Label className="text-sm">Estado</Label>
              <Select
                value={filterStatus || "all"}
                onValueChange={handleStatusChange}
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
              <Label className="text-sm">Contacto</Label>
              <Select
                value={filterContactId || "all"}
                onValueChange={handleContactIdChange}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los contactos</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-sm">Método</Label>
              <Select
                value={filterMethod || "all"}
                onValueChange={handleMethodChange}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                  <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                  <SelectItem value="CHEQUE">Cheque</SelectItem>
                  <SelectItem value="DEPOSITO">Depósito</SelectItem>
                </SelectContent>
              </Select>
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
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Fecha
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Tipo
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Contacto
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Método
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Documento
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Descripción
                  </th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">
                    Estado
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                    Monto
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center">
                      <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">
                        No hay cobros ni pagos registrados
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {hasFilters
                          ? "Ningún registro coincide con los filtros aplicados"
                          : "Cree el primer cobro o pago para comenzar"}
                      </p>
                    </td>
                  </tr>
                ) : (
                  items.map((payment) => (
                    <PaymentRow
                      key={payment.id}
                      orgSlug={orgSlug}
                      payment={payment}
                      direction={inferDirection(payment, contacts)}
                      isLoading={actioningId === payment.id}
                      onPost={setPostPayment}
                      onVoid={setVoidPayment}
                      onDelete={setDeletePayment}
                    />
                  ))
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
                href={buildHref(
                  orgSlug,
                  Math.max(1, page - 1),
                  filterStatus || undefined,
                  filterContactId || undefined,
                  filterMethod || undefined,
                )}
                aria-disabled={page <= 1}
                className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
                text="Anterior"
              />
            </PaginationItem>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <PaginationItem key={p}>
                <PaginationLink
                  href={buildHref(
                    orgSlug,
                    p,
                    filterStatus || undefined,
                    filterContactId || undefined,
                    filterMethod || undefined,
                  )}
                  isActive={p === page}
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                href={buildHref(
                  orgSlug,
                  Math.min(totalPages, page + 1),
                  filterStatus || undefined,
                  filterContactId || undefined,
                  filterMethod || undefined,
                )}
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

      {/* Dialog — CONTABILIZAR */}
      <Dialog
        open={postPayment !== null}
        onOpenChange={(open) => !open && setPostPayment(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contabilizar Pago</DialogTitle>
            <DialogDescription>
              Esta acción contabilizará el pago y generará los asientos
              contables correspondientes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={actioningId !== null}
              onClick={() => setPostPayment(null)}
            >
              Cancelar
            </Button>
            <Button
              className="bg-success hover:bg-success/90 text-success-foreground"
              disabled={actioningId !== null}
              onClick={() =>
                postPayment && executeStatusTransition(postPayment, "POSTED")
              }
            >
              {actioningId !== null ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Contabilizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — ANULAR */}
      <Dialog
        open={voidPayment !== null}
        onOpenChange={(open) => !open && setVoidPayment(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular Pago</DialogTitle>
            <DialogDescription>
              Esta acción anulará el pago y revertirá los asientos y CxC/CxP
              asociados. Esta operación no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={actioningId !== null}
              onClick={() => setVoidPayment(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={actioningId !== null}
              onClick={() =>
                voidPayment && executeStatusTransition(voidPayment, "VOIDED")
              }
            >
              {actioningId !== null ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Anular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — ELIMINAR */}
      <Dialog
        open={deletePayment !== null}
        onOpenChange={(open) => !open && setDeletePayment(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Pago Borrador</DialogTitle>
            <DialogDescription>
              Esta acción eliminará permanentemente el pago borrador. Esta
              operación no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={actioningId !== null}
              onClick={() => setDeletePayment(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={actioningId !== null}
              onClick={() => deletePayment && executeDelete(deletePayment)}
            >
              {actioningId !== null ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
