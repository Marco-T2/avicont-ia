"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { ArrowLeft, Loader2, Pencil, CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

function formatCurrency(amount: number): string {
  return `Bs. ${amount.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Borrador", className: "bg-amber-100 text-amber-800" },
  POSTED: { label: "Contabilizado", className: "bg-green-100 text-green-800" },
  VOIDED: { label: "Anulado", className: "bg-red-100 text-red-700" },
};

interface JournalLine {
  id: string;
  debit: string | number;
  credit: string | number;
  description?: string | null;
  account: { code: string; name: string };
}

interface JournalEntryDetailProps {
  orgSlug: string;
  entry: {
    id: string;
    number: number;
    date: string;
    description: string;
    status: string;
    periodId: string;
    voucherTypeId: string;
    createdAt?: string;
    lines: JournalLine[];
  };
  periodName: string;
  voucherTypeName: string;
}

export default function JournalEntryDetail({
  orgSlug,
  entry,
  periodName,
  voucherTypeName,
}: JournalEntryDetailProps) {
  const router = useRouter();
  const [actionDialog, setActionDialog] = useState<"POST" | "VOID" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalDebit = entry.lines.reduce((sum, l) => sum + Number(l.debit), 0);
  const totalCredit = entry.lines.reduce((sum, l) => sum + Number(l.credit), 0);
  const isBalanced = Math.round(totalDebit * 100) === Math.round(totalCredit * 100);

  const statusBadge = STATUS_BADGE[entry.status] ?? {
    label: entry.status,
    className: "bg-gray-100 text-gray-800",
  };

  async function executeTransition(targetStatus: "POSTED" | "VOIDED") {
    setIsSubmitting(true);
    try {
      const res = await fetch(
        `/api/organizations/${orgSlug}/journal/${entry.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: targetStatus }),
        },
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al cambiar el estado");
      }

      toast.success(
        targetStatus === "POSTED"
          ? "Asiento contabilizado exitosamente"
          : "Asiento anulado exitosamente",
      );
      setActionDialog(null);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al cambiar el estado",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link href={`/${orgSlug}/accounting/journal`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver al Libro Diario
        </Button>
      </Link>

      {/* Entry header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <CardTitle className="text-2xl">Asiento #{entry.number}</CardTitle>
                <Badge className={statusBadge.className}>{statusBadge.label}</Badge>
              </div>
              <p className="text-gray-500 mt-1">{entry.description}</p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 shrink-0">
              {entry.status === "DRAFT" && (
                <>
                  <Link href={`/${orgSlug}/accounting/journal/${entry.id}/edit`}>
                    <Button variant="outline" size="sm">
                      <Pencil className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    onClick={() => setActionDialog("POST")}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Contabilizar
                  </Button>
                </>
              )}
              {entry.status === "POSTED" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActionDialog("VOID")}
                  className="border-red-300 text-red-600 hover:bg-red-50"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Anular
                </Button>
              )}
              {entry.status === "VOIDED" && (
                <Badge className="bg-red-100 text-red-700 text-sm px-3 py-1">
                  Asiento Anulado
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <dt className="text-gray-500">Fecha</dt>
              <dd className="font-medium mt-0.5">{formatDate(entry.date)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Período</dt>
              <dd className="font-medium mt-0.5">{periodName}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Tipo de Comprobante</dt>
              <dd className="font-medium mt-0.5">{voucherTypeName}</dd>
            </div>
            {entry.createdAt && (
              <div>
                <dt className="text-gray-500">Creado</dt>
                <dd className="font-medium mt-0.5">
                  {formatDate(entry.createdAt)}
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Lines table */}
      <Card>
        <CardHeader>
          <CardTitle>Detalle del Asiento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Código
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Cuenta
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Descripción
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">
                    Debe
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">
                    Haber
                  </th>
                </tr>
              </thead>
              <tbody>
                {entry.lines.map((line) => (
                  <tr key={line.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-mono text-gray-600">
                      {line.account.code}
                    </td>
                    <td className="py-3 px-4">{line.account.name}</td>
                    <td className="py-3 px-4 text-gray-500">
                      {line.description ?? "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {Number(line.debit) > 0
                        ? formatCurrency(Number(line.debit))
                        : ""}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {Number(line.credit) > 0
                        ? formatCurrency(Number(line.credit))
                        : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                  <td colSpan={3} className="py-3 px-4 text-right">
                    Totales
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    {formatCurrency(totalDebit)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    {formatCurrency(totalCredit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {isBalanced ? (
            <p className="mt-4 text-sm text-green-600 font-medium">
              El asiento está balanceado correctamente.
            </p>
          ) : (
            <p className="mt-4 text-sm text-red-600 font-medium">
              Advertencia: El asiento NO está balanceado.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Confirmation dialog — POST */}
      <Dialog open={actionDialog === "POST"} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contabilizar Asiento</DialogTitle>
            <DialogDescription>
              Esta acción publicará el asiento #{entry.number} y actualizará los saldos
              contables. Una vez contabilizado, no podrá ser editado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={isSubmitting}
              onClick={() => setActionDialog(null)}
            >
              Cancelar
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={isSubmitting}
              onClick={() => executeTransition("POSTED")}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Contabilizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog — VOID */}
      <Dialog open={actionDialog === "VOID"} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular Asiento</DialogTitle>
            <DialogDescription>
              Esta acción anulará el asiento #{entry.number} y revertirá los saldos
              contables. Esta operación no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={isSubmitting}
              onClick={() => setActionDialog(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={isSubmitting}
              onClick={() => executeTransition("VOIDED")}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Anular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
