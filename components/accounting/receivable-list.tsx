"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  FileText,
  MoreHorizontal,
  RefreshCw,
  XCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import StatusBadge from "./status-badge";
import StatusUpdateDialog from "./status-update-dialog";
import ReceivableForm from "./receivable-form";
import ContactSelector from "@/components/contacts/contact-selector";
import type { ReceivableSnapshotWithContact } from "@/modules/receivables/presentation/server";

function formatCurrency(value: number | string): string {
  return new Intl.NumberFormat("es-BO", { minimumFractionDigits: 2 }).format(
    Number(value),
  );
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

interface ReceivableListProps {
  orgSlug: string;
  receivables: ReceivableSnapshotWithContact[];
}

export default function ReceivableList({
  orgSlug,
  receivables,
}: ReceivableListProps) {
  const router = useRouter();

  const [showCreate, setShowCreate] = useState(false);
  const [statusDialogFor, setStatusDialogFor] =
    useState<ReceivableSnapshotWithContact | null>(null);
  const [cancelDialogFor, setCancelDialogFor] =
    useState<ReceivableSnapshotWithContact | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  // Filters
  const [filterContactId, setFilterContactId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const filtered = receivables.filter((r) => {
    if (filterContactId != null && r.contactId !== filterContactId) return false;
    if (filterStatus !== "ALL" && r.status !== filterStatus) return false;
    if (filterDateFrom && new Date(r.dueDate) < new Date(filterDateFrom))
      return false;
    if (filterDateTo && new Date(r.dueDate) > new Date(filterDateTo))
      return false;
    return true;
  });

  async function handleStatusUpdate(
    receivable: ReceivableSnapshotWithContact,
    status: string,
    paidAmount?: number,
  ) {
    const res = await fetch(
      `/api/organizations/${orgSlug}/cxc/${receivable.id}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, paidAmount }),
      },
    );

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Error al actualizar el estado");
    }

    toast.success("Estado actualizado exitosamente");
    setStatusDialogFor(null);
    router.refresh();
  }

  async function executeCancel(receivable: ReceivableSnapshotWithContact) {
    setActioningId(receivable.id);
    try {
      const res = await fetch(
        `/api/organizations/${orgSlug}/cxc/${receivable.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "CANCELLED" }),
        },
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al cancelar");
      }

      toast.success("Cuenta por cobrar cancelada");
      setCancelDialogFor(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cancelar");
    } finally {
      setActioningId(null);
    }
  }

  const canUpdate = (status: string) =>
    status === "PENDING" || status === "PARTIAL";
  const canCancel = (status: string) =>
    status !== "CANCELLED" && status !== "PAID";
  const hasAnyAction = (status: string) =>
    canUpdate(status) || canCancel(status);

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="w-48">
            <ContactSelector
              orgSlug={orgSlug}
              value={filterContactId}
              onChange={setFilterContactId}
            />
          </div>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="PENDING">Pendiente</SelectItem>
              <SelectItem value="PARTIAL">Parcial</SelectItem>
              <SelectItem value="PAID">Pagado</SelectItem>
              <SelectItem value="CANCELLED">Cancelado</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="date"
            className="w-36"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            placeholder="Desde"
          />
          <Input
            type="date"
            className="w-36"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            placeholder="Hasta"
          />
        </div>

        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva CxC
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Contacto
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Descripción
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                    Monto
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                    Pagado
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                    Saldo
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Vencimiento
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Estado
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
                      <FileText className="h-10 w-10 text-muted-foreground/60 mx-auto mb-3" />
                      <p className="text-muted-foreground">
                        No hay cuentas por cobrar registradas
                      </p>
                      <p className="text-sm text-muted-foreground/70 mt-1">
                        Cree la primera CxC para comenzar
                      </p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => {
                    const amount = Number(r.amount);
                    const paid = Number(r.paid ?? 0);
                    const balance = Number(r.balance ?? (amount - paid));
                    return (
                      <tr key={r.id} className="border-b hover:bg-accent/50">
                        <td className="py-3 px-4 font-medium">
                          {r.contact.name}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {r.description}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {formatCurrency(amount)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-success">
                          {formatCurrency(paid)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold">
                          {formatCurrency(balance)}
                        </td>
                        <td className="py-3 px-4">{formatDate(r.dueDate)}</td>
                        <td className="py-3 px-4">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="py-3 px-4 text-right">
                          {actioningId === r.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-auto" />
                          ) : hasAnyAction(r.status) ? (
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
                                {canUpdate(r.status) && (
                                  <DropdownMenuItem
                                    onClick={() => setStatusDialogFor(r)}
                                  >
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Actualizar estado
                                  </DropdownMenuItem>
                                )}
                                {canUpdate(r.status) && canCancel(r.status) && (
                                  <DropdownMenuSeparator />
                                )}
                                {canCancel(r.status) && (
                                  <DropdownMenuItem
                                    onClick={() => setCancelDialogFor(r)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Cancelar
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : null}
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

      {/* Create Dialog */}
      <ReceivableForm
        open={showCreate}
        onOpenChange={setShowCreate}
        orgSlug={orgSlug}
        onCreated={() => setShowCreate(false)}
      />

      {/* Status Update Dialog */}
      {statusDialogFor && (
        <StatusUpdateDialog
          open={!!statusDialogFor}
          onOpenChange={(open) => {
            if (!open) setStatusDialogFor(null);
          }}
          currentStatus={statusDialogFor.status}
          onConfirm={async (status, paidAmount) => {
            await handleStatusUpdate(statusDialogFor, status, paidAmount);
          }}
        />
      )}

      <ConfirmDialog
        open={cancelDialogFor !== null}
        onOpenChange={(open) => !open && setCancelDialogFor(null)}
        title="Cancelar Cuenta por Cobrar"
        description={
          cancelDialogFor
            ? `Esta acción cancelará la cuenta por cobrar de ${cancelDialogFor.contact.name}. Esta operación no se puede deshacer.`
            : null
        }
        confirmLabel="Cancelar CxC"
        cancelLabel="Volver"
        variant="destructive"
        loading={actioningId !== null}
        onConfirm={async () => {
          if (cancelDialogFor) await executeCancel(cancelDialogFor);
        }}
      />
    </>
  );
}
