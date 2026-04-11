// Forma mínima de OrgSettings usada por la contabilidad de ventas.
export interface SaleOrgSettings {
  cxcAccountCode: string;
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
// DÉBITO: settings.cxcAccountCode (CxC) por el total — lleva contactId
// CRÉDITO: un CRÉDITO por línea de detalle usando detail.incomeAccountCode (4.1.x)
//
// Espejo inverso de buildPurchaseEntryLines para COMPRA_GENERAL.

export function buildSaleEntryLines(
  totalAmount: number,
  details: SaleDetailForEntry[],
  settings: SaleOrgSettings,
  contactId: string,
): EntryLineTemplate[] {
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
