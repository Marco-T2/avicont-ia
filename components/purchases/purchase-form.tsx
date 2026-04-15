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
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import type { Contact, FiscalPeriod } from "@/generated/prisma/client";
import { evaluateExpression } from "@/lib/evaluate-expression";
import { useOrgRole } from "@/components/common/use-org-role";
import type { PurchaseWithDetails } from "@/features/purchase";
import { IvaBookPurchaseModal } from "@/components/iva-books/iva-book-purchase-modal";

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

// ── Status badge config ──

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Borrador", className: "bg-amber-100 text-amber-800" },
  POSTED: { label: "Contabilizado", className: "bg-green-100 text-green-800" },
  VOIDED: { label: "Anulado", className: "bg-red-100 text-red-700" },
  LOCKED: { label: "Bloqueado", className: "bg-blue-100 text-blue-800 border-blue-300" },
};

const PURCHASE_TYPE_LABEL: Record<string, string> = {
  FLETE: "Flete",
  POLLO_FAENADO: "Pollo Faenado",
  COMPRA_GENERAL: "Compra General",
  SERVICIO: "Servicio",
};

// ── Detail line interfaces ──

interface FleteDetailLine {
  id: string;
  fecha: string;
  docRef: string;
  description: string;
  chickenQty: string;
  pricePerChicken: string;
}

interface PfDetailLine {
  id: string;
  productTypeId: string;
  description: string;
  detailNote: string;
  boxes: string;
  grossWeight: string;
  unitPrice: string;
  shortage: string;
}

interface GeneralDetailLine {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  expenseAccountCode: string;
}

// ── Computed values for PF lines ──

interface ComputedPfLine {
  tare: number;
  netWeight: number;
  shrinkage: number;
  realNetWeight: number;
  lineAmount: number;
}

function computePfLine(line: PfDetailLine, shrinkagePct: number): ComputedPfLine {
  const boxes = parseInt(line.boxes, 10) || 0;
  const grossWeight = parseFloat(line.grossWeight) || 0;
  const unitPrice = parseFloat(line.unitPrice) || 0;
  const shortage = parseFloat(line.shortage) || 0;

  const tare = boxes * 2;
  const netWeight = grossWeight - tare;
  const shrinkage = netWeight * (shrinkagePct / 100);
  const realNetWeight = netWeight - shrinkage - shortage;
  const lineAmount = Math.round(realNetWeight * unitPrice * 100) / 100;

  return { tare, netWeight, shrinkage, realNetWeight, lineAmount };
}

// ── Counter for unique line IDs ──

let lineCounter = 0;
function nextLineId() {
  lineCounter += 1;
  return `line-${lineCounter}`;
}

function emptyFleteeLine(): FleteDetailLine {
  return { id: nextLineId(), fecha: "", docRef: "", description: "", chickenQty: "", pricePerChicken: "" };
}

function emptyPfLine(): PfDetailLine {
  return { id: nextLineId(), productTypeId: "", description: "", detailNote: "", boxes: "", grossWeight: "", unitPrice: "", shortage: "" };
}

function emptyGeneralLine(): GeneralDetailLine {
  return { id: nextLineId(), description: "", quantity: "1", unitPrice: "", expenseAccountCode: "" };
}

// ── Props ──

interface ProductTypeOption {
  id: string;
  name: string;
  code: string;
}

interface PurchaseFormProps {
  orgSlug: string;
  purchaseType: "FLETE" | "POLLO_FAENADO" | "COMPRA_GENERAL" | "SERVICIO";
  contacts: Contact[];
  periods: FiscalPeriod[];
  productTypes: ProductTypeOption[];
  purchase?: PurchaseWithDetails;
  mode: "new" | "edit";
}

