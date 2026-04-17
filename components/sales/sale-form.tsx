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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Loader2,
  ArrowLeft,
  Trash2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import type { Contact, FiscalPeriod } from "@/generated/prisma/client";
import { evaluateExpression } from "@/lib/evaluate-expression";
import { useOrgRole } from "@/components/common/use-org-role";
import type { SaleWithDetails } from "@/features/sale";
import { IvaBookSaleModal } from "@/components/iva-books/iva-book-sale-modal";
import { isFiscalPeriodOpen } from "@/lib/fiscal-period.utils";
import { ConfirmTrimDialog } from "@/components/sales/confirm-trim-dialog";
import type { TrimPreviewItem } from "@/components/sales/confirm-trim-dialog";
import { LcvIndicator } from "@/components/sales/lcv-indicator";
import type { LcvState } from "@/components/sales/lcv-indicator";
import { UnlinkLcvConfirmDialog } from "@/components/sales/unlink-lcv-confirm-dialog";
import { useLcvUnlink } from "@/components/sales/use-lcv-unlink";
import { ReactivateLcvConfirmDialog } from "@/components/sales/reactivate-lcv-confirm-dialog";
import { useLcvReactivate } from "@/components/sales/use-lcv-reactivate";

// ── Helpers ──

function formatCurrency(amount: number): string {
  return `Bs. ${amount.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ── Derivación del estado LCV ──

/**
 * Deriva el estado del LcvIndicator a partir de la venta.
 * S1: borrador (sin id) o status DRAFT
 * S2: guardada, sin ivaSalesBook activo (null o VOIDED)
 * S3: guardada, con ivaSalesBook activo (status !== VOIDED)
 */
function deriveLcvState(
  sale:
    | { status: string; ivaSalesBook?: { id: string; status?: string } | null }
    | undefined
    | null,
): LcvState {
  if (!sale || sale.status === "DRAFT") return "S1";
  if (!sale.ivaSalesBook || sale.ivaSalesBook.status === "VOIDED") return "S2";
  return "S3";
}

// ── Configuración de badge de estado ──

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Borrador", className: "bg-amber-100 text-amber-800" },
  POSTED: { label: "Contabilizado", className: "bg-green-100 text-green-800" },
  VOIDED: { label: "Anulado", className: "bg-red-100 text-red-700" },
  LOCKED: { label: "Bloqueado", className: "bg-blue-100 text-blue-800 border-blue-300" },
};

// ── Interfaz para la línea de detalle ──

interface SaleDetailLine {
  id: string;
  description: string;
  incomeAccountId: string;
  quantity: string;
  unitPrice: string;
}

// ── Cuenta de ingreso para el selector ──

interface IncomeAccountOption {
  id: string;
  code: string;
  name: string;
}

// ── Contador para IDs únicos de línea ──

let lineCounter = 0;
function nextLineId() {
  lineCounter += 1;
  return `line-${lineCounter}`;
}

function emptySaleLine(): SaleDetailLine {
  return {
    id: nextLineId(),
    description: "",
    incomeAccountId: "",
    quantity: "1",
    unitPrice: "",
  };
}

// ── Props ──

interface SaleFormProps {
  orgSlug: string;
  contacts: Contact[];
  periods: FiscalPeriod[];
  incomeAccounts: IncomeAccountOption[];
  sale?: SaleWithDetails;
  mode: "new" | "edit";
}

export default function SaleForm({
  orgSlug,
  contacts,
  periods,
  incomeAccounts,
  sale,
  mode,
}: SaleFormProps) {
  const router = useRouter();
  const { role } = useOrgRole();
  const isEditMode = mode === "edit";
  const status = sale?.status ?? "DRAFT";
  const isAdminOrOwner = role === "admin" || role === "owner";
  const isLocked = status === "LOCKED";
  const isPosted = status === "POSTED";
  const isVoided = status === "VOIDED";
  const isReadOnly = isVoided || (isLocked && !isAdminOrOwner);

  // ── Estado del encabezado ──
  const [contactId, setContactId] = useState(sale?.contactId ?? "");
  const [periodId, setPeriodId] = useState(sale?.periodId ?? (periods[0]?.id ?? ""));
  const [date, setDate] = useState(
    sale?.date
      ? new Date(sale.date).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
  );
  const [referenceNumber, setReferenceNumber] = useState(
    sale?.referenceNumber != null ? String(sale.referenceNumber) : "",
  );
  const [description, setDescription] = useState(sale?.description ?? "");
  const [notes, setNotes] = useState(sale?.notes ?? "");

  // ── Estado de las líneas de detalle ──
  const [lines, setLines] = useState<SaleDetailLine[]>(() => {
    if (sale?.details && sale.details.length > 0) {
      return sale.details.map((d) => ({
        id: nextLineId(),
        description: d.description ?? "",
        incomeAccountId: d.incomeAccountId ?? "",
        quantity: d.quantity != null ? String(d.quantity) : "1",
        unitPrice: d.unitPrice != null ? String(d.unitPrice) : "",
      }));
    }
    return [emptySaleLine()];
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isActioning, setIsActioning] = useState(false);
  const [ivaModalOpen, setIvaModalOpen] = useState(false);

  // ── Estado del diálogo de confirmación de trim (REQ-7) ──
  const [trimPreview, setTrimPreview] = useState<TrimPreviewItem[] | null>(null);
  const [showTrimDialog, setShowTrimDialog] = useState(false);
  // Snapshot del body listo para reenviar con confirmTrim: true
  const [pendingEditBody, setPendingEditBody] = useState<object | null>(null);

  // ── Estado y hook de desvinculación LCV (T3.2 REQ-A.1) ──
  const [unlinkDialogOpen, setUnlinkDialogOpen] = useState(false);
  const { handleUnlink, isPending: isUnlinking } = useLcvUnlink(
    orgSlug,
    sale?.ivaSalesBook?.id,
  );

  // ── Estado y hook de reactivación LCV ──
  const [reactivateDialogOpen, setReactivateDialogOpen] = useState(false);
  const { handleReactivate, isPending: isReactivating } = useLcvReactivate(
    orgSlug,
    sale?.ivaSalesBook?.id,
  );

  // ── Total calculado ──
  const subtotal = lines.reduce((sum, l) => {
    const qty = parseFloat(l.quantity) || 1;
    const price = parseFloat(l.unitPrice) || 0;
    return sum + Math.round(qty * price * 100) / 100;
  }, 0);

  // ── Manejadores de líneas ──

  function updateLine(id: string, field: keyof SaleDetailLine, value: string) {
    if (isReadOnly) return;
    setLines((prev) => prev.map((l) => (l.id !== id ? l : { ...l, [field]: value })));
  }

  function addLine() {
    if (isReadOnly) return;
    setLines((prev) => [...prev, emptySaleLine()]);
  }

  function removeLine(id: string) {
    if (isReadOnly) return;
    if (lines.length <= 1) { toast.error("Debe haber al menos una línea"); return; }
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  function handleUnitPriceBlur(id: string, value: string) {
    if (!value.trim()) return;
    const result = evaluateExpression(value);
    if (result !== null) {
      updateLine(id, "unitPrice", String(result));
    } else {
      toast.error("Expresión inválida");
    }
  }

  // ── Validación ──

  const canSubmit = (() => {
    if (!contactId || !periodId || !date) return false;
    return lines.length > 0 && lines.every(
      (l) => l.description.trim() && l.incomeAccountId && (parseFloat(l.unitPrice) || 0) > 0,
    );
  })();

  // ── Construcción del payload ──

  function buildDetailsPayload() {
    return lines.map((l, i) => ({
      description: l.description.trim(),
      quantity: parseFloat(l.quantity) || 1,
      unitPrice: parseFloat(l.unitPrice) || 0,
      incomeAccountId: l.incomeAccountId,
      order: i,
    }));
  }

  function buildBody(postImmediately: boolean) {
    return {
      date,
      contactId,
      periodId,
      description: description.trim(),
      referenceNumber: referenceNumber ? parseInt(referenceNumber, 10) : undefined,
      notes: notes.trim() || undefined,
      details: buildDetailsPayload(),
      ...(postImmediately ? { postImmediately: true } : {}),
    };
  }

  // ── Guardar borrador ──

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || isReadOnly || isPosted || isLocked) return;
    setIsSubmitting(true);
    try {
      const body = buildBody(false);
      if (isEditMode && sale) {
        const response = await fetch(
          `/api/organizations/${orgSlug}/sales/${sale.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? "Error al actualizar la venta");
        }
        toast.success("Venta actualizada");
        router.refresh();
      } else {
        const response = await fetch(`/api/organizations/${orgSlug}/sales`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? "Error al guardar la venta");
        }
        toast.success("Venta guardada como borrador");
        router.push(`/${orgSlug}/dispatches`);
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar la venta");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Guardar y contabilizar (modo creación) ──

  async function handleCreateAndPost() {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const body = buildBody(true);
      const response = await fetch(`/api/organizations/${orgSlug}/sales`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al contabilizar la venta");
      }
      toast.success("Venta contabilizada");
      router.push(`/${orgSlug}/dispatches`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al contabilizar la venta");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Contabilizar desde modo edición ──

  async function handlePost() {
    if (!sale) return;
    if (!window.confirm("¿Contabilizar esta venta? Esta acción generará el asiento contable y la cuenta por cobrar.")) return;
    setIsActioning(true);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/sales/${sale.id}/status`,
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
      toast.success("Venta contabilizada exitosamente");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al contabilizar");
    } finally {
      setIsActioning(false);
    }
  }

  // ── Editar venta contabilizada (POSTED) con pre-flight dryRun ──

  async function handleEditPosted() {
    if (!sale || !canSubmit) return;
    setIsSubmitting(true);
    try {
      const body = buildBody(false);

      const response = await fetch(
        `/api/organizations/${orgSlug}/sales/${sale.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al actualizar la venta");
      }

      const data = await response.json();

      if (data.requiresConfirmation && Array.isArray(data.trimPreview) && data.trimPreview.length > 0) {
        // El servidor indica que hay allocations que se deben recortar → abrir diálogo
        setTrimPreview(data.trimPreview as TrimPreviewItem[]);
        setPendingEditBody(body);
        setShowTrimDialog(true);
        return; // No continuar — el usuario decide desde el diálogo
      }

      // Sin trim necesario → guardado exitoso
      toast.success("Venta actualizada");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar la venta");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Confirmar trim desde el diálogo ──

  async function handleConfirmTrim() {
    if (!sale || !pendingEditBody) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/sales/${sale.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...pendingEditBody, confirmTrim: true }),
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al actualizar la venta");
      }

      setShowTrimDialog(false);
      setTrimPreview(null);
      setPendingEditBody(null);
      toast.success("Venta actualizada");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar la venta");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Cancelar trim desde el diálogo ──

  function handleCancelTrim() {
    setShowTrimDialog(false);
    setTrimPreview(null);
    setPendingEditBody(null);
  }

  // ── Anular ──

  async function handleVoid() {
    if (!sale) return;
    if (!window.confirm("¿Anular esta venta? Se revertirá el asiento contable y la cuenta por cobrar. Esta acción no se puede deshacer.")) return;
    setIsActioning(true);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/sales/${sale.id}/status`,
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
      toast.success("Venta anulada");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al anular");
    } finally {
      setIsActioning(false);
    }
  }

  // ── Eliminar borrador ──

  async function handleDelete() {
    if (!sale) return;
    if (!window.confirm("¿Eliminar este borrador? Esta acción no se puede deshacer.")) return;
    setIsActioning(true);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/sales/${sale.id}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al eliminar");
      }
      toast.success("Borrador eliminado");
      router.push(`/${orgSlug}/dispatches`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setIsActioning(false);
    }
  }

  const backHref = `/${orgSlug}/dispatches`;
  const headerTitle = isEditMode
    ? `${sale!.displayCode} — Venta General`
    : "Nueva Venta General";

  // ── Render ──
  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-6">
      <Link href={backHref}>
        <Button type="button" variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver a Ventas
        </Button>
      </Link>

      {/* Campos del encabezado */}
      <Card className={isVoided ? "opacity-70" : undefined}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{headerTitle}</CardTitle>
            {isEditMode && (
              <Badge className={STATUS_BADGE[status]?.className ?? "bg-gray-100 text-gray-800"}>
                {STATUS_BADGE[status]?.label ?? status}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isReadOnly && isEditMode ? (
            /* ── Vista de solo lectura compacta ── */
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Nro. Referencia</dt>
                <dd className="font-medium mt-0.5 font-mono">
                  {sale!.referenceNumber ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Fecha</dt>
                <dd className="font-medium mt-0.5">
                  {new Date(sale!.date).toLocaleDateString("es-BO")}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Período</dt>
                <dd className="font-medium mt-0.5">
                  {periods.find((p) => p.id === sale!.periodId)?.name ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Cliente</dt>
                <dd className="font-medium mt-0.5">{sale!.contact.name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Total</dt>
                <dd className="font-medium mt-0.5 font-mono font-bold">
                  {formatCurrency(sale!.totalAmount)}
                </dd>
              </div>
              {sale!.notes && (
                <div className="col-span-2 sm:col-span-4">
                  <dt className="text-muted-foreground">Notas</dt>
                  <dd className="mt-0.5 text-gray-700">{sale!.notes}</dd>
                </div>
              )}
              {sale!.description && (
                <div className="col-span-2 sm:col-span-4">
                  <dt className="text-muted-foreground">Descripción</dt>
                  <dd className="mt-0.5 text-xs text-gray-600">{sale!.description}</dd>
                </div>
              )}
            </dl>
          ) : (
            /* ── Formulario editable ── */
            <>
              {/* Fila 1: Fecha / Período / Nro. Referencia */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sale-date">Fecha</Label>
                  <Input
                    id="sale-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    readOnly={isReadOnly}
                    className={isReadOnly ? "bg-muted cursor-default" : undefined}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="period">Período</Label>
                  {isReadOnly ? (
                    <Input
                      value={periods.find((p) => p.id === periodId)?.name ?? "—"}
                      readOnly
                      className="bg-muted cursor-default"
                    />
                  ) : (
                    <Select value={periodId} onValueChange={setPeriodId}>
                      <SelectTrigger id="period" className="w-full">
                        <SelectValue placeholder="Seleccione período" />
                      </SelectTrigger>
                      <SelectContent>
                        {periods.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reference-number">Nro. de Referencia (opcional)</Label>
                  <Input
                    id="reference-number"
                    type="number"
                    min={1}
                    step={1}
                    placeholder="Ej: 100"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    readOnly={isReadOnly}
                    className={isReadOnly ? "bg-muted cursor-default" : undefined}
                  />
                </div>
              </div>

              {/* Fila 2: Cliente / Total / LCV */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contact">Cliente</Label>
                  {isReadOnly ? (
                    <Input
                      value={sale?.contact?.name ?? "—"}
                      readOnly
                      className="bg-muted cursor-default"
                    />
                  ) : (
                    <Select value={contactId} onValueChange={setContactId}>
                      <SelectTrigger id="contact" className="w-full">
                        <SelectValue placeholder="Seleccione cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {contacts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {isEditMode && status !== "DRAFT" && (
                  <div className="space-y-2">
                    <Label>Total</Label>
                    <Input
                      value={formatCurrency(sale!.totalAmount)}
                      readOnly
                      className="bg-muted cursor-default font-mono font-bold"
                    />
                  </div>
                )}

                {/* LCV Indicator — siempre visible en fila 2 */}
                <div className="space-y-2">
                  <Label>Libro de Ventas (LCV)</Label>
                  <LcvIndicator
                    state={deriveLcvState(sale)}
                    periodOpen={isFiscalPeriodOpen(sale?.period ?? { status: "CLOSED" })}
                    onRegister={() => {
                      // Si hay un registro VOIDED → reactivar; si no → crear nuevo
                      if (sale?.ivaSalesBook?.status === "VOIDED") {
                        setReactivateDialogOpen(true);
                      } else {
                        setIvaModalOpen(true);
                      }
                    }}
                    onEdit={() => setIvaModalOpen(true)}
                    onUnlink={() => setUnlinkDialogOpen(true)}
                  />
                </div>
              </div>

              {/* Descripción */}
              <div className="space-y-2">
                <Label htmlFor="sale-description">Descripción</Label>
                <Input
                  id="sale-description"
                  placeholder="Descripción del documento"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  readOnly={isReadOnly}
                  className={isReadOnly ? "bg-muted cursor-default text-xs" : "text-xs"}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Líneas de detalle */}
      <Card className={isVoided ? "opacity-70" : undefined}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Líneas de Detalle</CardTitle>
            {!isReadOnly && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLine}
              >
                <Plus className="h-4 w-4 mr-1" />
                Agregar línea
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-2 font-medium text-gray-600 w-6">#</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-600 min-w-48">Descripción</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-600 min-w-48">Cuenta de Ingreso</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-600 w-24">Cantidad</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-600 w-28">Precio Unitario</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-600 w-28">Importe</th>
                  {!isReadOnly && <th className="w-10" />}
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => {
                  const qty = parseFloat(line.quantity) || 1;
                  const price = parseFloat(line.unitPrice) || 0;
                  const lineAmount = Math.round(qty * price * 100) / 100;
                  return (
                    <tr key={line.id} className="border-b hover:bg-gray-50/50">
                      <td className="py-2 px-2 text-gray-400 text-xs">{idx + 1}</td>
                      <td className="py-2 px-2">
                        <Input
                          value={line.description}
                          onChange={(e) => updateLine(line.id, "description", e.target.value)}
                          placeholder="Descripción del concepto"
                          className={`h-8 min-w-44 ${isReadOnly ? "bg-muted cursor-default" : ""}`}
                          readOnly={isReadOnly}
                        />
                      </td>
                      <td className="py-2 px-2">
                        {isReadOnly ? (
                          <Input
                            value={
                              incomeAccounts.find((a) => a.id === line.incomeAccountId)
                                ? `${incomeAccounts.find((a) => a.id === line.incomeAccountId)!.code} - ${incomeAccounts.find((a) => a.id === line.incomeAccountId)!.name}`
                                : line.incomeAccountId
                            }
                            readOnly
                            className="h-8 min-w-44 bg-muted cursor-default"
                          />
                        ) : (
                          <Select
                            value={line.incomeAccountId}
                            onValueChange={(val) => updateLine(line.id, "incomeAccountId", val)}
                          >
                            <SelectTrigger className="h-8 min-w-44">
                              <SelectValue placeholder="Seleccione cuenta" />
                            </SelectTrigger>
                            <SelectContent>
                              {incomeAccounts.map((a) => (
                                <SelectItem key={a.id} value={a.id}>
                                  {a.code} - {a.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          type="number"
                          min={0}
                          step={0.001}
                          value={line.quantity}
                          onChange={(e) => updateLine(line.id, "quantity", e.target.value)}
                          placeholder="1"
                          className={`h-8 text-right ${isReadOnly ? "bg-muted cursor-default" : ""}`}
                          readOnly={isReadOnly}
                        />
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          type="text"
                          value={line.unitPrice}
                          onChange={(e) => updateLine(line.id, "unitPrice", e.target.value)}
                          onBlur={(e) => !isReadOnly && handleUnitPriceBlur(line.id, e.target.value)}
                          placeholder="0.00"
                          className={`h-8 text-right ${isReadOnly ? "bg-muted cursor-default" : ""}`}
                          readOnly={isReadOnly}
                        />
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          value={lineAmount !== 0 ? lineAmount.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}
                          readOnly
                          className="h-8 text-right bg-muted cursor-default font-mono"
                          placeholder="—"
                        />
                      </td>
                      {!isReadOnly && (
                        <td className="py-2 px-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeLine(line.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-100">
                  <td colSpan={5} className="py-3 px-2 text-right font-semibold text-gray-700">
                    Total CxC (Bs.)
                  </td>
                  <td className="py-3 px-2 text-right font-mono font-bold text-gray-900 text-base">
                    {subtotal.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  {!isReadOnly && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Fila inferior: Notas (izq) + Resumen de Cobros (der) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="bottom-row">
        {/* Notas — siempre visible en slot izquierdo */}
        <div className="space-y-2">
          <Label htmlFor="sale-notes">Notas (opcional)</Label>
          <Textarea
            id="sale-notes"
            placeholder="Observaciones adicionales..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            readOnly={isReadOnly}
            className={isReadOnly ? "bg-muted cursor-default" : undefined}
          />
        </div>

        {/* Resumen de Cobros — slot derecho, solo cuando hay receivable */}
        {sale?.receivable != null && (status === "POSTED" || status === "LOCKED") ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumen de Cobros (CxC)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-1 ml-auto w-fit text-sm">
                <div className="flex gap-4 border-b pb-2 font-semibold">
                  <span>Total CxC (Bs.)</span>
                  <span className="font-mono">{formatCurrency(sale.receivable.amount)}</span>
                </div>
                {sale.receivable.allocations.map((alloc) => (
                  <div key={alloc.id} className="flex gap-4 text-muted-foreground py-1">
                    <Link
                      href={`/${orgSlug}/payments/${alloc.paymentId}`}
                      className="underline underline-offset-2 hover:text-foreground transition-colors"
                    >
                      Cobro el{" "}
                      {new Date(alloc.payment.date).toLocaleDateString("es-BO")}
                      {alloc.payment.description ? ` — ${alloc.payment.description}` : ""}
                    </Link>
                    <span className="font-mono text-green-700">
                      -{formatCurrency(alloc.amount)}
                    </span>
                  </div>
                ))}
                <div
                  className={`flex gap-4 border-t-2 pt-2 font-bold ${
                    sale.receivable.balance > 0 ? "text-red-600" : "text-green-700"
                  }`}
                >
                  <span className="text-foreground">Saldo pendiente</span>
                  <span className="font-mono">{formatCurrency(sale.receivable.balance)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div />
        )}
      </div>

      {/* Acciones */}
      <div className="flex justify-between gap-3">
        <div className="flex gap-3">
          {isEditMode && status === "DRAFT" && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isActioning}
            >
              {isActioning ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Eliminar
            </Button>
          )}
          {/* LCV action moved to header row 2 LcvIndicator (T3.4 REQ-A.1) */}
        </div>

        <div className="flex gap-3">
          <Link href={backHref}>
            <Button type="button" variant="outline">
              {isReadOnly && !isLocked ? "Volver" : "Cancelar"}
            </Button>
          </Link>

          {/* Modo creación — botones duales */}
          {!isEditMode && (
            <>
              <Button type="submit" variant="outline" disabled={!canSubmit || isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar borrador"
                )}
              </Button>
              <Button
                type="button"
                className="bg-green-600 hover:bg-green-700"
                onClick={handleCreateAndPost}
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Guardar y contabilizar
              </Button>
            </>
          )}

          {/* Edición en borrador */}
          {isEditMode && status === "DRAFT" && (
            <>
              <Button type="submit" disabled={!canSubmit || isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar"
                )}
              </Button>
              <Button
                type="button"
                className="bg-green-600 hover:bg-green-700"
                onClick={handlePost}
                disabled={!canSubmit || isActioning}
              >
                {isActioning ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Contabilizar
              </Button>
            </>
          )}

          {/* Acciones en estado POSTED */}
          {isEditMode && isPosted && (
            <>
              <Button
                type="button"
                variant="default"
                onClick={handleEditPosted}
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar cambios"
                )}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleVoid}
                disabled={isActioning}
              >
                {isActioning ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                Anular
              </Button>
            </>
          )}

          {/* Acciones en estado LOCKED (solo admin/owner) */}
          {isEditMode && isLocked && isAdminOrOwner && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleVoid}
              disabled={isActioning}
            >
              {isActioning ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Anular
            </Button>
          )}
        </div>
      </div>
    </form>

    {/* Diálogo de confirmación de trim (REQ-7) */}
    {showTrimDialog && trimPreview && (
      <ConfirmTrimDialog
        open={showTrimDialog}
        onOpenChange={(open) => { if (!open) handleCancelTrim(); }}
        trimPreview={trimPreview}
        onConfirm={handleConfirmTrim}
        onCancel={handleCancelTrim}
        isLoading={isSubmitting}
      />
    )}

    {/* Modal Libro de Ventas IVA — pre-fill desde esta venta o edición de entrada existente */}
    {sale && (
      <IvaBookSaleModal
        open={ivaModalOpen}
        onClose={() => setIvaModalOpen(false)}
        onSuccess={() => {
          setIvaModalOpen(false);
          router.refresh();
        }}
        orgSlug={orgSlug}
        periods={periods.map((p) => ({
          id: p.id,
          name: p.name,
          startDate: new Date(p.startDate).toISOString().split("T")[0],
          endDate: new Date(p.endDate).toISOString().split("T")[0],
          status: p.status,
        }))}
        mode={sale.ivaSalesBook && sale.ivaSalesBook.status !== "VOIDED" ? "edit" : "create-from-source"}
        entryId={sale.ivaSalesBook?.id}
        sourceSale={{
          id: sale.id,
          date: new Date(sale.date).toISOString().split("T")[0],
          totalAmount: sale.totalAmount,
          contact: {
            name: sale.contact.name,
            nit: sale.contact.nit ?? null,
          },
        }}
      />
    )}

    {/* Diálogo de confirmación de desvinculación LCV (T3.2 REQ-A.3) */}
    <UnlinkLcvConfirmDialog
      open={unlinkDialogOpen}
      onOpenChange={setUnlinkDialogOpen}
      onConfirm={async () => {
        await handleUnlink();
        setUnlinkDialogOpen(false);
      }}
      isPending={isUnlinking}
    />

    {/* Diálogo de confirmación de reactivación LCV */}
    <ReactivateLcvConfirmDialog
      open={reactivateDialogOpen}
      onOpenChange={setReactivateDialogOpen}
      onConfirm={async () => {
        await handleReactivate();
        setReactivateDialogOpen(false);
      }}
      isPending={isReactivating}
    />
    </>
  );
}
