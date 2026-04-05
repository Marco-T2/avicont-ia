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
import { Plus, FileText } from "lucide-react";
import { toast } from "sonner";
import StatusBadge from "./status-badge";
import StatusUpdateDialog from "./status-update-dialog";
import PayableForm from "./payable-form";
import ContactSelector from "@/components/contacts/contact-selector";
import type { PayableWithContact } from "@/features/payables";

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

interface PayableListProps {
  orgSlug: string;
  payables: PayableWithContact[];
}

export default function PayableList({ orgSlug, payables }: PayableListProps) {
  const router = useRouter();

  const [showCreate, setShowCreate] = useState(false);
  const [statusDialogFor, setStatusDialogFor] =
    useState<PayableWithContact | null>(null);

  // Filters
  const [filterContactId, setFilterContactId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const filtered = payables.filter((p) => {
    if (filterContactId != null && p.contactId !== filterContactId) return false;
    if (filterStatus !== "ALL" && p.status !== filterStatus) return false;
    if (filterDateFrom && new Date(p.dueDate) < new Date(filterDateFrom))
      return false;
    if (filterDateTo && new Date(p.dueDate) > new Date(filterDateTo))
      return false;
    return true;
  });

  async function handleStatusUpdate(
    payable: PayableWithContact,
    status: string,
    paidAmount?: number,
  ) {
    const res = await fetch(
      `/api/organizations/${orgSlug}/cxp/${payable.id}/status`,
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

  async function handleCancel(payable: PayableWithContact) {
    if (
      !confirm(
        `¿Cancelar la cuenta por pagar de ${payable.contact.name}?`,
      )
    )
      return;

    try {
      const res = await fetch(
        `/api/organizations/${orgSlug}/cxp/${payable.id}/status`,
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

      toast.success("Cuenta por pagar cancelada");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cancelar");
    }
  }

  const canUpdate = (status: string) =>
    status === "PENDING" || status === "PARTIAL";

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
          Nueva CxP
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Contacto
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Descripción
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">
                    Monto
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">
                    Pagado
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">
                    Saldo
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Vencimiento
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Estado
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
                      <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-600">
                        No hay cuentas por pagar registradas
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        Cree la primera CxP para comenzar
                      </p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => {
                    const amount = Number(p.amount);
                    const paid = Number(p.paid ?? 0);
                    const balance = Number(p.balance ?? (amount - paid));
                    return (
                      <tr key={p.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium">
                          {p.contact.name}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {p.description}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {formatCurrency(amount)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-green-700">
                          {formatCurrency(paid)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold">
                          {formatCurrency(balance)}
                        </td>
                        <td className="py-3 px-4">{formatDate(p.dueDate)}</td>
                        <td className="py-3 px-4">
                          <StatusBadge status={p.status} />
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex justify-end gap-2">
                            {canUpdate(p.status) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setStatusDialogFor(p)}
                              >
                                Actualizar estado
                              </Button>
                            )}
                            {p.status !== "CANCELLED" &&
                              p.status !== "PAID" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-red-600 border-red-300 hover:bg-red-50"
                                  onClick={() => handleCancel(p)}
                                >
                                  Cancelar
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

      {/* Create Dialog */}
      <PayableForm
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
    </>
  );
}
