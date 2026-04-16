// Forma mínima de OrgSettings usada por la contabilidad de ventas.
export interface SaleOrgSettings {
  cxcAccountCode: string;
  itExpenseAccountCode: string;
  itPayableAccountCode: string;
}

// ── Constantes de cuenta IVA — Plan de cuentas Bolivia SIN (V1) ──

/** Código de cuenta Débito Fiscal IVA (ventas). Fijo Bolivia SIN. */
export const IVA_DEBITO_FISCAL = "2.1.6";

// ── Interfaz de libro IVA reducida para uso en builders de asientos ──

/**
 * Datos del IvaSalesBook necesarios para generar las líneas IVA del asiento.
 * Todos los campos son `number` (no Prisma.Decimal) — la conversión ocurre
 * en la capa de servicio, manteniendo los builders como funciones puras.
 *
 * Convención SIN Bolivia (Form. 200): `baseIvaSujetoCf` es el "Importe Base"
 * que YA contiene el IVA conceptualmente. Por eso:
 *   - dfCfIva = baseIvaSujetoCf × 0.13 (alícuota nominal)
 *   - Línea de Ventas a registrar = baseIvaSujetoCf − dfCfIva (≈ × 0.87)
 *   - Invariante de balance: baseIvaSujetoCf + exentos = importeTotal
 */
export interface IvaBookForEntry {
  /** Importe Base SIAT (gravable que incluye IVA). */
  baseIvaSujetoCf: number;
  /** Débito Fiscal IVA = baseIvaSujetoCf × 0.13. */
  dfCfIva: number;
  /** Total factura (= totalAmount de la venta). */
  importeTotal: number;
  /** Importe exento/tasa-cero/no-sujeto residual. Opcional; default 0. */
  exentos?: number;
}

export function getDisplayCode(seq: number): string {
  return `VG-${String(seq).padStart(3, "0")}`;
}

// ── Plantilla de línea de asiento para la generación de comprobantes ──

export interface EntryLineTemplate {
  accountCode: string;
  debit: number;
  credit: number;
  description?: string;
  contactId?: string;
}

// ── Forma de detalle usada en buildSaleEntryLines ──

export interface SaleDetailForEntry {
  lineAmount: number;
  incomeAccountCode: string;
  description?: string;
}

// ── Construir líneas de asiento contable para una venta general ──
//
// Sin ivaBook (o ivaBook.dfCfIva === 0):
//   DÉBITO: settings.cxcAccountCode (CxC) por el total — lleva contactId
//   CRÉDITO: un CRÉDITO por línea de detalle usando detail.incomeAccountCode (4.1.x)
//
// Con ivaBook y dfCfIva > 0 (convención SIN Bolivia, alícuota nominal):
//   DÉBITO: CxC por importeTotal
//   CRÉDITO: incomeAccount (primer detalle) por (baseIvaSujetoCf − dfCfIva) ≈ 87%
//   CRÉDITO: IVA_DEBITO_FISCAL ("2.1.6") por dfCfIva (= base × 13%)
//   CRÉDITO: incomeAccount (primer detalle) por exentos residuales — si exentos > 0
//   DÉBITO: settings.itExpenseAccountCode por importeTotal × 3% (IT)
//   CRÉDITO: settings.itPayableAccountCode por importeTotal × 3% (IT)
//
// Invariante: baseIvaSujetoCf + exentos = importeTotal (el IVA ya está dentro de la base).
// Espejo inverso de buildPurchaseEntryLines para COMPRA_GENERAL.

export function buildSaleEntryLines(
  totalAmount: number,
  details: SaleDetailForEntry[],
  settings: SaleOrgSettings,
  contactId: string,
  ivaBook?: IvaBookForEntry,
): EntryLineTemplate[] {
  // ── Path con IVA activo ──
  if (ivaBook !== undefined && ivaBook.dfCfIva > 0) {
    const { baseIvaSujetoCf, dfCfIva, importeTotal } = ivaBook;
    const primaryAccount = details[0]?.incomeAccountCode ?? "4.1.1";

    // Exento residual: importeTotal − baseIvaSujetoCf (el IVA ya está dentro de la base)
    const exentosExplicit = ivaBook.exentos;
    const exentos =
      exentosExplicit !== undefined
        ? exentosExplicit
        : Math.round((importeTotal - baseIvaSujetoCf) * 100) / 100;

    // Invariante de balance (nueva semántica): base + exentos = importeTotal
    if (exentosExplicit !== undefined) {
      const residual = Math.abs(baseIvaSujetoCf + exentosExplicit - importeTotal);
      if (residual > 0.005) {
        throw new Error(
          `[buildSaleEntryLines] Invariante de balance violado: ` +
          `base(${baseIvaSujetoCf}) + exentos(${exentosExplicit}) = ` +
          `${baseIvaSujetoCf + exentosExplicit} ≠ importeTotal(${importeTotal}). ` +
          `Diferencia: ${residual.toFixed(4)}`
        );
      }
    }

    // Ingreso neto = base − IVA (preserva balance ante redondeos)
    const ingresoNeto = Math.round((baseIvaSujetoCf - dfCfIva) * 100) / 100;

    // DÉBITO: CxC por el total
    const debitLine: EntryLineTemplate = {
      accountCode: settings.cxcAccountCode,
      debit: importeTotal,
      credit: 0,
      contactId,
    };

    // CRÉDITO: Ventas (ingreso neto, ≈ 87% de la base)
    const baseCreditLine: EntryLineTemplate = {
      accountCode: primaryAccount,
      debit: 0,
      credit: ingresoNeto,
    };

    // CRÉDITO: IVA Débito Fiscal (13% de la base)
    const ivaLine: EntryLineTemplate = {
      accountCode: IVA_DEBITO_FISCAL,
      debit: 0,
      credit: dfCfIva,
    };

    // IT 3% sobre el total facturado (Art. 74 Ley 843)
    const itAmount = Math.round(importeTotal * 0.03 * 100) / 100;

    const lines: EntryLineTemplate[] = [debitLine, baseCreditLine, ivaLine];

    // CRÉDITO: exentos residuales (línea opcional)
    if (exentos > 0) {
      lines.push({
        accountCode: primaryAccount,
        debit: 0,
        credit: exentos,
      });
    }

    if (itAmount > 0) {
      lines.push({
        accountCode: settings.itExpenseAccountCode,
        debit: itAmount,
        credit: 0,
      });
      lines.push({
        accountCode: settings.itPayableAccountCode,
        debit: 0,
        credit: itAmount,
      });
    }

    return lines;
  }

  // ── Path sin IVA (comportamiento original — cero regresión) ──

  // DÉBITO: CxC por el total con contactId
  const debitLine: EntryLineTemplate = {
    accountCode: settings.cxcAccountCode,
    debit: totalAmount,
    credit: 0,
    contactId,
  };

  // CRÉDITO: una línea por cada detalle con su cuenta de ingreso
  const creditLines: EntryLineTemplate[] = details.map((d) => ({
    accountCode: d.incomeAccountCode,
    debit: 0,
    credit: d.lineAmount,
    description: d.description,
  }));

  return [debitLine, ...creditLines];
}
