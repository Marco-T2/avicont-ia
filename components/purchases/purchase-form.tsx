"use client";

import { useState, useEffect, useRef } from "react";
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
import type { Account, Contact, FiscalPeriod } from "@/generated/prisma/client";
import AccountSelector from "@/components/accounting/account-selector";
import ContactSelector from "@/components/contacts/contact-selector";
import { evaluateExpression } from "@/lib/evaluate-expression";
import { useOrgRole } from "@/components/common/use-org-role";
import type { PurchaseWithDetails } from "@/modules/purchase/presentation/dto/purchase-with-details";
import { IvaBookPurchaseModal } from "@/components/iva-books/iva-book-purchase-modal";
import { isFiscalPeriodOpen } from "@/lib/fiscal-period.utils";
import { LcvIndicator } from "@/components/common/lcv-indicator";
import type { LcvState } from "@/components/common/lcv-indicator";
import { UnlinkLcvConfirmDialogPurchase } from "@/components/purchases/unlink-lcv-confirm-dialog-purchase";
import { useLcvUnlinkPurchase } from "@/components/purchases/use-lcv-unlink-purchase";
import { ReactivateLcvConfirmDialogPurchase } from "@/components/purchases/reactivate-lcv-confirm-dialog-purchase";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useLcvReactivatePurchase } from "@/components/purchases/use-lcv-reactivate-purchase";
import { todayLocal, formatDateBO } from "@/lib/date-utils";
import { findPeriodCoveringDate } from "@/modules/fiscal-periods/presentation/index";
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

// ── Derivación del estado LCV ──

/**
 * Deriva el estado del LcvIndicator a partir de la compra.
 * S1: borrador (sin id) o status DRAFT
 * S2: guardada, sin ivaPurchaseBook activo (null o VOIDED)
 * S3: guardada, con ivaPurchaseBook activo (status ACTIVE)
 */
function deriveLcvStatePurchase(
  purchase:
    | { status: string; ivaPurchaseBook?: { id: string; status?: string } | null }
    | undefined,
): LcvState {
  if (!purchase || purchase.status === "DRAFT") return "S1";
  if (!purchase.ivaPurchaseBook || purchase.ivaPurchaseBook.status === "VOIDED") return "S2";
  return "S3";
}

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
  return { id: nextLineId(), fecha: todayLocal(), docRef: "", description: "", chickenQty: "", pricePerChicken: "" };
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
  expenseAccounts?: Account[];
  purchase?: PurchaseWithDetails;
  mode: "new" | "edit";
}

