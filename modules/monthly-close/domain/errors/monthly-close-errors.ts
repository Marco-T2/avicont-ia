import {
  ConflictError,
  ValidationError,
  PERIOD_ALREADY_CLOSED,
  PERIOD_UNBALANCED,
} from "@/features/shared/errors";
import type { Money } from "@/modules/shared/domain/value-objects/money";

/**
 * Domain-typed Error classes monthly-close — single bundle file convention
 * 14ª evidencia cumulative cross-module precedent EXACT (mirror sale/payment/
 * iva-books/fiscal-periods/accounting/purchase/payables/receivables/voucher-
 * types/contacts/org-settings/mortality/shared single bundle `<module>-errors.ts`
 * 13:0 cumulative supersede absoluto, NO `index.ts` barrel NO per-class
 * separate files).
 *
 * Wrap códigos `@/features/shared/errors` constants — preservar legacy parity
 * wire codes consumers see SAME (legacy `features/monthly-close/monthly-close.service.ts:147`
 * + `:194` patterns EXACT).
 */

export class PeriodAlreadyClosedError extends ConflictError {
  constructor() {
    super("El período fiscal", PERIOD_ALREADY_CLOSED);
  }
}

export class BalanceNotZeroError extends ValidationError {
  constructor(
    public readonly debit: Money,
    public readonly credit: Money,
  ) {
    const diff = Math.abs(debit.signedDiff(credit));
    super(
      `El período no balancea: DEBE = ${debit.toString()} / HABER = ${credit.toString()} (diferencia ${diff.toFixed(2)})`,
      PERIOD_UNBALANCED,
      {
        debit: debit.toString(),
        credit: credit.toString(),
        diff: diff.toFixed(2),
      },
    );
  }
}
