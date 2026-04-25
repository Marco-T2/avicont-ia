"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import VoucherStatusBadge from "@/components/common/voucher-status-badge";
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
import { Plus, Loader2, ArrowLeft, Trash2, Pencil, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import type { Contact, FiscalPeriod } from "@/generated/prisma/client";
import { evaluateExpression } from "@/lib/evaluate-expression";
import { useOrgRole } from "@/components/common/use-org-role";
import { JustificationModal } from "@/components/shared/justification-modal";
import { todayLocal, formatDateBO } from "@/lib/date-utils";
import { Gated } from "@/components/common/gated";

// ── Helpers ──

function formatKg(value: number): string {
  return value.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCurrency(amount: number): string {
  return `Bs. ${amount.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ── Rounding (client-side mirror of dispatch.utils.ts — no server-only deps) ──

function roundTotal(exactSum: number, threshold: number): number {
  const truncated = Math.floor(exactSum * 10) / 10;
  const firstDecimal = Math.round((truncated % 1) * 10);
  if (firstDecimal >= threshold * 10) {
    return Math.ceil(truncated);
  }
  return Math.floor(truncated);
}

// ── Auto-description builder (client-side mirror) ──

interface DescriptionLine {
  code?: string;
  detailNote?: string;
  netWeight: number;
  realNetWeight?: number;
  unitPrice: number;
}

function buildDispatchDescription(
  lines: DescriptionLine[],
  dispatchType: "NOTA_DESPACHO" | "BOLETA_CERRADA",
): string {
  return lines
    .filter((l) => l.code && l.netWeight > 0)
    .map((l) => {
      const weight =
        dispatchType === "BOLETA_CERRADA"
          ? (l.realNetWeight ?? l.netWeight)
          : l.netWeight;
      const prefix = l.detailNote
        ? `${l.code}-${l.detailNote}`
        : l.code;
      return `${prefix} ${weight.toFixed(1)}kg (${l.unitPrice})`;
    })
    .join(" | ");
}

// ── Line state ──

interface DetailLine {
  id: string;
  productTypeId: string;
  description: string; // auto-filled from product name
  detailNote: string;
  boxes: string;
  grossWeight: string; // string for arithmetic support
  unitPrice: string;   // string for arithmetic support
  shortage: string;    // BC only
}

let lineCounter = 0;
function nextLineId() {
  lineCounter += 1;
  return `line-${lineCounter}`;
}

function emptyLine(): DetailLine {
  return {
    id: nextLineId(),
    productTypeId: "",
    description: "",
    detailNote: "",
    boxes: "",
    grossWeight: "",
    unitPrice: "",
    shortage: "",
  };
}

// ── Computed line values ──

interface ComputedLine {
  tare: number;
  netWeight: number;
  shrinkage: number;
  realNetWeight: number;
  lineAmount: number;
}

function computeLine(
  line: DetailLine,
  dispatchType: "NOTA_DESPACHO" | "BOLETA_CERRADA",
  shrinkagePct: number,
): ComputedLine {
  const boxes = parseInt(line.boxes, 10) || 0;
  const grossWeight = parseFloat(line.grossWeight) || 0;
  const unitPrice = parseFloat(line.unitPrice) || 0;
  const shortage = parseFloat(line.shortage) || 0;

  const tare = boxes * 2;
  const netWeight = grossWeight - tare;

  if (dispatchType === "BOLETA_CERRADA") {
    const shrinkage = netWeight * (shrinkagePct / 100);
    const realNetWeight = netWeight - shrinkage - shortage;
    const lineAmount = Math.round(realNetWeight * unitPrice * 100) / 100;
    return { tare, netWeight, shrinkage, realNetWeight, lineAmount };
  }

  // NOTA_DESPACHO — raw 2-decimal rounding
  const lineAmount = Math.round(netWeight * unitPrice * 100) / 100;
  return { tare, netWeight, shrinkage: 0, realNetWeight: netWeight, lineAmount };
}

// ── Existing dispatch shape (from API) ──

interface ExistingDispatchDetail {
  id: string;
  productTypeId: string | null;
  productType?: { id: string; name: string; code: string } | null;
  detailNote: string | null;
  description: string;
  boxes: number;
  grossWeight: number;
  tare: number;
  netWeight: number;
  unitPrice: number;
  shrinkage: number | null;
  shortage: number | null;
  realNetWeight: number | null;
  lineAmount: number;
  order: number;
}

interface ExistingDispatch {
  id: string;
  dispatchType: "NOTA_DESPACHO" | "BOLETA_CERRADA";
  status: "DRAFT" | "POSTED" | "VOIDED" | "LOCKED";
  sequenceNumber: number;
  referenceNumber: number | null;
  displayCode: string;
  date: string;
  contactId: string;
  periodId: string;
  description: string;
  notes: string | null;
  totalAmount: number;
  farmOrigin: string | null;
  chickenCount: number | null;
  shrinkagePct: number | null;
  details: ExistingDispatchDetail[];
  contact: { id: string; name: string };
  receivable?: {
    id: string;
    amount: number;
    paid: number;
    balance: number;
    status: string;
    allocations: Array<{
      id: string;
      paymentId: string;
      amount: number;
      payment: {
        id: string;
        date: string;
        description: string;
      };
    }>;
  } | null;
}

// ── Props ──

interface ProductTypeOption {
  id: string;
  name: string;
  code: string;
}

interface DispatchFormProps {
  orgSlug: string;
  dispatchType: "NOTA_DESPACHO" | "BOLETA_CERRADA";
  contacts: Contact[];
  periods: FiscalPeriod[];
  productTypes: ProductTypeOption[];
  roundingThreshold: number;
  existingDispatch?: ExistingDispatch;
}

const DISPATCH_TYPE_LABEL: Record<string, string> = {
  NOTA_DESPACHO: "Nota de Despacho",
  BOLETA_CERRADA: "Boleta Cerrada",
};

export default function DispatchForm({
  orgSlug,
  dispatchType,
  contacts,
  periods,
  productTypes,
  roundingThreshold,
  existingDispatch,
}: DispatchFormProps) {
  const router = useRouter();
  const { role } = useOrgRole();
  const isBC = dispatchType === "BOLETA_CERRADA";
  const isEditMode = !!existingDispatch;
  const status = existingDispatch?.status ?? "DRAFT";
  const isAdminOrOwner = role === "admin" || role === "owner";
  const isLocked = status === "LOCKED";
  const isPosted = status === "POSTED";
  const isReadOnly = status === "VOIDED" || (isLocked && !isAdminOrOwner);
  const isVoided = status === "VOIDED";

  // ── Justification modal state ──
  const [showJustification, setShowJustification] = useState(false);
  const [pendingAction, setPendingAction] = useState<"save" | "void" | null>(null);
  const [isJustificationLoading, setIsJustificationLoading] = useState(false);

  // ── Initialize lines from existing dispatch ──
  function initLinesFromExisting(details: ExistingDispatchDetail[]): DetailLine[] {
    if (details.length === 0) return [emptyLine()];
    return details.map((d) => ({
      id: nextLineId(),
      productTypeId: d.productTypeId ?? "",
      description: d.productType?.name ?? d.description ?? "",
      detailNote: d.detailNote ?? "",
      boxes: String(d.boxes),
      grossWeight: String(d.grossWeight),
      unitPrice: String(d.unitPrice),
      shortage: d.shortage !== null && d.shortage !== 0 ? String(d.shortage) : "",
    }));
  }

  // ── Header state ──
  const [contactId, setContactId] = useState(existingDispatch?.contactId ?? "");
  const [periodId, setPeriodId] = useState(
    existingDispatch?.periodId ?? (periods[0]?.id ?? ""),
  );
  const [date, setDate] = useState(
    existingDispatch?.date
      ? new Date(existingDispatch.date).toISOString().split("T")[0]
      : todayLocal(),
  );
  const [referenceNumber, setReferenceNumber] = useState(
    existingDispatch?.referenceNumber !== null && existingDispatch?.referenceNumber !== undefined
      ? String(existingDispatch.referenceNumber)
      : "",
  );
  const [description, setDescription] = useState(existingDispatch?.description ?? "");
  const [descriptionOverride, setDescriptionOverride] = useState(!!existingDispatch);
  const [notes, setNotes] = useState(existingDispatch?.notes ?? "");

  // ── BC-only header state ──
  const [farmOrigin, setFarmOrigin] = useState(existingDispatch?.farmOrigin ?? "");
  const [chickenCount, setChickenCount] = useState(
    existingDispatch?.chickenCount !== null && existingDispatch?.chickenCount !== undefined
      ? String(existingDispatch.chickenCount)
      : "",
  );
  const [shrinkagePct, setShrinkagePct] = useState(
    existingDispatch?.shrinkagePct !== null && existingDispatch?.shrinkagePct !== undefined
      ? String(existingDispatch.shrinkagePct)
      : "0",
  );

  // ── Detail lines state ──
  const [lines, setLines] = useState<DetailLine[]>(
    existingDispatch ? initLinesFromExisting(existingDispatch.details) : [emptyLine()],
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isActioning, setIsActioning] = useState(false);

  // ── Computed values ──
  const shrinkagePctNum = parseFloat(shrinkagePct) || 0;
  const computedLines = lines.map((l) =>
    computeLine(l, dispatchType, shrinkagePctNum),
  );

  const totalGrossKg = lines.reduce(
    (s, l) => s + (parseFloat(l.grossWeight) || 0),
    0,
  );
  const totalNetKg = computedLines.reduce((s, c) => s + c.netWeight, 0);
  const totalShrinkKg = computedLines.reduce((s, c) => s + c.shrinkage, 0);
  const totalShortageKg = lines.reduce(
    (s, l) => s + (parseFloat(l.shortage) || 0),
    0,
  );
  const totalRealNetKg = computedLines.reduce((s, c) => s + c.realNetWeight, 0);
  const subtotal = computedLines.reduce((s, c) => s + c.lineAmount, 0);
  const totalCxC = roundTotal(subtotal, roundingThreshold);

  const chickenCountNum = parseInt(chickenCount, 10) || 0;
  const avgKgPerChicken =
    isBC && chickenCountNum > 0 ? totalNetKg / chickenCountNum : null;

  // ── Auto-description rebuild ──
  const rebuildDescription = useCallback(
    (updatedLines: DetailLine[], updatedComputedLines: ComputedLine[]) => {
      if (descriptionOverride) return;
      const productMap = new Map(productTypes.map((p) => [p.id, p]));
      const descLines: DescriptionLine[] = updatedLines.map((l, i) => {
        const pt = productMap.get(l.productTypeId);
        const computed = updatedComputedLines[i];
        return {
          code: pt?.code,
          detailNote: l.detailNote || undefined,
          netWeight: computed.netWeight,
          realNetWeight: computed.realNetWeight,
          unitPrice: parseFloat(l.unitPrice) || 0,
        };
      });
      const autoDesc = buildDispatchDescription(descLines, dispatchType);
      setDescription(autoDesc);
    },
    [descriptionOverride, productTypes, dispatchType],
  );

  // ── Line handlers ──

  function addLine() {
    if (isReadOnly) return;
    setLines((prev) => {
      const next = [...prev, emptyLine()];
      const nextComputed = next.map((l) =>
        computeLine(l, dispatchType, shrinkagePctNum),
      );
      rebuildDescription(next, nextComputed);
      return next;
    });
  }

  function removeLine(id: string) {
    if (isReadOnly) return;
    if (lines.length <= 1) {
      toast.error("El despacho debe tener al menos una línea");
      return;
    }
    setLines((prev) => {
      const next = prev.filter((l) => l.id !== id);
      const nextComputed = next.map((l) =>
        computeLine(l, dispatchType, shrinkagePctNum),
      );
      rebuildDescription(next, nextComputed);
      return next;
    });
  }

  function updateLine(id: string, field: keyof DetailLine, value: string) {
    if (isReadOnly) return;
    setLines((prev) => {
      const next = prev.map((l) => {
        if (l.id !== id) return l;
        // Auto-fill description from product name when productTypeId changes
        if (field === "productTypeId") {
          const pt = productTypes.find((p) => p.id === value);
          return { ...l, productTypeId: value, description: pt?.name ?? "" };
        }
        return { ...l, [field]: value };
      });
      const nextComputed = next.map((l) =>
        computeLine(l, dispatchType, shrinkagePctNum),
      );
      rebuildDescription(next, nextComputed);
      return next;
    });
  }

  // ── Arithmetic blur handler ──

  function handleArithmeticBlur(
    id: string,
    field: "grossWeight" | "unitPrice",
    value: string,
  ) {
    if (!value.trim()) return;
    const result = evaluateExpression(value);
    if (result !== null) {
      updateLine(id, field, String(result));
    } else {
      toast.error("Expresión inválida");
    }
  }

  // ── Submit (Create or Update) ──

  const canSubmit =
    contactId &&
    periodId &&
    date &&
    lines.length > 0 &&
    lines.every(
      (l) =>
        l.productTypeId &&
        parseInt(l.boxes, 10) > 0 &&
        parseFloat(l.grossWeight) > 0 &&
        parseFloat(l.unitPrice) > 0,
    );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || isReadOnly || isPosted || isLocked) return;
    setIsSubmitting(true);

    try {
      const detailPayload = lines.map((line, i) => ({
        productTypeId: line.productTypeId || undefined,
        description: line.description,
        detailNote: line.detailNote || undefined,
        boxes: parseInt(line.boxes, 10),
        grossWeight: parseFloat(line.grossWeight),
        unitPrice: parseFloat(line.unitPrice),
        shortage: isBC && line.shortage ? parseFloat(line.shortage) : undefined,
        order: i,
      }));

      if (isEditMode && existingDispatch) {
        // PATCH — update existing draft
        const body = {
          date,
          contactId,
          description: description.trim(),
          referenceNumber: referenceNumber ? parseInt(referenceNumber, 10) : undefined,
          notes: notes.trim() || undefined,
          farmOrigin: isBC ? (farmOrigin.trim() || undefined) : undefined,
          chickenCount: isBC && chickenCount ? parseInt(chickenCount, 10) : undefined,
          shrinkagePct: isBC ? shrinkagePctNum : undefined,
          details: detailPayload,
        };

        const response = await fetch(
          `/api/organizations/${orgSlug}/dispatches/${existingDispatch.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? "Error al actualizar el despacho");
        }

        toast.success("Despacho actualizado");
        router.refresh();
      } else {
        // POST — create new
        const body = {
          dispatchType,
          date,
          contactId,
          periodId,
          description: description.trim(),
          referenceNumber: referenceNumber ? parseInt(referenceNumber, 10) : undefined,
          notes: notes.trim() || undefined,
          farmOrigin: isBC ? (farmOrigin.trim() || undefined) : undefined,
          chickenCount: isBC && chickenCount ? parseInt(chickenCount, 10) : undefined,
          shrinkagePct: isBC ? shrinkagePctNum : undefined,
          details: detailPayload,
        };

        const response = await fetch(`/api/organizations/${orgSlug}/dispatches`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? "Error al guardar el despacho");
        }

        toast.success("Despacho guardado como borrador");
        router.push(`/${orgSlug}/dispatches`);
        router.refresh();
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al guardar el despacho",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Status action handlers ──

  async function handlePost() {
    if (!existingDispatch) return;
    if (!window.confirm("¿Contabilizar este despacho? Esta acción generará el asiento contable y la cuenta por cobrar.")) return;
    setIsActioning(true);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/dispatches/${existingDispatch.id}/status`,
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
      toast.success("Despacho contabilizado exitosamente");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al contabilizar");
    } finally {
      setIsActioning(false);
    }
  }

  async function handleVoid() {
    if (!existingDispatch) return;
    if (!window.confirm("¿Anular este despacho? Se revertirá el asiento contable y la cuenta por cobrar. Esta acción no se puede deshacer.")) return;
    setIsActioning(true);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/dispatches/${existingDispatch.id}/status`,
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
      toast.success("Despacho anulado");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al anular");
    } finally {
      setIsActioning(false);
    }
  }



  async function handleDelete() {
    if (!existingDispatch) return;
    if (!window.confirm("¿Eliminar este borrador? Esta acción no se puede deshacer.")) return;
    setIsActioning(true);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/dispatches/${existingDispatch.id}`,
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

  // ── Create and Post (atomic POSTED creation) ──

  async function handleCreateAndPost() {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const detailPayload = lines.map((line, i) => ({
        productTypeId: line.productTypeId || undefined,
        description: line.description,
        detailNote: line.detailNote || undefined,
        boxes: parseInt(line.boxes, 10),
        grossWeight: parseFloat(line.grossWeight),
        unitPrice: parseFloat(line.unitPrice),
        shortage: isBC && line.shortage ? parseFloat(line.shortage) : undefined,
        order: i,
      }));

      const body = {
        dispatchType,
        date,
        contactId,
        periodId,
        description: description.trim(),
        referenceNumber: referenceNumber ? parseInt(referenceNumber, 10) : undefined,
        notes: notes.trim() || undefined,
        farmOrigin: isBC ? (farmOrigin.trim() || undefined) : undefined,
        chickenCount: isBC && chickenCount ? parseInt(chickenCount, 10) : undefined,
        shrinkagePct: isBC ? shrinkagePctNum : undefined,
        details: detailPayload,
        postImmediately: true,
      };

      const response = await fetch(`/api/organizations/${orgSlug}/dispatches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al contabilizar el despacho");
      }

      toast.success("Despacho contabilizado");
      router.push(`/${orgSlug}/dispatches`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al contabilizar el despacho");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── LOCKED edit handlers ──

  async function handleLockedSave(justification: string) {
    if (!existingDispatch) return;
    setIsJustificationLoading(true);
    try {
      const detailPayload = lines.map((line, i) => ({
        productTypeId: line.productTypeId || undefined,
        description: line.description,
        detailNote: line.detailNote || undefined,
        boxes: parseInt(line.boxes, 10),
        grossWeight: parseFloat(line.grossWeight),
        unitPrice: parseFloat(line.unitPrice),
        shortage: isBC && line.shortage ? parseFloat(line.shortage) : undefined,
        order: i,
      }));

      const body = {
        date,
        contactId,
        description: description.trim(),
        referenceNumber: referenceNumber ? parseInt(referenceNumber, 10) : undefined,
        notes: notes.trim() || undefined,
        farmOrigin: isBC ? (farmOrigin.trim() || undefined) : undefined,
        chickenCount: isBC && chickenCount ? parseInt(chickenCount, 10) : undefined,
        shrinkagePct: isBC ? shrinkagePctNum : undefined,
        details: detailPayload,
        justification,
      };

      const response = await fetch(
        `/api/organizations/${orgSlug}/dispatches/${existingDispatch.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al guardar el despacho bloqueado");
      }

      toast.success("Despacho actualizado");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar el despacho bloqueado");
    } finally {
      setIsJustificationLoading(false);
    }
  }

  async function handleLockedVoid(justification: string) {
    if (!existingDispatch) return;
    setIsJustificationLoading(true);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/dispatches/${existingDispatch.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "VOIDED", justification }),
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al anular el despacho bloqueado");
      }

      toast.success("Despacho anulado");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al anular el despacho bloqueado");
    } finally {
      setIsJustificationLoading(false);
    }
  }

  const backHref = `/${orgSlug}/dispatches`;

  // ── Title ──
  const headerTitle = isEditMode
    ? `${existingDispatch.displayCode} — ${DISPATCH_TYPE_LABEL[dispatchType]}`
    : `Nuevo ${DISPATCH_TYPE_LABEL[dispatchType]}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Link href={backHref}>
        <Button type="button" variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver a Despachos
        </Button>
      </Link>

      {/* Header fields */}
      <Card className={isVoided ? "opacity-70" : undefined}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{headerTitle}</CardTitle>
            {isEditMode && <VoucherStatusBadge status={status} />}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isReadOnly && isEditMode ? (
            <>
              {/* ── Compact read-only header ── */}
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">Tipo</dt>
                  <dd className="font-medium mt-0.5">{DISPATCH_TYPE_LABEL[dispatchType]}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Nro. Referencia</dt>
                  <dd className="font-medium mt-0.5 font-mono">
                    {existingDispatch.referenceNumber ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Fecha</dt>
                  <dd className="font-medium mt-0.5">
                    {formatDateBO(existingDispatch.date)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Período</dt>
                  <dd className="font-medium mt-0.5">
                    {periods.find((p) => p.id === existingDispatch.periodId)?.name ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Cliente</dt>
                  <dd className="font-medium mt-0.5">{existingDispatch.contact.name}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Total</dt>
                  <dd className="font-medium mt-0.5 font-mono font-bold">
                    {formatCurrency(existingDispatch.totalAmount)}
                  </dd>
                </div>
                {existingDispatch.notes && (
                  <div className="col-span-2 sm:col-span-4">
                    <dt className="text-muted-foreground">Notas</dt>
                    <dd className="mt-0.5 text-foreground/80">{existingDispatch.notes}</dd>
                  </div>
                )}
                {existingDispatch.description && (
                  <div className="col-span-2 sm:col-span-4">
                    <dt className="text-muted-foreground">Descripción</dt>
                    <dd className="mt-0.5 text-xs text-muted-foreground">{existingDispatch.description}</dd>
                  </div>
                )}
              </dl>

              {/* BC-only fields in compact mode */}
              {isBC && (
                <div className="border-t pt-4">
                  <p className="text-xs font-medium text-muted-foreground mb-3">
                    Campos de Boleta Cerrada
                  </p>
                  <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 text-sm">
                    <div>
                      <dt className="text-muted-foreground">Granja</dt>
                      <dd className="font-medium mt-0.5">{existingDispatch.farmOrigin ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">N° Pollos</dt>
                      <dd className="font-medium mt-0.5">{existingDispatch.chickenCount ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Merma General %</dt>
                      <dd className="font-medium mt-0.5">{existingDispatch.shrinkagePct ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Promedio kg/pollo</dt>
                      <dd className="font-medium mt-0.5">
                        {avgKgPerChicken !== null ? avgKgPerChicken.toFixed(2) : "—"}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}
            </>
          ) : (
            <>
              {/* ── Editable form grid ── */}
              {/* Row 1: Tipo / Nro. Referencia / Fecha / Período (4 cols) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Tipo (readonly) */}
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Input
                    value={DISPATCH_TYPE_LABEL[dispatchType]}
                    readOnly
                    className="bg-muted cursor-default"
                  />
                </div>

                {/* Nro. Referencia */}
                <div className="space-y-2">
                  <Label htmlFor="reference-number">Nro. Referencia (opcional)</Label>
                  <Input
                    id="reference-number"
                    type="number"
                    min={1}
                    step={1}
                    placeholder="Ej: 738"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    readOnly={isReadOnly}
                    className={isReadOnly ? "bg-muted cursor-default" : undefined}
                  />
                </div>

                {/* Fecha */}
                <div className="space-y-2">
                  <Label htmlFor="dispatch-date">Fecha</Label>
                  <Input
                    id="dispatch-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    readOnly={isReadOnly}
                    className={isReadOnly ? "bg-muted cursor-default" : undefined}
                    required
                  />
                </div>

                {/* Período */}
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
              </div>

              {/* Row 2: Cliente / Total (2 cols) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Cliente */}
                <div className="space-y-2">
                  <Label htmlFor="contact">Cliente</Label>
                  {isReadOnly ? (
                    <Input
                      value={existingDispatch?.contact?.name ?? "—"}
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

                {/* Total (only for existing dispatches) */}
                {isEditMode && status !== "DRAFT" && (
                  <div className="space-y-2">
                    <Label>Total</Label>
                    <Input
                      value={formatCurrency(existingDispatch.totalAmount)}
                      readOnly
                      className="bg-muted cursor-default font-mono font-bold"
                    />
                  </div>
                )}
              </div>

              {/* Row 3: Descripción auto-generada */}
              <div className="grid grid-cols-1 gap-4">
                {/* Descripción auto-generada */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="dispatch-description">Descripción</Label>
                    {!isReadOnly && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-muted-foreground"
                        onClick={() => setDescriptionOverride((prev) => !prev)}
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        {descriptionOverride ? "Auto" : "Editar"}
                      </Button>
                    )}
                  </div>
                  <Input
                    id="dispatch-description"
                    placeholder="Se genera automáticamente"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    readOnly={isReadOnly || !descriptionOverride}
                    className={
                      isReadOnly || !descriptionOverride
                        ? "bg-muted cursor-default text-xs"
                        : "text-xs"
                    }
                  />
                </div>
              </div>

              {/* BC-only header fields */}
              {isBC && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium text-muted-foreground mb-3">
                    Campos de Boleta Cerrada
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="farm-origin">Granja</Label>
                      <Input
                        id="farm-origin"
                        placeholder="Nombre de la granja"
                        value={farmOrigin}
                        onChange={(e) => setFarmOrigin(e.target.value)}
                        readOnly={isReadOnly}
                        className={isReadOnly ? "bg-muted cursor-default" : undefined}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="chicken-count">N° Pollos</Label>
                      <Input
                        id="chicken-count"
                        type="number"
                        min={1}
                        step={1}
                        placeholder="Ej: 500"
                        value={chickenCount}
                        onChange={(e) => setChickenCount(e.target.value)}
                        readOnly={isReadOnly}
                        className={isReadOnly ? "bg-muted cursor-default" : undefined}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shrinkage-pct">Merma General %</Label>
                      <Input
                        id="shrinkage-pct"
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        placeholder="Ej: 2.5"
                        value={shrinkagePct}
                        onChange={(e) => setShrinkagePct(e.target.value)}
                        readOnly={isReadOnly}
                        className={isReadOnly ? "bg-muted cursor-default" : undefined}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="avg-kg">Promedio kg/pollo</Label>
                      <Input
                        id="avg-kg"
                        readOnly
                        className="bg-muted cursor-default"
                        value={avgKgPerChicken !== null ? avgKgPerChicken.toFixed(2) : "—"}
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail lines */}
      <Card className={isVoided ? "opacity-70" : undefined}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Líneas de Detalle</CardTitle>
            {!isReadOnly && (
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
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
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground w-6">#</th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground min-w-36">
                    Producto
                  </th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground min-w-28">
                    Detalle
                  </th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground w-20">
                    Cajas
                  </th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground w-28">
                    P. Bruto
                  </th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground w-24">
                    Tara
                  </th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground w-28">
                    P. Neto
                  </th>
                  {isBC && (
                    <>
                      <th className="text-right py-3 px-2 font-medium text-muted-foreground w-28">
                        Merma
                      </th>
                      <th className="text-right py-3 px-2 font-medium text-muted-foreground w-28">
                        Faltante
                      </th>
                      <th className="text-right py-3 px-2 font-medium text-muted-foreground w-28">
                        Neto Real
                      </th>
                    </>
                  )}
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground w-28">
                    Precio
                  </th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground w-28">
                    Subtotal
                  </th>
                  {!isReadOnly && <th className="w-10" />}
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => {
                  const computed = computedLines[idx];
                  return (
                    <tr key={line.id} className="border-b hover:bg-accent/50">
                      <td className="py-2 px-2 text-muted-foreground text-xs">{idx + 1}</td>

                      {/* Producto (Select) */}
                      <td className="py-2 px-2">
                        {isReadOnly ? (
                          <Input
                            value={productTypes.find((p) => p.id === line.productTypeId)?.name ?? line.description ?? "—"}
                            readOnly
                            className="h-8 min-w-32 bg-muted cursor-default"
                          />
                        ) : (
                          <Select
                            value={line.productTypeId}
                            onValueChange={(v) =>
                              updateLine(line.id, "productTypeId", v)
                            }
                          >
                            <SelectTrigger className="h-8 min-w-32">
                              <SelectValue placeholder="Producto" />
                            </SelectTrigger>
                            <SelectContent>
                              {productTypes.map((pt) => (
                                <SelectItem key={pt.id} value={pt.id}>
                                  {pt.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </td>

                      {/* Detalle / nota */}
                      <td className="py-2 px-2">
                        <Input
                          value={line.detailNote}
                          onChange={(e) =>
                            updateLine(line.id, "detailNote", e.target.value)
                          }
                          placeholder={isReadOnly ? "—" : "Obs. / detalle"}
                          maxLength={200}
                          className={`h-8 min-w-24 ${isReadOnly ? "bg-muted cursor-default" : ""}`}
                          readOnly={isReadOnly}
                        />
                      </td>

                      {/* Cajas */}
                      <td className="py-2 px-2">
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          value={line.boxes}
                          onChange={(e) =>
                            updateLine(line.id, "boxes", e.target.value)
                          }
                          placeholder="0"
                          className={`h-8 text-right ${isReadOnly ? "bg-muted cursor-default" : ""}`}
                          readOnly={isReadOnly}
                        />
                      </td>

                      {/* Peso Bruto — arithmetic */}
                      <td className="py-2 px-2">
                        <Input
                          type="text"
                          value={line.grossWeight}
                          onChange={(e) =>
                            updateLine(line.id, "grossWeight", e.target.value)
                          }
                          onBlur={(e) =>
                            !isReadOnly && handleArithmeticBlur(line.id, "grossWeight", e.target.value)
                          }
                          placeholder="0.00"
                          className={`h-8 text-right ${isReadOnly ? "bg-muted cursor-default" : ""}`}
                          readOnly={isReadOnly}
                        />
                      </td>

                      {/* Tara (computed) */}
                      <td className="py-2 px-2">
                        <Input
                          value={computed.tare > 0 ? formatKg(computed.tare) : ""}
                          readOnly
                          className="h-8 text-right bg-muted cursor-default"
                          placeholder="—"
                        />
                      </td>

                      {/* Peso Neto (computed) */}
                      <td className="py-2 px-2">
                        <Input
                          value={computed.netWeight !== 0 ? formatKg(computed.netWeight) : ""}
                          readOnly
                          className="h-8 text-right bg-muted cursor-default"
                          placeholder="—"
                        />
                      </td>

                      {/* BC-only columns */}
                      {isBC && (
                        <>
                          {/* Merma (computed) */}
                          <td className="py-2 px-2">
                            <Input
                              value={
                                computed.shrinkage !== 0
                                  ? formatKg(computed.shrinkage)
                                  : ""
                              }
                              readOnly
                              className="h-8 text-right bg-muted cursor-default"
                              placeholder="—"
                            />
                          </td>

                          {/* Faltante (manual) */}
                          <td className="py-2 px-2">
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              value={line.shortage}
                              onChange={(e) =>
                                updateLine(line.id, "shortage", e.target.value)
                              }
                              placeholder="0.00"
                              className={`h-8 text-right ${isReadOnly ? "bg-muted cursor-default" : ""}`}
                              readOnly={isReadOnly}
                            />
                          </td>

                          {/* Neto Real (computed) */}
                          <td className="py-2 px-2">
                            <Input
                              value={
                                computed.realNetWeight !== 0
                                  ? formatKg(computed.realNetWeight)
                                  : ""
                              }
                              readOnly
                              className="h-8 text-right bg-muted cursor-default"
                              placeholder="—"
                            />
                          </td>
                        </>
                      )}

                      {/* Precio — arithmetic */}
                      <td className="py-2 px-2">
                        <Input
                          type="text"
                          value={line.unitPrice}
                          onChange={(e) =>
                            updateLine(line.id, "unitPrice", e.target.value)
                          }
                          onBlur={(e) =>
                            !isReadOnly && handleArithmeticBlur(line.id, "unitPrice", e.target.value)
                          }
                          placeholder="0.00"
                          className={`h-8 text-right ${isReadOnly ? "bg-muted cursor-default" : ""}`}
                          readOnly={isReadOnly}
                        />
                      </td>

                      {/* Subtotal de línea (computed) */}
                      <td className="py-2 px-2">
                        <Input
                          value={
                            computed.lineAmount !== 0
                              ? computed.lineAmount.toLocaleString("es-BO", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })
                              : ""
                          }
                          readOnly
                          className="h-8 text-right bg-muted cursor-default font-mono"
                          placeholder="—"
                        />
                      </td>

                      {/* Delete button */}
                      {!isReadOnly && (
                        <td className="py-2 px-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeLine(line.id)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>

              {/* Summary totals */}
              <tfoot>
                {isBC && (
                  <>
                    <tr className="border-t bg-muted/50 text-xs text-muted-foreground">
                      <td colSpan={4} className="py-2 px-2 text-right font-medium">
                        Totales:
                      </td>
                      <td className="py-2 px-2 text-right font-mono">
                        {formatKg(totalGrossKg)}
                      </td>
                      <td />
                      <td className="py-2 px-2 text-right font-mono">
                        {formatKg(totalNetKg)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono">
                        {formatKg(totalShrinkKg)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono">
                        {formatKg(totalShortageKg)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono">
                        {formatKg(totalRealNetKg)}
                      </td>
                      <td />
                      <td />
                      {!isReadOnly && <td />}
                    </tr>
                    {avgKgPerChicken !== null && (
                      <tr className="bg-muted/50 text-xs text-muted-foreground">
                        <td colSpan={6} className="py-1 px-2 text-right">
                          Promedio kg/pollo:
                        </td>
                        <td className="py-1 px-2 text-right font-mono text-foreground">
                          {formatKg(avgKgPerChicken)}
                        </td>
                        <td colSpan={isReadOnly ? 5 : 6} />
                      </tr>
                    )}
                  </>
                )}

                {/* Subtotal row */}
                <tr className="border-t bg-muted/50">
                  <td
                    colSpan={isBC ? 11 : 8}
                    className="py-2 px-2 text-right text-xs text-muted-foreground"
                  >
                    Subtotal (exacto):
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-sm text-foreground">
                    {formatCurrency(subtotal)}
                  </td>
                  {!isReadOnly && <td />}
                </tr>

                {/* Total CxC row */}
                <tr className="border-t-2 border-border bg-muted">
                  <td
                    colSpan={isBC ? 11 : 8}
                    className="py-3 px-2 text-right font-semibold text-foreground"
                  >
                    Total CxC (Bs.)
                  </td>
                  <td className="py-3 px-2 text-right font-mono font-bold text-foreground text-base">
                    {totalCxC.toLocaleString("es-BO")}
                  </td>
                  {!isReadOnly && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Fila inferior: Notas (izq) + Resumen de Cobros (der) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="bottom-row-dispatch">
        {/* Notas — siempre visible en slot izquierdo */}
        <div className="space-y-2">
          <Label htmlFor="dispatch-notes">Notas (opcional)</Label>
          <Textarea
            id="dispatch-notes"
            placeholder="Observaciones adicionales..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            readOnly={isReadOnly}
            className={isReadOnly ? "bg-muted cursor-default" : undefined}
          />
        </div>

        {/* Resumen de Cobros — slot derecho, solo cuando hay receivable */}
        {existingDispatch?.receivable != null &&
        (status === "POSTED" || status === "LOCKED") ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumen de Cobros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-1 w-full text-sm">
                <div className="flex justify-between items-start gap-4 border-b pb-2 font-semibold">
                  <span>Total CxC (Bs.)</span>
                  <span className="font-mono text-right">
                    {totalCxC.toLocaleString("es-BO")}
                  </span>
                </div>
                {existingDispatch.receivable.allocations.map((alloc) => (
                  <div
                    key={alloc.id}
                    className="flex justify-between items-start gap-4 text-muted-foreground py-1"
                  >
                    <Link
                      href={`/${orgSlug}/payments/${alloc.paymentId}`}
                      className="underline underline-offset-2 hover:text-foreground transition-colors"
                    >
                      Pago el{" "}
                      {formatDateBO(alloc.payment.date)}
                    </Link>
                    <span className="font-mono text-success text-right whitespace-nowrap">
                      -{formatCurrency(alloc.amount)}
                    </span>
                  </div>
                ))}
                <div
                  className={`flex justify-between items-start gap-4 border-t-2 pt-2 font-bold ${
                    existingDispatch.receivable.balance > 0
                      ? "text-destructive"
                      : "text-success"
                  }`}
                >
                  <span className="text-foreground">Saldo pendiente</span>
                  <span className="font-mono text-right">
                    {formatCurrency(existingDispatch.receivable.balance)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div />
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-between gap-3">
        <div className="flex gap-3">
          {/* Destructive actions on the left */}
          {isEditMode && status === "DRAFT" && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isActioning}
            >
              {isActioning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Eliminar
            </Button>
          )}
        </div>

        <div className="flex gap-3">
          <Link href={backHref}>
            <Button type="button" variant="outline">
              {isReadOnly && !isLocked ? "Volver" : "Cancelar"}
            </Button>
          </Link>

          <Gated resource="dispatches" action="write">
            {/* CREATE mode — dual buttons */}
            {!isEditMode && (
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
                  className="bg-success hover:bg-success/90 text-success-foreground"
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

            {/* DRAFT edit actions */}
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
                  variant="default"
                  className="bg-success hover:bg-success/90 text-success-foreground"
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

            {/* LOCKED edit actions (admin/owner only) */}
            {isEditMode && isLocked && isAdminOrOwner && (
              <>
                <Button
                  type="button"
                  onClick={() => { setPendingAction("void"); setShowJustification(true); }}
                  variant="destructive"
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

            {/* POSTED actions */}
            {isEditMode && isPosted && (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleVoid}
                  disabled={isActioning}
                >
                  {isActioning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                  Anular
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setPendingAction("save");
                    setShowJustification(true);
                  }}
                  disabled={!canSubmit || isJustificationLoading}
                >
                  {isJustificationLoading && pendingAction === "save" ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Guardar
                </Button>
              </>
            )}
          </Gated>

          {/* VOIDED — no actions */}
        </div>
      </div>

      {/* Justification Modal */}
      <JustificationModal
        isOpen={showJustification}
        onClose={() => { setShowJustification(false); setPendingAction(null); }}
        onConfirm={async (justification: string) => {
          if (pendingAction === "save") await handleLockedSave(justification);
          else if (pendingAction === "void") await handleLockedVoid(justification);
          setShowJustification(false);
          setPendingAction(null);
        }}
        isLoading={isJustificationLoading}
      />
    </form>
  );
}
