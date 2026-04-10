"use client";

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
  ArrowDownCircle,
  ArrowUpCircle,
  FileText,
  Plus,
  Search,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { PaymentWithRelations, PaymentDirection } from "@/features/payment/payment.types";

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

interface PaymentListProps {
  orgSlug: string;
  payments: PaymentWithRelations[];
  contacts: ContactOption[];
}

export default function PaymentList({
  orgSlug,
  payments,
  contacts,
}: PaymentListProps) {
  const router = useRouter();

  // ── Client-side filters ──
  const params =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();

  const filterStatus = params.get("status") ?? "";
  const filterContactId = params.get("contactId") ?? "";
  const filterMethod = params.get("method") ?? "";

  function applyFilter(key: string, value: string) {
    const p = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : "",
    );

    if (value && value !== "all") {
      p.set(key, value);
    } else {
      p.delete(key);
    }

    const query = p.toString();
    router.push(`/${orgSlug}/payments${query ? `?${query}` : ""}`);
  }

  function clearFilters() {
    router.push(`/${orgSlug}/payments`);
  }

  const hasFilters = !!(filterStatus || filterContactId || filterMethod);

  // ── Filter payments locally ──
  const filteredPayments = payments.filter((p) => {
    if (filterStatus && p.status !== filterStatus) return false;
    if (filterContactId && p.contactId !== filterContactId) return false;
    if (filterMethod && p.method !== filterMethod) return false;
    return true;
  });

  // ── Summary stats ──
  const cobros = payments.filter((p) => inferDirection(p, contacts) === "COBRO");
  const pagos = payments.filter((p) => inferDirection(p, contacts) === "PAGO");
  const cobrosTotal = cobros.reduce((s, p) => s + p.amount, 0);
  const pagosTotal = pagos.reduce((s, p) => s + p.amount, 0);

  // ── Inline actions ──

  async function handlePost(paymentId: string) {
    if (
      !confirm(
        "¿Está seguro de contabilizar este pago?",
      )
    )
      return;

    try {
      const res = await fetch(
        `/api/organizations/${orgSlug}/payments/${paymentId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "POSTED" }),
        },
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al contabilizar");
      }
      toast.success("Pago contabilizado correctamente");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al contabilizar el pago",
      );
    }
  }

  async function handleDelete(paymentId: string) {
    if (!confirm("¿Está seguro de eliminar este pago borrador?")) return;

    try {
      const res = await fetch(
        `/api/organizations/${orgSlug}/payments/${paymentId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al eliminar");
      }
      toast.success("Pago eliminado correctamente");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al eliminar el pago",
      );
    }
  }

  async function handleVoid(paymentId: string) {
    if (
      !confirm(
        "¿Está seguro de anular este pago? Se revertirán los asientos y CxC/CxP.",
      )
    )
      return;

    try {
      const res = await fetch(
        `/api/organizations/${orgSlug}/payments/${paymentId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "VOIDED" }),
        },
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al anular");
      }
      toast.success("Pago anulado correctamente");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al anular el pago",
      );
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
              <div className="rounded-lg bg-blue-100 p-2">
                <ArrowDownCircle className="h-5 w-5 text-blue-600" />
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
              <div className="rounded-lg bg-green-100 p-2">
                <ArrowUpCircle className="h-5 w-5 text-green-600" />
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
              <Label className="text-sm">Contacto</Label>
              <Select
                value={filterContactId || "all"}
                onValueChange={(v) => applyFilter("contactId", v)}
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
                onValueChange={(v) => applyFilter("method", v)}
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
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Fecha
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Tipo
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Contacto
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Método
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Documento
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Descripción
                  </th>
                  <th className="text-center py-3 px-4 font-medium text-gray-600">
                    Estado
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">
                    Monto
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center">
                      <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-600">
                        No hay cobros ni pagos registrados
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        {hasFilters
                          ? "Ningún registro coincide con los filtros aplicados"
                          : "Cree el primer cobro o pago para comenzar"}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((payment) => {
                    const direction = inferDirection(payment, contacts);
                    const statusBadge = STATUS_BADGE[payment.status] ?? {
                      label: payment.status,
                      className: "bg-gray-100 text-gray-800",
                    };
                    const totalAllocated = payment.allocations.reduce(
                      (sum, a) => sum + a.amount,
                      0,
                    );
                    const unapplied = payment.amount - totalAllocated;
                    const hasUnapplied =
                      unapplied > 0.01 &&
                      (payment.status === "POSTED" || payment.status === "LOCKED");

                    return (
                      <tr
                        key={payment.id}
                        className="border-b hover:bg-gray-50 cursor-pointer"
                        onClick={() =>
                          router.push(`/${orgSlug}/payments/${payment.id}`)
                        }
                      >
                        <td className="py-3 px-4 whitespace-nowrap">
                          {formatDate(payment.date)}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            className={
                              direction === "COBRO"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-green-100 text-green-800"
                            }
                          >
                            {direction === "COBRO" ? "Cobro" : "Pago"}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {payment.contact?.name ?? "---"}
                        </td>
                        <td className="py-3 px-4 text-gray-500">
                          {METHOD_LABEL[payment.method] ?? payment.method}
                        </td>
                        <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                          {payment.operationalDocType && payment.referenceNumber
                            ? `${payment.operationalDocType.code}-${payment.referenceNumber}`
                            : payment.referenceNumber
                              ? String(payment.referenceNumber)
                              : "—"}
                        </td>
                        <td className="py-3 px-4 text-gray-500 max-w-48 truncate">
                          {payment.description}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge className={statusBadge.className}>
                            {statusBadge.label}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          <div className="flex flex-col items-end gap-1">
                            <span>{formatCurrency(payment.amount)}</span>
                            {hasUnapplied && (
                              <Badge className="bg-sky-100 text-sky-700 text-xs font-normal">
                                Crédito: Bs{unapplied.toLocaleString("es-BO", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div
                            className="flex justify-end gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {payment.status === "DRAFT" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    router.push(
                                      `/${orgSlug}/payments/${payment.id}`,
                                    )
                                  }
                                >
                                  Editar
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handlePost(payment.id)}
                                >
                                  Contabilizar
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-500 hover:text-red-700"
                                  onClick={() => handleDelete(payment.id)}
                                >
                                  Eliminar
                                </Button>
                              </>
                            )}
                            {payment.status === "POSTED" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    router.push(
                                      `/${orgSlug}/payments/${payment.id}`,
                                    )
                                  }
                                >
                                  Ver
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-500 hover:text-red-700"
                                  onClick={() => handleVoid(payment.id)}
                                >
                                  Anular
                                </Button>
                              </>
                            )}
                            {payment.status === "LOCKED" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  router.push(
                                    `/${orgSlug}/payments/${payment.id}`,
                                  )
                                }
                              >
                                Ver
                              </Button>
                            )}
                            {payment.status === "VOIDED" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  router.push(
                                    `/${orgSlug}/payments/${payment.id}`,
                                  )
                                }
                              >
                                Ver
                              </Button>
                            )}
                          </div>
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
