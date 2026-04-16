import type { PurchaseType } from "@/generated/prisma/client";

// ── Constantes de cuenta IVA — Plan de cuentas Bolivia SIN (V1) ──

/** Código de cuenta Crédito Fiscal IVA (compras). Fijo Bolivia SIN. */
export const IVA_CREDITO_FISCAL = "1.1.8";

// ── Interfaz de libro IVA reducida para uso en builders de asientos ──

/**
 * Datos del IvaPurchaseBook necesarios para generar las líneas IVA del asiento.
 * Todos los campos son `number` (no Prisma.Decimal) — la conversión ocurre
 * en la capa de servicio, manteniendo los builders como funciones puras.
 *
 * Convención SIN Bolivia (Form. 200): `baseIvaSujetoCf` es el "Importe Base"
 * que YA contiene el IVA conceptualmente. Por eso:
 *   - dfCfIva = baseIvaSujetoCf × 0.13 (alícuota nominal)
 *   - Línea de Gasto a registrar = baseIvaSujetoCf − dfCfIva (≈ × 0.87)
 *   - Invariante de balance: baseIvaSujetoCf + exentos = importeTotal
 */
export interface IvaBookForEntry {
  /** Importe Base SIAT (gravable que incluye IVA). */
  baseIvaSujetoCf: number;
  /** Crédito Fiscal IVA = baseIvaSujetoCf × 0.13. */
  dfCfIva: number;
  /** Total factura (= totalAmount de la compra). */
  importeTotal: number;
  /** Importe exento/tasa-cero/no-sujeto residual. Opcional; default 0. */
  exentos?: number;
}

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
// Paths de ejecución:
//
// 1. Sin ivaBook (o ivaBook ausente):
//    FLETE:           DÉBITO settings.fleteExpenseAccountCode  |  CRÉDITO settings.cxpAccountCode
//    POLLO_FAENADO:   DÉBITO settings.polloFaenadoCOGSAccountCode  |  CRÉDITO settings.cxpAccountCode
//    COMPRA_GENERAL:  un DÉBITO por línea de detalle usando detail.expenseAccountCode  |  CRÉDITO settings.cxpAccountCode
//    SERVICIO:        un DÉBITO por línea de detalle usando detail.expenseAccountCode  |  CRÉDITO settings.cxpAccountCode
//
// 2. Con ivaBook y dfCfIva > 0 (SPEC-2, SPEC-8):
//    Todos los tipos colapsan a 3 líneas (+ 4ta opcional de exento):
//    DÉBITO: tipo-specific expense account  por baseIvaSujetoCf
//    DÉBITO: IVA_CREDITO_FISCAL ("1.1.8")   por dfCfIva
//    DÉBITO: mismo expense account           por exentos residuales — si exentos > 0
//    CRÉDITO: cxpAccountCode                por importeTotal
//
//    Para FLETE/POLLO_FAENADO se usa el account fijo del tipo.
//    Para COMPRA_GENERAL/SERVICIO se usa el account del primer detalle (collapse multi-detalle).
//    El campo ivaBook.exentos es opcional: cuando ausente se auto-computa como residual;
//    cuando explícito, se verifica la invariante de balance (throw si diferencia > 0.005).
//
// 3. Con ivaBook y dfCfIva === 0 (compra 100% exenta):
//    Cae al path original sin IVA (sin línea 1.1.8).
//
// Todas las líneas CRÉDITO CxP reciben contactId.

/**
 * Resuelve la cuenta de gasto de la línea base según el tipo de compra.
 * Para FLETE/POLLO_FAENADO se usa el código fijo del settings.
 * Para COMPRA_GENERAL/SERVICIO se usa el expenseAccountCode del primer detalle.
 */
function resolveExpenseAccount(
  purchaseType: PurchaseType,
  details: PurchaseDetailForEntry[],
  settings: PurchaseOrgSettings,
): string {
  if (purchaseType === "FLETE") return settings.fleteExpenseAccountCode;
  if (purchaseType === "POLLO_FAENADO") return settings.polloFaenadoCOGSAccountCode;
  // COMPRA_GENERAL o SERVICIO: primer detalle
  return details[0]?.expenseAccountCode ?? "5.1.1";
}

export function buildPurchaseEntryLines(
  purchaseType: PurchaseType,
  totalAmount: number,
  details: PurchaseDetailForEntry[],
  settings: PurchaseOrgSettings,
  contactId: string,
  ivaBook?: IvaBookForEntry,
): EntryLineTemplate[] {
  const cxpAccountCode = settings.cxpAccountCode;

  // ── Path con IVA activo (convención SIN Bolivia, alícuota nominal) ──
  if (ivaBook !== undefined && ivaBook.dfCfIva > 0) {
    const { baseIvaSujetoCf, dfCfIva, importeTotal } = ivaBook;
    const expenseAccount = resolveExpenseAccount(purchaseType, details, settings);

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
          `[buildPurchaseEntryLines] Invariante de balance violado: ` +
          `base(${baseIvaSujetoCf}) + exentos(${exentosExplicit}) = ` +
          `${baseIvaSujetoCf + exentosExplicit} ≠ importeTotal(${importeTotal}). ` +
          `Diferencia: ${residual.toFixed(4)}`
        );
      }
    }

    // Gasto neto = base − IVA (preserva balance ante redondeos)
    const gastoNeto = Math.round((baseIvaSujetoCf - dfCfIva) * 100) / 100;

    // DÉBITO: Gasto neto (≈ 87% de la base)
    const baseDebitLine: EntryLineTemplate = {
      accountCode: expenseAccount,
      debit: gastoNeto,
      credit: 0,
    };

    // DÉBITO: IVA Crédito Fiscal (13% de la base)
    const ivaLine: EntryLineTemplate = {
      accountCode: IVA_CREDITO_FISCAL,
      debit: dfCfIva,
      credit: 0,
    };

    // CRÉDITO: CxP por el total
    const creditLine: EntryLineTemplate = {
      accountCode: cxpAccountCode,
      debit: 0,
      credit: importeTotal,
      contactId,
    };

    const lines: EntryLineTemplate[] = [baseDebitLine, ivaLine];

    // DÉBITO: exentos residuales (línea opcional — mismo account de gasto)
    if (exentos > 0) {
      lines.push({
        accountCode: expenseAccount,
        debit: exentos,
        credit: 0,
      });
    }

    lines.push(creditLine);

    return lines;
  }

  // ── Path sin IVA (comportamiento original — cero regresión) ──

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
