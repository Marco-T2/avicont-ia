"use client";

import { useState, useCallback } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2, ArrowLeft, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import type { Contact, FiscalPeriod } from "@/generated/prisma/client";
import { evaluateExpression } from "@/lib/evaluate-expression";

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
}: DispatchFormProps) {
  const router = useRouter();
  const isBC = dispatchType === "BOLETA_CERRADA";

  // ── Header state ──
  const [contactId, setContactId] = useState("");
  const [periodId, setPeriodId] = useState(periods[0]?.id ?? "");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionOverride, setDescriptionOverride] = useState(false);
  const [notes, setNotes] = useState("");

  // ── BC-only header state ──
  const [farmOrigin, setFarmOrigin] = useState("");
  const [chickenCount, setChickenCount] = useState("");
  const [shrinkagePct, setShrinkagePct] = useState("0");

  // ── Detail lines state ──
  const [lines, setLines] = useState<DetailLine[]>([emptyLine()]);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // ── Submit ──

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
    if (!canSubmit) return;
    setIsSubmitting(true);

    try {
      const body = {
        dispatchType,
        date,
        contactId,
        periodId,
        description: description.trim(),
        referenceNumber: referenceNumber ? parseInt(referenceNumber, 10) : undefined,
        notes: notes.trim() || undefined,
        // BC fields
        farmOrigin: isBC ? (farmOrigin.trim() || undefined) : undefined,
        chickenCount: isBC && chickenCount ? parseInt(chickenCount, 10) : undefined,
        shrinkagePct: isBC ? shrinkagePctNum : undefined,
        details: lines.map((line, i) => ({
          productTypeId: line.productTypeId || undefined,
          description: line.description,
          detailNote: line.detailNote || undefined,
          boxes: parseInt(line.boxes, 10),
          grossWeight: parseFloat(line.grossWeight),
          unitPrice: parseFloat(line.unitPrice),
          shortage: isBC && line.shortage ? parseFloat(line.shortage) : undefined,
          order: i,
        })),
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
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al guardar el despacho",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const backHref = `/${orgSlug}/dispatches`;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Link href={backHref}>
        <Button type="button" variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver a Despachos
        </Button>
      </Link>

      {/* Header fields */}
      <Card>
        <CardHeader>
          <CardTitle>
            Nuevo {DISPATCH_TYPE_LABEL[dispatchType]}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Tipo (readonly) */}
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Input
                value={DISPATCH_TYPE_LABEL[dispatchType]}
                readOnly
                className="bg-muted cursor-default"
              />
            </div>

            {/* Cliente */}
            <div className="space-y-2">
              <Label htmlFor="contact">Cliente</Label>
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
            </div>

            {/* Período */}
            <div className="space-y-2">
              <Label htmlFor="period">Período</Label>
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
            </div>

            {/* Fecha */}
            <div className="space-y-2">
              <Label htmlFor="dispatch-date">Fecha</Label>
              <Input
                id="dispatch-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
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
              />
            </div>

            {/* Notas */}
            <div className="space-y-2 lg:col-span-3">
              <Label htmlFor="dispatch-notes">Notas (opcional)</Label>
              <Textarea
                id="dispatch-notes"
                placeholder="Observaciones adicionales..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Descripción auto-generada */}
            <div className="space-y-2 lg:col-span-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="dispatch-description">Descripción</Label>
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
              </div>
              <Input
                id="dispatch-description"
                placeholder="Se genera automáticamente"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                readOnly={!descriptionOverride}
                className={!descriptionOverride ? "bg-muted cursor-default text-xs" : "text-xs"}
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
        </CardContent>
      </Card>

      {/* Detail lines */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Líneas de Detalle</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="h-4 w-4 mr-1" />
              Agregar línea
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-2 font-medium text-gray-600 w-6">#</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-600 min-w-36">
                    Producto
                  </th>
                  <th className="text-left py-3 px-2 font-medium text-gray-600 min-w-28">
                    Detalle
                  </th>
                  <th className="text-right py-3 px-2 font-medium text-gray-600 w-20">
                    Cajas
                  </th>
                  <th className="text-right py-3 px-2 font-medium text-gray-600 w-28">
                    P. Bruto
                  </th>
                  <th className="text-right py-3 px-2 font-medium text-gray-600 w-24">
                    Tara
                  </th>
                  <th className="text-right py-3 px-2 font-medium text-gray-600 w-28">
                    P. Neto
                  </th>
                  {isBC && (
                    <>
                      <th className="text-right py-3 px-2 font-medium text-gray-600 w-28">
                        Merma
                      </th>
                      <th className="text-right py-3 px-2 font-medium text-gray-600 w-28">
                        Faltante
                      </th>
                      <th className="text-right py-3 px-2 font-medium text-gray-600 w-28">
                        Neto Real
                      </th>
                    </>
                  )}
                  <th className="text-right py-3 px-2 font-medium text-gray-600 w-28">
                    Precio
                  </th>
                  <th className="text-right py-3 px-2 font-medium text-gray-600 w-28">
                    Subtotal
                  </th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => {
                  const computed = computedLines[idx];
                  return (
                    <tr key={line.id} className="border-b hover:bg-gray-50/50">
                      <td className="py-2 px-2 text-gray-400 text-xs">{idx + 1}</td>

                      {/* Producto (Select) */}
                      <td className="py-2 px-2">
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
                      </td>

                      {/* Detalle / nota */}
                      <td className="py-2 px-2">
                        <Input
                          value={line.detailNote}
                          onChange={(e) =>
                            updateLine(line.id, "detailNote", e.target.value)
                          }
                          placeholder="Obs. / detalle"
                          maxLength={200}
                          className="h-8 min-w-24"
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
                          className="h-8 text-right"
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
                            handleArithmeticBlur(line.id, "grossWeight", e.target.value)
                          }
                          placeholder="0.00"
                          className="h-8 text-right"
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
                              className="h-8 text-right"
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
                            handleArithmeticBlur(line.id, "unitPrice", e.target.value)
                          }
                          placeholder="0.00"
                          className="h-8 text-right"
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
                    </tr>
                  );
                })}
              </tbody>

              {/* Summary totals */}
              <tfoot>
                {isBC && (
                  <>
                    <tr className="border-t bg-gray-50 text-xs text-gray-500">
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
                      <td />
                    </tr>
                    {avgKgPerChicken !== null && (
                      <tr className="bg-gray-50 text-xs text-gray-500">
                        <td colSpan={6} className="py-1 px-2 text-right">
                          Promedio kg/pollo:
                        </td>
                        <td className="py-1 px-2 text-right font-mono text-gray-700">
                          {formatKg(avgKgPerChicken)}
                        </td>
                        <td colSpan={6} />
                      </tr>
                    )}
                  </>
                )}

                {/* Subtotal row */}
                <tr className="border-t bg-gray-50">
                  <td
                    colSpan={isBC ? 11 : 8}
                    className="py-2 px-2 text-right text-xs text-gray-500"
                  >
                    Subtotal (exacto):
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-sm text-gray-700">
                    {formatCurrency(subtotal)}
                  </td>
                  <td />
                </tr>

                {/* Total CxC row */}
                <tr className="border-t-2 border-gray-300 bg-gray-100">
                  <td
                    colSpan={isBC ? 11 : 8}
                    className="py-3 px-2 text-right font-semibold text-gray-700"
                  >
                    Total CxC (Bs.)
                  </td>
                  <td className="py-3 px-2 text-right font-mono font-bold text-gray-900 text-base">
                    {totalCxC.toLocaleString("es-BO")}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Link href={backHref}>
          <Button type="button" variant="outline">
            Cancelar
          </Button>
        </Link>
        <Button type="submit" disabled={!canSubmit || isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Guardando...
            </>
          ) : (
            "Guardar Borrador"
          )}
        </Button>
      </div>
    </form>
  );
}
