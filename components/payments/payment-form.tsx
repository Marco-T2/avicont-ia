"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowLeft, CheckSquare, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import type { PaymentWithRelations, PaymentDirection, PaymentMethod } from "@/features/payment/payment.types";
import type { PendingDocument } from "@/features/contacts/contacts.types";
import { JustificationModal } from "@/components/shared/justification-modal";

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

const PAYMENT_METHODS = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "DEPOSITO", label: "Depósito" },
] as const;

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Borrador", className: "bg-amber-100 text-amber-800" },
  POSTED: { label: "Contabilizado", className: "bg-green-100 text-green-800" },
  VOIDED: { label: "Anulado", className: "bg-red-100 text-red-700" },
  LOCKED: { label: "Bloqueado", className: "bg-blue-100 text-blue-800 border-blue-300" },
};

// ── Allocation line state ──

interface AllocationLine {
  id: string;
  type: "receivable" | "payable";
  description: string;
  totalAmount: number;
  paid: number;
  balance: number;
  sourceType: string | null;
  sourceId: string | null;
  dueDate: Date;
  assignedAmount: string; // string for input control
  checked: boolean;
}

// ── Props ──

interface ContactOption {
  id: string;
  name: string;
  type: string;
}

interface PeriodOption {
  id: string;
  name?: string;
  year?: number;
  status: string;
}

interface PaymentFormProps {
  orgSlug: string;
  contacts: ContactOption[];
  periods: PeriodOption[];
  existingPayment?: PaymentWithRelations;
  userRole?: string;
  defaultType?: "COBRO" | "PAGO";
}

