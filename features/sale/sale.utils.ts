// Forma mínima de OrgSettings usada por la contabilidad de ventas.
export interface SaleOrgSettings {
  cxcAccountCode: string;
}

// ── Constantes de cuenta IVA — Plan de cuentas Bolivia SIN (V1) ──

/** Código de cuenta Débito Fiscal IVA (ventas). Fijo Bolivia SIN. */
export const IVA_DEBITO_FISCAL = "2.1.6";

// ── Interfaz de libro IVA reducida para uso en builders de asientos ──

/**
 * Datos del IvaSalesBook necesarios para generar las líneas IVA del asiento.
 * Todos los campos son `number` (no Prisma.Decimal) — la conversión ocurre
 * en la capa de servicio, manteniendo los builders como funciones puras.
 */
export interface IvaBookForEntry {
  /** Base imponible (subtotal sujeto a IVA). */
  baseIvaSujetoCf: number;
  /** Débito/Crédito Fiscal IVA (13% sobre baseIvaSujetoCf). */
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
// Con ivaBook y dfCfIva > 0 (SPEC-1, SPEC-4, SPEC-8):
//   DÉBITO: CxC por importeTotal
//   CRÉDITO: incomeAccount (primer detalle) por baseIvaSujetoCf
//   CRÉDITO: IVA_DEBITO_FISCAL ("2.1.6") por dfCfIva
//   CRÉDITO: incomeAccount (primer detalle) por exentos residuales — si exentos > 0
//
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

    // Calcular exento residual: lo que no es base gravable ni IVA
    const exentosExplicit = ivaBook.exentos;
    const exentos =
      exentosExplicit !== undefined
        ? exentosExplicit
        : Math.round((importeTotal - baseIvaSujetoCf - dfCfIva) * 100) / 100;

    // Invariante de balance: cuando exentos son explícitos, verificar que cuadren
    if (exentosExplicit !== undefined) {
      const residual = Math.abs(baseIvaSujetoCf + dfCfIva + exentosExplicit - importeTotal);
      if (residual > 0.005) {
        throw new Error(
          `[buildSaleEntryLines] Invariante de balance violado: ` +
          `base(${baseIvaSujetoCf}) + IVA(${dfCfIva}) + exentos(${exentosExplicit}) = ` +
          `${baseIvaSujetoCf + dfCfIva + exentosExplicit} ≠ importeTotal(${importeTotal}). ` +
          `Diferencia: ${residual.toFixed(4)}`
        );
      }
    }

    // DÉBITO: CxC por el total
    const debitLine: EntryLineTemplate = {
      accountCode: settings.cxcAccountCode,
      debit: importeTotal,
      credit: 0,
      contactId,
    };

    // CRÉDITO: Ventas base gravable (un solo renglón — collapse multi-detail)
    const baseCreditLine: EntryLineTemplate = {
      accountCode: primaryAccount,
      debit: 0,
      credit: baseIvaSujetoCf,
    };

    // CRÉDITO: IVA Débito Fiscal
    const ivaLine: EntryLineTemplate = {
      accountCode: IVA_DEBITO_FISCAL,
      debit: 0,
      credit: dfCfIva,
    };

    const lines: EntryLineTemplate[] = [debitLine, baseCreditLine, ivaLine];

    // CRÉDITO: exentos residuales (4ta línea opcional)
    if (exentos > 0) {
      lines.push({
        accountCode: primaryAccount,
        debit: 0,
        credit: exentos,
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
