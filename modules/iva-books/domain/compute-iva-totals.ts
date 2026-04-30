import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import { IvaCalcResult } from "./value-objects/iva-calc-result";

/**
 * IVA computation pure functions — domain helper. Migración 1:1 desde
 * `features/accounting/iva-books/iva-calc.utils.ts` (legacy 145 LOC) per
 * D-A1#5 lockeada (POC #11.0c A2). Convención SIN Bolivia (Formulario 200):
 * Débito Fiscal = Importe Base × 13% (alícuota nominal). El "Importe Base"
 * del LCV = subtotal − descuento (NO se divide entre 1.13).
 *
 * **Asimetría con legacy** — el helper legacy retorna `Decimal` plain con
 * `roundHalfUp` explícito; el hex usa `MonetaryAmount` end-to-end (POC #8
 * shared/) que aplica round half-up internamente vía `round2()`. Eliminado
 * helper `roundHalfUp` redundante (§13 emergente Ciclo 2 — duplicar
 * rounding logic con MonetaryAmount viola DRY domain). Coverage rounding
 * cubierta por MonetaryAmount POC #8.
 *
 * **Pipeline output** — `computeIvaTotals` retorna `IvaCalcResult` VO
 * directamente (no plain object) — agrega invariantes domain
 * (baseImponible ≤ subtotal, ivaAmount ≤ baseImponible). Las funciones
 * intermedias retornan `MonetaryAmount` para composability.
 */

const TASA_IVA = 0.13;

export interface CalcSubtotalParams {
  importeTotal: MonetaryAmount;
  importeIce: MonetaryAmount;
  importeIehd: MonetaryAmount;
  importeIpj: MonetaryAmount;
  tasas: MonetaryAmount;
  otrosNoSujetos: MonetaryAmount;
  exentos: MonetaryAmount;
  tasaCero: MonetaryAmount;
}

export interface ComputeIvaTotalsParams extends CalcSubtotalParams {
  codigoDescuentoAdicional: MonetaryAmount;
  importeGiftCard: MonetaryAmount;
}

/**
 * Calcula el subtotal sujeto a IVA según la fórmula SIN Bolivia:
 *   subtotal = importeTotal − ICE − IEHD − IPJ − tasas − otrosNoSuj − exentos − tasaCero
 * Si las deducciones exceden el importeTotal (datos inconsistentes), retorna 0.
 */
export function calcSubtotal(params: CalcSubtotalParams): MonetaryAmount {
  const totalDeducciones = params.importeIce
    .plus(params.importeIehd)
    .plus(params.importeIpj)
    .plus(params.tasas)
    .plus(params.otrosNoSujetos)
    .plus(params.exentos)
    .plus(params.tasaCero);

  if (params.importeTotal.isLessThan(totalDeducciones)) {
    return MonetaryAmount.zero();
  }
  return params.importeTotal.minus(totalDeducciones);
}

/**
 * Calcula el "Importe Base" SIAT (Formulario 200, Rubro 1.a) sobre el cual
 * se aplica la alícuota del 13% para Débito/Crédito Fiscal:
 *   baseImponible = subtotal − descuento
 *
 * @param descuento - codigoDescuentoAdicional + importeGiftCard
 */
export function calcBaseImponible(
  subtotal: MonetaryAmount,
  descuento: MonetaryAmount,
): MonetaryAmount {
  if (subtotal.isLessThan(descuento)) return MonetaryAmount.zero();
  return subtotal.minus(descuento);
}

/**
 * Calcula el crédito fiscal IVA 13% a partir del Importe Base SIAT.
 * Fórmula: baseImponible × 0.13 (alícuota nominal SIN, NO ÷ 1.13).
 * Si base = 0 (factura 100% exenta), retorna 0.
 */
export function calcIvaCreditoFiscal(
  baseImponible: MonetaryAmount,
): MonetaryAmount {
  if (baseImponible.equals(MonetaryAmount.zero())) {
    return MonetaryAmount.zero();
  }
  return MonetaryAmount.of(baseImponible.value * TASA_IVA);
}

/**
 * Calcula el débito fiscal IVA 13% para el Libro de Ventas. Misma fórmula
 * que `calcIvaCreditoFiscal` — el débito es simétrico al crédito. El
 * estadoSIN (A/V/C/L) no altera el cálculo de IVA (ortogonalidad
 * D-A1 lockeada).
 */
export function calcDebitoFiscal(
  baseImponible: MonetaryAmount,
): MonetaryAmount {
  return calcIvaCreditoFiscal(baseImponible);
}

/**
 * Pipeline IVA completo: subtotal → baseImponible → ivaAmount, retornando
 * `IvaCalcResult` VO con invariantes domain validados (baseImponible ≤
 * subtotal, ivaAmount ≤ baseImponible). Equivalente hex de legacy
 * `calcTotales`.
 */
export function computeIvaTotals(
  params: ComputeIvaTotalsParams,
): IvaCalcResult {
  const subtotal = calcSubtotal(params);
  const descuento = params.codigoDescuentoAdicional.plus(params.importeGiftCard);
  const baseImponible = calcBaseImponible(subtotal, descuento);
  const ivaAmount = calcIvaCreditoFiscal(baseImponible);
  return IvaCalcResult.of({ subtotal, baseImponible, ivaAmount });
}
