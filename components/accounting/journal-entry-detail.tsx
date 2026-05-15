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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ArrowLeft, Pencil, CheckCircle, XCircle, FileDown } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  sourceTypeLabel,
  sourceTypeBadgeClassName,
} from "@/features/accounting/journal.ui";
import { formatDateBO } from "@/lib/date-utils";
import { Gated } from "@/components/common/gated";

function formatCurrency(amount: number): string {
  return `Bs. ${amount.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  DRAFT: {
    label: "Borrador",
    className: "bg-warning/10 text-warning dark:bg-warning/20",
  },
  POSTED: {
    label: "Contabilizado",
    className: "bg-success/10 text-success dark:bg-success/20",
  },
  VOIDED: {
    label: "Anulado",
    className: "bg-destructive/10 text-destructive dark:bg-destructive/20",
  },
};

interface JournalLine {
  id: string;
  debit: string | number;
  credit: string | number;
  description?: string | null;
  account: { code: string; name: string };
  contact?: { name: string } | null;
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
    sourceType?: string | null;
    createdAt?: string;
    contact?: { name: string } | null;
    lines: JournalLine[];
  };
  periodName: string;
  periodStatus?: string;
  voucherTypeName: string;
  voucherTypeActive?: boolean;
}

export default function JournalEntryDetail({
  orgSlug,
  entry,
  periodName,
  periodStatus,
  voucherTypeName,
  voucherTypeActive = true,
}: JournalEntryDetailProps) {
  const router = useRouter();
  const [actionDialog, setActionDialog] = useState<"POST" | "VOID" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalDebit = entry.lines.reduce((sum, l) => sum + Number(l.debit), 0);
  const totalCredit = entry.lines.reduce((sum, l) => sum + Number(l.credit), 0);
  const isBalanced = Math.round(totalDebit * 100) === Math.round(totalCredit * 100);

  // REQ-A.2: show Edit button only for manual entries (sourceType=null) in an OPEN period.
  const canEdit =
    (entry.status === "DRAFT" ||
      (entry.status === "POSTED" && !entry.sourceType)) &&
    periodStatus === "OPEN";

  const statusBadge = STATUS_BADGE[entry.status] ?? {
    label: entry.status,
    className: "bg-muted text-muted-foreground",
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
              <p className="text-muted-foreground mt-1">{entry.description}</p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 shrink-0">
              <a
                href={`/api/organizations/${orgSlug}/journal/${entry.id}?format=pdf`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm">
                  <FileDown className="h-4 w-4 mr-1" />
                  Descargar PDF
                </Button>
              </a>
              <Gated resource="journal" action="write">
                {canEdit && (
                  <Link href={`/${orgSlug}/accounting/journal/${entry.id}/edit`}>
                    <Button variant="outline" size="sm">
                      <Pencil className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                  </Link>
                )}
                {entry.status === "DRAFT" && (
                  <Button
                    size="sm"
                    onClick={() => setActionDialog("POST")}
                    className="bg-success hover:bg-success/90 text-success-foreground"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Contabilizar
                  </Button>
                )}
                {entry.status === "POSTED" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActionDialog("VOID")}
                    className="border-destructive/40 text-destructive hover:bg-destructive/10"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Anular
                  </Button>
                )}
              </Gated>
              {entry.status === "VOIDED" && (
                <Badge className="bg-destructive/10 text-destructive dark:bg-destructive/20 text-sm px-3 py-1">
                  Asiento Anulado
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Fecha</dt>
              <dd className="font-medium mt-0.5">{formatDateBO(entry.date)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Período</dt>
              <dd className="font-medium mt-0.5">{periodName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Tipo de Comprobante</dt>
              <dd className="font-medium mt-0.5 flex items-center gap-2">
                <span>{voucherTypeName}</span>
                {!voucherTypeActive && (
                  <Badge className="bg-muted text-muted-foreground">Inactivo</Badge>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Origen</dt>
              <dd className="mt-0.5">
                <Badge
                  className={sourceTypeBadgeClassName(entry.sourceType ?? null)}
                >
                  {sourceTypeLabel(entry.sourceType ?? null)}
                </Badge>
              </dd>
            </div>
            {entry.contact && (
              <div>
                <dt className="text-muted-foreground">Contacto</dt>
                <dd className="font-medium mt-0.5">{entry.contact.name}</dd>
              </div>
            )}
            {entry.createdAt && (
              <div>
                <dt className="text-muted-foreground">Creado</dt>
                <dd className="font-medium mt-0.5">
                  {formatDateBO(entry.createdAt)}
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
                <tr className="border-b bg-muted">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Código
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Cuenta
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Descripción
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Contacto
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                    Debe
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                    Haber
                  </th>
                </tr>
              </thead>
              <tbody>
                {entry.lines.map((line) => (
                  <tr key={line.id} className="border-b hover:bg-accent/50">
                    <td className="py-3 px-4 font-mono text-muted-foreground">
                      {line.account.code}
                    </td>
                    <td className="py-3 px-4">{line.account.name}</td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {line.description ?? "—"}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {line.contact?.name ?? "—"}
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
                <tr className="border-t-2 border-border bg-muted font-bold">
                  <td colSpan={4} className="py-3 px-4 text-right">
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
            <p className="mt-4 text-sm text-success font-medium">
              El asiento está balanceado correctamente.
            </p>
          ) : (
            <p className="mt-4 text-sm text-destructive font-medium">
              Advertencia: El asiento NO está balanceado.
            </p>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={actionDialog === "POST"}
        onOpenChange={(open) => !open && setActionDialog(null)}
        title="Contabilizar asiento"
        description={`Esta acción publicará el asiento #${entry.number} y actualizará los saldos contables. Una vez contabilizado, el asiento seguirá siendo editable mientras el período esté abierto. Al cerrar el período quedará inmutable.`}
        confirmLabel="Contabilizar"
        variant="default"
        loading={isSubmitting}
        onConfirm={() => executeTransition("POSTED")}
      />

      <ConfirmDialog
        open={actionDialog === "VOID"}
        onOpenChange={(open) => !open && setActionDialog(null)}
        title="Anular asiento"
        description={`Esta acción anulará el asiento #${entry.number} y revertirá los saldos contables. Esta operación no se puede deshacer.`}
        confirmLabel="Anular"
        variant="destructive"
        loading={isSubmitting}
        onConfirm={() => executeTransition("VOIDED")}
      />
    </div>
  );
}