export default function PurchaseForm({
  orgSlug,
  purchaseType,
  contacts,
  periods,
  productTypes,
  expenseAccounts = [],
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

  // ── Header state ──
  const [contactId, setContactId] = useState(purchase?.contactId ?? "");
  const [date, setDate] = useState(
    purchase?.date
      ? new Date(purchase.date).toISOString().split("T")[0]
      : todayLocal(),
  );
  const [periodId, setPeriodId] = useState(() => {
    if (purchase?.periodId) return purchase.periodId;
    const initialDate = purchase?.date
      ? new Date(purchase.date).toISOString().split("T")[0]
      : todayLocal();
    return findPeriodCoveringDate(initialDate, periods)?.id ?? "";
  });
  const [periodManuallySelected, setPeriodManuallySelected] = useState(false);
  const isFirstPeriodSync = useRef(true);

  useEffect(() => {
    if (isFirstPeriodSync.current) {
      isFirstPeriodSync.current = false;
      return;
    }
    if (periodManuallySelected || !date) return;
    const match = findPeriodCoveringDate(date, periods);
    setPeriodId(match?.id ?? "");
  }, [date, periods, periodManuallySelected]);
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
  const [confirmPost, setConfirmPost] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [ivaModalOpen, setIvaModalOpen] = useState(false);

  // ── Estado y hook de desvinculación LCV (T4.5 REQ-A.3) ──
  const [unlinkDialogOpen, setUnlinkDialogOpen] = useState(false);
  const { handleUnlink, isPending: isUnlinking } = useLcvUnlinkPurchase(
    orgSlug,
    purchase?.ivaPurchaseBook?.id,
  );

  // ── Estado y hook de reactivación LCV (T5.6 REQ-A.4) ──
  const [reactivateDialogOpen, setReactivateDialogOpen] = useState(false);
  const { handleReactivate, isPending: isReactivating } = useLcvReactivatePurchase(
    orgSlug,
    purchase?.ivaPurchaseBook?.id,
  );

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
      return fleteLines.map((l, i) => {
        const qty = parseFloat(l.chickenQty) || 0;
        const price = parseFloat(l.pricePerChicken) || 0;
        return {
          description: l.description.trim() || `Flete ${i + 1}`,
          fecha: l.fecha ? l.fecha : undefined,
          docRef: l.docRef || undefined,
          chickenQty: parseFloat(l.chickenQty) || undefined,
          pricePerChicken: parseFloat(l.pricePerChicken) || undefined,
          lineAmount: Math.round(qty * price * 100) / 100,
          order: i,
        };
      });
    }
    if (purchaseType === "POLLO_FAENADO") {
      const pct = parseFloat(shrinkagePct) || 0;
      return pfLines.map((l, i) => {
        const computed = computePfLine(l, pct);
        return {
          productTypeId: l.productTypeId || undefined,
          description: l.description,
          detailNote: l.detailNote || undefined,
          boxes: parseInt(l.boxes, 10) || 0,
          grossWeight: parseFloat(l.grossWeight) || 0,
          unitPrice: parseFloat(l.unitPrice) || 0,
          shortage: l.shortage ? parseFloat(l.shortage) : undefined,
          lineAmount: computed.lineAmount,
          order: i,
        };
      });
    }
    // COMPRA_GENERAL / SERVICIO
    return generalLines.map((l, i) => {
      const qty = parseFloat(l.quantity) || 1;
      const price = parseFloat(l.unitPrice) || 0;
      return {
        description: l.description.trim(),
        quantity: parseFloat(l.quantity) || 1,
        unitPrice: parseFloat(l.unitPrice) || 0,
        lineAmount: Math.round(qty * price * 100) / 100,
        expenseAccountId: l.expenseAccountCode || undefined,
        order: i,
      };
    });
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

  function handlePost() {
    if (!purchase) return;
    setConfirmPost(true);
  }

  function handleVoid() {
    if (!purchase) return;
    setConfirmVoid(true);
  }

  function handleDelete() {
    if (!purchase) return;
    setConfirmDelete(true);
  }

  async function executePost() {
    if (!purchase) return;
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
      setConfirmPost(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al contabilizar");
    } finally {
      setIsActioning(false);
    }
  }

  async function executeVoid() {
    if (!purchase) return;
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
      setConfirmVoid(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al anular");
    } finally {
      setIsActioning(false);
    }
  }

  async function executeDelete() {
    if (!purchase) return;
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
      setConfirmDelete(false);
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
            {isEditMode && <VoucherStatusBadge status={status} />}
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
                  {formatDateBO(purchase!.date)}
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
                  <dd className="mt-0.5 text-foreground/80">{purchase!.notes}</dd>
                </div>
              )}
              {purchase!.description && (
                <div className="col-span-2 sm:col-span-4">
                  <dt className="text-muted-foreground">Descripción</dt>
                  <dd className="mt-0.5 text-xs text-muted-foreground">{purchase!.description}</dd>
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
                    <Select
                      value={periodId}
                      onValueChange={(value) => {
                        setPeriodManuallySelected(true);
                        setPeriodId(value);
                      }}
                    >
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

              {!isReadOnly && date && !periodId && periods.length > 0 && (
                <div
                  role="alert"
                  className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-foreground"
                >
                  No hay un período abierto que cubra esta fecha. Abrí el período
                  correspondiente o elegí otra fecha.
                </div>
              )}

              {/* Row 2: Proveedor / Total / LCV */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contact">Proveedor</Label>
                  {isReadOnly ? (
                    <Input
                      value={purchase?.contact?.name ?? "—"}
                      readOnly
                      className="bg-muted cursor-default"
                    />
                  ) : (
                    <ContactSelector
                      orgSlug={orgSlug}
                      value={contactId || null}
                      onChange={(v) => setContactId(v ?? "")}
                      typeFilter="PROVEEDOR"
                      placeholder="Seleccione proveedor"
                      initialContact={purchase?.contact}
                    />
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

                <div className="space-y-2">
                  <Label>Libro de Compras (LCV)</Label>
                  <LcvIndicator
                    state={deriveLcvStatePurchase(purchase)}
                    periodOpen={purchase ? isFiscalPeriodOpen(purchase.period) : false}
                    onRegister={() => {
                      if (purchase?.ivaPurchaseBook?.status === "VOIDED") {
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

              {/* Description */}
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
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground w-6">#</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground min-w-28">Fecha</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground min-w-28">Doc. Ref.</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground min-w-40">Detalle</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground w-28">Cant. Pollos</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground w-28">Precio x Pollo</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground w-28">Total</th>
                    {!isReadOnly && <th className="w-10" />}
                  </tr>
                </thead>
                <tbody>
                  {fleteLines.map((line, idx) => {
                    const qty = parseFloat(line.chickenQty) || 0;
                    const price = parseFloat(line.pricePerChicken) || 0;
                    const lineAmount = Math.round(qty * price * 100) / 100;
                    return (
                      <tr key={line.id} className="border-b hover:bg-accent/50">
                        <td className="py-2 px-2 text-muted-foreground text-xs">{idx + 1}</td>
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
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted">
                    <td colSpan={6} className="py-3 px-2 text-right font-semibold text-foreground">
                      Total CxP (Bs.)
                    </td>
                    <td className="py-3 px-2 text-right font-mono font-bold text-foreground text-base">
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
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground w-6">#</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground min-w-36">Tipo Producto</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground min-w-28">Nota</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground w-20">Cajas</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground w-28">Peso Bruto</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground w-24">Tara</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground w-28">Peso Neto</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground w-28">Merma</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground w-28">Faltante</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground w-28">Neto Real</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground w-28">Precio</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground w-28">Total</th>
                    {!isReadOnly && <th className="w-10" />}
                  </tr>
                </thead>
                <tbody>
                  {pfLines.map((line, idx) => {
                    const computed = computedPfLines[idx];
                    return (
                      <tr key={line.id} className="border-b hover:bg-accent/50">
                        <td className="py-2 px-2 text-muted-foreground text-xs">{idx + 1}</td>

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
                <tfoot>
                  <tr className="border-t bg-muted/50 text-xs text-muted-foreground">
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
                    <tr className="bg-muted/50 text-xs text-muted-foreground">
                      <td colSpan={6} className="py-1 px-2 text-right">Promedio kg/pollo:</td>
                      <td className="py-1 px-2 text-right font-mono text-foreground">{formatKg(avgKgPerChicken)}</td>
                      <td colSpan={isReadOnly ? 5 : 6} />
                    </tr>
                  )}
                  <tr className="border-t bg-muted/50">
                    <td colSpan={11} className="py-2 px-2 text-right text-xs text-muted-foreground">
                      Subtotal (exacto):
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-sm text-foreground">
                      {formatCurrency(subtotal)}
                    </td>
                    {!isReadOnly && <td />}
                  </tr>
                  <tr className="border-t-2 border-border bg-muted">
                    <td colSpan={11} className="py-3 px-2 text-right font-semibold text-foreground">
                      Total CxP (Bs.)
                    </td>
                    <td className="py-3 px-2 text-right font-mono font-bold text-foreground text-base">
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
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground w-6">#</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground min-w-56">Cuenta Contable de Gasto</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground min-w-48">Descripción</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground w-24">Cantidad</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground w-28">Precio Unitario</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground w-28">Monto</th>
                    {!isReadOnly && <th className="w-10" />}
                  </tr>
                </thead>
                <tbody>
                  {generalLines.map((line, idx) => {
                    const qty = parseFloat(line.quantity) || 1;
                    const price = parseFloat(line.unitPrice) || 0;
                    const lineAmount = Math.round(qty * price * 100) / 100;
                    return (
                      <tr key={line.id} className="border-b hover:bg-accent/50">
                        <td className="py-2 px-2 text-muted-foreground text-xs">{idx + 1}</td>
                        <td className="py-2 px-2">
                          <AccountSelector
                            accounts={expenseAccounts}
                            value={line.expenseAccountCode}
                            onChange={(v) => updateGeneralLine(line.id, "expenseAccountCode", v)}
                            disabled={isReadOnly}
                          />
                        </td>
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
                        {!isReadOnly && (
                          <td className="py-2 px-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => removeGeneralLine(line.id)}
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
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted">
                    <td colSpan={5} className="py-3 px-2 text-right font-semibold text-foreground">
                      Total CxP (Bs.)
                    </td>
                    <td className="py-3 px-2 text-right font-mono font-bold text-foreground text-base">
                      {subtotal.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    {!isReadOnly && <td />}
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Fila inferior: Notas (izq) + Resumen de Pagos (der) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="bottom-row">
        {/* Notas — siempre visible en slot izquierdo */}
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

        {/* Resumen de Pagos — slot derecho, solo cuando hay payable */}
        {purchase?.payable != null && (status === "POSTED" || status === "LOCKED") ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumen de Pagos (CxP)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-1 w-full text-sm">
                <div className="flex justify-between items-start gap-4 border-b pb-2 font-semibold">
                  <span>Total CxP (Bs.)</span>
                  <span className="font-mono text-right">{formatCurrency(purchase.payable.amount)}</span>
                </div>
                {purchase.payable.allocations.map((alloc) => (
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
                      {alloc.payment.description ? ` — ${alloc.payment.description}` : ""}
                    </Link>
                    <span className="font-mono text-success text-right whitespace-nowrap">
                      -{formatCurrency(alloc.amount)}
                    </span>
                  </div>
                ))}
                <div
                  className={`flex justify-between items-start gap-4 border-t-2 pt-2 font-bold ${
                    purchase.payable.balance > 0 ? "text-destructive" : "text-success"
                  }`}
                >
                  <span className="text-foreground">Saldo pendiente</span>
                  <span className="font-mono text-right">{formatCurrency(purchase.payable.balance)}</span>
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
          {/* LCV button removed — now handled by LcvIndicator in header row 2 (REQ-A.1) */}
        </div>

        <div className="flex gap-3">
          <Link href={backHref}>
            <Button type="button" variant="outline">
              {isReadOnly && !isLocked ? "Volver" : "Cancelar"}
            </Button>
          </Link>

          <Gated resource="purchases" action="write">
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
          </Gated>
        </div>
      </div>
    </form>

    {/* Modal Libro de Compras IVA — pre-fill desde esta compra o edición de entrada existente */}
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
        mode={purchase.ivaPurchaseBook && purchase.ivaPurchaseBook.status !== "VOIDED" ? "edit" : "create-from-source"}
        entryId={
          purchase.ivaPurchaseBook && purchase.ivaPurchaseBook.status !== "VOIDED"
            ? purchase.ivaPurchaseBook.id
            : undefined
        }
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

    {/* Dialog de desvinculación del LCV (REQ-A.3) */}
    <UnlinkLcvConfirmDialogPurchase
      open={unlinkDialogOpen}
      onOpenChange={setUnlinkDialogOpen}
      onConfirm={async () => {
        await handleUnlink();
        setUnlinkDialogOpen(false);
      }}
      isPending={isUnlinking}
    />

    {/* Dialog de reactivación del LCV (REQ-A.4) */}
    <ReactivateLcvConfirmDialogPurchase
      open={reactivateDialogOpen}
      onOpenChange={setReactivateDialogOpen}
      onConfirm={async () => {
        await handleReactivate();
        setReactivateDialogOpen(false);
      }}
      isPending={isReactivating}
    />

    <ConfirmDialog
      open={confirmPost}
      onOpenChange={setConfirmPost}
      title="Contabilizar compra"
      description="¿Contabilizar esta compra? Esta acción generará el asiento contable y la cuenta por pagar."
      confirmLabel="Contabilizar"
      variant="default"
      loading={isActioning}
      onConfirm={executePost}
    />

    <ConfirmDialog
      open={confirmVoid}
      onOpenChange={setConfirmVoid}
      title="Anular compra"
      description="¿Anular esta compra? Se revertirá el asiento contable y la cuenta por pagar. Esta operación no se puede deshacer."
      confirmLabel="Anular"
      variant="destructive"
      loading={isActioning}
      onConfirm={executeVoid}
    />

    <ConfirmDialog
      open={confirmDelete}
      onOpenChange={setConfirmDelete}
      title="Eliminar borrador"
      description="Esta acción eliminará el borrador permanentemente. No se puede deshacer."
      confirmLabel="Eliminar"
      variant="destructive"
      loading={isActioning}
      onConfirm={executeDelete}
    />
    </>
  );
}
