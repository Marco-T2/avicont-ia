"use client";

/**
 * Modal para registrar una entrada en el Libro de Compras IVA (Bolivia SIN).
 *
 * Modos:
 * - "create-standalone": el usuario completa todos los campos manualmente
 * - "create-from-source": pre-rellena con datos de una Compra existente
 * - "edit": edita una entrada ya registrada
 *
 * Auto-calc: al salir del campo importeTotal (y otros deductibles),
 * recalcula subtotal, baseImponible y creditoFiscal usando la fórmula
 * IVA 13% Bolivia SIN (ROUND_HALF_UP, 2dp).
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

// ── Cálculo IVA client-side (pure JS — no Prisma.Decimal) ────────────────────

/**
 * Named export added at oleada-money-decimal-hex-purity sub-POC 5 Cycle 2
 * RED to enable direct parity testing of the client-side IVA math without
 * driving it through the rendered DOM. Behavior-preserving export-only
 * refactor — runtime semantics unchanged. Sister `calcClientTotales`
 * exported in the same commit. The downstream consumers within this
 * module (handleSubmit + triggerCalc) continue to use these functions
 * exactly as before.
 */
export function roundHalfUp(n: number, dp = 2): number {
  const factor = Math.pow(10, dp);
  return Math.round(n * factor) / factor;
}

export function calcClientTotales(params: {
  importeTotal: number;
  importeIce: number;
  importeIehd: number;
  importeIpj: number;
  tasas: number;
  otrosNoSujetos: number;
  exentos: number;
  tasaCero: number;
  codigoDescuentoAdicional: number;
  importeGiftCard: number;
}) {
  const subtotal = Math.max(
    0,
    params.importeTotal -
      params.importeIce -
      params.importeIehd -
      params.importeIpj -
      params.tasas -
      params.otrosNoSujetos -
      params.exentos -
      params.tasaCero,
  );
  const descuento = params.codigoDescuentoAdicional + params.importeGiftCard;
  // baseImponible = subtotal − descuento ("Importe Base SIAT", Form. 200 Rubro 1.a)
  const baseImponible = Math.max(0, subtotal - descuento);
  // ivaAmount = baseImponible × 0.13 (alícuota nominal SIN Bolivia, NO se divide entre 1.13)
  const ivaAmount = baseImponible === 0 ? 0 : roundHalfUp(baseImponible * 0.13);

  return {
    subtotal: roundHalfUp(subtotal),
    baseImponible: roundHalfUp(baseImponible),
    ivaAmount,
  };
}

// ── Tipos ────────────────────────────────────────────────────────────────────

interface SourcePurchase {
  id: string;
  date: string;
  totalAmount: number;
  contact: {
    name: string;
    nit?: string | null;
  };
}

interface FiscalPeriodOption {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
}

type ModalMode = "create-standalone" | "create-from-source" | "edit";

interface IvaBookPurchaseModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  orgSlug: string;
  periods: FiscalPeriodOption[];
  mode: ModalMode;
  sourcePurchase?: SourcePurchase;
  /** ID de entrada a editar (solo en mode="edit") */
  entryId?: string;
}

// ── Helpers de formato ──────────────────────────────────────────────────────

function toFixed2(n: number): string {
  return n.toFixed(2);
}

function parseNum(s: string): number {
  const v = parseFloat(s);
  return isNaN(v) ? 0 : v;
}

// ── Componente ───────────────────────────────────────────────────────────────

