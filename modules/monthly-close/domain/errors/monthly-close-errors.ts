import {
  ConflictError,
  ValidationError,
  PERIOD_ALREADY_CLOSED,
  PERIOD_HAS_DRAFT_ENTRIES,
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

/**
 * 15ª evidencia single bundle errors file matures cumulative cross-module —
 * wrap PERIOD_HAS_DRAFT_ENTRIES legacy parity
 * `features/monthly-close/monthly-close.service.ts:166-176` 5 readonly fields
 * cross-entity counts mirror BalanceNotZeroError shape EXACT (readonly fields
 * + super(message, code, details)).
 */
export class DraftEntriesPresentError extends ValidationError {
  constructor(
    public readonly dispatches: number,
    public readonly payments: number,
    public readonly journalEntries: number,
    public readonly sales: number,
    public readonly purchases: number,
  ) {
    const parts: string[] = [];
    if (dispatches > 0) parts.push(`${dispatches} despacho(s)`);
    if (payments > 0) parts.push(`${payments} pago(s)`);
    if (journalEntries > 0)
      parts.push(`${journalEntries} asiento(s) de diario`);
    if (sales > 0) parts.push(`${sales} venta(s)`);
    if (purchases > 0) parts.push(`${purchases} compra(s)`);
    super(
      `El periodo tiene registros en borrador: ${parts.join(", ")}. Debe publicarlos o eliminarlos antes de cerrar`,
      PERIOD_HAS_DRAFT_ENTRIES,
      {
        dispatches,
        payments,
        journalEntries,
        sales,
        purchases,
      },
    );
  }
}