export default function PurchaseForm({
  orgSlug,
  purchaseType,
  contacts,
  periods,
  productTypes,
  purchase,
  mode,
}: PurchaseFormProps) {
  const router = useRouter();
  const { role } = useOrgRole();
  const isEditMode = mode === "edit";
  const status = purchase?.status ?? "DRAFT";
  const isAdminOrOwner = role === "admin" || role === "owner";
  const isLocked = status === "LOCKED";
  const isPosted = status === "POSTED";
  const isVoided = status === "VOIDED";
  const isReadOnly = isVoided || (isLocked && !isAdminOrOwner);
  const canEdit = !isReadOnly && (status === "DRAFT" || isPosted || (isLocked && isAdminOrOwner));

  // ── Header state ──
  const [contactId, setContactId] = useState(purchase?.contactId ?? "");
  const [periodId, setPeriodId] = useState(purchase?.periodId ?? (periods[0]?.id ?? ""));
  const [date, setDate] = useState(
    purchase?.date
      ? new Date(purchase.date).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
  );
  const [referenceNumber, setReferenceNumber] = useState(
    purchase?.referenceNumber != null ? String(purchase.referenceNumber) : "",
  );
  const [description, setDescription] = useState(purchase?.description ?? "");
  const [notes, setNotes] = useState(purchase?.notes ?? "");

  // ── FLETE extra ──
  const [ruta, setRuta] = useState(purchase?.ruta ?? "");

  // ── POLLO_FAENADO extra ──
  const [farmOrigin, setFarmOrigin] = useState(purchase?.farmOrigin ?? "");
  const [chickenCount, setChickenCount] = useState(
    purchase?.chickenCount != null ? String(purchase.chickenCount) : "",
  );
  const [shrinkagePct, setShrinkagePct] = useState(
    purchase?.shrinkagePct != null ? String(purchase.shrinkagePct) : "0",
  );

  // ── Detail lines state ──
  const [fleteLines, setFleteLines] = useState<FleteDetailLine[]>(() => {
    if (purchaseType !== "FLETE") return [];
    if (purchase?.details && purchase.details.length > 0) {
      return purchase.details.map((d) => ({
        id: nextLineId(),
        fecha: d.fecha ? new Date(d.fecha).toISOString().split("T")[0] : "",
        docRef: d.docRef ?? "",
        description: d.description ?? "",
        chickenQty: d.chickenQty != null ? String(d.chickenQty) : "",
        pricePerChicken: d.pricePerChicken != null ? String(d.pricePerChicken) : "",
      }));
    }
    return [emptyFleteeLine()];
  });

  const [pfLines, setPfLines] = useState<PfDetailLine[]>(() => {
    if (purchaseType !== "POLLO_FAENADO") return [];
    if (purchase?.details && purchase.details.length > 0) {
      return purchase.details.map((d) => ({
        id: nextLineId(),
        productTypeId: d.productTypeId ?? "",
        description: d.description ?? "",
        detailNote: d.detailNote ?? "",
        boxes: d.boxes != null ? String(d.boxes) : "",
        grossWeight: d.grossWeight != null ? String(d.grossWeight) : "",
        unitPrice: d.unitPrice != null ? String(d.unitPrice) : "",
        shortage: d.shortage != null && d.shortage !== 0 ? String(d.shortage) : "",
      }));
    }
    return [emptyPfLine()];
  });

  const [generalLines, setGeneralLines] = useState<GeneralDetailLine[]>(() => {
    if (purchaseType !== "COMPRA_GENERAL" && purchaseType !== "SERVICIO") return [];
    if (purchase?.details && purchase.details.length > 0) {
      return purchase.details.map((d) => ({
        id: nextLineId(),
        description: d.description ?? "",
        quantity: d.quantity != null ? String(d.quantity) : "1",
        unitPrice: d.unitPrice != null ? String(d.unitPrice) : "",
        expenseAccountCode: d.expenseAccountId ?? "",
      }));
    }
    return [emptyGeneralLine()];
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isActioning, setIsActioning] = useState(false);
  const [ivaModalOpen, setIvaModalOpen] = useState(false);

  // ── Computed totals ──
  const shrinkagePctNum = parseFloat(shrinkagePct) || 0;

  const computedPfLines = pfLines.map((l) => computePfLine(l, shrinkagePctNum));

  const totalPfGrossKg = pfLines.reduce((s, l) => s + (parseFloat(l.grossWeight) || 0), 0);
  const totalPfNetKg = computedPfLines.reduce((s, c) => s + c.netWeight, 0);
  const totalPfShrinkKg = computedPfLines.reduce((s, c) => s + c.shrinkage, 0);
  const totalPfShortageKg = pfLines.reduce((s, l) => s + (parseFloat(l.shortage) || 0), 0);
  const totalPfRealNetKg = computedPfLines.reduce((s, c) => s + c.realNetWeight, 0);

  const chickenCountNum = parseInt(chickenCount, 10) || 0;
  const avgKgPerChicken =
    purchaseType === "POLLO_FAENADO" && chickenCountNum > 0
      ? totalPfNetKg / chickenCountNum
      : null;

  const subtotal: number = (() => {
    if (purchaseType === "FLETE") {
      return fleteLines.reduce((s, l) => {
        const qty = parseFloat(l.chickenQty) || 0;
        const price = parseFloat(l.pricePerChicken) || 0;
        return s + Math.round(qty * price * 100) / 100;
      }, 0);
    }
    if (purchaseType === "POLLO_FAENADO") {
      return computedPfLines.reduce((s, c) => s + c.lineAmount, 0);
    }
    // COMPRA_GENERAL / SERVICIO
    return generalLines.reduce((s, l) => {
      const qty = parseFloat(l.quantity) || 1;
      const price = parseFloat(l.unitPrice) || 0;
      return s + Math.round(qty * price * 100) / 100;
    }, 0);
  })();

  // ── Line handlers — FLETE ──

  function updateFleteLine(id: string, field: keyof FleteDetailLine, value: string) {
    if (isReadOnly) return;
    setFleteLines((prev) => prev.map((l) => (l.id !== id ? l : { ...l, [field]: value })));
  }

  function addFleteLine() {
    if (isReadOnly) return;
    setFleteLines((prev) => [...prev, emptyFleteeLine()]);
  }

  function removeFleteLine(id: string) {
    if (isReadOnly) return;
    if (fleteLines.length <= 1) { toast.error("Debe haber al menos una línea"); return; }
    setFleteLines((prev) => prev.filter((l) => l.id !== id));
  }

  // ── Line handlers — POLLO_FAENADO ──

  function updatePfLine(id: string, field: keyof PfDetailLine, value: string) {
    if (isReadOnly) return;
    setPfLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        if (field === "productTypeId") {
          const pt = productTypes.find((p) => p.id === value);
          return { ...l, productTypeId: value, description: pt?.name ?? "" };
        }
        return { ...l, [field]: value };
      }),
    );
  }

  function addPfLine() {
    if (isReadOnly) return;
    setPfLines((prev) => [...prev, emptyPfLine()]);
  }

  function removePfLine(id: string) {
    if (isReadOnly) return;
    if (pfLines.length <= 1) { toast.error("Debe haber al menos una línea"); return; }
    setPfLines((prev) => prev.filter((l) => l.id !== id));
  }

  function handlePfArithmeticBlur(id: string, field: "grossWeight" | "unitPrice", value: string) {
    if (!value.trim()) return;
    const result = evaluateExpression(value);
    if (result !== null) {
      updatePfLine(id, field, String(result));
    } else {
      toast.error("Expresión inválida");
    }
  }

  // ── Line handlers — COMPRA_GENERAL / SERVICIO ──

  function updateGeneralLine(id: string, field: keyof GeneralDetailLine, value: string) {
    if (isReadOnly) return;
    setGeneralLines((prev) => prev.map((l) => (l.id !== id ? l : { ...l, [field]: value })));
  }

  function addGeneralLine() {
    if (isReadOnly) return;
    setGeneralLines((prev) => [...prev, emptyGeneralLine()]);
  }

  function removeGeneralLine(id: string) {
    if (isReadOnly) return;
    if (generalLines.length <= 1) { toast.error("Debe haber al menos una línea"); return; }
    setGeneralLines((prev) => prev.filter((l) => l.id !== id));
  }

  function handleGeneralArithmeticBlur(id: string, field: "unitPrice", value: string) {
    if (!value.trim()) return;
    const result = evaluateExpression(value);
    if (result !== null) {
      updateGeneralLine(id, field, String(result));
    } else {
      toast.error("Expresión inválida");
    }
  }

  // ── Build details payload ──

  function buildDetailsPayload() {
    if (purchaseType === "FLETE") {
      return fleteLines.map((l, i) => ({
        description: l.description.trim() || `Flete ${i + 1}`,
        fecha: l.fecha ? l.fecha : undefined,
        docRef: l.docRef || undefined,
        chickenQty: parseFloat(l.chickenQty) || undefined,
        pricePerChicken: parseFloat(l.pricePerChicken) || undefined,
        order: i,
      }));
    }
    if (purchaseType === "POLLO_FAENADO") {
      return pfLines.map((l, i) => ({
        productTypeId: l.productTypeId || undefined,
        description: l.description,
        detailNote: l.detailNote || undefined,
        boxes: parseInt(l.boxes, 10) || 0,
        grossWeight: parseFloat(l.grossWeight) || 0,
        unitPrice: parseFloat(l.unitPrice) || 0,
        shortage: l.shortage ? parseFloat(l.shortage) : undefined,
        order: i,
      }));
    }
    // COMPRA_GENERAL / SERVICIO
    return generalLines.map((l, i) => ({
      description: l.description.trim(),
      quantity: parseFloat(l.quantity) || 1,
      unitPrice: parseFloat(l.unitPrice) || 0,
      expenseAccountId: l.expenseAccountCode || undefined,
      order: i,
    }));
  }

  // ── Validation ──

  const canSubmit = (() => {
    if (!contactId || !periodId || !date) return false;
    if (purchaseType === "FLETE") {
      return fleteLines.length > 0 && fleteLines.every(
        (l) => (parseFloat(l.chickenQty) || 0) > 0 && (parseFloat(l.pricePerChicken) || 0) > 0,
      );
    }
    if (purchaseType === "POLLO_FAENADO") {
      return pfLines.length > 0 && pfLines.every(
        (l) =>
          l.productTypeId &&
          (parseInt(l.boxes, 10) || 0) > 0 &&
          (parseFloat(l.grossWeight) || 0) > 0 &&
          (parseFloat(l.unitPrice) || 0) > 0,
      );
    }
    // COMPRA_GENERAL / SERVICIO
    return generalLines.length > 0 && generalLines.every(
      (l) => l.description.trim() && (parseFloat(l.unitPrice) || 0) > 0,
    );
  })();

  // ── Submit ──

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || isReadOnly || isPosted || isLocked) return;
    setIsSubmitting(true);
    try {
      const body = buildBody(false);
      if (isEditMode && purchase) {
        const response = await fetch(
          `/api/organizations/${orgSlug}/purchases/${purchase.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? "Error al actualizar la compra");
        }
        toast.success("Compra actualizada");
        router.refresh();
      } else {
        const response = await fetch(`/api/organizations/${orgSlug}/purchases`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? "Error al guardar la compra");
        }
        toast.success("Compra guardada como borrador");
        router.push(`/${orgSlug}/purchases`);
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar la compra");
    } finally {
      setIsSubmitting(false);
    }
  }

  function buildBody(postImmediately: boolean) {
    return {
      purchaseType,
      date,
      contactId,
      periodId,
      description: description.trim(),
      referenceNumber: referenceNumber ? parseInt(referenceNumber, 10) : undefined,
      notes: notes.trim() || undefined,
      ruta: purchaseType === "FLETE" ? (ruta.trim() || undefined) : undefined,
      farmOrigin: purchaseType === "POLLO_FAENADO" ? (farmOrigin.trim() || undefined) : undefined,
      chickenCount: purchaseType === "POLLO_FAENADO" && chickenCount ? parseInt(chickenCount, 10) : undefined,
      shrinkagePct: purchaseType === "POLLO_FAENADO" ? shrinkagePctNum : undefined,
      details: buildDetailsPayload(),
      ...(postImmediately ? { postImmediately: true } : {}),
    };
  }

  async function handleCreateAndPost() {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const body = buildBody(true);
      const response = await fetch(`/api/organizations/${orgSlug}/purchases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al contabilizar la compra");
      }
      toast.success("Compra contabilizada");
      router.push(`/${orgSlug}/purchases`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al contabilizar la compra");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePost() {
    if (!purchase) return;
    if (!window.confirm("¿Contabilizar esta compra? Esta acción generará el asiento contable y la cuenta por pagar.")) return;
    setIsActioning(true);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/purchases/${purchase.id}/status`,
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
      toast.success("Compra contabilizada exitosamente");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al contabilizar");
    } finally {
      setIsActioning(false);
    }
  }

  async function handleVoid() {
    if (!purchase) return;
    if (!window.confirm("¿Anular esta compra? Se revertirá el asiento contable y la cuenta por pagar. Esta acción no se puede deshacer.")) return;
    setIsActioning(true);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/purchases/${purchase.id}/status`,
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
      toast.success("Compra anulada");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al anular");
    } finally {
      setIsActioning(false);
    }
  }

  async function handleDelete() {
    if (!purchase) return;
    if (!window.confirm("¿Eliminar este borrador? Esta acción no se puede deshacer.")) return;
    setIsActioning(true);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/purchases/${purchase.id}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al eliminar");
      }
      toast.success("Borrador eliminado");
      router.push(`/${orgSlug}/purchases`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setIsActioning(false);
    }
  }

  const backHref = `/${orgSlug}/purchases`;
  const headerTitle = isEditMode
    ? `${purchase!.displayCode} — ${PURCHASE_TYPE_LABEL[purchaseType]}`
    : `Nueva ${PURCHASE_TYPE_LABEL[purchaseType]}`;

  // ── Render ──
  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-6">
      <Link href={backHref}>
        <Button type="button" variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver a Compras
        </Button>
      </Link>

      {/* Header fields */}
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
            /* ── Compact read-only header ── */
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Tipo</dt>
                <dd className="font-medium mt-0.5">{PURCHASE_TYPE_LABEL[purchaseType]}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Nro. Referencia</dt>
                <dd className="font-medium mt-0.5 font-mono">
                  {purchase!.referenceNumber ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Fecha</dt>
                <dd className="font-medium mt-0.5">
                  {new Date(purchase!.date).toLocaleDateString("es-BO")}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Período</dt>
                <dd className="font-medium mt-0.5">
                  {periods.find((p) => p.id === purchase!.periodId)?.name ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Proveedor</dt>
                <dd className="font-medium mt-0.5">{purchase!.contact.name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Total</dt>
                <dd className="font-medium mt-0.5 font-mono font-bold">
                  {formatCurrency(purchase!.totalAmount)}
                </dd>
              </div>
              {purchaseType === "FLETE" && purchase!.ruta && (
                <div>
                  <dt className="text-muted-foreground">Ruta</dt>
                  <dd className="font-medium mt-0.5">{purchase!.ruta}</dd>
                </div>
              )}
              {purchaseType === "POLLO_FAENADO" && (
                <>
                  {purchase!.farmOrigin && (
                    <div>
                      <dt className="text-muted-foreground">Granja Origen</dt>
                      <dd className="font-medium mt-0.5">{purchase!.farmOrigin}</dd>
                    </div>
                  )}
                  {purchase!.chickenCount != null && (
                    <div>
                      <dt className="text-muted-foreground">Cantidad Pollos</dt>
                      <dd className="font-medium mt-0.5">{purchase!.chickenCount}</dd>
                    </div>
                  )}
                  {purchase!.shrinkagePct != null && (
                    <div>
                      <dt className="text-muted-foreground">% Merma</dt>
                      <dd className="font-medium mt-0.5">{purchase!.shrinkagePct}%</dd>
                    </div>
                  )}
                </>
              )}
              {purchase!.notes && (
                <div className="col-span-2 sm:col-span-4">
                  <dt className="text-muted-foreground">Notas</dt>
                  <dd className="mt-0.5 text-gray-700">{purchase!.notes}</dd>
                </div>
              )}
              {purchase!.description && (
                <div className="col-span-2 sm:col-span-4">
                  <dt className="text-muted-foreground">Descripción</dt>
                  <dd className="mt-0.5 text-xs text-gray-600">{purchase!.description}</dd>
                </div>
              )}
            </dl>
          ) : (
            /* ── Editable form grid ── */
            <>
              {/* Row 1: Tipo / Nro Referencia / Fecha / Período (4 cols) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Input
                    value={PURCHASE_TYPE_LABEL[purchaseType]}
                    readOnly
                    className="bg-muted cursor-default"
                  />
                </div>

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

                <div className="space-y-2">
                  <Label htmlFor="purchase-date">Fecha</Label>
                  <Input
                    id="purchase-date"
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
              </div>

              {/* Row 2: Proveedor / Total */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contact">Proveedor</Label>
                  {isReadOnly ? (
                    <Input
                      value={purchase?.contact?.name ?? "—"}
                      readOnly
                      className="bg-muted cursor-default"
                    />
                  ) : (
                    <Select value={contactId} onValueChange={setContactId}>
                      <SelectTrigger id="contact" className="w-full">
                        <SelectValue placeholder="Seleccione proveedor" />
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
                      value={formatCurrency(purchase!.totalAmount)}
                      readOnly
                      className="bg-muted cursor-default font-mono font-bold"
                    />
                  </div>
                )}
              </div>

              {/* FLETE extra: Ruta */}
              {purchaseType === "FLETE" && (
                <div className="space-y-2">
                  <Label htmlFor="ruta">Ruta</Label>
                  <Input
                    id="ruta"
                    placeholder="Ej: Santa Cruz - Cochabamba"
                    value={ruta}
                    onChange={(e) => setRuta(e.target.value)}
                    readOnly={isReadOnly}
                    className={isReadOnly ? "bg-muted cursor-default" : undefined}
                  />
                </div>
              )}

              {/* POLLO_FAENADO extra: Granja, Cantidad Pollos, % Merma */}
              {purchaseType === "POLLO_FAENADO" && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium text-muted-foreground mb-3">
                    Campos de Pollo Faenado
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="farm-origin">Granja Origen</Label>
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
                      <Label htmlFor="chicken-count">Cantidad Pollos</Label>
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
                      <Label htmlFor="shrinkage-pct">% Merma</Label>
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
                      <Label>Promedio kg/pollo</Label>
                      <Input
                        readOnly
                        className="bg-muted cursor-default"
                        value={avgKgPerChicken !== null ? avgKgPerChicken.toFixed(2) : "—"}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Notes + Description */}
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="purchase-notes">Notas (opcional)</Label>
                  <Textarea
                    id="purchase-notes"
                    placeholder="Observaciones adicionales..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    readOnly={isReadOnly}
                    className={isReadOnly ? "bg-muted cursor-default" : undefined}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchase-description">Descripción</Label>
                  <Input
                    id="purchase-description"
                    placeholder="Descripción del documento"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    readOnly={isReadOnly}
                    className={isReadOnly ? "bg-muted cursor-default text-xs" : "text-xs"}
                  />
                </div>
              </div>
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (purchaseType === "FLETE") addFleteLine();
                  else if (purchaseType === "POLLO_FAENADO") addPfLine();
                  else addGeneralLine();
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Agregar línea
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            {/* ── FLETE detail table ── */}
            {purchaseType === "FLETE" && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-2 font-medium text-gray-600 w-6">#</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-600 min-w-28">Fecha</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-600 min-w-28">Doc. Ref.</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-600 min-w-40">Detalle</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-600 w-28">Cant. Pollos</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-600 w-28">Precio x Pollo</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-600 w-28">Total</th>
                    {!isReadOnly && <th className="w-10" />}
                  </tr>
                </thead>
                <tbody>
                  {fleteLines.map((line, idx) => {
                    const qty = parseFloat(line.chickenQty) || 0;
                    const price = parseFloat(line.pricePerChicken) || 0;
                    const lineAmount = Math.round(qty * price * 100) / 100;
                    return (
                      <tr key={line.id} className="border-b hover:bg-gray-50/50">
                        <td className="py-2 px-2 text-gray-400 text-xs">{idx + 1}</td>
                        <td className="py-2 px-2">
                          <Input
                            type="date"
                            value={line.fecha}
                            onChange={(e) => updateFleteLine(line.id, "fecha", e.target.value)}
                            className={`h-8 ${isReadOnly ? "bg-muted cursor-default" : ""}`}
                            readOnly={isReadOnly}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            value={line.docRef}
                            onChange={(e) => updateFleteLine(line.id, "docRef", e.target.value)}
                            placeholder="Doc. ref."
                            className={`h-8 min-w-24 ${isReadOnly ? "bg-muted cursor-default" : ""}`}
                            readOnly={isReadOnly}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            value={line.description}
                            onChange={(e) => updateFleteLine(line.id, "description", e.target.value)}
                            placeholder="Detalle"
                            className={`h-8 min-w-36 ${isReadOnly ? "bg-muted cursor-default" : ""}`}
                            readOnly={isReadOnly}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            value={line.chickenQty}
                            onChange={(e) => updateFleteLine(line.id, "chickenQty", e.target.value)}
                            placeholder="0"
                            className={`h-8 text-right ${isReadOnly ? "bg-muted cursor-default" : ""}`}
                            readOnly={isReadOnly}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={line.pricePerChicken}
                            onChange={(e) => updateFleteLine(line.id, "pricePerChicken", e.target.value)}
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
                              onClick={() => removeFleteLine(line.id)}
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
                    <td colSpan={6} className="py-3 px-2 text-right font-semibold text-gray-700">
                      Total CxP (Bs.)
                    </td>
                    <td className="py-3 px-2 text-right font-mono font-bold text-gray-900 text-base">
                      {subtotal.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    {!isReadOnly && <td />}
                  </tr>
                </tfoot>
              </table>
            )}

            {/* ── POLLO_FAENADO detail table ── */}
            {purchaseType === "POLLO_FAENADO" && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-2 font-medium text-gray-600 w-6">#</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-600 min-w-36">Tipo Producto</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-600 min-w-28">Nota</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-600 w-20">Cajas</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-600 w-28">Peso Bruto</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-600 w-24">Tara</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-600 w-28">Peso Neto</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-600 w-28">Merma</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-600 w-28">Faltante</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-600 w-28">Neto Real</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-600 w-28">Precio</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-600 w-28">Total</th>
                    {!isReadOnly && <th className="w-10" />}
                  </tr>
                </thead>
                <tbody>
                  {pfLines.map((line, idx) => {
                    const computed = computedPfLines[idx];
                    return (
                      <tr key={line.id} className="border-b hover:bg-gray-50/50">
                        <td className="py-2 px-2 text-gray-400 text-xs">{idx + 1}</td>

                        {/* Tipo Producto */}
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
                              onValueChange={(v) => updatePfLine(line.id, "productTypeId", v)}
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

                        {/* Nota */}
                        <td className="py-2 px-2">
                          <Input
                            value={line.detailNote}
                            onChange={(e) => updatePfLine(line.id, "detailNote", e.target.value)}
                            placeholder={isReadOnly ? "—" : "Obs."}
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
                            onChange={(e) => updatePfLine(line.id, "boxes", e.target.value)}
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
                            onChange={(e) => updatePfLine(line.id, "grossWeight", e.target.value)}
                            onBlur={(e) => !isReadOnly && handlePfArithmeticBlur(line.id, "grossWeight", e.target.value)}
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

                        {/* Merma (computed) */}
                        <td className="py-2 px-2">
                          <Input
                            value={computed.shrinkage !== 0 ? formatKg(computed.shrinkage) : ""}
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
                            onChange={(e) => updatePfLine(line.id, "shortage", e.target.value)}
                            placeholder="0.00"
                            className={`h-8 text-right ${isReadOnly ? "bg-muted cursor-default" : ""}`}
                            readOnly={isReadOnly}
                          />
                        </td>

                        {/* Neto Real (computed) */}
                        <td className="py-2 px-2">
                          <Input
                            value={computed.realNetWeight !== 0 ? formatKg(computed.realNetWeight) : ""}
                            readOnly
                            className="h-8 text-right bg-muted cursor-default"
                            placeholder="—"
                          />
                        </td>

                        {/* Precio — arithmetic */}
                        <td className="py-2 px-2">
                          <Input
                            type="text"
                            value={line.unitPrice}
                            onChange={(e) => updatePfLine(line.id, "unitPrice", e.target.value)}
                            onBlur={(e) => !isReadOnly && handlePfArithmeticBlur(line.id, "unitPrice", e.target.value)}
                            placeholder="0.00"
                            className={`h-8 text-right ${isReadOnly ? "bg-muted cursor-default" : ""}`}
                            readOnly={isReadOnly}
                          />
                        </td>

                        {/* Total de línea (computed) */}
                        <td className="py-2 px-2">
                          <Input
                            value={computed.lineAmount !== 0 ? computed.lineAmount.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}
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
                              onClick={() => removePfLine(line.id)}
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
                  <tr className="border-t bg-gray-50 text-xs text-gray-500">
                    <td colSpan={4} className="py-2 px-2 text-right font-medium">Totales:</td>
                    <td className="py-2 px-2 text-right font-mono">{formatKg(totalPfGrossKg)}</td>
                    <td />
                    <td className="py-2 px-2 text-right font-mono">{formatKg(totalPfNetKg)}</td>
                    <td className="py-2 px-2 text-right font-mono">{formatKg(totalPfShrinkKg)}</td>
                    <td className="py-2 px-2 text-right font-mono">{formatKg(totalPfShortageKg)}</td>
                    <td className="py-2 px-2 text-right font-mono">{formatKg(totalPfRealNetKg)}</td>
                    <td />
                    <td />
                    {!isReadOnly && <td />}
                  </tr>
                  {avgKgPerChicken !== null && (
                    <tr className="bg-gray-50 text-xs text-gray-500">
                      <td colSpan={6} className="py-1 px-2 text-right">Promedio kg/pollo:</td>
                      <td className="py-1 px-2 text-right font-mono text-gray-700">{formatKg(avgKgPerChicken)}</td>
                      <td colSpan={isReadOnly ? 5 : 6} />
                    </tr>
                  )}
                  <tr className="border-t bg-gray-50">
                    <td colSpan={11} className="py-2 px-2 text-right text-xs text-gray-500">
                      Subtotal (exacto):
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-sm text-gray-700">
                      {formatCurrency(subtotal)}
                    </td>
                    {!isReadOnly && <td />}
                  </tr>
                  <tr className="border-t-2 border-gray-300 bg-gray-100">
                    <td colSpan={11} className="py-3 px-2 text-right font-semibold text-gray-700">
                      Total CxP (Bs.)
                    </td>
                    <td className="py-3 px-2 text-right font-mono font-bold text-gray-900 text-base">
                      {subtotal.toLocaleString("es-BO")}
                    </td>
                    {!isReadOnly && <td />}
                  </tr>
                </tfoot>
              </table>
            )}

            {/* ── COMPRA_GENERAL / SERVICIO detail table ── */}
            {(purchaseType === "COMPRA_GENERAL" || purchaseType === "SERVICIO") && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-2 font-medium text-gray-600 w-6">#</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-600 min-w-48">Concepto</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-600 w-24">Cantidad</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-600 w-28">Precio Unitario</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-600 w-28">Total</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-600 min-w-32">Cuenta de Gasto</th>
                    {!isReadOnly && <th className="w-10" />}
                  </tr>
                </thead>
                <tbody>
                  {generalLines.map((line, idx) => {
                    const qty = parseFloat(line.quantity) || 1;
                    const price = parseFloat(line.unitPrice) || 0;
                    const lineAmount = Math.round(qty * price * 100) / 100;
                    return (
                      <tr key={line.id} className="border-b hover:bg-gray-50/50">
                        <td className="py-2 px-2 text-gray-400 text-xs">{idx + 1}</td>
                        <td className="py-2 px-2">
                          <Input
                            value={line.description}
                            onChange={(e) => updateGeneralLine(line.id, "description", e.target.value)}
                            placeholder="Descripción del concepto"
                            className={`h-8 min-w-44 ${isReadOnly ? "bg-muted cursor-default" : ""}`}
                            readOnly={isReadOnly}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            min={0}
                            step={0.001}
                            value={line.quantity}
                            onChange={(e) => updateGeneralLine(line.id, "quantity", e.target.value)}
                            placeholder="1"
                            className={`h-8 text-right ${isReadOnly ? "bg-muted cursor-default" : ""}`}
                            readOnly={isReadOnly}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            type="text"
                            value={line.unitPrice}
                            onChange={(e) => updateGeneralLine(line.id, "unitPrice", e.target.value)}
                            onBlur={(e) => !isReadOnly && handleGeneralArithmeticBlur(line.id, "unitPrice", e.target.value)}
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
                        <td className="py-2 px-2">
                          <Input
                            value={line.expenseAccountCode}
                            onChange={(e) => updateGeneralLine(line.id, "expenseAccountCode", e.target.value)}
                            placeholder="Código de cuenta"
                            className={`h-8 min-w-28 ${isReadOnly ? "bg-muted cursor-default" : ""}`}
                            readOnly={isReadOnly}
                          />
                        </td>
                        {!isReadOnly && (
                          <td className="py-2 px-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => removeGeneralLine(line.id)}
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
                    <td colSpan={4} className="py-3 px-2 text-right font-semibold text-gray-700">
                      Total CxP (Bs.)
                    </td>
                    <td className="py-3 px-2 text-right font-mono font-bold text-gray-900 text-base">
                      {subtotal.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td />
                    {!isReadOnly && <td />}
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payable summary (CxP) */}
      {purchase?.payable != null && (status === "POSTED" || status === "LOCKED") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumen de Pagos (CxP)</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b font-semibold">
                  <td className="py-2">Total CxP (Bs.)</td>
                  <td className="py-2 text-right font-mono">
                    {formatCurrency(purchase.payable.amount)}
                  </td>
                </tr>
                {purchase.payable.allocations.map((alloc) => (
                  <tr key={alloc.id} className="text-muted-foreground">
                    <td className="py-1.5">
                      <Link
                        href={`/${orgSlug}/payments/${alloc.paymentId}`}
                        className="underline underline-offset-2 hover:text-foreground transition-colors"
                      >
                        Pago el{" "}
                        {new Date(alloc.payment.date).toLocaleDateString("es-BO")}
                        {alloc.payment.description ? ` — ${alloc.payment.description}` : ""}
                      </Link>
                    </td>
                    <td className="py-1.5 text-right font-mono text-green-700">
                      -{formatCurrency(alloc.amount)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 font-bold">
                  <td className="py-2">Saldo pendiente</td>
                  <td
                    className={`py-2 text-right font-mono ${
                      purchase.payable.balance > 0 ? "text-red-600" : "text-green-700"
                    }`}
                  >
                    {formatCurrency(purchase.payable.balance)}
                  </td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
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
          {/* Registrar en Libro de Compras IVA — disponible en modo edición */}
          {isEditMode && purchase && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setIvaModalOpen(true)}
            >
              <BookOpen className="h-4 w-4 mr-2" />
              Registrar Libro de Compras
            </Button>
          )}
        </div>

        <div className="flex gap-3">
          <Link href={backHref}>
            <Button type="button" variant="outline">
              {isReadOnly && !isLocked ? "Volver" : "Cancelar"}
            </Button>
          </Link>

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
                className="bg-green-600 hover:bg-green-700"
                onClick={handleCreateAndPost}
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Guardar y Contabilizar
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

          {/* POSTED actions */}
          {isEditMode && isPosted && (
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

          {/* LOCKED actions (admin/owner only) */}
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

    {/* Modal Libro de Compras IVA — pre-fill desde esta compra */}
    {purchase && (
      <IvaBookPurchaseModal
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
        mode="create-from-source"
        sourcePurchase={{
          id: purchase.id,
          date: new Date(purchase.date).toISOString().split("T")[0],
          totalAmount: purchase.totalAmount,
          contact: {
            name: purchase.contact.name,
            nit: purchase.contact.nit ?? null,
          },
        }}
      />
    )}
    </>
  );
}
