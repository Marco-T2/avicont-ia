import type { PaymentMethod } from "../../domain/value-objects/payment-method";
import { isBankTransfer } from "../../domain/value-objects/payment-method";
import type { JournalEntryLineDraft } from "../../domain/ports/accounting.port";

/**
 * Treasury rule: build the journal-entry line shape for a payment based on
 * direction and method. Mirror of `buildEntryLines` (features/payment/payment.service.ts:1355).
 *
 * Cobro (COBRO) — incoming cash from a customer:
 *   - cash/cheque (2 lines): DEBIT caja/banco, CREDIT cxc(contactId)
 *   - bank transfer (4 lines): DEBIT caja, CREDIT cxc(contactId), DEBIT banco, CREDIT caja
 *
 * Pago (PAGO) — outgoing cash to a supplier:
 *   - cash/cheque (2 lines): DEBIT cxp(contactId), CREDIT caja/banco
 *   - bank transfer (4 lines): DEBIT cxp(contactId), CREDIT caja, DEBIT caja, CREDIT banco
 */
export interface BuildEntryLinesParams {
  isCollection: boolean;
  method: PaymentMethod;
  amount: number;
  cajaAccountCode: string;
  bancoAccountCode: string;
  cxcAccountCode: string;
  cxpAccountCode: string;
  contactId: string;
  selectedAccountCode?: string;
}

export function buildEntryLines(
  params: BuildEntryLinesParams,
): JournalEntryLineDraft[] {
  const {
    isCollection,
    method,
    amount,
    cajaAccountCode,
    bancoAccountCode,
    cxcAccountCode,
    cxpAccountCode,
    contactId,
    selectedAccountCode,
  } = params;

  const isBank = isBankTransfer(method);

  if (isCollection) {
    if (isBank) {
      return [
        { accountCode: cajaAccountCode, side: "DEBIT", amount },
        { accountCode: cxcAccountCode, side: "CREDIT", amount, contactId },
        {
          accountCode: selectedAccountCode ?? bancoAccountCode,
          side: "DEBIT",
          amount,
        },
        { accountCode: cajaAccountCode, side: "CREDIT", amount },
      ];
    }
    return [
      {
        accountCode: selectedAccountCode ?? cajaAccountCode,
        side: "DEBIT",
        amount,
      },
      { accountCode: cxcAccountCode, side: "CREDIT", amount, contactId },
    ];
  }

  // PAGO
  if (isBank) {
    return [
      { accountCode: cxpAccountCode, side: "DEBIT", amount, contactId },
      { accountCode: cajaAccountCode, side: "CREDIT", amount },
      { accountCode: cajaAccountCode, side: "DEBIT", amount },
      {
        accountCode: selectedAccountCode ?? bancoAccountCode,
        side: "CREDIT",
        amount,
      },
    ];
  }

  return [
    { accountCode: cxpAccountCode, side: "DEBIT", amount, contactId },
    {
      accountCode: selectedAccountCode ?? cajaAccountCode,
      side: "CREDIT",
      amount,
    },
  ];
}
