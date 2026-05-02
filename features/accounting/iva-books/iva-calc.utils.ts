import { Prisma } from "@/generated/prisma/client";

import { roundHalfUp } from "@/features/accounting/financial-statements/money.utils";

// Alias local para legibilidad — no rompe el tipo Prisma.Decimal
type Decimal = Prisma.Decimal;

// ── Constantes ────────────────────────────────────────────────────────────────

// Convención SIN Bolivia (Formulario 200): Débito Fiscal = Total × 13% (alícuota nominal).
// El "Importe Base" del LCV = subtotal − descuento (NO se divide entre 1.13).
/**
 * Alícuota IVA Bolivia 13% — exported para consumo cross-module legacy↔hex
 * bridge (POC #11.0c A4-c C2 GREEN P3.4 lock Marco): mapper hex
 * `IvaSalesBookEntry → IvaSalesBookDTO` requiere `tasaIva: Decimal` campo
 * que NO existe en `IvaCalcResult` VO (solo subtotal/baseImponible/ivaAmount).
 * Single source of truth post-A2-C1 migration (POC siguiente) — TASA_IVA
 * migrado del legacy `iva-books.service.ts:25` aquí (semánticamente acoplado
 * a `calcTotales` — ambos cálculo IVA cohesivos en el mismo archivo). Valor
 * textual `"0.1300"` preserve P3.4 source-text lock (drop trailing zero
 * silently equivalente runtime via Decimal.js normalize, pero pierde el lock
 * textual que cementa la alícuota canonical 4-decimales SIN Bolivia).
 */
export const TASA_IVA = new Prisma.Decimal("0.1300");
const ZERO = new Prisma.Decimal("0");

// ── Parámetros para calcSubtotal ──────────────────────────────────────────────

type CalcSubtotalParams = {
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
 * Calcula el "Importe Base" SIAT (Formulario 200, Rubro 1.a) sobre el cual se
 * aplica la alícuota del 13% para Débito/Crédito Fiscal:
 *
 *   baseImponible = subtotal - descuento
 *
 * Convención SIN Bolivia: el 13% es alícuota NOMINAL aplicada al Importe Base
 * (NO se divide entre 1.13). El total facturado es el Importe Base.
 *
 * @param subtotal    - resultado de calcSubtotal (ya sin ICE, IEHD, IPJ, exentos, etc.)
 * @param descuento   - codigoDescuentoAdicional + importeGiftCard
 */
export function calcBaseImponible(subtotal: Decimal, descuento: Decimal): Decimal {
  const gravable = subtotal.minus(descuento);
  if (gravable.lte(ZERO)) return ZERO;
  return roundHalfUp(gravable);
}

// ── calcIvaCreditoFiscal ──────────────────────────────────────────────────────

/**
 * Calcula el crédito fiscal IVA 13% a partir del Importe Base SIAT.
 * Fórmula: baseImponible × 0.13 (alícuota nominal SIN Bolivia).
 *
 * Caso especial: si base = 0 (factura 100% exenta), devuelve 0.
 * Redondea con ROUND_HALF_UP a 2dp.
 */
export function calcIvaCreditoFiscal(baseImponible: Decimal): Decimal {
  if (baseImponible.isZero()) return ZERO;
  return roundHalfUp(baseImponible.mul(TASA_IVA));
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

type CalcTotalesParams = CalcSubtotalParams & {
  codigoDescuentoAdicional: Decimal;
  importeGiftCard: Decimal;
};

type CalcTotalesResult = {
  subtotal: Decimal;
  baseImponible: Decimal;
  ivaAmount: Decimal;
};

/**
 * Función de conveniencia que ejecuta el pipeline completo de cálculo:
 *   1. calcSubtotal   — deduce ICE, IEHD, IPJ, tasas, exentos, tasaCero
 *   2. baseImponible  — subtotal − descuento (Importe Base SIAT, Form. 200 Rubro 1.a)
 *   3. ivaAmount      — baseImponible × 0.13 (alícuota nominal SIN)
 *
 * El "Importe Base" es el monto facturado depurado (sin ICE/IEHD/exentos/descuentos)
 * sobre el cual se aplica el 13% nominal. El ingreso contable a registrar es
 * baseImponible × 0.87 (queda a cargo del builder de asientos).
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
