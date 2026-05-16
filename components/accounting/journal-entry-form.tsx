"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Plus, Loader2, ArrowLeft, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import JournalLineRow, { type JournalLineData } from "./journal-line-row";
import { formatCorrelativeNumber } from "@/features/accounting/correlative.utils";
import { findPeriodCoveringDate } from "@/modules/fiscal-periods/presentation/index";
import type { Account, FiscalPeriod, VoucherTypeCfg } from "@/generated/prisma/client";
import Decimal from "decimal.js";
import { eq, sumDecimals } from "@/modules/accounting/presentation";
import { todayLocal } from "@/lib/date-utils";

function formatCurrency(amount: number): string {
  return `Bs. ${amount.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

let rowCounter = 0;
function nextRowId() {
  rowCounter += 1;
  return `row-${rowCounter}`;
}

function emptyLine(): JournalLineData {
  return { id: nextRowId(), accountId: "", debit: "", credit: "", description: "", contactId: "" };
}

/** Shape compartido para edit/template — un asiento que pre-llena el form. */
interface JournalEntryTemplate {
  id?: string;
  number?: number;
  date: string;
  description: string;
  periodId: string;
  voucherTypeId: string;
  referenceNumber?: number | null;
  lines: Array<{
    accountId: string;
    debit: number | string;
    credit: number | string;
    description?: string | null;
    contactId?: string | null;
    /** Contacto cargado eagerly desde Prisma (line.contact via include) —
     *  necesario para que ContactSelector muestre el nombre sin abrir el popover. */
    contact?: {
      id: string;
      name: string;
      type: string;
      nit?: string | null;
    } | null;
  }>;
}

interface JournalEntryFormProps {
  orgSlug: string;
  accounts: Account[];
  periods: FiscalPeriod[];
  voucherTypes: VoucherTypeCfg[];
  /** Cuando está seteado, el form está en modo edición (PATCH) y bloquea el voucher type. */
  editEntry?: JournalEntryTemplate & { id: string; number: number };
  /**
   * Cuando está seteado, el form se pre-llena con estos valores PERO está en
   * modo creación (POST). El voucher type queda EDITABLE — caso de uso típico:
   * "duplicar como nuevo" para cambiar el tipo de comprobante de un asiento
   * existente sin re-tipear N líneas. Reference number NO se copia (se asigna
   * uno nuevo al guardar).
   */
  templateEntry?: JournalEntryTemplate;
}

export default function JournalEntryForm({
  orgSlug,
  accounts,
  periods,
  voucherTypes,
  editEntry,
  templateEntry,
}: JournalEntryFormProps) {
  const router = useRouter();
  const isEditing = !!editEntry;
  // Fuente única para pre-llenar — edit tiene precedencia sobre template.
  const initial = editEntry ?? templateEntry;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingAndPosting, setIsCreatingAndPosting] = useState(false);
  const [date, setDate] = useState(initial?.date ?? todayLocal());
  const [description, setDescription] = useState(initial?.description ?? "");
  // Período = derivado puro de la fecha (no es un input editable). El contador
  // captura la fecha y el período se resuelve por `findPeriodCoveringDate`
  // (filtra por OPEN). Si la fecha no cae en ningún período OPEN, periodId
  // queda "" y el banner de warning bloquea el submit (canSubmit).
  // En edit mode arrancamos con el periodId persistido del entry — el backend
  // ya valida invariante I12 (date ∈ período), entonces el periodId existente
  // siempre es coherente con la fecha actual del entry.
  const [periodId, setPeriodId] = useState(() => {
    if (initial?.periodId) return initial.periodId;
    return findPeriodCoveringDate(initial?.date ?? todayLocal(), periods)?.id ?? "";
  });
  const [voucherTypeId, setVoucherTypeId] = useState(initial?.voucherTypeId ?? "");
  // El reference number NO se copia en modo template — se asigna uno nuevo.
  const [referenceNumber, setReferenceNumber] = useState<string>(
    editEntry?.referenceNumber?.toString() ?? "",
  );
  const [lastReference, setLastReference] = useState<number | null>(null);
  const [nextNumber, setNextNumber] = useState<number | null>(null);
  const [loadingLastRef, setLoadingLastRef] = useState(false);
  const [lines, setLines] = useState<JournalLineData[]>(() => {
    if (initial && initial.lines.length >= 2) {
      return initial.lines.map((l) => ({
        id: nextRowId(),
        accountId: l.accountId,
        debit: Number(l.debit) > 0 ? String(l.debit) : "",
        credit: Number(l.credit) > 0 ? String(l.credit) : "",
        description: l.description ?? "",
        contactId: l.contactId ?? "",
        // Si vino el contacto cargado eagerly, pasarlo para que ContactSelector
        // muestre el nombre sin tener que abrir el popover y fetchear.
        initialContact: l.contact ?? undefined,
      }));
    }
    return [emptyLine(), emptyLine()];
  });

  useEffect(() => {
    if (!date) return;
    const match = findPeriodCoveringDate(date, periods);
    setPeriodId(match?.id ?? "");
  }, [date, periods]);

  useEffect(() => {
    if (!voucherTypeId) {
      setLastReference(null);
      setNextNumber(null);
      return;
    }
    setLoadingLastRef(true);
    const params = new URLSearchParams({ voucherTypeId });
    if (periodId) params.set("periodId", periodId);
    fetch(
      `/api/organizations/${orgSlug}/journal/last-reference?${params}`,
    )
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { lastReferenceNumber: number | null; nextNumber: number | null }) => {
        setLastReference(data.lastReferenceNumber);
        setNextNumber(data.nextNumber);
      })
      .catch(() => {
        setLastReference(null);
        setNextNumber(null);
      })
      .finally(() => setLoadingLastRef(false));
  }, [voucherTypeId, periodId, orgSlug]);

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(id: string) {
    if (lines.length <= 2) {
      toast.error("Un asiento debe tener al menos 2 líneas");
      return;
    }
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  function updateLine(id: string, field: keyof JournalLineData, value: string) {
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)),
    );
  }

  const debits = lines.map((l) => new Decimal(l.debit || "0"));
  const credits = lines.map((l) => new Decimal(l.credit || "0"));
  const totalDebitD = sumDecimals(debits);
  const totalCreditD = sumDecimals(credits);
  const totalDebit = totalDebitD.toNumber();
  const totalCredit = totalCreditD.toNumber();
  const difference = totalDebitD.minus(totalCreditD).toNumber();
  const isBalanced = eq(totalDebitD, totalCreditD) && totalDebitD.gt(0);

  const allLinesValid = lines.every(
    (l) => l.accountId && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0),
  );

  const canSubmit = date && periodId && voucherTypeId && isBalanced && allLinesValid;

  // Período derivado para el hint inline bajo Fecha. `findPeriodCoveringDate`
  // filtra por OPEN — para mostrar "Mayo 2026 — CERRADO" cuando aplica,
  // resolvemos manualmente sobre la lista completa.
  const currentPeriod = (() => {
    if (!date) return null;
    return (
      periods.find((p) => {
        const start = new Date(p.startDate).toISOString().slice(0, 10);
        const end = new Date(p.endDate).toISOString().slice(0, 10);
        return start <= date && date <= end;
      }) ?? null
    );
  })();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);

    try {
      const body = {
        date,
        description,
        periodId,
        voucherTypeId,
        referenceNumber: referenceNumber ? parseInt(referenceNumber, 10) : undefined,
        lines: lines.map((l, idx) => ({
          accountId: l.accountId,
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
          description: l.description || undefined,
          contactId: l.contactId || undefined,
          order: idx,
        })),
      };

      let res: Response;

      if (isEditing) {
        res = await fetch(`/api/organizations/${orgSlug}/journal/${editEntry.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch(`/api/organizations/${orgSlug}/journal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        const code: string = data.code ?? "";
        if (code === "CONTACT_REQUIRED_FOR_ACCOUNT") {
          throw new Error("Una o más cuentas requieren que seleccione un contacto.");
        }
        if (code === "REFERENCE_NUMBER_DUPLICATE") {
          throw new Error(data.error);
        }
        throw new Error(data.error ?? "Error al guardar el asiento");
      }

      const saved = await res.json();
      toast.success(
        isEditing ? "Asiento actualizado exitosamente" : "Asiento contable creado exitosamente",
      );
      router.push(`/${orgSlug}/accounting/journal/${saved.id}`);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al guardar el asiento",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Create and Post (atomic POSTED creation) ──

  async function handleCreateAndPost() {
    if (!canSubmit || isEditing) return;
    setIsCreatingAndPosting(true);
    try {
      const body = {
        date,
        description,
        periodId,
        voucherTypeId,
        referenceNumber: referenceNumber ? parseInt(referenceNumber, 10) : undefined,
        lines: lines.map((l, idx) => ({
          accountId: l.accountId,
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
          description: l.description || undefined,
          contactId: l.contactId || undefined,
          order: idx,
        })),
        postImmediately: true,
      };

      const res = await fetch(`/api/organizations/${orgSlug}/journal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        const code: string = data.code ?? "";
        if (code === "CONTACT_REQUIRED_FOR_ACCOUNT") {
          throw new Error("Una o más cuentas requieren que seleccione un contacto.");
        }
        if (code === "REFERENCE_NUMBER_DUPLICATE") {
          throw new Error(data.error);
        }
        throw new Error(data.error ?? "Error al contabilizar el asiento");
      }

      const saved = await res.json();
      toast.success("Asiento contabilizado exitosamente");
      router.push(`/${orgSlug}/accounting/journal/${saved.id}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al contabilizar el asiento");
    } finally {
      setIsCreatingAndPosting(false);
    }
  }

  const selectedVoucherType = voucherTypes.find((vt) => vt.id === voucherTypeId) ?? null;
  const previewDisplayNumber = (() => {
    if (isEditing && editEntry && selectedVoucherType) {
      return formatCorrelativeNumber(
        selectedVoucherType.prefix,
        new Date(editEntry.date),
        editEntry.number,
      );
    }
    if (!isEditing && selectedVoucherType && nextNumber && date) {
      return formatCorrelativeNumber(selectedVoucherType.prefix, new Date(date), nextNumber);
    }
    return null;
  })();

  const backHref = isEditing
    ? `/${orgSlug}/accounting/journal/${editEntry.id}`
    : `/${orgSlug}/accounting/journal`;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Link href={backHref}>
        <Button type="button" variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-1" />
          {isEditing ? "Volver al Asiento" : "Volver al Libro Diario"}
        </Button>
      </Link>

      {/* Header fields */}
      <Card>
        <CardHeader>
          <CardTitle>
            {isEditing ? "Editar Asiento Contable" : "Nuevo Asiento Contable"}
            {previewDisplayNumber && (
              <span className="ml-2 font-bold text-primary">
                — {previewDisplayNumber}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="entry-date">Fecha</Label>
              <Input
                id="entry-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
              {currentPeriod && (
                <p
                  data-testid="period-hint"
                  className={`text-xs font-medium ${
                    currentPeriod.status === "OPEN"
                      ? "text-success"
                      : "text-destructive"
                  }`}
                >
                  {currentPeriod.status === "OPEN"
                    ? `✓ Período: ${currentPeriod.name}`
                    : `✗ Período: ${currentPeriod.name} — CERRADO`}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="voucher-type">Tipo de Comprobante</Label>
              <Select
                value={voucherTypeId}
                onValueChange={setVoucherTypeId}
                disabled={!!editEntry}
              >
                <SelectTrigger id="voucher-type">
                  <SelectValue placeholder="Seleccione tipo" />
                </SelectTrigger>
                <SelectContent>
                  {voucherTypes
                    .filter((vt) => vt.isActive || vt.id === editEntry?.voucherTypeId)
                    .map((vt) => (
                      <SelectItem key={vt.id} value={vt.id}>
                        {vt.name}
                        {!vt.isActive && (
                          <span className="text-muted-foreground/70 ml-1">(inactivo)</span>
                        )}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reference-number">Nro. de referencia (opcional)</Label>
              <Input
                id="reference-number"
                type="number"
                min={1}
                step={1}
                placeholder="Ej: 738"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
              />
              {voucherTypeId && (
                <p className="text-xs text-muted-foreground">
                  {loadingLastRef
                    ? "Cargando..."
                    : lastReference !== null
                      ? `Último: ${lastReference}`
                      : "Último: ninguno"}
                </p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2 lg:col-span-3">
              <Label htmlFor="entry-description">Glosa general</Label>
              <Input
                id="entry-description"
                placeholder="Glosa del asiento (opcional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {/* Banner solo cuando NO existe ningún período (OPEN ni CLOSED) que cubra
              la fecha. Si existe pero está CLOSED, el hint rojo bajo Fecha ya
              comunica el bloqueo — evitamos doble mensaje. */}
          {date && !periodId && !currentPeriod && periods.length > 0 && (
            <div
              role="alert"
              className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-foreground"
            >
              No hay un período fiscal para esta fecha. Creá el período
              correspondiente o elegí otra fecha.
            </div>
          )}
          {date && !periodId && currentPeriod && currentPeriod.status !== "OPEN" && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground"
            >
              El período <strong>{currentPeriod.name}</strong> está cerrado. Para
              registrar en esta fecha, reabrí el período o elegí otra fecha.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lines */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Líneas del Asiento</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="h-4 w-4 mr-1" />
              Agregar Línea
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted">
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground w-64">
                    Cuenta
                  </th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">
                    Detalle específico (opcional)
                  </th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground w-44">
                    Contacto
                  </th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground w-36">
                    Debe
                  </th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground w-36">
                    Haber
                  </th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <JournalLineRow
                    key={line.id}
                    line={line}
                    accounts={accounts}
                    canRemove={lines.length > 2}
                    orgSlug={orgSlug}
                    onUpdate={updateLine}
                    onRemove={removeLine}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted">
                  <td colSpan={3} className="py-3 px-2 text-right text-sm text-muted-foreground">
                    Total Débitos
                  </td>
                  <td className="py-3 px-2 text-right font-mono font-bold text-foreground">
                    {formatCurrency(totalDebit)}
                  </td>
                  <td colSpan={2} />
                </tr>
                <tr className="bg-muted">
                  <td colSpan={3} className="py-3 px-2 text-right text-sm text-muted-foreground">
                    Total Créditos
                  </td>
                  <td />
                  <td className="py-3 px-2 text-right font-mono font-bold text-foreground">
                    {formatCurrency(totalCredit)}
                  </td>
                  <td />
                </tr>
                <tr className="bg-muted border-t">
                  <td colSpan={3} className="py-3 px-2 text-right text-sm font-semibold">
                    Diferencia
                  </td>
                  <td
                    colSpan={2}
                    className={`py-3 px-2 text-right font-mono font-bold ${
                      isBalanced ? "text-success" : "text-destructive"
                    }`}
                  >
                    {formatCurrency(Math.abs(difference))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {!isBalanced && totalDebit > 0 && (
            <p className="mt-3 text-sm text-destructive font-medium">
              Los débitos y créditos no balancean. Ajuste las líneas antes de guardar.
            </p>
          )}
          {isBalanced && (
            <p className="mt-3 text-sm text-success font-medium">
              El asiento está balanceado correctamente.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Link href={backHref}>
          <Button type="button" variant="outline">
            Cancelar
          </Button>
        </Link>

        {/* Edit mode — single save button */}
        {isEditing && (
          <Button type="submit" disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              "Actualizar Asiento"
            )}
          </Button>
        )}

        {/* Create mode — dual buttons */}
        {!isEditing && (
          <>
            <Button type="submit" variant="outline" disabled={!canSubmit || isSubmitting || isCreatingAndPosting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar Borrador"
              )}
            </Button>
            <Button
              type="button"
              className="bg-success hover:bg-success/90 text-success-foreground"
              onClick={handleCreateAndPost}
              disabled={!canSubmit || isSubmitting || isCreatingAndPosting}
            >
              {isCreatingAndPosting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Contabilizar
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