export function IvaBookPurchaseModal({
  open,
  onClose,
  onSuccess,
  orgSlug,
  periods,
  mode,
  sourcePurchase,
  entryId,
}: IvaBookPurchaseModalProps) {
  // ── Estado del formulario ──
  const [fechaFactura, setFechaFactura] = useState("");
  const [nitProveedor, setNitProveedor] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [numeroFactura, setNumeroFactura] = useState("");
  const [codigoAutorizacion, setCodigoAutorizacion] = useState("");
  const [codigoControl, setCodigoControl] = useState("");
  const [tipoCompra, setTipoCompra] = useState("1");
  const [fiscalPeriodId, setFiscalPeriodId] = useState("");
  const [notes, setNotes] = useState("");

  // Campos monetarios
  const [importeTotal, setImporteTotal] = useState("0.00");
  const [importeIce, setImporteIce] = useState("0.00");
  const [importeIehd, setImporteIehd] = useState("0.00");
  const [importeIpj, setImporteIpj] = useState("0.00");
  const [tasas, setTasas] = useState("0.00");
  const [otrosNoSujetos, setOtrosNoSujetos] = useState("0.00");
  const [exentos, setExentos] = useState("0.00");
  const [tasaCero, setTasaCero] = useState("0.00");
  const [codigoDescuentoAdicional, setCodigoDescuentoAdicional] = useState("0.00");
  const [importeGiftCard, setImporteGiftCard] = useState("0.00");

  // Campos calculados (display-only)
  const [computedSubtotal, setComputedSubtotal] = useState("0.00");
  const [computedBase, setComputedBase] = useState("0.00");
  const [computedCreditoFiscal, setComputedCreditoFiscal] = useState("0.00");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Lock state: true cuando la entrada está vinculada a una compra (purchaseId presente)
  const [isLinkedToPurchase, setIsLinkedToPurchase] = useState(false);

  // ── Pre-fill desde sourcePurchase ──
  useEffect(() => {
    if (mode === "create-from-source" && sourcePurchase) {
      setFechaFactura(sourcePurchase.date?.split("T")[0] ?? "");
      setNitProveedor(sourcePurchase.contact.nit ?? "");
      setRazonSocial(sourcePurchase.contact.name ?? "");
      setImporteTotal(toFixed2(sourcePurchase.totalAmount));
      // Recalcular con el nuevo importe total
      triggerCalc({
        importeTotal: sourcePurchase.totalAmount,
        importeIce: 0,
        importeIehd: 0,
        importeIpj: 0,
        tasas: 0,
        otrosNoSujetos: 0,
        exentos: 0,
        tasaCero: 0,
        codigoDescuentoAdicional: 0,
        importeGiftCard: 0,
      });
    }
  }, [mode, sourcePurchase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch y pre-fill en modo edición ──
  useEffect(() => {
    if (!open || mode !== "edit" || !entryId) return;

    fetch(`/api/organizations/${orgSlug}/iva-books/purchases/${entryId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Error al cargar la entrada del Libro de Compras");
        return res.json();
      })
      .then((data: Record<string, unknown>) => {
        setFechaFactura(typeof data.fechaFactura === "string" ? data.fechaFactura.split("T")[0] : "");
        setNitProveedor(typeof data.nitProveedor === "string" ? data.nitProveedor : "");
        setRazonSocial(typeof data.razonSocial === "string" ? data.razonSocial : "");
        setNumeroFactura(typeof data.numeroFactura === "string" ? data.numeroFactura : "");
        setCodigoAutorizacion(typeof data.codigoAutorizacion === "string" ? data.codigoAutorizacion : "");
        setCodigoControl(typeof data.codigoControl === "string" ? data.codigoControl : "");
        setTipoCompra(typeof data.tipoCompra === "number" ? String(data.tipoCompra) : "1");
        setFiscalPeriodId(typeof data.fiscalPeriodId === "string" ? data.fiscalPeriodId : "");
        setNotes(typeof data.notes === "string" ? data.notes : "");
        const toStr = (v: unknown) => (v != null ? String(v) : "0.00");
        setImporteTotal(toStr(data.importeTotal));
        setImporteIce(toStr(data.importeIce));
        setImporteIehd(toStr(data.importeIehd));
        setImporteIpj(toStr(data.importeIpj));
        setTasas(toStr(data.tasas));
        setOtrosNoSujetos(toStr(data.otrosNoSujetos));
        setExentos(toStr(data.exentos));
        setTasaCero(toStr(data.tasaCero));
        setCodigoDescuentoAdicional(toStr(data.codigoDescuentoAdicional));
        setImporteGiftCard(toStr(data.importeGiftCard));
        setIsLinkedToPurchase(typeof data.purchaseId === "string" && data.purchaseId !== "");
        triggerCalc({
          importeTotal: parseNum(toStr(data.importeTotal)),
          importeIce: parseNum(toStr(data.importeIce)),
          importeIehd: parseNum(toStr(data.importeIehd)),
          importeIpj: parseNum(toStr(data.importeIpj)),
          tasas: parseNum(toStr(data.tasas)),
          otrosNoSujetos: parseNum(toStr(data.otrosNoSujetos)),
          exentos: parseNum(toStr(data.exentos)),
          tasaCero: parseNum(toStr(data.tasaCero)),
          codigoDescuentoAdicional: parseNum(toStr(data.codigoDescuentoAdicional)),
          importeGiftCard: parseNum(toStr(data.importeGiftCard)),
        });
      })
      .catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : "Error al cargar la entrada del Libro de Compras");
      });
  }, [open, mode, entryId, orgSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset cuando se cierra ──
  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  function resetForm() {
    setFechaFactura("");
    setNitProveedor("");
    setRazonSocial("");
    setNumeroFactura("");
    setCodigoAutorizacion("");
    setCodigoControl("");
    setTipoCompra("1");
    setFiscalPeriodId("");
    setNotes("");
    setImporteTotal("0.00");
    setImporteIce("0.00");
    setImporteIehd("0.00");
    setImporteIpj("0.00");
    setTasas("0.00");
    setOtrosNoSujetos("0.00");
    setExentos("0.00");
    setTasaCero("0.00");
    setCodigoDescuentoAdicional("0.00");
    setImporteGiftCard("0.00");
    setComputedSubtotal("0.00");
    setComputedBase("0.00");
    setComputedCreditoFiscal("0.00");
    setIsLinkedToPurchase(false);
    setErrors({});
  }

  function triggerCalc(overrides?: Partial<{
    importeTotal: number;
    importeIce: number;
    importeIehd: number;
    importeIpj: number;
    tasas: number;
    otrosNoSujetos: number;
    exentos: number;
    tasaCero: number;
    codigoDescuentoAdicional: number;
    importeGiftCard: number;
  }>) {
    const params = {
      importeTotal: parseNum(importeTotal),
      importeIce: parseNum(importeIce),
      importeIehd: parseNum(importeIehd),
      importeIpj: parseNum(importeIpj),
      tasas: parseNum(tasas),
      otrosNoSujetos: parseNum(otrosNoSujetos),
      exentos: parseNum(exentos),
      tasaCero: parseNum(tasaCero),
      codigoDescuentoAdicional: parseNum(codigoDescuentoAdicional),
      importeGiftCard: parseNum(importeGiftCard),
      ...overrides,
    };
    const result = calcClientTotales(params);
    setComputedSubtotal(toFixed2(result.subtotal));
    setComputedBase(toFixed2(result.baseImponible));
    setComputedCreditoFiscal(toFixed2(result.ivaAmount));
  }

  function handleBlurCalc() {
    triggerCalc();
  }

  // ── Validación ──
  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!fechaFactura) errs.fechaFactura = "Requerido";
    if (!nitProveedor.trim()) errs.nitProveedor = "Requerido";
    if (!razonSocial.trim()) errs.razonSocial = "Requerido";
    if (!numeroFactura.trim()) errs.numeroFactura = "Requerido";
    if (!codigoAutorizacion.trim()) errs.codigoAutorizacion = "Requerido";
    if (!fiscalPeriodId) errs.fiscalPeriodId = "Selecciona un período fiscal";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Submit ──
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    // Recalcular antes de persistir
    const params = {
      importeTotal: parseNum(importeTotal),
      importeIce: parseNum(importeIce),
      importeIehd: parseNum(importeIehd),
      importeIpj: parseNum(importeIpj),
      tasas: parseNum(tasas),
      otrosNoSujetos: parseNum(otrosNoSujetos),
      exentos: parseNum(exentos),
      tasaCero: parseNum(tasaCero),
      codigoDescuentoAdicional: parseNum(codigoDescuentoAdicional),
      importeGiftCard: parseNum(importeGiftCard),
    };
    const computed = calcClientTotales(params);

    setIsSubmitting(true);
    try {
      const url = mode === "edit" && entryId
        ? `/api/organizations/${orgSlug}/iva-books/purchases/${entryId}`
        : `/api/organizations/${orgSlug}/iva-books/purchases`;

      const body = {
        fechaFactura,
        nitProveedor,
        razonSocial,
        numeroFactura,
        codigoAutorizacion,
        codigoControl: codigoControl || "",
        tipoCompra: parseInt(tipoCompra, 10),
        fiscalPeriodId,
        notes: notes || undefined,
        importeTotal: toFixed2(params.importeTotal),
        importeIce: toFixed2(params.importeIce),
        importeIehd: toFixed2(params.importeIehd),
        importeIpj: toFixed2(params.importeIpj),
        tasas: toFixed2(params.tasas),
        otrosNoSujetos: toFixed2(params.otrosNoSujetos),
        exentos: toFixed2(params.exentos),
        tasaCero: toFixed2(params.tasaCero),
        codigoDescuentoAdicional: toFixed2(params.codigoDescuentoAdicional),
        importeGiftCard: toFixed2(params.importeGiftCard),
        subtotal: toFixed2(computed.subtotal),
        baseIvaSujetoCf: toFixed2(computed.baseImponible),
        dfCfIva: toFixed2(computed.ivaAmount),
        dfIva: toFixed2(computed.ivaAmount),
        tasaIva: "0.1300",
        ...(mode === "create-from-source" && sourcePurchase
          ? { purchaseId: sourcePurchase.id }
          : {}),
      };

      const res = await fetch(url, {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Error al registrar entrada");
      }

      toast.success("Entrada registrada en el Libro de Compras");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!open) return null;

  // ── Render ──
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="purchase-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div className="bg-card rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 id="purchase-modal-title" className="text-xl font-semibold">
            Registrar Libro de Compras IVA
          </h2>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            ×
          </Button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {/* ── Sección: Datos del documento ── */}
          <fieldset>
            <legend className="text-sm font-medium text-foreground mb-3">Datos del documento</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="pm-fecha-factura">Fecha de factura</Label>
                <Input
                  id="pm-fecha-factura"
                  type="date"
                  value={fechaFactura}
                  onChange={(e) => setFechaFactura(e.target.value)}
                  aria-invalid={!!errors.fechaFactura}
                />
                {errors.fechaFactura && (
                  <p className="text-xs text-destructive">{errors.fechaFactura}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="pm-nit-proveedor">NIT del proveedor</Label>
                <Input
                  id="pm-nit-proveedor"
                  type="text"
                  value={nitProveedor}
                  onChange={(e) => setNitProveedor(e.target.value)}
                  placeholder="Ej: 12345678"
                  aria-invalid={!!errors.nitProveedor}
                />
                {errors.nitProveedor && (
                  <p className="text-xs text-destructive">{errors.nitProveedor}</p>
                )}
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="pm-razon-social">Razón social</Label>
                <Input
                  id="pm-razon-social"
                  type="text"
                  value={razonSocial}
                  onChange={(e) => setRazonSocial(e.target.value)}
                  placeholder="Nombre del proveedor"
                  aria-invalid={!!errors.razonSocial}
                />
                {errors.razonSocial && (
                  <p className="text-xs text-destructive">{errors.razonSocial}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="pm-nro-factura">Número de factura</Label>
                <Input
                  id="pm-nro-factura"
                  type="text"
                  value={numeroFactura}
                  onChange={(e) => setNumeroFactura(e.target.value)}
                  placeholder="Ej: 001"
                  aria-invalid={!!errors.numeroFactura}
                />
                {errors.numeroFactura && (
                  <p className="text-xs text-destructive">{errors.numeroFactura}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="pm-codigo-autorizacion">Código de autorización</Label>
                <Input
                  id="pm-codigo-autorizacion"
                  type="text"
                  value={codigoAutorizacion}
                  onChange={(e) => setCodigoAutorizacion(e.target.value)}
                  placeholder="Número de autorización SIN"
                  aria-invalid={!!errors.codigoAutorizacion}
                />
                {errors.codigoAutorizacion && (
                  <p className="text-xs text-destructive">{errors.codigoAutorizacion}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="pm-codigo-control">Código de control (opcional)</Label>
                <Input
                  id="pm-codigo-control"
                  type="text"
                  value={codigoControl}
                  onChange={(e) => setCodigoControl(e.target.value)}
                  placeholder="Código control manual"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="pm-tipo-compra">Tipo de compra</Label>
                <select
                  id="pm-tipo-compra"
                  value={tipoCompra}
                  onChange={(e) => setTipoCompra(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                >
                  <option value="1">1 - Compras para mercado interno con derecho CF</option>
                  <option value="2">2 - Compras para exportaciones</option>
                  <option value="3">3 - Compras para actividades gravadas y exentas</option>
                  <option value="4">4 - Compras para actividades no gravadas (sin CF)</option>
                  <option value="5">5 - Otros</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="pm-period-select">Período fiscal</Label>
                <select
                  id="pm-period-select"
                  data-testid="period-select"
                  value={fiscalPeriodId}
                  onChange={(e) => setFiscalPeriodId(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  aria-invalid={!!errors.fiscalPeriodId}
                >
                  <option value="">— Seleccionar período —</option>
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {errors.fiscalPeriodId && (
                  <p className="text-xs text-destructive">{errors.fiscalPeriodId}</p>
                )}
              </div>
            </div>
          </fieldset>

          {/* ── Banner: importes bloqueados por compra vinculada ── */}
          {isLinkedToPurchase && (
            <div className="rounded-md border border-info/30 bg-info/10 px-4 py-3 text-sm text-info">
              Los importes se calculan automáticamente desde la compra vinculada. Para modificarlos, editá la compra.
            </div>
          )}

          {/* ── Sección: Importes ── */}
          <fieldset>
            <legend className="text-sm font-medium text-foreground mb-3">Importes (Bs.)</legend>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label htmlFor="pm-importe-total">Importe total</Label>
                <Input
                  id="pm-importe-total"
                  type="number"
                  min="0"
                  step="0.01"
                  value={importeTotal}
                  onChange={(e) => setImporteTotal(e.target.value)}
                  onBlur={handleBlurCalc}
                  readOnly={isLinkedToPurchase}
                  className={`text-right${isLinkedToPurchase ? " opacity-60 cursor-not-allowed bg-muted" : ""}`}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="pm-importe-ice">Importe ICE</Label>
                <Input
                  id="pm-importe-ice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={importeIce}
                  onChange={(e) => setImporteIce(e.target.value)}
                  onBlur={handleBlurCalc}
                  readOnly={isLinkedToPurchase}
                  className={`text-right${isLinkedToPurchase ? " opacity-60 cursor-not-allowed bg-muted" : ""}`}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="pm-importe-iehd">Importe IEHD</Label>
                <Input
                  id="pm-importe-iehd"
                  type="number"
                  min="0"
                  step="0.01"
                  value={importeIehd}
                  onChange={(e) => setImporteIehd(e.target.value)}
                  onBlur={handleBlurCalc}
                  readOnly={isLinkedToPurchase}
                  className={`text-right${isLinkedToPurchase ? " opacity-60 cursor-not-allowed bg-muted" : ""}`}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="pm-importe-ipj">Importe IPJ</Label>
                <Input
                  id="pm-importe-ipj"
                  type="number"
                  min="0"
                  step="0.01"
                  value={importeIpj}
                  onChange={(e) => setImporteIpj(e.target.value)}
                  onBlur={handleBlurCalc}
                  readOnly={isLinkedToPurchase}
                  className={`text-right${isLinkedToPurchase ? " opacity-60 cursor-not-allowed bg-muted" : ""}`}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="pm-tasas">Tasas</Label>
                <Input
                  id="pm-tasas"
                  type="number"
                  min="0"
                  step="0.01"
                  value={tasas}
                  onChange={(e) => setTasas(e.target.value)}
                  onBlur={handleBlurCalc}
                  readOnly={isLinkedToPurchase}
                  className={`text-right${isLinkedToPurchase ? " opacity-60 cursor-not-allowed bg-muted" : ""}`}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="pm-otros-no-sujetos">Otros no sujetos CF</Label>
                <Input
                  id="pm-otros-no-sujetos"
                  type="number"
                  min="0"
                  step="0.01"
                  value={otrosNoSujetos}
                  onChange={(e) => setOtrosNoSujetos(e.target.value)}
                  onBlur={handleBlurCalc}
                  readOnly={isLinkedToPurchase}
                  className={`text-right${isLinkedToPurchase ? " opacity-60 cursor-not-allowed bg-muted" : ""}`}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="pm-exentos">Exentos</Label>
                <Input
                  id="pm-exentos"
                  type="number"
                  min="0"
                  step="0.01"
                  value={exentos}
                  onChange={(e) => setExentos(e.target.value)}
                  onBlur={handleBlurCalc}
                  readOnly={isLinkedToPurchase}
                  className={`text-right${isLinkedToPurchase ? " opacity-60 cursor-not-allowed bg-muted" : ""}`}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="pm-tasa-cero">Tasa cero</Label>
                <Input
                  id="pm-tasa-cero"
                  type="number"
                  min="0"
                  step="0.01"
                  value={tasaCero}
                  onChange={(e) => setTasaCero(e.target.value)}
                  onBlur={handleBlurCalc}
                  readOnly={isLinkedToPurchase}
                  className={`text-right${isLinkedToPurchase ? " opacity-60 cursor-not-allowed bg-muted" : ""}`}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="pm-descuento">Descuento/Bonif.</Label>
                <Input
                  id="pm-descuento"
                  type="number"
                  min="0"
                  step="0.01"
                  value={codigoDescuentoAdicional}
                  onChange={(e) => setCodigoDescuentoAdicional(e.target.value)}
                  onBlur={handleBlurCalc}
                  readOnly={isLinkedToPurchase}
                  className={`text-right${isLinkedToPurchase ? " opacity-60 cursor-not-allowed bg-muted" : ""}`}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="pm-gift-card">Importe Gift Card</Label>
                <Input
                  id="pm-gift-card"
                  type="number"
                  min="0"
                  step="0.01"
                  value={importeGiftCard}
                  onChange={(e) => setImporteGiftCard(e.target.value)}
                  onBlur={handleBlurCalc}
                  readOnly={isLinkedToPurchase}
                  className={`text-right${isLinkedToPurchase ? " opacity-60 cursor-not-allowed bg-muted" : ""}`}
                />
              </div>
            </div>
          </fieldset>

          {/* ── Sección: Calculados (read-only) ── */}
          <div className="rounded-md border border-border bg-muted p-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">Calculado automáticamente (SIN Bolivia IVA 13%)</p>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground block text-xs">Subtotal</span>
                <span
                  data-testid="computed-subtotal"
                  className="font-mono font-medium"
                >
                  {computedSubtotal}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">Base sujeta CF</span>
                <span
                  data-testid="computed-base"
                  className="font-mono font-medium"
                >
                  {computedBase}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">Crédito Fiscal (CF)</span>
                <span
                  data-testid="computed-credito-fiscal"
                  className="font-mono font-medium"
                >
                  {computedCreditoFiscal}
                </span>
              </div>
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-1">
            <Label htmlFor="pm-notes">Notas (opcional)</Label>
            <Input
              id="pm-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observaciones adicionales"
            />
          </div>

          {/* ── Acciones ── */}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Registrando..." : "Registrar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
