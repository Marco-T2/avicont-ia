import { Prisma } from "@/generated/prisma/client";

// Alias local para legibilidad — no rompe el tipo Prisma.Decimal
type Decimal = Prisma.Decimal;

// ── Constantes ────────────────────────────────────────────────────────────────

const TASA_IVA = new Prisma.Decimal("13");
const DIVISOR_IVA = new Prisma.Decimal("113");
const ZERO = new Prisma.Decimal("0");

// ── roundHalfUp ───────────────────────────────────────────────────────────────

/**
 * Redondea un Decimal a 2 decimales con ROUND_HALF_UP (estándar SIN Bolivia).
 * 0.005 → 0.01, 0.004 → 0.00
 */
function roundHalfUp(d: Decimal): Decimal {
  return d.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

// ── Parámetros para calcSubtotal ──────────────────────────────────────────────

export type CalcSubtotalParams = {
  importeTotal: Decimal;
  importeIce: Decimal;
  importeIehd: Decimal;
  importeIpj: Decimal;
  tasas: Decimal;
  otrosNoSujetos: Decimal;
  exentos: Decimal;
  tasaCero: Decimal;
};

/**
 * Calcula el subtotal sujeto a IVA según la fórmula SIN Bolivia:
 *   subtotal = importeTotal - ICE - IEHD - IPJ - tasas - otrosNoSuj - exentos - tasaCero
 *
 * El resultado se redondea a 2dp con ROUND_HALF_UP.
 * Si el resultado es negativo (datos inconsistentes), devuelve 0.
 */
export function calcSubtotal(params: CalcSubtotalParams): Decimal {
  const {
    importeTotal,
    importeIce,
    importeIehd,
    importeIpj,
    tasas,
    otrosNoSujetos,
    exentos,
    tasaCero,
  } = params;

  const result = importeTotal
    .minus(importeIce)
    .minus(importeIehd)
    .minus(importeIpj)
    .minus(tasas)
    .minus(otrosNoSujetos)
    .minus(exentos)
    .minus(tasaCero);

  return roundHalfUp(result.lt(ZERO) ? ZERO : result);
}

// ── calcBaseImponible ─────────────────────────────────────────────────────────

/**
 * Calcula la base imponible sujeta a crédito fiscal (Libro Compras) o
 * débito fiscal (Libro Ventas) restando el descuento adicional y gift card.
 *
 * @param subtotal    - resultado de calcSubtotal
 * @param descuento   - codigoDescuentoAdicional + importeGiftCard
 */
export function calcBaseImponible(subtotal: Decimal, descuento: Decimal): Decimal {
  const result = subtotal.minus(descuento);
  return roundHalfUp(result.lt(ZERO) ? ZERO : result);
}

// ── calcIvaCreditoFiscal ──────────────────────────────────────────────────────

/**
 * Calcula el crédito fiscal IVA 13% a partir de la base imponible.
 * Fórmula: base × 13 / 113 (IVA está INCLUIDO en el precio).
 *
 * Caso especial: si base = 0 (factura 100% exenta), devuelve 0 sin dividir.
 * Redondea con ROUND_HALF_UP a 2dp.
 */
export function calcIvaCreditoFiscal(baseImponible: Decimal): Decimal {
  if (baseImponible.isZero()) return ZERO;
  const iva = baseImponible.mul(TASA_IVA).div(DIVISOR_IVA);
  return roundHalfUp(iva);
}

// ── calcDebitoFiscal ──────────────────────────────────────────────────────────

/**
 * Calcula el débito fiscal IVA 13% para el Libro de Ventas.
 * Misma fórmula que calcIvaCreditoFiscal — el débito es simétrico al crédito.
 * El estadoSIN (A/V/C/L) no altera el cálculo de IVA.
 */
export function calcDebitoFiscal(baseImponible: Decimal): Decimal {
  return calcIvaCreditoFiscal(baseImponible);
}

// ── Parámetros para calcTotales ───────────────────────────────────────────────

export type CalcTotalesParams = CalcSubtotalParams & {
  codigoDescuentoAdicional: Decimal;
  importeGiftCard: Decimal;
};

export type CalcTotalesResult = {
  subtotal: Decimal;
  baseImponible: Decimal;
  ivaAmount: Decimal;
};

/**
 * Función de conveniencia que ejecuta el pipeline completo de cálculo:
 *   1. calcSubtotal (deduce ICE, IEHD, IPJ, tasas, exentos, tasaCero)
 *   2. calcBaseImponible (deduce descuento y gift card)
 *   3. calcIvaCreditoFiscal / calcDebitoFiscal
 *
 * El result.ivaAmount sirve tanto para dfCfIva (compras) como dfIva (ventas).
 */
export function calcTotales(params: CalcTotalesParams): CalcTotalesResult {
  const subtotal = calcSubtotal(params);
  const descuento = params.codigoDescuentoAdicional.plus(params.importeGiftCard);
  const baseImponible = calcBaseImponible(subtotal, descuento);
  const ivaAmount = calcIvaCreditoFiscal(baseImponible);

  return { subtotal, baseImponible, ivaAmount };
}
