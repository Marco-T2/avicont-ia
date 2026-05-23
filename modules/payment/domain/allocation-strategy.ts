import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

/**
 * REQ-PAY-6 — AllocationStrategy domain (pure, DEC-1).
 *
 * Distributes a cash budget across invoice lines. The domain owns the rule so
 * the form (Phase 7) consumes it as a preview instead of re-implementing FIFO
 * inline with float-cents arithmetic (the legacy payment-form.tsx:609-631 used
 * raw `Math.min` over floats — forbidden by DEC-1). All money math here goes
 * through `MonetaryAmount` (decimal.js under the hood); the contract surfaces
 * plain `number` at the boundary (sister convention: PaymentGlosaInput consumes
 * already-converted numbers).
 *
 * Two implementations:
 *   - FifoStrategy: oldest `dueDate` first; tie-break by `id` ascending
 *     (stable). Each line is capped at its `saldo`; the budget is consumed in
 *     order until exhausted.
 *   - ManualStrategy: pass-through — returns each line's pre-set `applied`
 *     amount unchanged (the budget is ignored). Used after a user overrides a
 *     FIFO-filled line (Scenario O).
 *
 * Cross-ref:
 *   - sdd/pagos-cobros-fifo/spec — REQ-PAY-6 (Scenario N, Scenario O)
 *   - sdd/pagos-cobros-fifo/design §5 (FifoStrategy + ManualStrategy)
 */

export interface AllocationLine {
  id: string;
  dueDate: Date;
  saldo: number;
  /** Pre-set amount, consumed by ManualStrategy (ignored by FifoStrategy). */
  applied?: number;
}

export interface AllocationResult {
  id: string;
  applied: number;
}

export interface AllocationStrategy {
  distribute(budget: number, lines: AllocationLine[]): AllocationResult[];
}

/**
 * Returns the smaller of two MonetaryAmounts (no `min` on the VO).
 */
function minAmount(a: MonetaryAmount, b: MonetaryAmount): MonetaryAmount {
  return a.isLessThan(b) ? a : b;
}

export class FifoStrategy implements AllocationStrategy {
  distribute(budget: number, lines: AllocationLine[]): AllocationResult[] {
    const ordered = [...lines].sort((a, b) => {
      const dateDiff = a.dueDate.getTime() - b.dueDate.getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

    let remaining = MonetaryAmount.of(budget);

    return ordered.map((line) => {
      const saldo = MonetaryAmount.of(line.saldo);
      const applied = minAmount(saldo, remaining);
      remaining = remaining.minus(applied);
      return { id: line.id, applied: applied.value };
    });
  }
}

export class ManualStrategy implements AllocationStrategy {
  distribute(_budget: number, lines: AllocationLine[]): AllocationResult[] {
    return lines.map((line) => ({
      id: line.id,
      // Normalize through MonetaryAmount so the pass-through value is rounded to
      // the same 2-decimal precision the FIFO path produces (DEC-1 consistency).
      applied: MonetaryAmount.of(line.applied ?? 0).value,
    }));
  }
}
