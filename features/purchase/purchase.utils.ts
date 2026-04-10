import type { PurchaseType } from "@/generated/prisma/client";

// Forma mínima de OrgSettings usada por la contabilidad de compras.
// Incluye los nuevos campos agregados en la migración add_purchase_module.
export interface PurchaseOrgSettings {
  cxpAccountCode: string;
  fleteExpenseAccountCode: string;
  polloFaenadoCOGSAccountCode: string;
}

const TYPE_PREFIXES: Record<PurchaseType, string> = {
  FLETE: "FL",
  POLLO_FAENADO: "PF",
  COMPRA_GENERAL: "CG",
  SERVICIO: "SV",
};

export function getDisplayCode(type: PurchaseType, seq: number): string {
  return `${TYPE_PREFIXES[type]}-${String(seq).padStart(3, "0")}`;
}

// ── Plantilla de línea de asiento para la generación de comprobantes ──

export interface EntryLineTemplate {
  accountCode: string;
  debit: number;
  credit: number;
  description?: string;
  contactId?: string;
}

// ── Forma de detalle usada en buildPurchaseEntryLines ──

export interface PurchaseDetailForEntry {
  lineAmount: number;
  expenseAccountCode?: string | null; // código pre-resuelto para COMPRA_GENERAL/SERVICIO
  description?: string;
}

// ── Construir líneas de asiento contable para una compra ──
//
// FLETE:           DÉBITO settings.fleteExpenseAccountCode  |  CRÉDITO settings.cxpAccountCode
// POLLO_FAENADO:   DÉBITO settings.polloFaenadoCOGSAccountCode  |  CRÉDITO settings.cxpAccountCode
// COMPRA_GENERAL:  un DÉBITO por línea de detalle usando detail.expenseAccountCode  |  CRÉDITO settings.cxpAccountCode
// SERVICIO:        un DÉBITO por línea de detalle usando detail.expenseAccountCode  |  CRÉDITO settings.cxpAccountCode
//
// Todas las líneas CRÉDITO reciben contactId (CxP lo requiere).

export function buildPurchaseEntryLines(
  purchaseType: PurchaseType,
  totalAmount: number,
  details: PurchaseDetailForEntry[],
  settings: PurchaseOrgSettings,
  contactId: string,
): EntryLineTemplate[] {
  const cxpAccountCode = settings.cxpAccountCode;

  if (purchaseType === "FLETE") {
    return [
      {
        accountCode: settings.fleteExpenseAccountCode,
        debit: totalAmount,
        credit: 0,
      },
      {
        accountCode: cxpAccountCode,
        debit: 0,
        credit: totalAmount,
        contactId,
      },
    ];
  }

  if (purchaseType === "POLLO_FAENADO") {
    return [
      {
        accountCode: settings.polloFaenadoCOGSAccountCode,
        debit: totalAmount,
        credit: 0,
      },
      {
        accountCode: cxpAccountCode,
        debit: 0,
        credit: totalAmount,
        contactId,
      },
    ];
  }

  // COMPRA_GENERAL o SERVICIO — un DÉBITO por línea de detalle
  const debitLines: EntryLineTemplate[] = details.map((d) => ({
    accountCode: d.expenseAccountCode!, // el llamador debe garantizar que esté definido
    debit: d.lineAmount,
    credit: 0,
    description: d.description,
  }));

  const creditLine: EntryLineTemplate = {
    accountCode: cxpAccountCode,
    debit: 0,
    credit: totalAmount,
    contactId,
  };

  return [...debitLines, creditLine];
}
