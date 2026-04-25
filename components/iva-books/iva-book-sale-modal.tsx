"use client";

/**
 * Modal para registrar una entrada en el Libro de Ventas IVA (Bolivia SIN).
 *
 * Igual que IvaBookPurchaseModal pero:
 * - NIT campo: nitCliente (no nitProveedor)
 * - Agrega estadoSIN: mandatory dropdown A/V/C/L SIN valor por defecto
 * - El submit se bloquea si estadoSIN está vacío
 * - Endpoint: /api/.../iva-books/sales
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

// ── Cálculo IVA client-side (pure JS — no Prisma.Decimal) ────────────────────

function roundHalfUp(n: number, dp = 2): number {
  const factor = Math.pow(10, dp);
  return Math.round(n * factor) / factor;
}

function calcClientTotales(params: {
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

type EstadoSIN = "A" | "V" | "C" | "L" | "";

interface SourceSale {
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

interface IvaBookSaleModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  orgSlug: string;
  periods: FiscalPeriodOption[];
  mode: ModalMode;
  sourceSale?: SourceSale;
  entryId?: string;
}

function toFixed2(n: number): string {
  return n.toFixed(2);
}

function parseNum(s: string): number {
  const v = parseFloat(s);
  return isNaN(v) ? 0 : v;
}

const ESTADO_SIN_OPTIONS: { value: EstadoSIN; label: string }[] = [
  { value: "A", label: "A - Activo" },
  { value: "V", label: "V - Anulado" },
  { value: "C", label: "C - Contingencia" },
  { value: "L", label: "L - Libre" },
];

// ── Componente ───────────────────────────────────────────────────────────────

export function IvaBookSaleModal({
  open,
  onClose,
  onSuccess,
  orgSlug,
  periods,
  mode,
  sourceSale,
  entryId,
}: IvaBookSaleModalProps) {
  // ── Estado del formulario ──
  const [fechaFactura, setFechaFactura] = useState("");
  const [nitCliente, setNitCliente] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [numeroFactura, setNumeroFactura] = useState("");
  const [codigoAutorizacion, setCodigoAutorizacion] = useState("");
  const [codigoControl, setCodigoControl] = useState("");
  const [estadoSIN, setEstadoSIN] = useState<EstadoSIN>("");
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
  const [computedDebitoFiscal, setComputedDebitoFiscal] = useState("0.00");

  // Lock state: true cuando la entrada está vinculada a una venta (saleId presente)
  const [isLinkedToSale, setIsLinkedToSale] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── Pre-fill desde sourceSale ──
  // NOTA: estadoSIN NO se pre-rellena — es obligación manual del usuario
  useEffect(() => {
    if (mode === "create-from-source" && sourceSale) {
      setFechaFactura(sourceSale.date?.split("T")[0] ?? "");
      setNitCliente(sourceSale.contact.nit ?? "");
      setRazonSocial(sourceSale.contact.name ?? "");
      setImporteTotal(toFixed2(sourceSale.totalAmount));
      triggerCalc({ importeTotal: sourceSale.totalAmount });
    }
  }, [mode, sourceSale]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch y pre-fill en modo edición ──
  useEffect(() => {
    if (!open || mode !== "edit" || !entryId) return;

    fetch(`/api/organizations/${orgSlug}/iva-books/sales/${entryId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Error al cargar la entrada del Libro de Ventas");
        return res.json();
      })
      .then((data: Record<string, unknown>) => {
        setFechaFactura(typeof data.fechaFactura === "string" ? data.fechaFactura.split("T")[0] : "");
        setNitCliente(typeof data.nitCliente === "string" ? data.nitCliente : "");
        setRazonSocial(typeof data.razonSocial === "string" ? data.razonSocial : "");
        setNumeroFactura(typeof data.numeroFactura === "string" ? data.numeroFactura : "");
        setCodigoAutorizacion(typeof data.codigoAutorizacion === "string" ? data.codigoAutorizacion : "");
        setCodigoControl(typeof data.codigoControl === "string" ? data.codigoControl : "");
        setEstadoSIN((typeof data.estadoSIN === "string" ? data.estadoSIN : "") as EstadoSIN);
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
        // Determinar si la entrada está vinculada a una venta
        setIsLinkedToSale(typeof data.saleId === "string" && data.saleId !== "");
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
        toast.error(err instanceof Error ? err.message : "Error al cargar la entrada del Libro de Ventas");
      });
  }, [open, mode, entryId, orgSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) resetForm();
  }, [open]);

  function resetForm() {
    setFechaFactura("");
    setNitCliente("");
    setRazonSocial("");
    setNumeroFactura("");
    setCodigoAutorizacion("");
    setCodigoControl("");
    setEstadoSIN(""); // explícitamente vacío — sin default
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
    setComputedDebitoFiscal("0.00");
    setIsLinkedToSale(false);
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
    setComputedDebitoFiscal(toFixed2(result.ivaAmount));
  }

  function handleBlurCalc() {
    triggerCalc();
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!fechaFactura) errs.fechaFactura = "Requerido";
    if (!nitCliente.trim()) errs.nitCliente = "Requerido";
    if (!razonSocial.trim()) errs.razonSocial = "Requerido";
    if (!numeroFactura.trim()) errs.numeroFactura = "Requerido";
    if (!codigoAutorizacion.trim()) errs.codigoAutorizacion = "Requerido";
    if (!estadoSIN) errs.estadoSIN = "El estado SIN es obligatorio (A/V/C/L)";
    if (!fiscalPeriodId) errs.fiscalPeriodId = "Selecciona un período fiscal";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

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
        ? `/api/organizations/${orgSlug}/iva-books/sales/${entryId}`
        : `/api/organizations/${orgSlug}/iva-books/sales`;

      const body = {
        fechaFactura,
        nitCliente,
        razonSocial,
        numeroFactura,
        codigoAutorizacion,
        codigoControl: codigoControl || "",
        estadoSIN,
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
        ...(mode === "create-from-source" && sourceSale
          ? { saleId: sourceSale.id }
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

      toast.success("Entrada registrada en el Libro de Ventas");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sale-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div className="bg-card rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 id="sale-modal-title" className="text-xl font-semibold">
            Registrar Libro de Ventas IVA
          </h2>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            ×
          </Button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {/* ── Banner: entrada vinculada a venta ── */}
          {isLinkedToSale && (
            <div
              role="note"
              className="rounded-md border border-info/30 bg-info/10 px-4 py-3 text-sm text-info"
            >
              Los importes se calculan automáticamente desde la venta vinculada. Para modificarlos, editá la venta.
            </div>
          )}

          {/* ── Datos del documento ── */}
          <fieldset>
            <legend className="text-sm font-medium text-foreground mb-3">Datos del documento</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="sm-fecha-factura">Fecha de factura</Label>
                <Input
                  id="sm-fecha-factura"
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
                <Label htmlFor="sm-nit-cliente">NIT del cliente</Label>
                <Input
                  id="sm-nit-cliente"
                  type="text"
                  value={nitCliente}
                  onChange={(e) => setNitCliente(e.target.value)}
                  placeholder="Ej: 87654321"
                  aria-invalid={!!errors.nitCliente}
                />
                {errors.nitCliente && (
                  <p className="text-xs text-destructive">{errors.nitCliente}</p>
                )}
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="sm-razon-social">Razón social</Label>
                <Input
                  id="sm-razon-social"
                  type="text"
                  value={razonSocial}
                  onChange={(e) => setRazonSocial(e.target.value)}
                  placeholder="Nombre del cliente"
                  aria-invalid={!!errors.razonSocial}
                />
                {errors.razonSocial && (
                  <p className="text-xs text-destructive">{errors.razonSocial}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="sm-nro-factura">Número de factura</Label>
                <Input
                  id="sm-nro-factura"
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
                <Label htmlFor="sm-codigo-autorizacion">Código de autorización</Label>
                <Input
                  id="sm-codigo-autorizacion"
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
                <Label htmlFor="sm-codigo-control">Código de control (opcional)</Label>
                <Input
                  id="sm-codigo-control"
                  type="text"
                  value={codigoControl}
                  onChange={(e) => setCodigoControl(e.target.value)}
                  placeholder="Código control manual"
                />
              </div>

              {/* estadoSIN — Mandatory, NO default */}
              <div className="space-y-1">
                <Label htmlFor="sm-estado-sin">Estado SIN *</Label>
                <select
                  id="sm-estado-sin"
                  data-testid="estado-sin-select"
                  value={estadoSIN}
                  onChange={(e) => setEstadoSIN(e.target.value as EstadoSIN)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  aria-invalid={!!errors.estadoSIN}
                  aria-required="true"
                >
                  <option value="">— Seleccionar estado SIN —</option>
                  {ESTADO_SIN_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {errors.estadoSIN && (
                  <p className="text-xs text-destructive">{errors.estadoSIN}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="sm-period-select">Período fiscal</Label>
                <select
                  id="sm-period-select"
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

          {/* ── Importes ── */}
          <fieldset>
            <legend className="text-sm font-medium text-foreground mb-3">Importes (Bs.)</legend>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label htmlFor="sm-importe-total">Importe total</Label>
                <Input
                  id="sm-importe-total"
                  type="number"
                  min="0"
                  step="0.01"
                  value={importeTotal}
                  onChange={(e) => setImporteTotal(e.target.value)}
                  onBlur={handleBlurCalc}
                  readOnly={isLinkedToSale}
                  className={`text-right${isLinkedToSale ? " opacity-60 cursor-not-allowed bg-muted" : ""}`}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="sm-importe-ice">Importe ICE</Label>
                <Input
                  id="sm-importe-ice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={importeIce}
                  onChange={(e) => setImporteIce(e.target.value)}
                  onBlur={handleBlurCalc}
                  readOnly={isLinkedToSale}
                  className={`text-right${isLinkedToSale ? " opacity-60 cursor-not-allowed bg-muted" : ""}`}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="sm-importe-iehd">Importe IEHD</Label>
                <Input
                  id="sm-importe-iehd"
                  type="number"
                  min="0"
                  step="0.01"
                  value={importeIehd}
                  onChange={(e) => setImporteIehd(e.target.value)}
                  onBlur={handleBlurCalc}
                  readOnly={isLinkedToSale}
                  className={`text-right${isLinkedToSale ? " opacity-60 cursor-not-allowed bg-muted" : ""}`}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="sm-importe-ipj">Importe IPJ</Label>
                <Input
                  id="sm-importe-ipj"
                  type="number"
                  min="0"
                  step="0.01"
                  value={importeIpj}
                  onChange={(e) => setImporteIpj(e.target.value)}
                  onBlur={handleBlurCalc}
                  readOnly={isLinkedToSale}
                  className={`text-right${isLinkedToSale ? " opacity-60 cursor-not-allowed bg-muted" : ""}`}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="sm-tasas">Tasas</Label>
                <Input
                  id="sm-tasas"
                  type="number"
                  min="0"
                  step="0.01"
                  value={tasas}
                  onChange={(e) => setTasas(e.target.value)}
                  onBlur={handleBlurCalc}
                  readOnly={isLinkedToSale}
                  className={`text-right${isLinkedToSale ? " opacity-60 cursor-not-allowed bg-muted" : ""}`}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="sm-otros-no-sujetos">Otros no sujetos CF</Label>
                <Input
                  id="sm-otros-no-sujetos"
                  type="number"
                  min="0"
                  step="0.01"
                  value={otrosNoSujetos}
                  onChange={(e) => setOtrosNoSujetos(e.target.value)}
                  onBlur={handleBlurCalc}
                  readOnly={isLinkedToSale}
                  className={`text-right${isLinkedToSale ? " opacity-60 cursor-not-allowed bg-muted" : ""}`}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="sm-exentos">Exentos</Label>
                <Input
                  id="sm-exentos"
                  type="number"
                  min="0"
                  step="0.01"
                  value={exentos}
                  onChange={(e) => setExentos(e.target.value)}
                  onBlur={handleBlurCalc}
                  readOnly={isLinkedToSale}
                  className={`text-right${isLinkedToSale ? " opacity-60 cursor-not-allowed bg-muted" : ""}`}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="sm-tasa-cero">Tasa cero</Label>
                <Input
                  id="sm-tasa-cero"
                  type="number"
                  min="0"
                  step="0.01"
                  value={tasaCero}
                  onChange={(e) => setTasaCero(e.target.value)}
                  onBlur={handleBlurCalc}
                  readOnly={isLinkedToSale}
                  className={`text-right${isLinkedToSale ? " opacity-60 cursor-not-allowed bg-muted" : ""}`}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="sm-descuento">Descuento/Bonif.</Label>
                <Input
                  id="sm-descuento"
                  type="number"
                  min="0"
                  step="0.01"
                  value={codigoDescuentoAdicional}
                  onChange={(e) => setCodigoDescuentoAdicional(e.target.value)}
                  onBlur={handleBlurCalc}
                  readOnly={isLinkedToSale}
                  className={`text-right${isLinkedToSale ? " opacity-60 cursor-not-allowed bg-muted" : ""}`}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="sm-gift-card">Importe Gift Card</Label>
                <Input
                  id="sm-gift-card"
                  type="number"
                  min="0"
                  step="0.01"
                  value={importeGiftCard}
                  onChange={(e) => setImporteGiftCard(e.target.value)}
                  onBlur={handleBlurCalc}
                  readOnly={isLinkedToSale}
                  className={`text-right${isLinkedToSale ? " opacity-60 cursor-not-allowed bg-muted" : ""}`}
                />
              </div>
            </div>
          </fieldset>

          {/* ── Calculados (read-only) ── */}
          <div className="rounded-md border border-border bg-muted p-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">Calculado automáticamente (SIN Bolivia IVA 13%)</p>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground block text-xs">Subtotal</span>
                <span data-testid="computed-subtotal" className="font-mono font-medium">
                  {computedSubtotal}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">Base sujeta DF</span>
                <span data-testid="computed-base" className="font-mono font-medium">
                  {computedBase}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">Débito Fiscal (DF)</span>
                <span data-testid="computed-debito-fiscal" className="font-mono font-medium">
                  {computedDebitoFiscal}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="sm-notes">Notas (opcional)</Label>
            <Input
              id="sm-notes"
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