export default function PaymentForm({
  orgSlug,
  contacts,
  periods,
  existingPayment,
  userRole,
  defaultType,
}: PaymentFormProps) {
  const router = useRouter();

  // ── Determine mode ──
  const isNew = !existingPayment;
  const isDraft = existingPayment?.status === "DRAFT";
  const isPosted = existingPayment?.status === "POSTED";
  const isVoided = existingPayment?.status === "VOIDED";
  const isLocked = existingPayment?.status === "LOCKED";
  const isAdminOrOwner = userRole === "admin" || userRole === "owner";
  const isReadOnly = isVoided || (isLocked && !isAdminOrOwner);

  // Infer direction from existing payment
  function inferDirection(payment: PaymentWithRelations): PaymentDirection {
    if (payment.allocations.length > 0 && payment.allocations[0].receivableId) {
      return "COBRO";
    }
    return "PAGO";
  }

  // ── Header state ──
  const [paymentType, setPaymentType] = useState<PaymentDirection>(
    existingPayment ? inferDirection(existingPayment) : (defaultType ?? "COBRO"),
  );
  const [contactId, setContactId] = useState(existingPayment?.contactId ?? "");
  const [periodId, setPeriodId] = useState(
    existingPayment?.periodId ?? periods[0]?.id ?? "",
  );
  const [date, setDate] = useState(
    existingPayment
      ? new Date(existingPayment.date).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
  );
  const [method, setMethod] = useState<PaymentMethod>(existingPayment?.method ?? "EFECTIVO");
  const [description, setDescription] = useState(existingPayment?.description ?? "");
  const [notes, setNotes] = useState(existingPayment?.notes ?? "");
  const [amountOverride, setAmountOverride] = useState(
    existingPayment ? String(existingPayment.amount) : "",
  );

  // ── Allocations state ──
  const [allocations, setAllocations] = useState<AllocationLine[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [creditBalance, setCreditBalance] = useState(0);

  // ── Credit to apply ──
  const [creditApplied, setCreditApplied] = useState(0);

  // ── Submission state ──
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);

  // ── Justification modal state ──
  const [showJustification, setShowJustification] = useState(false);
  const [pendingAction, setPendingAction] = useState<"save" | "void" | null>(null);
  const [isJustificationLoading, setIsJustificationLoading] = useState(false);

  // ── Load existing allocations ──
  useEffect(() => {
    if (existingPayment && existingPayment.allocations.length > 0) {
      const lines: AllocationLine[] = existingPayment.allocations.map((a) => {
        const target = a.receivable ?? a.payable;
        const desc = target
          ? `${target.sourceType ?? "Documento"} — ${(target as Record<string, unknown>).description ?? ""}`
          : "Documento";
        return {
          id: a.receivableId ?? a.payableId ?? a.id,
          type: a.receivableId ? "receivable" : "payable",
          description: desc,
          totalAmount: Number((target as Record<string, unknown>)?.amount ?? 0),
          paid: Number((target as Record<string, unknown>)?.paid ?? 0),
          balance: Number((target as Record<string, unknown>)?.balance ?? 0) + Number(a.amount),
          sourceType: (target as Record<string, unknown>)?.sourceType as string | null ?? null,
          sourceId: (target as Record<string, unknown>)?.sourceId as string | null ?? null,
          dueDate: (target as Record<string, unknown>)?.dueDate as Date ?? new Date(),
          assignedAmount: String(a.amount),
          checked: true,
        };
      });
      setAllocations(lines);
    }
  }, [existingPayment]);

  // ── Fetch pending documents when contact changes ──
  const fetchPendingDocuments = useCallback(
    async (selectedContactId: string) => {
      if (!selectedContactId) {
        setAllocations([]);
        setCreditBalance(0);
        return;
      }

      setLoadingDocs(true);
      try {
        const docType = paymentType === "COBRO" ? "receivable" : "payable";
        const [docsRes, creditRes] = await Promise.all([
          fetch(
            `/api/organizations/${orgSlug}/contacts/${selectedContactId}/pending-documents?type=${docType}`,
          ),
          fetch(
            `/api/organizations/${orgSlug}/contacts/${selectedContactId}/credit-balance`,
          ),
        ]);

        if (docsRes.ok) {
          const { documents } = (await docsRes.json()) as { documents: PendingDocument[] };
          const lines: AllocationLine[] = documents.map((doc) => ({
            id: doc.id,
            type: doc.type,
            description: doc.description,
            totalAmount: doc.amount,
            paid: doc.paid,
            balance: doc.balance,
            sourceType: doc.sourceType,
            sourceId: doc.sourceId,
            dueDate: doc.dueDate,
            assignedAmount: "0",
            checked: false,
          }));
          setAllocations(lines);
        }

        if (creditRes.ok) {
          const { creditBalance: bal } = (await creditRes.json()) as { creditBalance: number };
          setCreditBalance(bal ?? 0);
        }
      } catch {
        toast.error("Error al cargar documentos pendientes");
      } finally {
        setLoadingDocs(false);
      }
    },
    [orgSlug, paymentType],
  );

  // ── Fetch docs when contact or type changes (new mode only) ──
  useEffect(() => {
    if (isNew && contactId) {
      fetchPendingDocuments(contactId);
    }
  }, [isNew, contactId, paymentType, fetchPendingDocuments]);

  // ── Allocation handlers ──

  function updateAllocationAmount(id: string, value: string) {
    setAllocations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, assignedAmount: value } : a)),
    );
  }

  function selectAll() {
    setAllocations((prev) =>
      prev.map((a) => ({ ...a, checked: true, assignedAmount: String(a.balance) })),
    );
  }

  function handleCheckToggle(id: string, checked: boolean) {
    setAllocations((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;
        if (!checked) return { ...line, checked: false, assignedAmount: "0" };
        const currentApplied = prev
          .filter((l) => l.id !== id && l.checked)
          .reduce((sum, l) => sum + (parseFloat(l.assignedAmount) || 0), 0);
        const paymentAmt = parseFloat(amountOverride) || 0;
        const remaining = paymentAmt > 0
          ? Math.max(0, paymentAmt - currentApplied)
          : line.balance;
        const fillAmount = Math.min(line.balance, remaining);
        return { ...line, checked: true, assignedAmount: String(fillAmount) };
      }),
    );
  }

  // ── Computed totals ──

  const totalAllocated = allocations.reduce(
    (sum, a) => sum + (parseFloat(a.assignedAmount) || 0),
    0,
  );

  const paymentAmount =
    amountOverride && parseFloat(amountOverride) > 0
      ? parseFloat(amountOverride)
      : totalAllocated;

  const creditFromPayment =
    paymentAmount > totalAllocated ? paymentAmount - totalAllocated : 0;

  // ── Auto-description ──
  const autoDescription = useCallback(() => {
    const contactName = contacts.find((c) => c.id === contactId)?.name ?? "";
    const typeLabel = paymentType === "COBRO" ? "Cobro" : "Pago";
    const methodLabel =
      PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method;
    return `${typeLabel} ${methodLabel} - ${contactName}`;
  }, [contactId, contacts, paymentType, method]);

  useEffect(() => {
    if (isNew && contactId && !description) {
      setDescription(autoDescription());
    }
  }, [isNew, contactId, method, paymentType, autoDescription, description]);

  // ── Validation ──

  const activeAllocations = allocations.filter(
    (a) => a.checked && parseFloat(a.assignedAmount) > 0,
  );

  const hasOverAllocation = allocations.some(
    (a) => parseFloat(a.assignedAmount) > a.balance,
  );

  const canSubmit =
    contactId &&
    periodId &&
    date &&
    method &&
    description.trim() &&
    (paymentAmount > 0 || creditApplied > 0) &&
    !hasOverAllocation;

  // ── Submit (create or update) ──

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);

    try {
      const allocs = activeAllocations.map((a) => ({
        ...(a.type === "receivable"
          ? { receivableId: a.id }
          : { payableId: a.id }),
        amount: parseFloat(a.assignedAmount),
      }));

      const body = {
        method,
        date,
        amount: paymentAmount,
        creditApplied: creditApplied > 0 ? creditApplied : undefined,
        direction: allocs.length === 0 ? paymentType : undefined,
        description: description.trim(),
        periodId,
        contactId,
        allocations: allocs,
        notes: notes.trim() || undefined,
      };

      const url = existingPayment
        ? `/api/organizations/${orgSlug}/payments/${existingPayment.id}`
        : `/api/organizations/${orgSlug}/payments`;

      const response = await fetch(url, {
        method: existingPayment ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al guardar el pago");
      }

      toast.success(
        existingPayment
          ? "Pago actualizado correctamente"
          : "Pago guardado como borrador",
      );
      router.push(`/${orgSlug}/payments`);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al guardar el pago",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Post (DRAFT → POSTED) ──

  async function handlePost() {
    if (!existingPayment) return;
    if (
      !confirm(
        "¿Está seguro de contabilizar este pago? Esta acción generará el asiento contable correspondiente.",
      )
    )
      return;

    setIsPosting(true);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/payments/${existingPayment.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "POSTED" }),
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al contabilizar el pago");
      }

      toast.success("Pago contabilizado correctamente");
      router.push(`/${orgSlug}/payments`);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al contabilizar el pago",
      );
    } finally {
      setIsPosting(false);
    }
  }

  // ── Void (POSTED → VOIDED) ──

  async function handleVoid() {
    if (!existingPayment) return;
    if (
      !confirm(
        "¿Está seguro de anular este pago? Se revertirán los asientos contables y las actualizaciones de CxC/CxP.",
      )
    )
      return;

    setIsVoiding(true);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/payments/${existingPayment.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "VOIDED" }),
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al anular el pago");
      }

      toast.success("Pago anulado correctamente");
      router.push(`/${orgSlug}/payments`);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al anular el pago",
      );
    } finally {
      setIsVoiding(false);
    }
  }

  // ── Delete (DRAFT only) ──

  async function handleDelete() {
    if (!existingPayment) return;
    if (!confirm("¿Está seguro de eliminar este pago borrador?")) return;

    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/payments/${existingPayment.id}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al eliminar el pago");
      }

      toast.success("Pago eliminado correctamente");
      router.push(`/${orgSlug}/payments`);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al eliminar el pago",
      );
    }
  }

  // ── Create and Post (atomic POSTED creation) ──

  async function handleCreateAndPost() {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const allocs = activeAllocations.map((a) => ({
        ...(a.type === "receivable"
          ? { receivableId: a.id }
          : { payableId: a.id }),
        amount: parseFloat(a.assignedAmount),
      }));

      const body = {
        method,
        date,
        amount: paymentAmount,
        creditApplied: creditApplied > 0 ? creditApplied : undefined,
        direction: allocs.length === 0 ? paymentType : undefined,
        description: description.trim(),
        periodId,
        contactId,
        allocations: allocs,
        notes: notes.trim() || undefined,
        postImmediately: true,
      };

      const response = await fetch(`/api/organizations/${orgSlug}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al contabilizar el pago");
      }

      toast.success("Pago contabilizado");
      router.push(`/${orgSlug}/payments`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al contabilizar el pago");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── LOCKED edit handlers ──

  async function handleLockedSave(justification: string) {
    if (!existingPayment) return;
    setIsJustificationLoading(true);
    try {
      const allocs = activeAllocations.map((a) => ({
        ...(a.type === "receivable"
          ? { receivableId: a.id }
          : { payableId: a.id }),
        amount: parseFloat(a.assignedAmount),
      }));

      const body = {
        method,
        date,
        amount: paymentAmount,
        creditApplied: creditApplied > 0 ? creditApplied : undefined,
        direction: allocs.length === 0 ? paymentType : undefined,
        description: description.trim(),
        periodId,
        contactId,
        allocations: allocs,
        notes: notes.trim() || undefined,
        justification,
      };

      const response = await fetch(
        `/api/organizations/${orgSlug}/payments/${existingPayment.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al guardar el pago bloqueado");
      }

      toast.success("Pago actualizado");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar el pago bloqueado");
    } finally {
      setIsJustificationLoading(false);
    }
  }

  async function handleLockedVoid(justification: string) {
    if (!existingPayment) return;
    setIsJustificationLoading(true);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/payments/${existingPayment.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "VOIDED", justification }),
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al anular el pago bloqueado");
      }

      toast.success("Pago anulado");
      router.push(`/${orgSlug}/payments`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al anular el pago bloqueado");
    } finally {
      setIsJustificationLoading(false);
    }
  }

  // ── POSTED edit handler ──

  async function handlePostedSave(justification: string) {
    if (!existingPayment) return;
    setIsJustificationLoading(true);
    try {
      const allocs = activeAllocations.map((a) => ({
        ...(a.type === "receivable"
          ? { receivableId: a.id }
          : { payableId: a.id }),
        amount: parseFloat(a.assignedAmount),
      }));

      const body = {
        method,
        date,
        amount: paymentAmount,
        creditApplied: creditApplied > 0 ? creditApplied : undefined,
        direction: allocs.length === 0 ? paymentType : undefined,
        description: description.trim(),
        periodId,
        contactId,
        allocations: allocs,
        notes: notes.trim() || undefined,
        justification,
      };

      const response = await fetch(
        `/api/organizations/${orgSlug}/payments/${existingPayment.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al guardar el pago contabilizado");
      }

      toast.success("Pago actualizado y asiento recalculado");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar el pago contabilizado");
    } finally {
      setIsJustificationLoading(false);
    }
  }

  const backHref = `/${orgSlug}/payments`;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href={backHref}>
          <Button type="button" variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver a Cobros y Pagos
          </Button>
        </Link>

        {existingPayment && (
          <div className="flex items-center gap-2">
            {isVoided && (
              <Badge className="bg-red-100 text-red-700 text-sm px-3 py-1">
                ANULADO
              </Badge>
            )}
            <Badge className={STATUS_BADGE[existingPayment.status]?.className ?? ""}>
              {STATUS_BADGE[existingPayment.status]?.label ?? existingPayment.status}
            </Badge>
          </div>
        )}
      </div>

      {/* Header fields */}
      <Card>
        <CardHeader>
          <CardTitle>
            {isNew
              ? `Nuevo ${paymentType === "COBRO" ? "Cobro" : "Pago"}`
              : `${paymentType === "COBRO" ? "Cobro" : "Pago"} — ${existingPayment?.description ?? ""}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Tipo de Pago */}
            <div className="space-y-2">
              <Label>Tipo</Label>
              {isReadOnly ? (
                <Input
                  value={paymentType === "COBRO" ? "Cobro" : "Pago"}
                  readOnly
                  className="bg-muted cursor-default"
                />
              ) : (
                <Select
                  value={paymentType}
                  onValueChange={(v) => {
                    setPaymentType(v as PaymentDirection);
                    // Reset allocations when type changes
                    if (isNew) {
                      setAllocations([]);
                    }
                  }}
                  disabled={!!existingPayment}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COBRO">Cobro</SelectItem>
                    <SelectItem value="PAGO">Pago</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Contacto */}
            <div className="space-y-2">
              <Label htmlFor="contact">
                {paymentType === "COBRO" ? "Cliente" : "Proveedor"}
              </Label>
              {isReadOnly ? (
                <Input
                  value={existingPayment?.contact?.name ?? ""}
                  readOnly
                  className="bg-muted cursor-default"
                />
              ) : (
                <Select
                  value={contactId}
                  onValueChange={setContactId}
                  disabled={!!existingPayment}
                >
                  <SelectTrigger id="contact" className="w-full">
                    <SelectValue placeholder="Seleccione contacto" />
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

            {/* Método de Pago */}
            <div className="space-y-2">
              <Label htmlFor="method">Método de Pago</Label>
              {isReadOnly ? (
                <Input
                  value={
                    PAYMENT_METHODS.find((m) => m.value === method)?.label ??
                    method
                  }
                  readOnly
                  className="bg-muted cursor-default"
                />
              ) : (
                <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                  <SelectTrigger id="method" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Fecha */}
            <div className="space-y-2">
              <Label htmlFor="payment-date">Fecha</Label>
              <Input
                id="payment-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                readOnly={isReadOnly}
                className={isReadOnly ? "bg-muted cursor-default" : ""}
                required
              />
            </div>

            {/* Período */}
            <div className="space-y-2">
              <Label htmlFor="period">Período</Label>
              {isReadOnly ? (
                <Input
                  value={existingPayment?.period?.name ?? ""}
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
                        {p.name ?? `Período ${p.year}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Descripción */}
            <div className="space-y-2 lg:col-span-3">
              <Label htmlFor="payment-description">Descripción</Label>
              <Input
                id="payment-description"
                placeholder="Descripción del pago"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                readOnly={isReadOnly}
                className={isReadOnly ? "bg-muted cursor-default" : ""}
                required
              />
            </div>

            {/* Notas */}
            <div className="space-y-2 lg:col-span-3">
              <Label htmlFor="payment-notes">Notas (opcional)</Label>
              <Textarea
                id="payment-notes"
                placeholder="Observaciones adicionales..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                readOnly={isReadOnly}
                className={isReadOnly ? "bg-muted cursor-default" : ""}
              />
            </div>

            {/* Crédito a aplicar — solo visible cuando el contacto tiene saldo a favor */}
            {!isReadOnly && isNew && creditBalance > 0 && (
              <div className="space-y-2">
                <Label htmlFor="credit-applied">Crédito a aplicar</Label>
                <Input
                  id="credit-applied"
                  type="number"
                  min={0}
                  max={creditBalance}
                  step={0.01}
                  value={creditApplied || ""}
                  onChange={(e) => setCreditApplied(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">
                  Crédito disponible: Bs{creditBalance.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            )}

            {/* Dirección — solo visible cuando no hay asignaciones (pago sin facturas) */}
            {!isReadOnly && isNew && activeAllocations.length === 0 && (
              <div className="space-y-2">
                <Label htmlFor="direction">Dirección</Label>
                <Select
                  value={paymentType}
                  onValueChange={(v) => setPaymentType(v as PaymentDirection)}
                >
                  <SelectTrigger id="direction" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COBRO">Cobro</SelectItem>
                    <SelectItem value="PAGO">Pago</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Importe recibido — aparece antes de las asignaciones (estilo QuickBooks) */}
      {!isVoided && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-6 flex-wrap">
              <div className="space-y-1 flex-1 min-w-[200px]">
                <Label htmlFor="payment-amount-override">Importe recibido (Bs.)</Label>
                {isReadOnly && !isPosted ? (
                  <Input
                    value={existingPayment ? formatCurrency(existingPayment.amount) : ""}
                    readOnly
                    className="bg-muted cursor-default font-mono font-bold"
                  />
                ) : (
                  <Input
                    id="payment-amount-override"
                    type="number"
                    min={0}
                    step={0.01}
                    value={amountOverride}
                    onChange={(e) => setAmountOverride(e.target.value)}
                    placeholder={
                      existingPayment
                        ? String(existingPayment.amount)
                        : totalAllocated > 0
                          ? totalAllocated.toFixed(2)
                          : "0.00"
                    }
                    className="font-mono font-bold"
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  {!isReadOnly || isPosted
                    ? "Deje vacío para usar el total asignado en las líneas"
                    : ""}
                </p>
              </div>

              {/* Resumen en tiempo real */}
              <div className="flex gap-6 text-sm flex-wrap">
                <div className="text-center">
                  <p className="text-muted-foreground">Importe aplicado</p>
                  <p className="font-mono font-semibold text-gray-800">
                    {formatCurrency(totalAllocated)}
                  </p>
                </div>
                {creditFromPayment > 0 && (
                  <div className="text-center">
                    <p className="text-amber-700">Importe a acreditar</p>
                    <p className="font-mono font-semibold text-amber-700">
                      {formatCurrency(creditFromPayment)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Allocations table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              Asignación a{" "}
              {paymentType === "COBRO"
                ? "Cuentas por Cobrar"
                : "Cuentas por Pagar"}
            </CardTitle>
            {!isReadOnly && allocations.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={selectAll}
              >
                <CheckSquare className="h-4 w-4 mr-1" />
                Seleccionar Todo
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loadingDocs ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">
                Cargando documentos pendientes...
              </span>
            </div>
          ) : !contactId && isNew ? (
            <div className="py-12 text-center text-muted-foreground">
              <p>Seleccione un contacto para ver los documentos pendientes</p>
            </div>
          ) : allocations.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <p>
                No hay documentos pendientes para este{" "}
                {paymentType === "COBRO" ? "cliente" : "proveedor"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    {!isReadOnly && (
                      <th className="py-3 px-3 w-10" />
                    )}
                    <th className="text-left py-3 px-4 font-medium text-gray-600">
                      Descripción
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">
                      Total
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">
                      Pagado
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">
                      Saldo
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600 w-40">
                      Aplicar
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {allocations.map((alloc) => {
                    const assigned = parseFloat(alloc.assignedAmount) || 0;
                    const overLimit = assigned > alloc.balance;
                    return (
                      <tr
                        key={alloc.id}
                        className={`border-b hover:bg-gray-50/50 ${
                          alloc.checked ? "bg-blue-50/30" : ""
                        }`}
                      >
                        {!isReadOnly && (
                          <td className="py-3 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={alloc.checked}
                              onChange={(e) => handleCheckToggle(alloc.id, e.target.checked)}
                              className="h-4 w-4 rounded border-gray-300 accent-blue-600 cursor-pointer"
                            />
                          </td>
                        )}
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-gray-800">
                              {alloc.description}
                            </p>
                            {alloc.dueDate && (
                              <p className="text-xs text-gray-400">
                                Vence: {formatDate(alloc.dueDate)}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {formatCurrency(alloc.totalAmount)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-gray-500">
                          {formatCurrency(alloc.paid)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium">
                          {formatCurrency(alloc.balance)}
                        </td>
                        <td className="py-3 px-4">
                          {isReadOnly ? (
                            <Input
                              value={
                                assigned > 0
                                  ? assigned.toLocaleString("es-BO", {
                                      minimumFractionDigits: 2,
                                    })
                                  : "—"
                              }
                              readOnly
                              className="h-8 text-right bg-muted cursor-default font-mono"
                            />
                          ) : (
                            <Input
                              type="number"
                              min={0}
                              max={alloc.balance}
                              step={0.01}
                              value={alloc.assignedAmount}
                              onChange={(e) =>
                                updateAllocationAmount(alloc.id, e.target.value)
                              }
                              placeholder="0.00"
                              className={`h-8 text-right font-mono ${
                                overLimit
                                  ? "border-red-500 focus-visible:ring-red-500"
                                  : ""
                              }`}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Summary */}
                <tfoot>
                  <tr className="border-t bg-gray-50">
                    <td
                      colSpan={isReadOnly ? 4 : 5}
                      className="py-2 px-4 text-right text-sm text-gray-600"
                    >
                      Importe aplicado:
                    </td>
                    <td className="py-2 px-4 text-right font-mono font-medium">
                      {formatCurrency(totalAllocated)}
                    </td>
                  </tr>

                  {/* Credit balance row */}
                  {creditFromPayment > 0 && !isReadOnly && (
                    <tr className="bg-amber-50">
                      <td
                        colSpan={5}
                        className="py-2 px-4 text-right text-sm text-amber-700"
                      >
                        Importe a acreditar:
                      </td>
                      <td className="py-2 px-4 text-right font-mono text-amber-700 font-medium">
                        {formatCurrency(creditFromPayment)}
                      </td>
                    </tr>
                  )}

                  {/* Existing credit balance */}
                  {creditBalance > 0 && isNew && (
                    <tr className="bg-blue-50">
                      <td
                        colSpan={5}
                        className="py-2 px-4 text-right text-sm text-blue-700"
                      >
                        Saldo a favor existente del contacto:
                      </td>
                      <td className="py-2 px-4 text-right font-mono text-blue-700 font-medium">
                        {formatCurrency(creditBalance)}
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          )}

          {hasOverAllocation && (
            <p className="text-red-500 text-sm mt-2">
              Una o más asignaciones exceden el saldo disponible del documento.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Journal Entry reference (POSTED) */}
      {isPosted && existingPayment?.journalEntry && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="font-medium">Asiento Contable:</span>
              <span className="font-mono text-blue-600">
                {`#${existingPayment.journalEntry.number}`}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Link href={backHref}>
          <Button type="button" variant="outline">
            {isVoided ? "Volver" : "Cancelar"}
          </Button>
        </Link>

        {/* New mode — dual buttons */}
        {isNew && (
          <>
            <Button type="submit" variant="outline" disabled={!canSubmit || isSubmitting}>
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
              className="bg-green-600 hover:bg-green-700"
              onClick={handleCreateAndPost}
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Contabilizar
            </Button>
          </>
        )}

        {/* Draft actions */}
        {isDraft && (
          <>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
            >
              Eliminar
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handlePost}
              disabled={isPosting || !canSubmit}
            >
              {isPosting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Contabilizando...
                </>
              ) : (
                "Contabilizar"
              )}
            </Button>
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
          </>
        )}

        {/* LOCKED actions (admin/owner only) */}
        {isLocked && isAdminOrOwner && (
          <>
            <Button
              type="button"
              variant="destructive"
              onClick={() => { setPendingAction("void"); setShowJustification(true); }}
              disabled={isJustificationLoading}
            >
              {isJustificationLoading && pendingAction === "void" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Anular
            </Button>
            <Button
              type="button"
              onClick={() => { setPendingAction("save"); setShowJustification(true); }}
              disabled={!canSubmit || isJustificationLoading}
            >
              {isJustificationLoading && pendingAction === "save" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Guardar
            </Button>
          </>
        )}

        {/* Posted actions */}
        {isPosted && (
          <>
            <Button
              type="button"
              variant="destructive"
              onClick={handleVoid}
              disabled={isVoiding || isJustificationLoading}
            >
              {isVoiding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Anulando...
                </>
              ) : (
                "Anular"
              )}
            </Button>
            <Button
              type="button"
              onClick={() => { setPendingAction("save"); setShowJustification(true); }}
              disabled={!canSubmit || isJustificationLoading}
            >
              {isJustificationLoading && pendingAction === "save" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Guardar
            </Button>
          </>
        )}
      </div>

      {/* Justification Modal */}
      <JustificationModal
        isOpen={showJustification}
        onClose={() => { setShowJustification(false); setPendingAction(null); }}
        onConfirm={async (justification: string) => {
          if (pendingAction === "save" && isLocked) await handleLockedSave(justification);
          else if (pendingAction === "save" && isPosted) await handlePostedSave(justification);
          else if (pendingAction === "void") await handleLockedVoid(justification);
          setShowJustification(false);
          setPendingAction(null);
        }}
        isLoading={isJustificationLoading}
      />
    </form>
  );
}
