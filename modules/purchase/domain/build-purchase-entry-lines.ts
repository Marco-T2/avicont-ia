/**
 * Pure builder for purchase journal entries — mirrors legacy
 * `purchase.utils.ts:112-238` (fidelidad regla #1). Used by purchase-hex
 * `post` and `createAndPost` use cases (A2) to compose
 * `EntryLineTemplate[]` passed to `JournalEntryFactoryPort.generateForPurchase`.
 *
 * Two paths:
 *   - Sin IVA (or `ivaBook.dfCfIva === 0`): collapses by purchaseType.
 *     FLETE: 2 lines (debit fleteExpense + credit cxp).
 *     POLLO_FAENADO: 2 lines (debit polloFaenadoCOGS + credit cxp).
 *     COMPRA_GENERAL/SERVICIO: N debits per detail + 1 credit cxp.
 *   - Con IVA (Bolivia SIN convention, base ya contiene IVA): 3-4 lines.
 *     `dfCfIva = baseIvaSujetoCf × 0.13`. Línea de gasto = base − IVA.
 *     Si exentos > 0, 4ta línea de gasto residual.
 *     Invariante: `base + exentos = importeTotal` (tolerance 0.005 cuando exentos explícito).
 *
 * **Money math**: Decimal-internal arithmetic via `decimal.js` `Decimal` +
 * `roundHalfUp` from `modules/accounting/shared/domain/money.utils`.
 * `.toNumber()` at the `EntryLineTemplate.debit/credit: number` boundary
 * (SHAPE-A — number DTO preserved). R-money-tier2 discharged at
 * poc-tier2-money-decimal-convergence C2 GREEN (OLEADA 8 POC #1) — derivative
 * from R-money (OLEADA 7 archive #2452) per [[named_rule_immutability]].
 */

import Decimal from "decimal.js";
import { roundHalfUp } from "@/modules/accounting/shared/domain/money.utils";
import type { PurchaseType } from "./purchase.entity";

/** Código de cuenta Crédito Fiscal IVA (compras). Fijo Bolivia SIN. */
export const IVA_CREDITO_FISCAL = "1.1.8";

export interface EntryLineTemplate {
  accountCode: string;
  debit: number;
  credit: number;
  description?: string;
  contactId?: string;
}

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

export interface PurchaseOrgSettings {
  cxpAccountCode: string;
  fleteExpenseAccountCode: string;
  polloFaenadoCOGSAccountCode: string;
}

export interface PurchaseDetailForEntry {
  lineAmount: number;
  expenseAccountCode?: string | null;
  description?: string;
}

function resolveExpenseAccount(
  purchaseType: PurchaseType,
  details: PurchaseDetailForEntry[],
  settings: PurchaseOrgSettings,
): string {
  if (purchaseType === "FLETE") return settings.fleteExpenseAccountCode;
  if (purchaseType === "POLLO_FAENADO") return settings.polloFaenadoCOGSAccountCode;
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

  if (ivaBook !== undefined && ivaBook.dfCfIva > 0) {
    const { baseIvaSujetoCf, dfCfIva, importeTotal } = ivaBook;
    const expenseAccount = resolveExpenseAccount(purchaseType, details, settings);

    const exentosExplicit = ivaBook.exentos;
    const exentos =
      exentosExplicit !== undefined
        ? exentosExplicit
        : roundHalfUp(
            new Decimal(importeTotal).minus(baseIvaSujetoCf),
          ).toNumber();

    if (exentosExplicit !== undefined) {
      const residual = Math.abs(baseIvaSujetoCf + exentosExplicit - importeTotal);
      if (residual > 0.005) {
        throw new Error(
          `[buildPurchaseEntryLines] Invariante de balance violado: ` +
            `base(${baseIvaSujetoCf}) + exentos(${exentosExplicit}) = ` +
            `${baseIvaSujetoCf + exentosExplicit} ≠ importeTotal(${importeTotal}). ` +
            `Diferencia: ${residual.toFixed(4)}`,
        );
      }
    }

    const gastoNeto = roundHalfUp(
      new Decimal(baseIvaSujetoCf).minus(dfCfIva),
    ).toNumber();

    const lines: EntryLineTemplate[] = [
      { accountCode: expenseAccount, debit: gastoNeto, credit: 0 },
      { accountCode: IVA_CREDITO_FISCAL, debit: dfCfIva, credit: 0 },
    ];

    if (exentos > 0) {
      lines.push({ accountCode: expenseAccount, debit: exentos, credit: 0 });
    }

    lines.push({
      accountCode: cxpAccountCode,
      debit: 0,
      credit: importeTotal,
      contactId,
    });

    return lines;
  }

  if (purchaseType === "FLETE") {
    return [
      { accountCode: settings.fleteExpenseAccountCode, debit: totalAmount, credit: 0 },
      { accountCode: cxpAccountCode, debit: 0, credit: totalAmount, contactId },
    ];
  }

  if (purchaseType === "POLLO_FAENADO") {
    return [
      { accountCode: settings.polloFaenadoCOGSAccountCode, debit: totalAmount, credit: 0 },
      { accountCode: cxpAccountCode, debit: 0, credit: totalAmount, contactId },
    ];
  }

  const debitLines: EntryLineTemplate[] = details.map((d) => ({
    accountCode: d.expenseAccountCode!,
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
